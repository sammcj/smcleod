// Context menu (context-menu-trigger.js, lazy/context-menu.js), sharing and Copy as markdown: right-click and
// long-press, the Menu key and Shift+F10, each action, the share fallback, and copying a post's markdown.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useBrowser, open, shot, win, desktop, phone } from './lib.mjs';

useBrowser();

const clip = { permissions: ['clipboard-read', 'clipboard-write'] };
// headless Chromium may or may not have Web Share; these tests pick one explicitly
const noShare = () => { delete Navigator.prototype.share; delete navigator.share; };
const fakeShare = () => {
  window.shared = [];
  Navigator.prototype.share = async data => { window.shared.push(data); };
};
const menu = page => page.locator('.ctx:popover-open');
const items = page => menu(page).locator('[role=menuitem]').allTextContents();
const item = (page, name) => menu(page).getByRole('menuitem', { name, exact: true });
const clipboard = page => page.evaluate(() => navigator.clipboard.readText());
const noteText = page => page.locator('.ctx-note.on').textContent();
const firstPost = page => page.evaluate(async () => (await (await fetch(document.documentElement.dataset.index)).json()).posts[0]);
const focused = page => page.evaluate(() => document.activeElement?.textContent.trim());

async function openPost(viewport, opts) {
  const home = await open(viewport, '/', opts?.init, opts?.ctx);
  const post = await firstPost(home);
  await home.evaluate(u => window.deskbar.go(u), post.url);
  await win(home, 'reader').locator('.rd h1').waitFor();
  return { page: home, post };
}

test('right-click on the desktop opens the desktop menu, and Escape closes it', async () => {
  const page = await open(desktop, '/');
  await page.mouse.click(900, 500, { button: 'right' });
  await menu(page).waitFor();
  const list = await items(page);
  assert.equal(list[0], 'Home');
  assert.ok(list.includes('Search…'));
  if (await page.locator('a[href$="/control-panel/"]').count()) assert.ok(list.includes('Control panel…'));
  assert.ok(!list.includes('Appearance…'), 'the Control panel replaces Appearance');
  await shot(page, 'ctx-desktop');
  await page.keyboard.press('Escape');
  await menu(page).waitFor({ state: 'hidden' });
  // a press elsewhere closes it too
  await page.mouse.click(900, 500, { button: 'right' });
  await menu(page).waitFor();
  await page.mouse.click(700, 400);
  await menu(page).waitFor({ state: 'hidden' });
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test("the desktop menu's Control panel… opens the Control panel", async t => {
  const page = await open(desktop, '/');
  if (!(await page.locator('a[href$="/control-panel/"]').count())) { await page.context().close(); return t.skip('no Control panel link on this site'); }
  await page.mouse.click(900, 500, { button: 'right' });
  await menu(page).waitFor();
  const list = await items(page);
  assert.equal(list.indexOf('Control panel…'), list.indexOf('Search…') + 1, 'after Search, where Appearance was');
  await item(page, 'Control panel…').click();
  await win(page, 'control-panel').locator('.cp').waitFor();
  assert.equal(new URL(page.url()).pathname, '/control-panel/');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('post text keeps the browser menu, links included, and window chrome gets the shell menu', async () => {
  const { page } = await openPost(desktop);
  const body = win(page, 'reader').locator('.rd-body');
  const prevented = sel => page.evaluate(s => {
    const el = document.querySelector(s);
    const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 });
    el.dispatchEvent(e);
    return e.defaultPrevented;
  }, sel);
  assert.equal(await prevented('.win .rd-body p'), false, 'post text');
  if (await body.locator('a[href]').count()) assert.equal(await prevented('.win .rd-body a[href]'), false, 'link in post text');
  const para = body.locator('p').first();
  await para.scrollIntoViewIfNeeded();
  const b = await para.boundingBox();
  await page.mouse.click(b.x + 5, b.y + 5, { button: 'right' });
  await page.waitForTimeout(300);
  assert.equal(await menu(page).count(), 0);
  assert.equal(await prevented('.win .rd h1'), false, 'post title');
  if (await page.locator('.win .rd header a.chip').count()) assert.equal(await prevented('.win .rd header a.chip'), false, 'tag chip');
  // a word the right-click selected in the post must not keep the shell's menu off the chrome
  await page.evaluate(() => getSelection().selectAllChildren(document.querySelector('.win .rd-body p')));
  assert.equal(await prevented('.win .toolbar'), true, 'reader toolbar');
  assert.equal(await prevented('.win .tab.on .tt'), true, 'window tab');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('link menu: open, open in a new tab, copy link and share', async () => {
  const page = await open(desktop, '/', fakeShare, clip);
  const icon = page.locator('#icons a.dicon:not([target])').first();
  const href = await icon.evaluate(a => a.href);
  await icon.click({ button: 'right' });
  await menu(page).waitFor();
  assert.deepEqual(await items(page), ['Open', 'Open in new tab', 'Copy link', 'Share…']);
  assert.equal(await menu(page).getAttribute('aria-label'), await icon.getAttribute('title'));
  await shot(page, 'ctx-link');

  await item(page, 'Copy link').click();
  await menu(page).waitFor({ state: 'hidden' });
  assert.equal(await noteText(page), 'Link copied');
  assert.equal(await clipboard(page), href);

  await icon.click({ button: 'right' });
  await item(page, 'Share…').click();
  assert.deepEqual(await page.evaluate(() => window.shared), [{ title: await icon.getAttribute('title'), url: href }]);

  await icon.click({ button: 'right' });
  const [tab] = await Promise.all([page.context().waitForEvent('page'), item(page, 'Open in new tab').click()]);
  await tab.waitForLoadState();
  assert.equal(tab.url(), href);
  await tab.close();

  await icon.click({ button: 'right' });
  await item(page, 'Open').click();
  await page.waitForURL(u => u.href === href);
  assert.equal(await page.locator('.win:not([hidden])').count() > 0, true);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('window menu: copy link, share fallback, copy as markdown, maximise, minimise and close', async () => {
  const { page, post } = await openPost(desktop, { init: noShare, ctx: clip });
  const url = new URL(post.url, page.url()).href;
  const tab = win(page, 'reader').locator('.tab.on .tt');
  await tab.click({ button: 'right' });
  await menu(page).waitFor();
  const list = await items(page);
  assert.deepEqual(list, ['Open in new tab', 'Copy link', 'Share…', 'Copy as markdown', 'Minimise', 'Maximise', 'Close']);
  assert.equal(await menu(page).locator('[role=separator]').count(), 2);
  await shot(page, 'ctx-window');

  // without Web Share, sharing copies the link and says so
  await item(page, 'Share…').click();
  assert.equal(await noteText(page), 'Link copied');
  assert.equal(await clipboard(page), url);

  await tab.click({ button: 'right' });
  await item(page, 'Copy as markdown').click();
  await page.locator('.ctx-note.on', { hasText: 'Markdown copied' }).waitFor();
  assert.match(await clipboard(page), new RegExp('^# ' + post.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  await tab.click({ button: 'right' });
  await item(page, 'Maximise').click();
  await win(page, 'reader').locator('.ctl.max[aria-label="Restore"]').waitFor();
  await tab.click({ button: 'right' });
  assert.ok((await items(page)).includes('Restore'));
  await item(page, 'Restore').click();
  await win(page, 'reader').locator('.ctl.max[aria-label="Maximise"]').waitFor();

  await tab.click({ button: 'right' });
  await item(page, 'Minimise').click();
  await page.locator('.win:has(.view[data-key="reader"])[hidden]').waitFor({ state: 'attached' });
  await page.evaluate(u => window.deskbar.go(u), post.url);
  await win(page, 'reader').waitFor();

  await tab.click({ button: 'right' });
  await item(page, 'Close').click();
  await page.locator('.view[data-key="reader"]').waitFor({ state: 'detached' });
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('keyboard: Shift+F10 and the Menu key open it, arrows move, Escape returns focus', async () => {
  const { page } = await openPost(desktop);
  const tab = win(page, 'reader').locator('.tab.on .tt');
  await tab.focus();
  await page.keyboard.press('Shift+F10');
  await menu(page).waitFor();
  assert.equal(await focused(page), 'Open in new tab', 'first item focused');
  await page.keyboard.press('ArrowDown');
  assert.equal(await focused(page), 'Copy link');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  assert.equal(await focused(page), 'Close', 'wraps to the end');
  await page.keyboard.press('Home');
  assert.equal(await focused(page), 'Open in new tab');
  await page.keyboard.press('End');
  assert.equal(await focused(page), 'Close');
  await page.keyboard.press('Escape');
  await menu(page).waitFor({ state: 'hidden' });
  assert.equal(await page.evaluate(() => document.activeElement.classList.contains('tt')), true, 'focus back on the tab');

  await page.keyboard.press('ContextMenu');
  await menu(page).waitFor();
  // Enter runs the focused item; Maximise is the second last
  await page.keyboard.press('End');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await menu(page).waitFor({ state: 'hidden' });
  await win(page, 'reader').locator('.ctl.max[aria-label="Restore"]').waitFor();
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

// iOS fires no contextmenu event, so these are bare touch pointer events, as Safari sends them, then the click a
// lifted finger makes. Resolves to whether that click reached the link (stopped there, so nothing navigates).
const touchPress = (page, sel, move = 0, hold = 700) => page.evaluate(async ([s, dx, ms]) => {
  const el = document.querySelector(s), r = el.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
  const fire = (type, cx) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerType: 'touch', isPrimary: true, clientX: cx, clientY: y }));
  let reached = false;
  const stop = e => { reached = true; e.preventDefault(); e.stopPropagation(); };
  el.addEventListener('click', stop);
  fire('pointerdown', x);
  if (dx) fire('pointermove', x + dx);
  await new Promise(res => setTimeout(res, ms));
  fire('pointerup', x + dx);
  // a tap's click has detail 1; keyboard clicks (detail 0) are never suppressed
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
  el.removeEventListener('click', stop);
  return reached;
}, [sel, move, hold]);

test('long-press opens the menu on touch without following the link; a tap or a moving finger does not', async () => {
  const page = await open(phone, '/', null, { hasTouch: true, isMobile: true });
  // phones hide the desktop icons, so the press is on a post on the home screen
  const icon = '#recent a.pc';
  await page.locator(icon).first().waitFor();
  assert.equal(await touchPress(page, icon, 30), true, 'a drag clicks as usual');
  await page.waitForTimeout(200);
  assert.equal(await menu(page).count(), 0, 'a drag is not a long-press');

  assert.equal(await touchPress(page, icon, 0, 300), true, 'a tap clicks');
  await page.waitForTimeout(400);
  assert.equal(await menu(page).count(), 0, 'a tap is not a long-press');

  assert.equal(await touchPress(page, icon), false, 'the lifted finger does not open the link');
  await menu(page).waitFor();
  assert.equal((await items(page))[0], 'Open');
  const box = await menu(page).boundingBox();
  assert.ok(box.x >= 0 && box.x + box.width <= phone.width, 'menu fits the screen');
  const r = await page.locator(icon).first().boundingBox(), px = r.x + r.width / 2 + 2, py = r.y + r.height / 2 + 2;
  assert.ok([box.x, box.x + box.width].some(x => Math.abs(x - px) < 1.5), 'menu beside the press, horizontally');
  assert.ok([box.y, box.y + box.height].some(y => Math.abs(y - py) < 1.5), 'menu beside the press, vertically');
  await shot(page, 'ctx-touch');
  // a keyboard press (a click with detail 0) still works after the long-press
  const href = await page.locator(icon).first().getAttribute('href');
  await page.keyboard.press('Enter');
  await menu(page).waitFor({ state: 'hidden' });
  await page.waitForURL(u => u.pathname === href);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('long-press on a tab opens the window menu and ends the tab slide it started', async () => {
  const { page } = await openPost(desktop, { ctx: { hasTouch: true } });
  await touchPress(page, '.win .tab.on .tt');
  await menu(page).waitFor();
  assert.ok((await items(page)).includes('Close'));
  assert.equal(await page.locator('.tab.sliding').count(), 0);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('reader toolbar: Share uses Web Share, Copy as markdown copies the post, and pages without markdown hide it', async () => {
  const { page, post } = await openPost(desktop, { init: fakeShare, ctx: clip });
  const bar = win(page, 'reader').locator('.toolbar');
  await bar.getByRole('button', { name: 'Share' }).click();
  await page.waitForFunction(() => window.shared.length === 1);
  assert.deepEqual(await page.evaluate(() => window.shared[0]), { title: post.title, url: new URL(post.url, page.url()).href });

  const md = bar.getByRole('button', { name: 'Copy as markdown' });
  assert.ok(await md.isVisible());
  await md.click();
  await page.locator('.ctx-note.on', { hasText: 'Markdown copied' }).waitFor();
  const text = await clipboard(page);
  assert.ok(text.startsWith('# '), 'title heading first');
  assert.doesNotMatch(text, /\{\{[<%]/, 'shortcodes rendered');
  await shot(page, 'ctx-markdown-copied');

  const about = await page.evaluate(() => document.querySelector('#icons a.dicon[href$="/about/"], #menu a[href$="/about/"]')?.getAttribute('href'));
  if (about) {
    await page.evaluate(u => window.deskbar.go(u), about);
    const pv = page.locator(`.win:not([hidden]) .view[data-key="page:${about}"]`);
    await pv.locator('.rd h1').first().waitFor();
    assert.equal(await pv.getByRole('button', { name: 'Copy as markdown' }).isVisible(), false);
  }
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('copying reports a failure visibly', async () => {
  const { page } = await openPost(desktop, { ctx: clip });
  await page.route(/\/index\.md$/, route => route.fulfill({ status: 404, body: '' }));
  await win(page, 'reader').locator('.toolbar').getByRole('button', { name: 'Copy as markdown' }).click();
  await page.locator('.ctx-note.on', { hasText: "Couldn't copy the markdown" }).waitFor();
  await page.context().close();
});
