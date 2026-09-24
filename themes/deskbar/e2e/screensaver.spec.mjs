// Screen saver (lazy/screensaver.js, started by main.js after a spell without input). A visitor's own deskbar:saver
// setting (minutes) overrides the site's, which lets these tests wait seconds rather than minutes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { env, useBrowser, open, needs, shot, win, path, desktop } from './lib.mjs';

useBrowser();

const quick = () => localStorage.setItem('deskbar:saver', JSON.stringify(0.02));
const saver = page => page.locator('.saver');
const loaded = page => page.evaluate(() => performance.getEntriesByType('resource').some(e => e.name.includes('/js/deskbar-lazy/screensaver.')));

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
  const page = await open(desktop, '/links/', quick);
  await page.locator('.win:not([hidden])').first().waitFor();
  const posts = page.locator('#icons a').first();
  const box = await posts.boundingBox();
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  const before = await state(page);

  await saver(page).waitFor({ timeout: 5000 });
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
  await page.waitForTimeout(300);
  assert.deepEqual(await state(page), before);

  // and it comes back after another quiet spell; a key takes it away and does nothing else
  await saver(page).waitFor({ timeout: 5000 });
  await page.keyboard.press('Enter');
  await saver(page).waitFor({ state: 'detached' });
  assert.deepEqual(await state(page), before);

  // over the page's window, a whole wheel flick and a right-click are swallowed, not just their first event
  const view = await page.locator('.win:not([hidden]) .view').first().boundingBox();
  const vx = view.x + view.width / 2, vy = view.y + view.height / 2;
  await page.mouse.move(vx, vy);
  await saver(page).waitFor({ timeout: 5000 });
  for (let i = 0; i < 6; i++) await page.mouse.wheel(0, 120);
  await page.mouse.click(vx, vy, { button: 'right' });
  await saver(page).waitFor({ state: 'detached' });
  await page.waitForTimeout(300);
  assert.deepEqual(await state(page), before);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('the screen saver never starts while a reader window is open', async () => {
  // a post as the first page, so the reader is there before the idle timer could fire
  const html = await (await fetch(env.base + '/')).text();
  const index = await (await fetch(env.base + /data-index="?([^"\s>]+)/.exec(html)[1])).json();
  const page = await open(desktop, index.posts[0].url, quick);
  await win(page, 'reader').locator('.rd h1').waitFor();
  await page.waitForTimeout(3000);
  assert.equal(await saver(page).count(), 0);
  assert.equal(await loaded(page), false, 'nothing is even loaded');
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
  const input = win(page, 'terminal').locator('.term-in');
  await input.fill('screensaver leaves');
  await input.press('Enter');
  await saver(page).waitFor();
  await page.waitForTimeout(1500);
  const a = await saver(page).locator('canvas').screenshot();
  await page.waitForTimeout(400);
  const b = await saver(page).locator('canvas').screenshot();
  assert.notDeepEqual(a, b, 'leaves fall');
  await shot(page, 'screensaver');
  await page.mouse.move(100, 100);
  await page.mouse.move(400, 300, { steps: 3 });
  await saver(page).waitFor({ state: 'detached' });
  assert.ok(await input.evaluate(el => el === document.activeElement), 'focus is still in the terminal');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

// The sheep saver (lazy/sheep.js), chosen in the Control panel's System pane (deskbar:saverKind)
const sheepLoaded = page => page.evaluate(() => performance.getEntriesByType('resource').some(e => e.name.includes('/js/deskbar-lazy/sheep.')));
const canvasShot = page => saver(page).locator('canvas').screenshot();

test('Sheep: the default in the Control panel, the Test button and the idle watcher run it, over the dimmed desktop', async t => {
  if (!(await needs(t, '/control-panel/'))) return;
  const page = await open(desktop, '/control-panel/?pane=system', undefined, { reducedMotion: 'no-preference' });
  const cp = win(page, 'control-panel');
  await cp.locator('.cp').waitFor();
  assert.equal(await cp.locator('input[name="cp-saverKind"]:checked').getAttribute('value'), 'sheep', 'sheep by default');
  assert.equal(await sheepLoaded(page), false, 'no sheep until asked for');
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
    await page.waitForTimeout(1200);
    looks.add((await canvasShot(page)).toString('base64'));
  }
  assert.ok(looks.size > 1, 'sheep wander');
  await shot(page, 'screensaver-sheep');
  await page.mouse.move(100, 100);
  await page.mouse.move(400, 300, { steps: 3 });
  await saver(page).waitFor({ state: 'detached' });

  // the idle watcher runs the choice too
  await page.evaluate(() => localStorage.setItem('deskbar:saver', JSON.stringify(0.02)));
  await page.mouse.move(420, 320);
  await page.locator('.saver[data-kind="sheep"]').waitFor({ timeout: 5000 });
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
  await page.waitForTimeout(800);
  assert.deepEqual(await canvasShot(page), a, 'nothing moves');
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
