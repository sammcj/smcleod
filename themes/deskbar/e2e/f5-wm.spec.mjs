// Browser checks for window-manager gestures: tearing tabs off a stack, sliding tabs, grip resize, frame drag,
// quarter snaps (D5), the reading layout across the phone breakpoint (D7, D17) and landscape phones.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useBrowser, open, shot, win, cards, visibleWins, dragTab, desktop, phone, needs } from './lib.mjs';

useBrowser();

const landscape = { width: 844, height: 390 };
const touch = { hasTouch: true, isMobile: true };

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${+a.toFixed(2)} vs ${+b.toFixed(2)} (±${tol})`);

// Frame rect of the window showing a view, or null. Reads the DOM at once rather than waiting like a locator,
// so a missing window fails the assertion instead of timing out.
const rectOf = (page, key) => page.evaluate(k => {
  const r = document.querySelector(`.win:not([hidden]) .view[data-key="${k}"]:not([hidden])`)?.closest('.win').getBoundingClientRect();
  return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null;
}, key);

// The usable desk in viewport coordinates, matching windows.js deskRect() plus the desk's offset below the panel
const deskGeo = page => page.evaluate(() => {
  const d = document.getElementById('desk'), r = d.getBoundingClientRect(), dock = document.getElementById('dock');
  return {
    x: r.left, y: r.top, w: d.clientWidth, h: d.clientHeight - (dock ? dock.offsetHeight + 16 : 0),
    th: parseInt(getComputedStyle(document.documentElement).getPropertyValue('--tab-h'), 10),
  };
});

// Two animation frames, so layout from a resize or media query change has been applied
const settle = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

async function drag(page, from, to, { shift = false } = {}) {
  await page.mouse.move(from.x, from.y);
  if (shift) await page.keyboard.down('Shift');
  await page.mouse.down();
  // a short first leg passes the 5px drag threshold before the long move
  await page.mouse.move(from.x + Math.sign(to.x - from.x) * 10, from.y + Math.sign(to.y - from.y) * 10, { steps: 2 });
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();
  if (shift) await page.keyboard.up('Shift');
}

const centre = b => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

async function openPage(t, path) {
  if (!(await needs(t, path))) return null;
  const page = await open(desktop, path);
  await win(page, 'page:' + path).waitFor();
  return page;
}

async function openPost(page) {
  await cards(page).first().click();
  await win(page, 'reader').locator('.rd h1').waitFor();
}

test('D4: an inactive tab dragged off a stack becomes its own window', async t => {
  if (!(await needs(t, '/markdown/'))) return;
  const page = await openPage(t, '/about/');
  if (!page) return;
  await page.evaluate(() => window.deskbar.go('/markdown/'));
  await win(page, 'page:/markdown/').waitFor();
  const before = await visibleWins(page);

  // page windows open at the same spot, so move Markdown clear of About before stacking
  await dragTab(page, 'page:/markdown/', { x: 300, y: 500 });
  await page.mouse.up();
  const src = await win(page, 'page:/markdown/').locator('.tab.on .tt').boundingBox();
  const dst = await win(page, 'page:/about/').locator('.tab.on .tt').boundingBox();
  await drag(page, { x: src.x + 20, y: src.y + src.height / 2 }, centre(dst));
  const stack = page.locator('.win:not([hidden]):has(.tabs.multi)');
  assert.equal(await stack.count(), 1, 'dropping a tab on another stacks the windows');
  assert.equal(await stack.locator('.tab').count(), 2);
  assert.equal(await visibleWins(page), before - 1);
  await shot(page, 'w1-stacked');

  // Markdown was dropped last, so it is the active tab and About is the inactive one
  const off = await stack.locator('.tab:not(.on) .tt').boundingBox();
  const to = { x: 1000, y: 600 };
  await drag(page, { x: off.x + 20, y: off.y + off.height / 2 }, to);
  assert.equal(await stack.count(), 0, 'no stack is left');
  assert.equal(await visibleWins(page), before);
  assert.equal(await win(page, 'page:/markdown/').locator('.tab').count(), 1, 'the source window keeps one view');
  const torn = await rectOf(page, 'page:/about/');
  assert.ok(torn, 'About has its own window');
  // detachView places the new window's tab under the pointer: 40px in, half a tab above the frame
  near(torn.x, to.x - 40, 12, 'torn-off window follows the pointer (x)');
  near(torn.y, to.y + 12, 12, 'torn-off window follows the pointer (y)');
  await shot(page, 'w2-torn-off');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('D4: shift-dragging a lone tab slides it along the top edge within the frame', async t => {
  const page = await openPage(t, '/about/');
  if (!page) return;
  const w = win(page, 'page:/about/'), tab = w.locator('.tab');
  const wb = await w.boundingBox(), t0 = await tab.boundingBox();
  const y = t0.y + t0.height / 2;

  await drag(page, { x: t0.x + 20, y }, { x: t0.x + 220, y }, { shift: true });
  const t1 = await tab.boundingBox();
  near(t1.x, t0.x + 200, 3, 'tab slid right with the pointer');
  assert.deepEqual(await w.boundingBox(), wb, 'the window does not move');

  await drag(page, { x: t1.x + 20, y }, { x: desktop.width - 2, y }, { shift: true });
  const t2 = await tab.boundingBox();
  near(t2.x + t2.width, wb.x + wb.width, 2, 'tab stops at the right edge of the frame');

  await drag(page, { x: t2.x + 20, y }, { x: 2, y }, { shift: true });
  near((await tab.boundingBox()).x, wb.x, 2, 'tab stops at the left edge of the frame');
  assert.deepEqual(await w.boundingBox(), wb, 'the window still has not moved');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('D5: the grip resizes, with a 300x180 minimum, and unsnaps a snapped window', async t => {
  const page = await openPage(t, '/about/');
  if (!page) return;
  const w = win(page, 'page:/about/'), grip = w.locator('.grip');
  const b0 = await w.boundingBox();

  const g0 = centre(await grip.boundingBox());
  await drag(page, g0, { x: g0.x + 120, y: g0.y + 80 });
  const b1 = await w.boundingBox();
  near(b1.width, b0.width + 120, 3, 'width grows with the grip');
  near(b1.height, b0.height + 80, 3, 'height grows with the grip');
  assert.deepEqual([b1.x, b1.y], [b0.x, b0.y], 'top-left corner stays put');

  await drag(page, centre(await grip.boundingBox()), { x: b1.x + 5, y: b1.y + 5 });
  const b2 = await w.boundingBox();
  near(b2.width, 300, 1, 'minimum width');
  near(b2.height, 180, 1, 'minimum height');

  // snap left, then resize: the window is free now, so dragging it off keeps the resized size rather than
  // restoring the 300x180 it had before snapping
  await dragTab(page, 'page:/about/', { x: 2, y: 450 });
  await page.mouse.up();
  const sb = await w.boundingBox();
  near(sb.width, desktop.width / 2, 20, 'snapped to the left half');
  const g = centre(await grip.boundingBox());
  await drag(page, g, { x: g.x - 200, y: g.y - 100 });
  const b3 = await w.boundingBox();
  near(b3.width, sb.width - 200, 3, 'snapped window resizes from its snapped size');
  await dragTab(page, 'page:/about/', { x: 700, y: 400 });
  await page.mouse.up();
  const b4 = await w.boundingBox();
  near(b4.width, b3.width, 3, 'resizing unsnapped it: no restore on drag (width)');
  near(b4.height, b3.height, 3, 'resizing unsnapped it: no restore on drag (height)');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('D5: dragging the frame border moves the window and unsnaps a snapped one', async t => {
  const page = await openPage(t, '/about/');
  if (!page) return;
  const w = win(page, 'page:/about/');
  const b0 = await w.boundingBox();
  // the frame's padding is the only place a press lands on .frame itself
  const edge = b => ({ x: b.x + 2, y: b.y + b.height / 2 });
  const isFrame = p => page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.classList.contains('frame'), p);
  assert.ok(await isFrame(edge(b0)), 'the press point is on the frame border');

  await drag(page, edge(b0), { x: edge(b0).x + 150, y: edge(b0).y + 100 });
  const b1 = await w.boundingBox();
  near(b1.x, b0.x + 150, 2, 'moved right');
  near(b1.y, b0.y + 100, 2, 'moved down');
  assert.deepEqual([b1.width, b1.height], [b0.width, b0.height], 'size unchanged');

  await dragTab(page, 'page:/about/', { x: desktop.width - 2, y: 450 });
  await page.mouse.up();
  const sb = await w.boundingBox();
  assert.ok(sb.x > desktop.width / 2 - 10 && Math.abs(sb.width - b0.width) > 20, `snapped to the right half (${sb.x}, ${sb.width})`);
  assert.ok(await isFrame(edge(sb)));
  await drag(page, edge(sb), { x: edge(sb).x - 100, y: edge(sb).y + 50 });
  const b2 = await w.boundingBox();
  near(b2.width, b0.width, 2, 'unsnapped back to its old width');
  near(b2.height, b0.height, 2, 'unsnapped back to its old height');
  assert.notEqual(b2.x, sb.x, 'and moved');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('D5: dragging a tab to each corner snaps the window to that quarter', async t => {
  const page = await openPage(t, '/about/');
  if (!page) return;
  const d = await deskGeo(page), w = win(page, 'page:/about/');
  // zoneAt: within 14px of a side edge and 110px of the top or bottom of the usable desk
  const corners = {
    tl: { x: d.x + 3, y: d.y + 60 }, tr: { x: d.x + d.w - 3, y: d.y + 60 },
    bl: { x: d.x + 3, y: d.y + d.h - 50 }, br: { x: d.x + d.w - 3, y: d.y + d.h - 50 },
  };
  for (const [zone, p] of Object.entries(corners)) {
    await dragTab(page, 'page:/about/', p);
    assert.ok(await page.locator('#snapPreview').isVisible(), `${zone}: preview shows`);
    await page.mouse.up();
    const b = await w.boundingBox();
    near(b.width, d.w / 2, 12, `${zone}: half the desk wide`);
    near(b.height, d.h / 2 - d.th, 12, `${zone}: half the desk high, less the tab`);
    near(b.x, zone[1] === 'l' ? d.x : d.x + d.w / 2, 12, `${zone}: left edge`);
    near(b.y - d.th, zone[0] === 't' ? d.y : d.y + d.h / 2, 12, `${zone}: top edge including the tab`);
  }
  await shot(page, 'w3-quarter');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

// Waits for main.js to move the Windows switcher for the new width, then for layout to catch up
async function resizeTo(page, size) {
  await page.setViewportSize(size);
  const inPanel = size.width < 768;
  await page.waitForFunction(p => !!document.querySelector(p ? '#panel #winsBtn' : '#dock #winsBtn'), inPanel);
  await settle(page);
}

async function assertReadingLayout(page, width, label) {
  const tr = await rectOf(page, 'tracker'), rr = await rectOf(page, 'reader');
  assert.ok(tr, `${label}: Tracker is showing`);
  assert.ok(rr, `${label}: reader is showing`);
  assert.ok(tr.x < rr.x, `${label}: Tracker is left of the reader`);
  near(tr.width / width, 0.25, 0.05, `${label}: Tracker is about a quarter wide`);
  near(rr.width / width, 0.75, 0.05, `${label}: reader is about three quarters wide`);
  near(rr.x + rr.width, width, 12, `${label}: reader reaches the right edge`);
}

async function assertPhoneLayout(page, size, label) {
  assert.equal(await visibleWins(page), 1, `${label}: one window at a time`);
  const rr = await rectOf(page, 'reader');
  assert.ok(rr, `${label}: the reader is the window showing`);
  assert.equal(rr.x, 0, `${label}: reader starts at the left edge`);
  assert.equal(rr.width, size.width, `${label}: reader is full width`);
  assert.ok(await page.locator('#panel #panelHome').isVisible(), `${label}: Home sits in the panel`);
  assert.ok(!(await page.locator('#dock #homeBtn').isVisible()), `${label}: and not the dock`);
}

test('D7/D17: the reading layout survives a trip through phone width', async () => {
  const page = await open(desktop);
  await openPost(page);
  await win(page, 'tracker').waitFor();
  await assertReadingLayout(page, desktop.width, 'desktop');

  await resizeTo(page, phone);
  await assertPhoneLayout(page, phone, 'phone');
  await shot(page, 'w4-to-phone');

  await resizeTo(page, desktop);
  assert.ok(await page.locator('#dock #homeBtn').isVisible(), 'Home is back in the dock');
  await assertReadingLayout(page, desktop.width, 'back to desktop');
  await shot(page, 'w5-back-to-desktop');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('D7/D17: a post opened on a phone is in the reading layout once the screen widens', async () => {
  const page = await open(phone);
  await openPost(page);
  await assertPhoneLayout(page, phone, 'phone');

  await resizeTo(page, desktop);
  await assertReadingLayout(page, desktop.width, 'widened');
  await shot(page, 'w6-phone-widened');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('D17: a landscape phone gets phone mode: one full-screen window, Home in the panel, no snapping', async () => {
  const page = await open(landscape, '/', undefined, touch);
  assert.ok(await page.evaluate(() => matchMedia('(pointer: coarse)').matches), 'context emulates a touch screen');
  await openPost(page);
  await settle(page);
  await assertPhoneLayout(page, landscape, 'landscape');
  await shot(page, 'w7-landscape');

  const before = await rectOf(page, 'reader');
  await dragTab(page, 'reader', { x: 2, y: landscape.height / 2 });
  assert.ok(await page.locator('#snapPreview').isHidden(), 'no snap preview');
  await page.mouse.up();
  // the window grows as the post's images load, so its place and width are what a snap would change
  const after = await rectOf(page, 'reader');
  assert.deepEqual([after.x, after.width], [before.x, before.width], 'dragging the tab to an edge does not snap');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('page windows open centred on the desk, at the front matter windowWidth', async () => {
  const page = await open(desktop, '/about/');
  await win(page, 'page:/about/').waitFor();
  const r = await rectOf(page, 'page:/about/'), d = await deskGeo(page);
  // each site sets its own width in front matter (the example 880, smcleod.net 884)
  const want = await page.evaluate(() => fetch('/about/').then(res => res.text()).then(h => +/data-width="?(\d+)/.exec(h)?.[1]));
  near(r.width, want || 880, 1, 'windowWidth');
  near(r.x - d.x, (d.w - r.width) / 2, 2, 'centred across');
  near(r.y - d.y, (d.h - r.height) / 2, 2, 'centred down');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

// Front matter windowWidth and windowHeight size any app's window, not just plain pages
test('a folder window opens centred at its front matter windowWidth and windowHeight', async t => {
  if (!(await needs(t, '/links/'))) return;
  const page = await open(desktop, '/links/');
  await win(page, 'folder:/links/').waitFor();
  const r = await rectOf(page, 'folder:/links/'), d = await deskGeo(page);
  const [w, h] = await page.evaluate(() => fetch('/links/').then(res => res.text()).then(s => [/data-width="?(\d+)/, /data-height="?(\d+)/].map(re => +re.exec(s)?.[1])));
  assert.ok(w && h, `/links/ sets both sizes (${w}, ${h})`);
  near(r.width, w, 1, 'windowWidth');
  near(r.height, h, 1, 'windowHeight');
  near(r.x - d.x, (d.w - r.width) / 2, 2, 'centred across');
  near(r.y - d.y, (d.h - r.height) / 2, 2, 'centred down');

  // a front matter size larger than the desk is clamped to it
  await resizeTo(page, { width: 800, height: 500 });
  await page.locator('.tab.on .ctl.close').first().click();
  await page.evaluate(() => window.deskbar.go('/links/'));
  await win(page, 'folder:/links/').waitFor();
  const r2 = await rectOf(page, 'folder:/links/'), d2 = await deskGeo(page);
  assert.ok(r2.width <= d2.w && r2.y + r2.height <= d2.y + d2.h, `fits the small desk (${JSON.stringify(r2)})`);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('Tracker opens at 1170x696, clamped to a small desk', async () => {
  const page = await open(desktop, '/posts/');
  await win(page, 'tracker').waitFor();
  const r = await rectOf(page, 'tracker');
  assert.deepEqual([r.width, r.height], [1170, 696]);
  await page.context().close();

  const small = await open({ width: 1000, height: 600 }, '/posts/');
  await win(small, 'tracker').waitFor();
  const s = await rectOf(small, 'tracker'), d = await deskGeo(small);
  assert.ok(s.x + s.width <= d.x + d.w && s.y + s.height <= d.y + d.h, `fits the desk (${JSON.stringify(s)})`);
  await small.context().close();
});

test('resizing by the grip shows the size until release', async t => {
  const page = await openPage(t, '/about/');
  if (!page) return;
  const w = win(page, 'page:/about/'), g = centre(await w.locator('.grip').boundingBox());
  await page.mouse.move(g.x, g.y);
  await page.mouse.down();
  await page.mouse.move(g.x + 40, g.y + 30, { steps: 5 });
  const b = await w.boundingBox(), size = w.locator('.sizer');
  assert.equal(await size.textContent(), `${Math.round(b.width)} × ${Math.round(b.height)}`);
  assert.equal(await size.getAttribute('aria-hidden'), 'true');
  assert.equal(await size.evaluate(el => getComputedStyle(el).pointerEvents), 'none');
  await page.mouse.up();
  assert.equal(await size.count(), 0, 'removed on release');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('a dock item lights its running dot while a lazy app opened from it is open, and after a deep link', async () => {
  const page = await open(desktop, '/control-panel/?pane=system');
  await win(page, 'control-panel').waitFor();
  await page.waitForFunction(() => document.querySelector('#dock a.dk[href="/control-panel/"]')?.classList.contains('run'));
  await win(page, 'control-panel').locator('.tab .ctl.close').click();
  await page.waitForFunction(() => !document.querySelector('#dock a.dk[href="/control-panel/"]').classList.contains('run'));
  assert.deepEqual(page.errors, []);
  await page.context().close();
});
