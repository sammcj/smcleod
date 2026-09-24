// Pixel (css/deskbar/looks/pixel.css): ink rings with a knocked-out corner pixel around a title bar that spans and
// joins its frame, a sun bar dithered down to amber, keycap controls with pixel glyphs, a hotbar dock, Pixelify Sans
// on the chrome only, and a wallpaper of dithered sky over tiling hills: day in light, a dusk with twinkling stars in
// dark. Touch-sized on phones, readable in both schemes, and nothing of it shows while another window style is on,
// though the Control panel has loaded its stylesheet. Skips without /control-panel/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { useBrowser, open, needs, shot, win, cards, desktop, phone } from './lib.mjs';

useBrowser();

const seed = () => {
  localStorage.setItem('deskbar:deco', '"pixel"');
  localStorage.setItem('deskbar:wall', '"pixel"');
  // follow the browser's scheme, which the dark-mode tests set
  localStorage.setItem('deskbar:theme', '"auto"');
};
const css = (loc, prop, pseudo = null) => loc.first().evaluate((el, [p, ps]) => getComputedStyle(el, ps)[p], [prop, pseudo]);
const box = loc => loc.first().boundingBox();
const rootCss = (page, prop, pseudo) => page.evaluate(([p, ps]) => getComputedStyle(document.body, ps)[p], [prop, pseudo]);
// WCAG contrast of an element's text on its title bar's colour
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

test('Pixel: a ringed sun bar joined to its frame, keycap controls, pixel type, the hotbar and the day wallpaper', async t => {
  if (!(await needs(t, '/control-panel/'))) return;
  const page = await open(desktop, '/posts/', seed);
  await twoWindows(page);
  assert.deepEqual(await page.evaluate(() => ({ ...document.documentElement.dataset })).then(d => [d.deco, d.wall, d.dock]), ['pixel', 'pixel', undefined]);

  // the front window's bar spans its frame, wears the ink ring and dithers from sun to amber; the one behind is plain
  const front = page.locator('.win.active'), back = page.locator('.win:not(.active)');
  const [tb, fb] = [await box(front.locator('.tab')), await box(front.locator('.frame'))];
  assert.ok(Math.abs(tb.x - fb.x) <= 1 && Math.abs(tb.width - fb.width) <= 1, `title bar ${JSON.stringify(tb)} over frame ${JSON.stringify(fb)}`);
  assert.ok(Math.abs(tb.y + tb.height - fb.y) <= 1, 'the bar sits on the frame');
  assert.match(await css(front.locator('.tab'), 'borderImageSource'), /^url\("data:image\/svg\+xml/, 'ink ring');
  assert.equal(await css(front.locator('.tab'), 'borderBottomWidth'), '0px', 'joined to the frame');
  assert.equal(await css(front.locator('.frame'), 'borderTopWidth'), '0px');
  assert.match(await css(front.locator('.frame'), 'borderImageSource'), /svg\+xml/);
  assert.match(await css(front.locator('.tab'), 'backgroundImage'), /repeating-conic-gradient/, 'dithered sun bar');
  assert.equal(await css(back.locator('.tab'), 'backgroundImage'), 'none', 'no dither behind');
  assert.match(await css(front.locator('.tab'), 'boxShadow'), /rgba?\([^)]+\) 6px 6px 0px/, 'one hard shadow');

  // controls are keycaps drawing pixel glyphs through a mask, the SVG icons hidden
  for (const s of ['.ctl.close', '.ctl.min', '.ctl.max']) {
    assert.match(await css(front.locator(s), 'maskImage', '::before'), /^url\("data:image\/svg\+xml/, `${s} glyph`);
    assert.equal(await css(front.locator(s), 'width', '::before'), '10px');
    assert.match(await css(front.locator(s), 'borderImageSource'), /svg\+xml/, `${s} ring`);
  }
  assert.equal(await css(front.locator('.ctl svg'), 'display'), 'none', 'glyphs, not icons');

  // the chrome is set in Pixelify Sans; the post's body keeps the reading face
  assert.match(await css(front.locator('.tt'), 'fontFamily'), /Pixelify Sans/);
  assert.match(await css(page.locator('#panel'), 'fontFamily'), /Pixelify Sans/);
  assert.doesNotMatch(await css(front.locator('.rd p:not(.meta, .lede)'), 'fontFamily'), /Pixelify/);
  await page.evaluate(() => document.fonts.ready);
  assert.ok(await page.evaluate(() => document.fonts.check("15px 'Pixelify Sans'")), 'the font loads');

  // the day scene: sun, hills and sky strip on the body, clouds drifting, no stars by day
  const wall = await rootCss(page, 'backgroundImage');
  assert.equal((wall.match(/data:image\/svg\+xml/g) || []).length, 3, 'orb, hills and sky');
  assert.match(wall, /2f7fd8/, 'the day sky');
  assert.equal(await rootCss(page, 'backgroundImage', '::before'), 'none', 'no stars by day');
  assert.match(await rootCss(page, 'backgroundImage', '::after'), /svg\+xml/, 'clouds');
  assert.equal(await page.evaluate(() => getComputedStyle(document.body, '::after').position), 'fixed');

  // the hotbar: a ringed slab of recessed slots, Home on sun, and ink captions under the desktop icons
  const dock = page.locator('#dock');
  assert.match(await css(dock, 'borderImageSource'), /svg\+xml/);
  assert.equal(await css(dock, 'borderRadius'), '0px');
  assert.match(await css(page.locator('#dock .dk'), 'boxShadow'), /inset/);
  assert.equal(await css(page.locator('#dock #homeBtn'), 'backgroundColor'), 'rgb(255, 205, 77)');
  const label = page.locator('#icons .dicon span');
  assert.equal(await css(label, 'backgroundColor'), 'rgb(28, 26, 46)');
  assert.match(await css(label, 'fontFamily'), /Pixelify Sans/);

  // light: ink on the sun bar; the title behind stays readable
  assert.ok(await contrast(front, '.tt') >= 4.5);
  assert.ok(await contrast(back, '.tt') >= 4.5);
  await shot(page, 'pixel');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('Pixel in dark mode: the dusk scene with stars that twinkle, the same bar, text at 4.5:1', async t => {
  if (!(await needs(t, '/control-panel/'))) return;
  const page = await open(desktop, '/posts/', seed, { colorScheme: 'dark', reducedMotion: 'no-preference' });
  await twoWindows(page);
  const front = page.locator('.win.active'), back = page.locator('.win:not(.active)');
  assert.match(await css(front.locator('.tab'), 'backgroundImage'), /repeating-conic-gradient/);
  assert.equal(await css(front.locator('.frame'), 'backgroundColor'), 'rgb(58, 53, 96)', 'indigo frame');
  const wall = await rootCss(page, 'backgroundImage');
  assert.match(wall, /0b0a1f/, 'the night sky');
  assert.doesNotMatch(wall, /2f7fd8/);
  assert.match(await rootCss(page, 'backgroundImage', '::before'), /svg\+xml/, 'stars');
  assert.equal(await rootCss(page, 'animationName', '::before'), 'pk-twinkle');
  assert.equal(await rootCss(page, 'animationName', '::after'), 'pk-drift');
  assert.ok(await contrast(front, '.tt') >= 4.5);
  assert.ok(await contrast(back, '.tt') >= 4.5);
  assert.deepEqual(page.errors, []);
  await page.context().close();

  // reduced motion (the default for these tests) stills both layers
  const still = await open(desktop, '/', seed, { colorScheme: 'dark' });
  assert.equal(await rootCss(still, 'animationName', '::before'), 'none');
  assert.equal(await rootCss(still, 'animationName', '::after'), 'none');
  await still.context().close();
});

test('Pixel on a phone: a full-width sun bar with an ink rule, touch-sized keycaps and hotbar slots', async t => {
  if (!(await needs(t, '/control-panel/'))) return;
  const page = await open(phone, '/', seed);
  for (const b of await page.locator('#dock .dk').all()) assert.ok((await b.boundingBox()).height >= 44, 'launchers 44px tall');
  assert.match(await rootCss(page, 'backgroundImage'), /svg\+xml/);

  await cards(page).first().click();
  const front = win(page, 'reader');
  await front.locator('.rd h1').waitFor();
  const tb = await box(front.locator('.tab'));
  assert.ok(tb.height >= 44 && tb.width >= phone.width - 1, `title bar ${JSON.stringify(tb)}`);
  assert.match(await css(front.locator('.tab'), 'backgroundImage'), /repeating-conic-gradient/);
  assert.equal(await css(front.locator('.tab'), 'borderBottomWidth'), '2px', 'an ink rule under the bar');
  assert.equal(await css(front.locator('.tab'), 'boxShadow'), 'none');
  const close = await box(front.locator('.ctl.close'));
  assert.ok(close.width >= 40 && close.height >= 36, `close keycap target ${JSON.stringify(close)}`);
  assert.equal(await css(front.locator('.ctl.close'), 'width', '::before'), '15px');
  assert.equal(await front.locator('.ctl.max').isVisible(), false, 'no zoom on a phone');
  await shot(page, 'pixel-phone');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('another window style shows nothing of Pixel, with its stylesheet loaded', async t => {
  if (!(await needs(t, '/control-panel/'))) return;
  const page = await open(desktop, '/control-panel/');
  await win(page, 'control-panel').locator('.cp').waitFor();
  const href = await page.evaluate(() => JSON.parse(document.getElementById('deskbar-lazy').textContent)['look-pixel']?.css);
  if (!href) return t.skip('no Pixel look in this build');
  await page.waitForFunction(h => !!document.querySelector(`link[rel=stylesheet][href="${h}"]`), href);
  assert.equal(await css(page.locator('.win.active .tab'), 'borderImageSource'), 'none');
  assert.equal(await css(page.locator('.win.active .tab'), 'backgroundImage'), 'none');
  assert.notEqual(await css(page.locator('.win.active .ctl svg'), 'display'), 'none');
  assert.doesNotMatch(await rootCss(page, 'backgroundImage'), /svg\+xml/);
  assert.equal(await rootCss(page, 'content', '::before'), 'none');
  assert.equal(await css(page.locator('#dock'), 'borderImageSource'), 'none');
  assert.doesNotMatch(await css(page.locator('#panel'), 'fontFamily'), /Pixelify/);
  // its thumbnails in the Control panel are drawn all the same
  assert.match(await css(page.locator('.cp-deco.pixel'), 'backgroundImage'), /svg\+xml/);
  assert.match(await css(page.locator('.cp-wp.pixel'), 'backgroundImage'), /svg\+xml/);
  assert.equal(await css(page.locator('.cp-deco.pixel'), 'backgroundColor', '::before'), 'rgb(255, 205, 77)');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('picking Pixel sets the chrome in Pixelify Sans and brings its wallpaper and the floating dock', async t => {
  if (!(await needs(t, '/control-panel/'))) return;
  const page = await open(desktop, '/control-panel/');
  await win(page, 'control-panel').locator('.cp').waitFor();
  await page.locator('.cp-opt', { hasText: 'Pixel' }).first().click();
  await page.waitForFunction(() => document.documentElement.dataset.deco === 'pixel');
  assert.deepEqual(await page.evaluate(() => ({ ...document.documentElement.dataset })).then(d => [d.wall, d.dock]), ['pixel', undefined]);
  assert.match(await css(page.locator('#panel'), 'fontFamily'), /Pixelify Sans/);
  await page.evaluate(() => document.fonts.ready);
  assert.ok(await page.evaluate(() => document.fonts.check("12px 'Pixelify Sans'")), 'the font loads');
  assert.match(await rootCss(page, 'backgroundImage'), /svg\+xml/);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

// axe over Pixel's reading layout (focused and muted title bars), the menu and the window switcher, at 1440 and 390,
// light and dark, as a11y.spec.mjs does for the other looks
const AXE = readFileSync(fileURLToPath(import.meta.resolve('axe-core/axe.min.js')), 'utf8');
async function audit(page) {
  await page.addScriptTag({ content: AXE });
  const { violations } = await page.evaluate(() => window.axe.run(document, { iframes: false, resultTypes: ['violations'] }));
  return violations.filter(v => ['serious', 'critical'].includes(v.impact))
    .flatMap(v => v.nodes.map(n => `${v.impact} ${v.id}: ${n.target.join(' ')}`));
}

test('axe: Pixel at 1440 and 390, light and dark', async t => {
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
