// Screen saver (lazy/screensaver.js, started by main.js after a spell without input). The idle watcher runs on
// setTimeout and the savers on animation frames, so these tests drive time with Playwright's clock rather than wait.
// The clock goes in once the page has loaded: the timer armed at boot stays a real one-minute timer that never fires
// during a test, and the next input arms a fake one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { env, useBrowser, open, needs, shot, win, path, desktop, seed } from './lib.mjs';

useBrowser();

// a visitor's own deskbar:saver (minutes) overrides the site's
const oneMinute = seed({ saver: 1 });
const idle = page => page.clock.fastForward(61_000);
const saver = page => page.locator('.saver');
// the shell's own list of loaded bundles, as the clock replaces performance and so hides Resource Timing
const loaded = (page, name = 'screensaver') => page.evaluate(n => window.deskbar.loaded().includes(n), name);
let idx = null;
const index = async () => (idx ||= await (await fetch(env.base + '/deskbar.json')).json());

// Everything a visitor could see change: address, title, focus, every window's place, stacking and scroll
const state = page => page.evaluate(() => ({
  url: location.href, title: document.title, theme: document.documentElement.dataset.theme || '',
  focus: document.activeElement?.outerHTML.slice(0, 160),
  wins: [...document.querySelectorAll('.win')].map(w => [w.getAttribute('style'), w.className, w.hidden, w.getAttribute('aria-label')]),
  scroll: [...document.querySelectorAll('.win *')].filter(e => e.scrollTop).map(e => e.scrollTop),
  popovers: document.querySelectorAll(':popover-open').length,
}));

test('the screen saver starts after the idle time and any input takes it away, leaving things as they were', async t => {
  if (!(await needs(t, '/links/'))) return;
  // a folder window, since a post or page on screen keeps the saver away
  const page = await open(desktop, '/links/', oneMinute);
  await page.locator('.win:not([hidden])').first().waitFor();
  await page.clock.install();
  const posts = page.locator('#icons a').first();
  const box = await posts.boundingBox();
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  const before = await state(page);

  await idle(page);
  await saver(page).waitFor();
  await page.waitForFunction(() => document.querySelector('.saver')?.classList.contains('on'));
  assert.equal(await saver(page).getAttribute('aria-hidden'), 'true');
  // a small nudge, like a desk being bumped, is not enough
  await page.mouse.move(x + 4, y + 3);
  await page.mouse.move(x, y);
  assert.equal(await saver(page).count(), 1);
  // a press on an icon wakes the desktop without opening what lay underneath
  await page.mouse.down();
  await page.mouse.up();
  await saver(page).waitFor({ state: 'detached' });
  await page.clock.runFor(300);
  assert.deepEqual(await state(page), before);

  // and it comes back after another quiet spell; a key takes it away and does nothing else
  await idle(page);
  await saver(page).waitFor();
  await page.keyboard.press('Enter');
  await saver(page).waitFor({ state: 'detached' });
  assert.deepEqual(await state(page), before);

  // over the page's window, a whole wheel flick and a right-click are swallowed, not just their first event
  const view = await page.locator('.win:not([hidden]) .view').first().boundingBox();
  const vx = view.x + view.width / 2, vy = view.y + view.height / 2;
  await page.mouse.move(vx, vy);
  await idle(page);
  await saver(page).waitFor();
  for (let i = 0; i < 6; i++) await page.mouse.wheel(0, 120);
  await page.mouse.click(vx, vy, { button: 'right' });
  await saver(page).waitFor({ state: 'detached' });
  await page.clock.runFor(300);
  assert.deepEqual(await state(page), before);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('a post or page on screen keeps the screen saver away, and a minimised one does not', async t => {
  if (!(await needs(t, '/about/'))) return;
  const { posts } = await index();
  // a post as the first page, so the reader is there before the idle timer could fire
  const page = await open(desktop, posts[0].url, oneMinute);
  const reader = win(page, 'reader');
  await reader.locator('.rd h1').waitFor();
  await page.clock.install();
  await page.mouse.move(700, 450);
  await idle(page);
  // real time for a wrongly started import to arrive, as the fake clock moves timers but not the network
  await page.waitForTimeout(300);
  assert.equal(await saver(page).count(), 0);
  assert.equal(await loaded(page), false, 'nothing is even loaded');

  await reader.locator('.tab.on .ctl.min').click();
  await idle(page);
  await saver(page).waitFor();
  await page.keyboard.press('Escape');
  await saver(page).waitFor({ state: 'detached' });

  // a page window counts too. The saver's bundle is loaded by now, so a saver would be up as soon as the time passed.
  await page.evaluate(() => window.deskbar.go('/about/'));
  await page.locator('.win:not([hidden]) .view.reader[data-key="page:/about/"]').waitFor();
  await page.mouse.move(600, 400);
  await idle(page);
  assert.equal(await saver(page).count(), 0);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('the menu entry starts the screen saver without opening its page', async t => {
  if (!(await needs(t, '/screensaver/'))) return;
  const page = await open(desktop, '/');
  const entry = page.locator('#menu .mn-sec a[href$="/screensaver/"]').first();
  if (!(await entry.count())) return t.skip('no Screen saver menu entry on this site');
  const wins = await page.locator('.win:not([hidden])').count();
  await page.locator('#menuBtn').click();
  await page.locator('#menu .mn-cats button', { hasText: await entry.evaluate(a => a.closest('.mn-sec').dataset.group) }).click();
  await entry.click();
  await saver(page).waitFor();
  assert.equal(path(page), '/');
  assert.equal(await page.locator('#menu:popover-open').count(), 0, 'the menu closed');
  await page.keyboard.press('Escape');
  await saver(page).waitFor({ state: 'detached' });
  assert.equal(await page.locator('.win:not([hidden])').count(), wins, 'no window opened for the page');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('the screen saver moves on a desktop that allows motion, and the terminal starts it on request', async t => {
  if (!(await needs(t, '/terminal/'))) return;
  const page = await open(desktop, '/terminal/', undefined, { reducedMotion: 'no-preference' });
  await page.clock.install();
  const input = win(page, 'terminal').locator('.term-in');
  await input.fill('screensaver leaves');
  await input.press('Enter');
  await saver(page).waitFor();
  await page.clock.runFor(1500);
  const a = await saver(page).locator('canvas').screenshot();
  await page.clock.runFor(400);
  const b = await saver(page).locator('canvas').screenshot();
  assert.ok(!a.equals(b), 'leaves fall');
  await shot(page, 'screensaver');
  await page.mouse.move(100, 100);
  await page.mouse.move(400, 300, { steps: 3 });
  await saver(page).waitFor({ state: 'detached' });
  assert.ok(await input.evaluate(el => el === document.activeElement), 'focus is still in the terminal');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

// The sheep saver (lazy/sheep.js), chosen in the Control panel's System pane (deskbar:saverKind)
const canvasShot = page => saver(page).locator('canvas').screenshot();

test('Sheep: the default in the Control panel, the Test button and the idle watcher run it, over the dimmed desktop', async t => {
  if (!(await needs(t, '/control-panel/'))) return;
  const page = await open(desktop, '/control-panel/?pane=system', oneMinute, { reducedMotion: 'no-preference' });
  const cp = win(page, 'control-panel');
  await cp.locator('.cp').waitFor();
  await page.clock.install();
  assert.equal(await cp.locator('input[name="cp-saverKind"]:checked').getAttribute('value'), 'sheep', 'sheep by default');
  assert.equal(await loaded(page, 'sheep'), false, 'no sheep until asked for');
  // Leaves is kept once picked; Sheep, the default, stores nothing
  await cp.locator('input[name="cp-saverKind"][value="leaves"]').check();
  assert.equal(await page.evaluate(() => localStorage.getItem('deskbar:saverKind')), '"leaves"');
  await cp.locator('input[name="cp-saverKind"][value="sheep"]').check();
  assert.equal(await page.evaluate(() => localStorage.getItem('deskbar:saverKind')), null);

  await cp.getByRole('button', { name: 'Test screen saver' }).click();
  await page.locator('.saver[data-kind="sheep"]').waitFor();
  await page.waitForFunction(() => document.querySelector('.saver')?.classList.contains('on'));
  // the desktop shows through, dimmed
  const bg = await saver(page).evaluate(el => getComputedStyle(el).backgroundColor);
  assert.match(bg, /^rgba\(.*, 0\.6\)$/, bg);
  // the Control panel window's tab is a ledge to stand on
  const tab = await cp.locator('.tab.on').boundingBox();
  const ledges = await page.evaluate(() => window.deskbar.loadLazy('sheep').then(m => m.ledges()));
  assert.ok(ledges.some(l => Math.abs(l.y - tab.y) < 1 && l.x1 <= tab.x + 1 && l.x2 >= tab.x + tab.width - 1), 'the tab top');
  assert.ok(ledges.some(l => l.y === 900), 'and the bottom of the screen');
  // they move (a sheep can stand still for up to 3s, so a few looks over longer than that)
  const looks = new Set();
  for (let i = 0; i < 4; i++) {
    await page.clock.runFor(1200);
    looks.add((await canvasShot(page)).toString('base64'));
  }
  assert.ok(looks.size > 1, 'sheep wander');
  await shot(page, 'screensaver-sheep');
  await page.mouse.move(100, 100);
  await page.mouse.move(400, 300, { steps: 3 });
  await saver(page).waitFor({ state: 'detached' });

  // the idle watcher runs the choice too
  await page.mouse.move(420, 320);
  await idle(page);
  await page.locator('.saver[data-kind="sheep"]').waitFor();
  await page.keyboard.press('Escape');
  await saver(page).waitFor({ state: 'detached' });
  assert.equal(await cp.locator('.cp-pane:not([hidden])').getAttribute('id'), 'cp-system', 'nothing changed underneath');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('Sheep with reduced motion is a still frame of crisp sprites, whose sheet loads only once it starts', async () => {
  const page = await open(desktop, '/');
  const sheet = () => page.evaluate(() => performance.getEntriesByType('resource').some(e => e.name.includes('/vendor/esheep/gsheep-purple.png')));
  assert.equal(await sheet(), false, 'no sprites until the saver starts');
  await page.evaluate(() => window.deskbar.loadLazy('screensaver').then(m => m.start()));
  await page.locator('.saver[data-kind="sheep"]').waitFor();
  // the colours the canvas holds, once the sheet has loaded and sheep are drawn
  const colours = () => saver(page).locator('canvas').evaluate(c => {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, seen = new Set();
    for (let i = 0; i < d.length; i += 4) if (d[i + 3]) seen.add(d.slice(i, i + 4).join());
    return [...seen];
  });
  await page.waitForFunction(() => {
    const c = document.querySelector('.saver canvas');
    return c?.getContext('2d').getImageData(0, 0, c.width, c.height).data.some((v, i) => i % 4 === 3 && v);
  });
  assert.ok(await sheet(), 'the sheet loaded');
  const a = await canvasShot(page);
  // real time rather than the clock: a sheep can stand still for seconds, so a few frames prove nothing, and
  // running the clock over the saver changed the picture in ways real time did not
  await page.waitForTimeout(800);
  // compared as bytes: assert's diff of two unequal screenshots (every byte inspected) runs out of memory
  assert.ok((await canvasShot(page)).equals(a), 'nothing moves');
  // drawn whole pixels at a time: only the sheet's own few colours, none blended by smoothing
  const seen = await colours();
  assert.ok(seen.includes('255,246,145,255'), 'cream wool');
  assert.ok(seen.length <= 16, `${seen.length} colours`);
  await page.keyboard.press('Enter');
  await saver(page).waitFor({ state: 'detached' });
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('the terminal names a saver: screensaver sheep, screensaver leaves, and a wrong name is an error', async t => {
  if (!(await needs(t, '/terminal/'))) return;
  const page = await open(desktop, '/terminal/');
  const input = win(page, 'terminal').locator('.term-in');
  const run = async cmd => {
    await input.fill(cmd);
    await input.press('Enter');
  };
  await run('screensaver sheep');
  await page.locator('.saver[data-kind="sheep"]').waitFor();
  await page.mouse.move(100, 100);
  await page.mouse.move(400, 300, { steps: 3 });
  await saver(page).waitFor({ state: 'detached' });
  // named, it overrides the visitor's choice
  await page.evaluate(() => localStorage.setItem('deskbar:saverKind', '"sheep"'));
  await run('screensaver leaves');
  await page.locator('.saver[data-kind="leaves"]').waitFor();
  await page.mouse.move(100, 100);
  await page.mouse.move(400, 300, { steps: 3 });
  await saver(page).waitFor({ state: 'detached' });
  await run('screensaver goats');
  await win(page, 'terminal').locator('.term-out', { hasText: 'no saver called goats' }).waitFor();
  assert.equal(await saver(page).count(), 0);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});
