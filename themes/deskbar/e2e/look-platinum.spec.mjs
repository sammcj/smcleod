// Mac OS 9 Platinum (css/deskbar/looks/platinum.css): a pinstriped title bar with the close box on the left and the
// zoom and windowshade boxes on the right, its own wallpaper, the rainbow apple for the Menu, white-boxed icon labels
// and the Control Strip as the dock. Touch-sized on phones, readable in both schemes, and nothing of it shows while
// another window style is on, though the Control panel has loaded its stylesheet. Skips without /control-panel/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { useBrowser, open, needs, shot, win, cards, desktop, phone } from './lib.mjs';

useBrowser();

const seed = () => {
  localStorage.setItem('deskbar:deco', '"platinum"');
  localStorage.setItem('deskbar:wall', '"platinum"');
  // follow the browser's scheme, which the dark-mode tests set
  localStorage.setItem('deskbar:theme', '"auto"');
};
const css = (loc, prop, pseudo = null) => loc.first().evaluate((el, [p, ps]) => getComputedStyle(el, ps)[p], [prop, pseudo]);
const box = loc => loc.first().boundingBox();
// WCAG contrast of an element's text on its title bar's grey
const contrast = (tab, sel) => tab.locator(sel).first().evaluate((el, bar) => {
  const lum = c => {
    const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map(v => (v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [a, b] = [lum(getComputedStyle(el).color), lum(getComputedStyle(el.closest(bar)).backgroundColor)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}, '.tab');
// the Posts window with a post opened from it: the post's window in front, Posts behind
async function twoWindows(page) {
  await win(page, 'tracker').locator('a[data-url]').first().click();
  await win(page, 'reader').locator('.rd h1').waitFor();
}

test('Platinum: pinstriped title bar, three boxes, wallpaper, rainbow apple, icon labels and the Control Strip', async t => {
  if (!(await needs(t, '/control-panel/'))) return;
  const page = await open(desktop, '/posts/', seed);
  await twoWindows(page);
  assert.deepEqual(await page.evaluate(() => ({ ...document.documentElement.dataset })).then(d => [d.deco, d.wall, d.dock]), ['platinum', 'platinum', undefined]);

  // the front window's title bar spans its frame and is pinstriped; the one behind is plain grey without its boxes
  const front = page.locator('.win.active'), back = page.locator('.win:not(.active)');
  const [tb, fb] = [await box(front.locator('.tab')), await box(front.locator('.frame'))];
  assert.ok(Math.abs(tb.x - fb.x) <= 1 && Math.abs(tb.width - fb.width) <= 1, `title bar ${JSON.stringify(tb)} over frame ${JSON.stringify(fb)}`);
  assert.match(await css(front.locator('.tab'), 'backgroundImage'), /repeating-linear-gradient/, 'pinstripes');
  assert.equal(await css(back.locator('.tab'), 'backgroundImage'), 'none', 'no pinstripes behind');
  assert.equal(await css(back.locator('.ctl.close'), 'visibility'), 'hidden', 'no boxes behind');

  // close on the left; zoom (maximise) then windowshade (minimise) on the right, the title centred between
  const [close, title, max, min] = await Promise.all(['.ctl.close', '.tt', '.ctl.max', '.ctl.min'].map(s => box(front.locator(`.tab ${s}`))));
  assert.ok(close.x < title.x && title.x < max.x && max.x < min.x, 'close, title, zoom, windowshade');
  assert.ok(close.x - tb.x < 8 && tb.x + tb.width - (min.x + min.width) < 8, 'boxes at the ends');
  assert.ok(Math.abs(title.x + title.width / 2 - (tb.x + tb.width / 2)) < 30, 'title centred');
  for (const s of ['.ctl.close', '.ctl.max', '.ctl.min']) assert.equal(await css(front.locator(s), 'width', '::before'), '13px', `${s} is a 13px box`);
  assert.equal(await css(front.locator('.ctl.max'), 'content', '::after'), '""', 'zoom box mark');
  assert.equal(await css(front.locator('.ctl svg'), 'display'), 'none', 'boxes, not icons');

  // the wallpaper, the apple, the rounded screen corners and the icon labels
  assert.match(await css(page.locator('body'), 'backgroundImage'), /repeating-linear-gradient\(45deg.*rgb\(111, 108, 192\)/);
  assert.match(await css(page.locator('#menuBtn'), 'maskImage', '::before'), /^url\("data:image\/svg\+xml/);
  assert.match(await css(page.locator('#menuBtn'), 'backgroundImage', '::before'), /rgb\(94, 189, 62\).*rgb\(0, 156, 223\)/, 'rainbow');
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement, '::before').position), 'fixed');
  const label = page.locator('#icons .dicon span');
  assert.deepEqual([await css(label, 'backgroundColor'), await css(label, 'color')], ['rgb(255, 255, 255)', 'rgb(0, 0, 0)']);

  // the Control Strip: from the left edge, rounded at its far end, modules between grooves
  const dock = page.locator('#dock');
  assert.equal((await box(dock)).x, 0);
  assert.equal(await css(dock, 'borderTopRightRadius'), '9px');
  assert.equal(await css(dock, 'content', '::after'), '""', 'ridged end tab');
  assert.match(await css(page.locator('#dock .dk'), 'borderRightStyle'), /solid/);

  // light: dark text on the grey; the title behind stays readable
  assert.ok(await contrast(front, '.tt') >= 4.5);
  assert.ok(await contrast(back, '.tt') >= 4.5);
  await shot(page, 'platinum');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('Platinum in dark mode: darker greys, the same shapes, text at 4.5:1', async t => {
  if (!(await needs(t, '/control-panel/'))) return;
  const page = await open(desktop, '/posts/', seed, { colorScheme: 'dark' });
  await twoWindows(page);
  const front = page.locator('.win.active'), back = page.locator('.win:not(.active)');
  assert.equal(await css(front.locator('.tab'), 'backgroundColor'), 'rgb(68, 68, 73)');
  assert.match(await css(front.locator('.tab'), 'backgroundImage'), /repeating-linear-gradient/);
  assert.ok(await contrast(front, '.tt') >= 4.5);
  assert.ok(await contrast(back, '.tt') >= 4.5);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('Platinum on a phone: a full-width title bar and Control Strip with touch-sized targets', async t => {
  if (!(await needs(t, '/control-panel/'))) return;
  const page = await open(phone, '/', seed);
  const dock = page.locator('#dock');
  assert.equal((await box(dock)).x, 0);
  for (const b of await page.locator('#dock .dk').all()) assert.ok((await b.boundingBox()).height >= 44, 'launchers 44px tall');
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement, '::before').content), 'none', 'no screen corners');

  await cards(page).first().click();
  const front = win(page, 'reader');
  await front.locator('.rd h1').waitFor();
  const tb = await box(front.locator('.tab'));
  assert.ok(tb.height >= 44 && tb.width >= phone.width - 1, `title bar ${JSON.stringify(tb)}`);
  assert.match(await css(front.locator('.tab'), 'backgroundImage'), /repeating-linear-gradient/);
  const close = await box(front.locator('.ctl.close'));
  assert.ok(close.width >= 44 && close.height >= 40, `close box target ${JSON.stringify(close)}`);
  assert.equal(await css(front.locator('.ctl.close'), 'width', '::before'), '20px');
  assert.equal(await front.locator('.ctl.max').isVisible(), false, 'no zoom on a phone');
  await shot(page, 'platinum-phone');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('another window style shows nothing of Platinum, with its stylesheet loaded', async t => {
  if (!(await needs(t, '/control-panel/'))) return;
  const page = await open(desktop, '/control-panel/');
  await win(page, 'control-panel').locator('.cp').waitFor();
  const href = await page.evaluate(() => JSON.parse(document.getElementById('deskbar-lazy').textContent)['look-platinum']?.css);
  if (!href) return t.skip('no Platinum look in this build');
  await page.waitForFunction(h => !!document.querySelector(`link[rel=stylesheet][href="${h}"]`), href);
  assert.equal(await css(page.locator('.win.active .tab'), 'backgroundImage'), 'none');
  assert.notEqual(await css(page.locator('.win.active .ctl svg'), 'display'), 'none');
  assert.doesNotMatch(await css(page.locator('body'), 'backgroundImage'), /45deg/);
  assert.notEqual((await box(page.locator('#dock'))).x, 0);
  assert.equal(await css(page.locator('#menuBtn'), 'content', '::before'), 'none');
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement, '::before').content), 'none');
  // its thumbnails in the Control panel are drawn all the same
  assert.match(await css(page.locator('.cp-deco.platinum'), 'backgroundImage', '::before'), /repeating-linear-gradient/);
  assert.match(await css(page.locator('.cp-wp.platinum'), 'backgroundImage'), /rgb\(111, 108, 192\)/);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('picking Platinum plays the startup chime and sets the menus in Chicago; a reload stays quiet', async t => {
  if (!(await needs(t, '/control-panel/'))) return;
  // counts the chime's oscillators; the real context stays silent in a headless browser
  const spy = () => {
    window.__notes = 0;
    const start = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (...a) { window.__notes++; return start.apply(this, a); };
  };
  const page = await open(desktop, '/control-panel/', spy);
  await win(page, 'control-panel').locator('.cp').waitFor();
  await page.locator('.cp-opt', { hasText: 'Flat' }).click();
  assert.equal(await page.evaluate(() => window.__notes), 0, 'other styles are quiet');
  await page.locator('.cp-opt', { hasText: 'Platinum' }).first().click();
  await page.waitForFunction(() => document.documentElement.dataset.deco === 'platinum');
  assert.equal(await page.evaluate(() => window.__notes), 14, 'seven notes of two voices');
  assert.match(await css(page.locator('#panel'), 'fontFamily'), /Chicago FLF/);
  await page.evaluate(() => document.fonts.ready);
  assert.ok(await page.evaluate(() => document.fonts.check("12px 'Chicago FLF'")), 'the font loads');
  await page.reload();
  await page.waitForSelector('html.wm-ready');
  await win(page, 'control-panel').locator('.cp').waitFor();
  assert.equal(await page.evaluate(() => window.__notes), 0);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

// axe over Platinum's reading layout (focused and muted title bars), the menu and the window switcher, at 1440 and
// 390, light and dark, as a11y.spec.mjs does for the other looks
const AXE = readFileSync(fileURLToPath(import.meta.resolve('axe-core/axe.min.js')), 'utf8');
async function audit(page) {
  await page.addScriptTag({ content: AXE });
  const { violations } = await page.evaluate(() => window.axe.run(document, { iframes: false, resultTypes: ['violations'] }));
  return violations.filter(v => ['serious', 'critical'].includes(v.impact))
    .flatMap(v => v.nodes.map(n => `${v.impact} ${v.id}: ${n.target.join(' ')}`));
}

test('axe: Platinum at 1440 and 390, light and dark', async t => {
  if (!(await needs(t, '/control-panel/'))) return;
  const found = [];
  for (const [vp, w] of [[desktop, 1440], [phone, 390]]) {
    for (const theme of ['light', 'dark']) {
      const page = await open(vp, '/', seed, { colorScheme: theme });
      const tag = `[${w} ${theme}`;
      for (const v of await audit(page)) found.push(`${tag} home] ${v}`);
      await cards(page).first().click();
      await win(page, 'reader').locator('.rd h1').waitFor();
      for (const v of await audit(page)) found.push(`${tag} reader] ${v}`);
      // a second window, as a phone shows the switcher only with one behind the front one
      await page.evaluate(() => window.deskbar.go('/posts/'));
      await win(page, 'tracker').waitFor();
      await page.locator('#winsBtn').click();
      await page.locator('#switcher .sw-tab').first().waitFor();
      for (const v of await audit(page)) found.push(`${tag} switcher] ${v}`);
      await page.keyboard.press('Escape');
      await page.locator('#menuBtn').click();
      await page.locator('#menu .mn-it').first().waitFor();
      for (const v of await audit(page)) found.push(`${tag} menu] ${v}`);
      await page.context().close();
    }
  }
  assert.deepEqual(found, []);
});
