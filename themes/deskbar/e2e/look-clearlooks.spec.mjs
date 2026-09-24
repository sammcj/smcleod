// GNOME 2 Clearlooks (css/deskbar/looks/clearlooks.css): Metacity's blue title bars across each window, greyed when
// unfocused, light panels top and bottom with the window list and a workspace pager in the bottom one, its own
// wallpaper, square touch-sized title bars on phones, nothing left behind when it is off, and axe in light and dark.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { useBrowser, open, win, cards, desktop, phone } from './lib.mjs';

useBrowser();

const LOOK = { deco: 'clearlooks', wall: 'clearlooks', dock: 'panel' };
// visitor settings stored before the page's own scripts run, as a script string since open() passes no argument
const openLook = (vp, path, look, opts) => open(vp, path, `for (const [k, v] of Object.entries(${JSON.stringify(look)})) localStorage.setItem('deskbar:' + k, JSON.stringify(v));`, opts);
const css = (loc, prop, pseudo) => loc.first().evaluate((el, [p, ps]) => getComputedStyle(el, ps)[p], [prop, pseudo]);
const box = loc => loc.first().boundingBox();
const rgbs = s => [...s.matchAll(/rgba?\((\d+), (\d+), (\d+)/g)].map(m => m.slice(1, 4).map(Number));
const blue = ([r, g, b]) => b > r + 40 && b > g + 20;
const grey = ([r, g, b]) => Math.max(r, g, b) - Math.min(r, g, b) < 24;

// a post open over the Posts window, so there is a focused and an unfocused window
async function twoWindows(page) {
  await win(page, 'tracker').locator('a[data-url]').first().click();
  await win(page, 'reader').locator('.rd h1').waitFor();
}

test('Clearlooks: Metacity title bars, two light panels, the window list and pager at the bottom, its wallpaper', async () => {
  const page = await openLook(desktop, '/posts/', LOOK);
  await twoWindows(page);
  assert.ok(await page.evaluate(() => [...document.querySelectorAll('head link[rel=stylesheet]')].some(l => /looks\/clearlooks/.test(l.href))), 'its stylesheet is linked');
  assert.match(await css(page.locator('body'), 'fontFamily'), /DejaVu Sans/);

  // the focused window's title bar: a blue gradient, white bold title, the full width of the frame
  const tab = page.locator('.win.active .tab.on'), frame = page.locator('.win.active .frame');
  const bg = rgbs(await css(tab, 'backgroundImage'));
  assert.ok(bg.length >= 3 && bg.every(blue), `blue gradient: ${JSON.stringify(bg)}`);
  assert.equal(await css(tab.locator('.tt'), 'color'), 'rgb(255, 255, 255)');
  const [tb, fb] = [await box(tab), await box(frame)];
  assert.ok(Math.abs(tb.x - fb.x) <= 1 && Math.abs(tb.width - fb.width) <= 1, `title bar ${JSON.stringify(tb)} over frame ${JSON.stringify(fb)}`);
  assert.ok(Math.abs(tb.y + tb.height - fb.y) <= 1, 'joined to the frame');
  assert.equal(await css(tab, 'borderTopLeftRadius'), '5px');
  const [title, min, max, close] = await Promise.all(['.tt', '.ctl.min', '.ctl.max', '.ctl.close'].map(s => box(tab.locator(s))));
  assert.ok(title.x < min.x && min.x < max.x && max.x < close.x, 'title, then minimise, maximise and close');
  assert.ok(close.x + close.width >= tb.x + tb.width - 8, 'buttons at the right end');

  // the other window is greyed
  const off = page.locator('.win:not(.active) .tab');
  const obg = rgbs(await css(off, 'backgroundImage'));
  assert.ok(obg.length >= 2 && obg.every(grey), `grey gradient: ${JSON.stringify(obg)}`);
  assert.notEqual(await css(off.locator('.tt'), 'color'), 'rgb(255, 255, 255)');

  // both panels are light grey gradients; the dock is the bottom panel, holding the window list and the pager
  for (const sel of ['#panel', '#dock']) assert.ok(rgbs(await css(page.locator(sel), 'backgroundImage')).every(c => grey(c) && c[0] > 200), `${sel} light grey`);
  const vp = page.viewportSize(), dock = await box(page.locator('#dock'));
  assert.equal(dock.width, vp.width, 'the bottom panel spans the screen');
  assert.ok(Math.abs(dock.y + dock.height - vp.height) <= 1 && dock.height <= 40, `a slim panel on the bottom edge: ${JSON.stringify(dock)}`);
  const tasks = page.locator('#tasks .task');
  assert.equal(await tasks.count(), 2);
  for (const t of await tasks.all()) {
    const b = await t.boundingBox();
    assert.ok(b.y >= dock.y && b.y + b.height <= vp.height, `window list button in the bottom panel: ${JSON.stringify(b)}`);
  }
  const home = await box(page.locator('#dock #homeBtn')), pager = await box(page.locator('#dock #winsBtn'));
  assert.ok(home.x < 20 && pager.x + pager.width > vp.width - 20, 'Show desktop first, the pager last');
  assert.ok(rgbs(await css(page.locator('#dock #winsBtn'), 'backgroundImage', '::after')).some(blue), 'pager with a current workspace');
  assert.equal(await page.locator('#winsN').textContent(), '2');

  // a minimised window's title is in brackets
  await win(page, 'reader').locator('.tab.on .ctl.min').click();
  await page.locator('#tasks .task.min').waitFor();
  assert.equal(await css(page.locator('#tasks .task.min span'), 'content', '::before'), '"["');

  // the wallpaper: GNOME blue under a faint foot
  const wall = await css(page.locator('body'), 'backgroundImage');
  assert.match(wall, /data:image\/svg\+xml/);
  assert.ok(rgbs(wall).some(blue));
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('Clearlooks dark: dark panels and windows, the title bar still blue', async () => {
  const page = await openLook(desktop, '/posts/', LOOK, { colorScheme: 'dark' });
  await twoWindows(page);
  assert.ok(rgbs(await css(page.locator('#panel'), 'backgroundImage')).every(c => grey(c) && c[0] < 90), 'dark grey panel');
  assert.ok(rgbs(await css(page.locator('.win.active .tab.on'), 'backgroundImage')).every(blue));
  assert.ok(rgbs(await css(page.locator('.win.active .views'), 'backgroundColor'))[0].every(v => v < 60), 'dark content');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('Clearlooks on a phone: a square, full-width title bar with touch-sized buttons', async () => {
  const page = await openLook(phone, '/', LOOK, { hasTouch: true, isMobile: true });
  for (const d of await page.locator('#dock .dk').all()) assert.ok((await d.boundingBox()).height >= 44, 'touch-sized launchers');
  await cards(page).first().click();
  const w = win(page, 'reader');
  await w.locator('.rd h1').waitFor();
  const tab = w.locator('.tab.on');
  const tb = await box(tab);
  assert.ok(tb.x === 0 && tb.width === phone.width, `full width: ${JSON.stringify(tb)}`);
  assert.equal(await css(tab, 'borderTopLeftRadius'), '0px');
  assert.ok(rgbs(await css(tab, 'backgroundImage')).every(blue));
  const c = await box(tab.locator('.ctl.close'));
  assert.ok(c.width >= 40 && c.height >= 30, `close button: ${JSON.stringify(c)}`);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('with the Clearlooks wallpaper alone, the window style and panels stay as they were', async () => {
  const page = await openLook(desktop, '/posts/', { wall: 'clearlooks' });
  await twoWindows(page);
  assert.equal(await css(page.locator('.win.active .tab.on'), 'backgroundColor'), 'rgb(255, 203, 0)', 'Haiku yellow tab');
  assert.equal(await css(page.locator('#tasks'), 'position'), 'static', 'window list in the top panel');
  assert.match(await css(page.locator('body'), 'backgroundImage'), /data:image\/svg\+xml/, 'the wallpaper itself applies');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

// axe over the reading layout and the menu, as a11y.spec.mjs does for the other looks
const AXE = readFileSync(fileURLToPath(import.meta.resolve('axe-core/axe.min.js')), 'utf8');
async function audit(page) {
  await page.addScriptTag({ content: AXE });
  const { violations } = await page.evaluate(() => window.axe.run(document, { iframes: false, resultTypes: ['violations'] }));
  return violations.filter(v => ['serious', 'critical'].includes(v.impact))
    .flatMap(v => v.nodes.map(n => `${v.impact} ${v.id}: ${n.target.join(' ')} ${n.failureSummary?.split('\n')[1]?.trim() ?? ''}`));
}

test('axe: Clearlooks at 1440 and 390, light and dark', async () => {
  const found = [];
  for (const [vp, w] of [[desktop, 1440], [phone, 390]]) {
    for (const theme of ['light', 'dark']) {
      const page = await openLook(vp, '/', { ...LOOK, theme }, { colorScheme: theme });
      await cards(page).first().click();
      await win(page, 'reader').locator('.rd h1').waitFor();
      for (const v of await audit(page)) found.push(`[${w} ${theme} reader] ${v}`);
      await page.locator('#menuBtn').click();
      await page.locator('#menu .mn-it').first().waitFor();
      for (const v of await audit(page)) found.push(`[${w} ${theme} menu] ${v}`);
      await page.context().close();
    }
  }
  assert.deepEqual(found, []);
});
