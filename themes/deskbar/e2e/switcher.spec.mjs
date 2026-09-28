// The window switcher (wm/panel.js): a native popover over the dock's windows button that lists every window,
// minimised ones marked, with keyboard movement, hover previews, close buttons and the copy layout link.
// The phone switcher is in shell.spec.mjs and home-shelf.spec.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { env, useBrowser, open, needs, win, cards, desktop } from './lib.mjs';

useBrowser();

let idx = null;
const index = async () => (idx ||= await (await fetch(env.base + '/deskbar.json')).json());

test('the window switcher is a native popover that redraws while open', async () => {
  const { posts } = await index();
  const page = await open(desktop, posts[0].url);
  await win(page, 'tracker').waitFor();
  const sw = page.locator('#switcher'), tabs = sw.locator('.sw-tab');
  await page.click('#winsBtn');
  await tabs.first().waitFor();
  assert.ok(await sw.evaluate(el => el.matches(':popover-open')));
  // the post's reader and Tracker
  assert.equal(await tabs.count(), 2);
  // on the desktop the switcher is a dock icon and its tabs rise from it, clear of the dock, with the focused
  // window's tab nearest the button and its icon over the button's centre
  const got = await page.evaluate(() => {
    const box = s => document.querySelector(s).getBoundingClientRect();
    const btn = box('#winsBtn'), tabs = [...document.querySelectorAll('#switcher .sw-tab')].map(t => t.getBoundingClientRect());
    return {
      where: document.getElementById('winsBtn').closest('#panel, #dock').id, sw: box('#switcher').bottom, dock: box('#dock').top,
      first: document.querySelector('#switcher .sw-tab').matches('.on'), rising: tabs[0].top > tabs[1].top,
      offset: Math.abs(box('#switcher .sw-tab .ico').x + 8 - (btn.x + btn.width / 2)),
    };
  });
  assert.equal(got.where, 'dock');
  assert.ok(got.sw <= got.dock, `switcher (bottom ${got.sw}) sits above the dock (top ${got.dock})`);
  assert.ok(got.first && got.rising, 'the focused window comes first, at the bottom of the column');
  assert.ok(got.offset <= 2, `tab icons line up over the button (${got.offset}px off)`);
  await sw.locator('.sw-close').first().click();
  await page.waitForFunction(() => document.querySelectorAll('#switcher .sw-tab').length === 1);
  await page.keyboard.press('Escape');
  await sw.waitFor({ state: 'hidden' });
  await page.click('#winsBtn');
  await sw.waitFor();
  await page.mouse.click(700, 500);
  await sw.waitFor({ state: 'hidden' });
  await page.context().close();
});

test('the window switcher works from the keyboard, marks minimised windows and previews on hover', async () => {
  const { posts } = await index();
  const page = await open(desktop, posts[0].url);
  await win(page, 'reader').locator('.rd h1').waitFor();
  await win(page, 'reader').locator('.ctl.min').click();
  const sw = page.locator('#switcher'), label = () => page.evaluate(() => document.activeElement.textContent);
  await page.locator('#winsBtn').focus();
  await page.keyboard.press('Enter');
  await sw.locator('.sw-tab').first().waitFor();
  // the minimised reader follows the open windows and says so; Tracker is first
  const min = sw.locator('.sw-tab.min').first();
  assert.equal(await min.locator('.sw-open span').textContent(), posts[0].title);
  assert.match(await min.locator('.sw-open').getAttribute('aria-label'), /, minimised$/);
  await page.keyboard.press('Tab');
  assert.ok(await page.evaluate(() => document.activeElement.matches('#switcher .sw-tab:first-child .sw-open')));
  // Up climbs the column, then on to the copy link at its top, and wraps round
  const first = await label();
  await page.keyboard.press('ArrowUp');
  assert.equal(await label(), posts[0].title);
  await page.keyboard.press('ArrowUp');
  assert.ok(await page.evaluate(() => document.activeElement.matches('.sw-link')));
  await page.keyboard.press('ArrowUp');
  assert.equal(await label(), first);
  await page.keyboard.press('ArrowDown');
  assert.ok(await page.evaluate(() => document.activeElement.matches('.sw-link')));
  // hovering a tab lifts its window above the others; leaving puts it back
  await sw.locator('.sw-tab').first().hover();
  assert.equal(await page.locator('.win.peek').count(), 1);
  await page.keyboard.press('Escape');
  await sw.waitFor({ state: 'hidden' });
  assert.equal(await page.locator('.win.peek').count(), 0);
  assert.ok(await page.evaluate(() => document.activeElement.id === 'winsBtn'), 'focus returns to the button');
  // choosing the minimised window restores and focuses it
  await page.click('#winsBtn');
  await min.locator('.sw-open').click();
  await sw.waitFor({ state: 'hidden' });
  await page.locator('.win.active .view[data-key="reader"]').waitFor();
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('Home and End move to the first and last entries of the window switcher', async t => {
  if (!(await needs(t, '/about/'))) return;
  const { posts } = await index();
  const page = await open(desktop, posts[0].url);
  await win(page, 'reader').locator('.rd h1').waitFor();
  await page.evaluate(() => window.deskbar.go('/about/'));
  await page.locator('.win:not([hidden]) .view[data-key="page:/about/"]').waitFor();
  await page.locator('#winsBtn').focus();
  await page.keyboard.press('Enter');
  const btns = page.locator('#switcher :is(.sw-open, .sw-link)');
  await btns.first().waitFor();
  await page.keyboard.press('Tab');
  const focused = () => page.evaluate(() => [...document.querySelectorAll('#switcher :is(.sw-open, .sw-link)')].indexOf(document.activeElement));
  await page.keyboard.press('End');
  assert.equal(await focused(), (await btns.count()) - 1);
  await page.keyboard.press('Home');
  assert.equal(await focused(), 0);
  await page.context().close();
});

test('the window switcher lists the Posts window, counts it in the badge and closes it', async () => {
  const page = await open(desktop);
  await cards(page).first().waitFor();
  assert.equal(await page.locator('#winsN').textContent(), '1', 'the badge counts the Posts window');
  await page.click('#winsBtn');
  const tab = page.locator('#switcher .sw-tab');
  await tab.first().waitFor();
  assert.equal(await tab.count(), 1);
  assert.equal(await tab.locator('.sw-open').textContent(), '~/posts');
  assert.equal(await page.locator('#switcher .sw-empty').count(), 0);
  await tab.locator('.sw-close').click();
  assert.equal(await page.locator('.view[data-key="tracker"]').count(), 0, 'closing it from the switcher closes the window');
  await page.locator('#switcher .sw-empty').waitFor();
  assert.equal(await page.locator('#winsN').textContent(), '');
  await page.keyboard.press('Escape');

  // minimised, it is marked so, and choosing it restores the window
  await page.locator('#icons .dicon[href$="/posts/"]').click();
  await win(page, 'tracker').locator('.tab .ctl.min').click();
  await page.click('#winsBtn');
  assert.match(await tab.locator('.sw-open').getAttribute('aria-label'), /^~\/posts, minimised$/);
  await tab.locator('.sw-open').click();
  await win(page, 'tracker').waitFor();
  assert.deepEqual(page.errors, []);
  await page.context().close();
});
