// Posts dragged out of Tracker (the Posts window) open in windows of their own, outside the reading layout (D7), each
// with its own Back and Forward. Tracker's Cmd/Ctrl- and Shift-clicks select posts to open that way, as do Enter,
// the toolbar button and the context menu. Runs on any site: addresses come from the shell's post index.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { env, useBrowser, open, shot, win, cards, path, desktop, phone } from './lib.mjs';

useBrowser();

let idx = null;
const posts = async () => (idx ||= await (await fetch(env.base + '/deskbar.json')).json()).posts;

const OWN = '.view[data-key^="post:"]';
const owns = page => page.locator(`.win:not([hidden]):has(${OWN})`);
const titles = page => page.locator(`.win:not([hidden]) ${OWN} .rd h1`).allTextContents();
const box = loc => loc.boundingBox();

// Presses the middle of from, moves past the threshold and on to (x, y) in viewport pixels; mid runs before the release
async function dragTo(page, from, x, y, mid) {
  const b = await from.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 24, b.y + b.height / 2 + 12, { steps: 4 });
  await page.mouse.move(x, y, { steps: 10 });
  await mid?.();
  await page.mouse.up();
}

const inside = (b, x, y) => b && x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height;
// the desk right of a window, where a drop lands outside it (Tracker starts right of the icons, which may wrap)
const beside = b => (b.x + b.width + desktop.width) / 2;

test('the Posts window: a post dropped on the desk opens in its own window where it lands; dropped back, nothing opens', async () => {
  const list = await posts();
  const page = await open(desktop);
  const rp = cards(page).first(), tk = win(page, 'tracker');
  await rp.waitFor();
  const tb = await box(tk);

  await dragTo(page, rp, 760, 120, async () => {
    await page.locator('.dragout').waitFor();
    assert.match(await page.locator('.dragout').textContent(), new RegExp(list[0].title.slice(0, 12).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    await shot(page, 'dragout-ghost');
  });
  const w = owns(page);
  await w.locator('.rd h1').waitFor();
  assert.equal(await w.locator('.rd h1').textContent(), list[0].title);
  assert.equal(await page.locator('.dragout').count(), 0, 'the ghost goes on release');
  assert.equal(await page.locator('.view[data-key="reader"]').count(), 0, 'the shared reader is not used');
  assert.deepEqual(await box(tk), tb, 'no reading layout, so the Posts window stays where it was');
  const b = await box(w);
  assert.equal(Math.round(b.width), 680, 'sized like a page window');
  assert.ok(inside(await box(w.locator('.tab.on')), 760, 120), 'its tab lands under the pointer');
  assert.equal(path(page), list[0].url, 'the address names the post on top');
  await shot(page, 'dragout-posts');
  // D36: Escape puts back a Posts window the reading layout took, which a post window of its own never does
  await w.locator('.rd h1').click();
  await page.keyboard.press('Escape');
  assert.equal(await owns(page).count(), 1, 'Escape leaves a post window of its own open');

  // back onto the Posts window: no window, and the release does not click the link
  const second = cards(page).nth(1), sb = await box(second);
  await dragTo(page, second, sb.x + sb.width / 2 + 40, sb.y + sb.height / 2 + 60);
  await page.waitForTimeout(300);
  assert.equal(await owns(page).count(), 1, 'nothing more opened');
  assert.equal(path(page), list[0].url, 'and nothing was routed');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('Tracker: a card dragged out gets its own window; Tracker stays put, and a plain click still uses the reader', async () => {
  const page = await open(desktop, '/posts/');
  const tk = win(page, 'tracker'), card = tk.locator('.pc').first();
  await card.waitFor();
  const tb = await box(tk), url = await card.getAttribute('href');

  // dropped back inside Tracker: cancelled
  await dragTo(page, card, tb.x + 300, tb.y + 400);
  await page.waitForTimeout(300);
  assert.equal(await owns(page).count(), 0, 'nothing opens');
  assert.equal(path(page), '/posts/', 'and the click the release makes is not routed');

  await dragTo(page, card, beside(tb), 500);
  const w = owns(page);
  await w.locator('.rd h1').waitFor();
  assert.equal(path(page), url);
  assert.deepEqual(await box(tk), tb, 'Tracker is where it was');
  const wb = await box(w), desk = await box(page.locator('#desk'));
  assert.ok(wb.x + wb.width <= desk.x + desk.width && wb.y + wb.height <= desk.y + desk.height, `dropped near the edge, clamped to the desk (${JSON.stringify(wb)})`);

  // H2: a plain click still opens the reading layout (D7); the post window is left alone
  const other = tk.locator('.pc').nth(1), otherURL = await other.getAttribute('href');
  await tk.locator('.tab.on .tt').click();
  await other.click();
  await page.waitForURL(u => u.pathname === otherURL);
  await win(page, 'reader').locator('.rd h1').waitFor();
  assert.deepEqual(await box(w), wb, 'the post window keeps its place and size');
  assert.equal(await owns(page).count(), 1);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('Tracker: Cmd/Ctrl- and Shift-click select without opening; dragging the selection opens each, cascaded', async t => {
  const page = await open(desktop, '/posts/');
  const tk = win(page, 'tracker');
  await tk.locator('.seg[data-m="list"]').click();
  const rows = tk.locator('tr[data-url]');
  await rows.first().waitFor();
  if (await rows.count() < 3) return t.skip('needs three posts');
  const urls = await rows.evaluateAll(xs => xs.slice(0, 3).map(x => x.dataset.url));
  let tabs = 0;
  page.context().on('page', () => tabs++);

  await rows.nth(0).locator('a').click({ modifiers: ['ControlOrMeta'] });
  await rows.nth(2).locator('a').click({ modifiers: ['Shift'] });
  await tk.locator('tr.sel').nth(2).waitFor();
  assert.equal(await tk.locator('tr.sel').count(), 3, 'Shift selects the range');
  assert.equal(tabs, 0, 'no browser tab or window');
  assert.equal(path(page), '/posts/', 'nothing opened');
  assert.equal(await page.locator('.view[data-key="reader"]').count(), 0);

  await dragTo(page, rows.nth(1), beside(await box(tk)), 500, async () => {
    await page.locator('.dragout').waitFor();
    assert.equal(await page.locator('.dragout b').textContent(), '3', 'the ghost counts the posts');
    await shot(page, 'dragout-ghost-many');
  });
  await page.waitForFunction(() => document.querySelectorAll('.view[data-key^="post:"] .rd h1').length === 3);
  const boxes = await Promise.all([0, 1, 2].map(i => box(owns(page).nth(i))));
  boxes.sort((a, b) => a.x - b.x);
  assert.ok(boxes.every((b, i) => !i || (Math.round(b.x - boxes[i - 1].x) === 28 && Math.round(b.y - boxes[i - 1].y) === 28)), `cascaded (${JSON.stringify(boxes)})`);
  assert.equal(path(page), urls[2], 'the last one is on top and names the address');
  assert.equal(await page.locator(`.win.active ${OWN}`).count(), 1);
  assert.equal(await tk.locator('tr.sel').count(), 0, 'the selection is done with');
  await shot(page, 'dragout-three');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('Tracker: Enter, the toolbar button and the context menu open a selection; Shift+Down selects by keyboard', async t => {
  const list = await posts();
  if (list.length < 4) return t.skip('needs four posts');
  const listView = async page => {
    const tk = win(page, 'tracker');
    await tk.locator('.seg[data-m="list"]').click();
    await tk.locator('tr[data-url]').first().waitFor();
    return tk;
  };

  let page = await open(desktop, '/posts/');
  let tk = await listView(page);
  await tk.locator('tr[data-url] a').nth(0).click({ modifiers: ['ControlOrMeta'] });
  await tk.locator('tr[data-url] a').nth(1).click({ modifiers: ['ControlOrMeta'] });
  await tk.locator('tr.sel').nth(1).waitFor();
  const btn = tk.locator('.toolbar .tk-open');
  assert.ok(await btn.isVisible(), 'a toolbar button offers the selection');
  assert.match(await btn.getAttribute('aria-label'), /2/);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelectorAll('.view[data-key^="post:"] .rd h1').length === 2);
  assert.equal(await page.locator('.view[data-key="reader"]').count(), 0, 'Enter did not open the focused row in the reader');
  assert.ok(await btn.isHidden(), 'no selection, no button');
  assert.deepEqual(page.errors, []);
  await page.context().close();

  // keyboard only: Shift+Down from the focused row selects it and the next, the button opens them
  page = await open(desktop, '/posts/');
  tk = await listView(page);
  await tk.locator('tr[data-url] a').nth(2).focus();
  await page.keyboard.press('Shift+ArrowDown');
  await tk.locator('tr.sel').nth(1).waitFor();
  assert.equal(await page.evaluate(() => document.activeElement.closest('tr')?.rowIndex), 4, 'focus moved with the selection');
  await tk.locator('.toolbar .tk-open').click();
  await page.waitForFunction(() => document.querySelectorAll('.view[data-key^="post:"] .rd h1').length === 2);
  assert.deepEqual((await titles(page)).sort(), [list[2].title, list[3].title].sort());

  // the context menu of a selected row
  await tk.locator('.tab.on .tt').click();
  await tk.locator('tr[data-url] a').nth(0).click({ modifiers: ['ControlOrMeta'] });
  await tk.locator('tr[data-url] a').nth(1).click({ modifiers: ['ControlOrMeta'] });
  await tk.locator('tr.sel').nth(1).waitFor();
  await tk.locator('tr[data-url] a').nth(1).click({ button: 'right' });
  await page.locator('.ctx [role=menuitem]', { hasText: 'Open in new windows' }).click();
  await page.waitForFunction(() => document.querySelectorAll('.view[data-key^="post:"] .rd h1').length === 4);
  // Escape drops a selection
  await tk.locator('.tab.on .tt').click();
  await tk.locator('tr[data-url] a').nth(0).click({ modifiers: ['ControlOrMeta'] });
  await tk.locator('tr.sel').first().waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await tk.locator('tr.sel').count(), 0);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('each post window has its own Back and Forward, and browser Back returns to the window that showed the page', async t => {
  const list = await posts();
  const page = await open(desktop);
  await cards(page).nth(1).waitFor();
  await dragTo(page, cards(page).nth(0), 760, 120);
  await owns(page).locator('.rd h1').waitFor();
  await dragTo(page, cards(page).nth(1), 1100, 240);
  await page.waitForFunction(() => document.querySelectorAll('.view[data-key^="post:"] .rd h1').length === 2);
  const one = page.locator(`.win:has(${OWN} .rd h1:text-is(${JSON.stringify(list[0].title)}))`);
  const two = page.locator(`.win:has(${OWN} .rd h1:text-is(${JSON.stringify(list[1].title)}))`);
  const key1 = await one.locator(OWN).getAttribute('data-key'), key2 = await two.locator(OWN).getAttribute('data-key');
  const w1 = page.locator(`.win:has(.view[data-key="${key1}"])`), w2 = page.locator(`.win:has(.view[data-key="${key2}"])`);
  const h1 = w => w.locator('.rd h1').textContent();
  const link = w1.locator('.rd-pager a[href], .ticker a[href]').first();
  if (!(await link.count())) return t.skip('the post links to no other post');

  await w1.locator('.tab.on .tt').click();
  const to = await link.getAttribute('href');
  await link.click();
  await page.waitForURL(u => u.pathname === to);
  await page.waitForFunction(([k, t]) => document.querySelector(`.view[data-key="${k}"] .rd h1`)?.textContent !== t, [key1, list[0].title]);
  const third = await h1(w1);
  assert.equal(await h1(w2), list[1].title, 'the other window keeps its post');
  assert.equal(await page.locator('.view[data-key="reader"]').count(), 0, 'links in a post window stay in it');

  await w1.locator('button[aria-label="Back"]').click();
  await page.waitForFunction(([k, t]) => document.querySelector(`.view[data-key="${k}"] .rd h1`)?.textContent === t, [key1, list[0].title]);
  assert.ok(await w2.locator('button[aria-label="Back"]').isDisabled(), 'the other window has nothing to go back to');
  await w1.locator('button[aria-label="Forward"]').click();
  await page.waitForFunction(([k, t]) => document.querySelector(`.view[data-key="${k}"] .rd h1`)?.textContent === t, [key1, third]);

  await page.goBack();
  await page.waitForFunction(([k, t]) => document.querySelector(`.view[data-key="${k}"] .rd h1`)?.textContent === t, [key1, list[0].title]);
  assert.equal(await h1(w2), list[1].title);
  assert.equal(await page.locator('.view[data-key="reader"]').count(), 0, 'browser Back went to the post window, not the reader');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('a layout link reopens post windows as post windows', async () => {
  const list = await posts();
  const page = await open(desktop);
  await cards(page).nth(1).waitFor();
  await dragTo(page, cards(page).nth(0), 800, 200);
  await owns(page).locator('.rd h1').waitFor();
  await dragTo(page, cards(page).nth(1), 900, 300);
  await page.waitForFunction(() => document.querySelectorAll('.view[data-key^="post:"] .rd h1').length === 2);
  await page.evaluate(() => { navigator.clipboard.writeText = s => { window.__copied = s; return Promise.resolve(); }; });
  await page.click('#winsBtn');
  await page.click('#switcher .sw-link');
  await page.waitForFunction(() => window.__copied);
  const u = new URL(await page.evaluate(() => window.__copied));
  assert.equal(u.pathname, list[1].url);
  // the Posts window is a window with an address like any other (D36); pressing its second card raised it over the
  // first post window
  assert.equal(u.searchParams.get('layout'), `p${list[0].url},/posts/,p${list[1].url}`);
  await page.context().close();

  const again = await open(desktop, u.pathname + u.search);
  await again.waitForFunction(() => document.querySelectorAll('.view[data-key^="post:"] .rd h1').length === 2);
  assert.deepEqual((await titles(again)).sort(), [list[0].title, list[1].title].sort(), 'both are post windows');
  assert.equal(await again.locator('.view[data-key="reader"]').count(), 0, 'not the reader');
  assert.equal(await again.locator('.win:not([hidden]) .view[data-key="tracker"]').count(), 1, 'the Posts window is back too');
  const tb = await again.locator('.win:has(.view[data-key="tracker"])').boundingBox();
  assert.ok(tb.x > 100, `beside the icons rather than snapped into a reading layout (x=${tb.x})`);
  assert.equal(await again.locator(`.win.active ${OWN} .rd h1`).textContent(), list[1].title, 'the address\'s post is on top');
  assert.equal(new URL(again.url()).search, '');
  assert.deepEqual(again.errors, []);
  await again.context().close();
});

test('Home hides post windows and puts them back where they were', async () => {
  const list = await posts();
  const page = await open(desktop);
  await cards(page).nth(1).waitFor();
  await dragTo(page, cards(page).nth(0), 800, 200);
  await owns(page).locator('.rd h1').waitFor();
  await dragTo(page, cards(page).nth(1), 900, 300);
  await page.waitForFunction(() => document.querySelectorAll('.view[data-key^="post:"] .rd h1').length === 2);
  const before = await Promise.all([0, 1].map(i => box(owns(page).nth(i))));

  await page.click('#homeBtn');
  assert.equal(await owns(page).count(), 0, 'hidden');
  assert.equal(path(page), '/');
  await page.click('#homeBtn');
  await page.waitForFunction(() => document.querySelectorAll('.win:not([hidden]) .view[data-key^="post:"]').length === 2);
  assert.deepEqual(await Promise.all([0, 1].map(i => box(owns(page).nth(i)))), before, 'same places and sizes');
  assert.equal(path(page), list[1].url);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('phones: no drag-out (D17)', async () => {
  const page = await open(phone);
  const rp = cards(page).first();
  await rp.waitFor();
  const b = await box(rp);
  await dragTo(page, rp, b.x + b.width / 2, b.y + b.height + 200);
  await page.waitForTimeout(300);
  assert.equal(await page.locator('.dragout').count(), 0);
  assert.equal(await page.locator(OWN).count(), 0);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});
