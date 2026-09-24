// Woodblock (css/deskbar/looks/woodblock.css): a shin-hanga print of the Australian coast. Cartouche title bars on
// washi windows inside thin key lines, a vermilion seal for the close control, a sky-band panel, a gum-green dock
// tray, the Apostles at dusk as wallpaper with the site's name in a tall cartouche, a night print in dark mode,
// touch-sized on phones, nothing left behind when the look is off, and axe over its main states.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { useBrowser, open, needs, shot, win, cards, desktop, phone } from './lib.mjs';

useBrowser();

const LOOK = { deco: 'woodblock', wall: 'woodblock' };
const seed = look => `for (const [k, v] of Object.entries(${JSON.stringify(look)})) localStorage.setItem("deskbar:" + k, JSON.stringify(v));`;
const openLook = (vp, path, opts) => open(vp, path, seed(LOOK), opts);
const INK = 'rgb(34, 30, 24)', CREAM = 'rgb(243, 233, 212)', SEA = 'rgb(31, 74, 95)', SHU = 'rgb(200, 57, 27)', GUM = 'rgb(74, 106, 78)', PAPER = 'rgb(234, 223, 198)';
const NIGHT = { ink: 'rgb(232, 223, 200)', sea: 'rgb(43, 100, 120)', paper: 'rgb(26, 37, 48)' };
const css = (loc, props, pseudo) => loc.evaluate((el, [ps, p]) => {
  const s = getComputedStyle(el, p);
  return Object.fromEntries(ps.map(k => [k, s[k]]));
}, [props, pseudo]);
// the double rule: a paper gap then an ink line, drawn as two inset rings
const cartouche = (shadow, paper) => shadow.startsWith(`${paper} 0px 0px 0px 2px inset, `) && / 0px 0px 0px 3px inset$/.test(shadow);

test('Woodblock: cartouche title bars on keylined washi windows, a seal to close, a sky-band panel and the print', async t => {
  if (!(await needs(t, '/posts/'))) return;
  const page = await openLook(desktop, '/posts/', { colorScheme: 'light' });
  const w = win(page, 'tracker');
  await w.locator('.pc').first().waitFor();

  const frame = w.locator('.frame'), tab = w.locator('.tab.on');
  const f = await css(frame, ['borderTopWidth', 'borderTopColor', 'borderTopLeftRadius', 'backgroundImage', 'backgroundColor']);
  assert.deepEqual([f.borderTopWidth, f.borderTopColor, f.borderTopLeftRadius, f.backgroundColor], ['1px', INK, '0px', PAPER], 'one thin key line round washi');
  assert.match(f.backgroundImage, /^url\("data:image\/svg\+xml/, 'the paper carries its fibre');
  assert.deepEqual(await css(w.locator('.views'), ['borderTopWidth', 'borderTopColor']), { borderTopWidth: '1px', borderTopColor: INK }, 'the content ruled off by a second');
  const tb = await css(tab, ['backgroundColor', 'color', 'boxShadow', 'borderTopWidth']);
  assert.deepEqual([tb.backgroundColor, tb.color, tb.borderTopWidth], [SEA, CREAM, '1px'], 'a sea-blue cartouche with cream type');
  assert.ok(cartouche(tb.boxShadow, SEA), `the cartouche's inner rule: ${tb.boxShadow}`);
  assert.match((await css(tab.locator('.tt'), ['fontFamily'])).fontFamily, /^"?Fraunces/);
  assert.ok(await page.evaluate(() => document.fonts.check('700 12px Fraunces')), 'Fraunces is self-hosted and loaded');
  const close = await css(tab.locator('.ctl.close'), ['backgroundColor', 'color', 'rotate', 'borderTopLeftRadius']);
  assert.deepEqual([close.backgroundColor, close.color, close.borderTopLeftRadius], [SHU, 'rgb(255, 255, 255)', '2px'], 'the close control is a vermilion seal');
  assert.match(close.rotate, /-6deg/, 'stamped a little askew');
  for (const c of ['.ctl.min', '.ctl.max']) {
    const s = await css(tab.locator(c), ['borderTopWidth', 'borderTopColor', 'backgroundColor', 'borderTopLeftRadius']);
    assert.deepEqual(s, { borderTopWidth: '1px', borderTopColor: CREAM, backgroundColor: 'rgba(0, 0, 0, 0)', borderTopLeftRadius: '0px' }, `${c} is a keyline box`);
  }
  // cards are flat sheets; the open one carries a vermilion rule
  assert.equal((await css(w.locator('.pc').first(), ['borderTopLeftRadius'])).borderTopLeftRadius, '0px');

  // the panel: the sky band under an ink rule with a vermilion hairline. The pointer starts at 0,0, over the Menu
  // button in some headless browsers, which would show its hover instead
  await page.mouse.move(desktop.width / 2, desktop.height - 150);
  const panel = await css(page.locator('#panel'), ['backgroundImage', 'borderBottomColor', 'boxShadow']);
  assert.match(panel.backgroundImage, /linear-gradient/);
  assert.equal(panel.borderBottomColor, INK);
  assert.ok(panel.boxShadow.includes(SHU), `a vermilion hairline: ${panel.boxShadow}`);
  assert.match((await css(page.locator('#menuBtn'), ['fontFamily'])).fontFamily, /^"?Fraunces/);
  assert.doesNotMatch(await page.evaluate(() => getComputedStyle(document.body).fontFamily), /Fraunces/, 'body text keeps the sans');

  // the wallpaper: the print, drawn as SVG, over the near sea, and the site's name in a tall cartouche
  const body = await page.evaluate(() => { const s = getComputedStyle(document.body); return { image: s.backgroundImage, size: s.backgroundSize, colour: s.backgroundColor }; });
  assert.ok((body.image.match(/data:image\/svg\+xml/g) || []).length >= 2, 'fibre and the print');
  assert.match(body.size, /cover/);
  assert.equal(body.colour, SEA);
  const name = await css(page.locator('#desk'), ['writingMode', 'borderTopWidth', 'borderTopColor', 'color', 'fontFamily', 'top'], '::after');
  assert.equal(name.writingMode, 'vertical-rl');
  assert.deepEqual([name.borderTopWidth, name.borderTopColor, name.color], ['1px', INK, INK]);
  assert.match(name.fontFamily, /^"?Fraunces/);
  assert.equal(name.top, '34px', 'at the top right, as a print titles itself');

  // the dock: a gum-green tray inside the double rule, a running app marked with a seal
  const dock = await css(page.locator('#dock'), ['backgroundColor', 'borderTopLeftRadius', 'boxShadow', 'backdropFilter']);
  assert.equal(dock.backgroundColor, GUM);
  assert.equal(dock.borderTopLeftRadius, '0px');
  assert.ok(dock.boxShadow.includes(`${PAPER} 0px 0px 0px 3px`) && dock.boxShadow.includes(`${INK} 0px 0px 0px 4px`), `the double rule: ${dock.boxShadow}`);
  assert.equal(dock.backdropFilter, 'none');
  const run = page.locator('#dock .dk.run').first();
  if (await run.count()) assert.equal((await css(run, ['backgroundColor'], '::after')).backgroundColor, SHU);
  // desktop icons carry cartouche captions
  const cap = page.locator('.dicon span').first();
  if (await cap.count()) assert.deepEqual(await css(cap, ['backgroundColor', 'color', 'borderTopLeftRadius']), { backgroundColor: SEA, color: CREAM, borderTopLeftRadius: '0px' });
  await shot(page, 'woodblock');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('Woodblock: the night print in dark mode, cream ink on indigo paper, the reader without its fibre', async t => {
  if (!(await needs(t, '/posts/'))) return;
  const page = await open(desktop, '/posts/', seed({ ...LOOK, theme: 'auto' }), { colorScheme: 'dark' });
  const w = win(page, 'tracker');
  await w.locator('.pc').first().waitFor();
  const f = await css(w.locator('.frame'), ['borderTopColor', 'backgroundColor']);
  assert.deepEqual(f, { borderTopColor: NIGHT.ink, backgroundColor: NIGHT.paper }, 'cream key lines on indigo paper');
  assert.deepEqual(await css(w.locator('.tab.on'), ['backgroundColor', 'color']), { backgroundColor: NIGHT.sea, color: CREAM });
  assert.equal((await css(w.locator('.tab.on .ctl.close'), ['backgroundColor'])).backgroundColor, SHU, 'the seal stays vermilion');
  const night = await page.evaluate(() => getComputedStyle(document.body).backgroundImage);
  const lit = await open(desktop, '/posts/', seed({ ...LOOK, theme: 'light' }), { colorScheme: 'light' });
  assert.notEqual(night, await lit.evaluate(() => getComputedStyle(document.body).backgroundImage), 'a different print at night');
  await lit.context().close();
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(8, 25, 42)');
  assert.equal(await page.locator('#themeBtn').isVisible(), true, 'the visitor keeps the theme switch');
  await cards(page).first().click();
  const r = win(page, 'reader');
  await r.locator('.rd h1').waitFor();
  assert.doesNotMatch((await css(r.locator('.reader'), ['backgroundImage'])).backgroundImage, /svg/, 'no speckle over dark reading paper');
  await shot(page, 'woodblock-dark');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('Woodblock: the reader sets a Fraunces headline over the readable serif, headings ruled and sealed', async t => {
  if (!(await needs(t, '/posts/'))) return;
  const page = await openLook(desktop, '/');
  await cards(page).first().click();
  const r = win(page, 'reader');
  await r.locator('.rd h1').waitFor();
  assert.match((await css(r.locator('.rd h1'), ['fontFamily'])).fontFamily, /^"?Fraunces/);
  assert.doesNotMatch((await css(r.locator('.rd-body p').first(), ['fontFamily'])).fontFamily, /Fraunces/, 'body text is not set in the display face');
  assert.match((await css(r.locator('.reader'), ['backgroundImage'])).backgroundImage, /svg\+xml/, 'reading paper carries its fibre by day');
  const h2 = r.locator('.rd h2').first();
  if (await h2.count()) {
    assert.deepEqual(await css(h2, ['borderBottomWidth', 'borderBottomColor']), { borderBottomWidth: '1px', borderBottomColor: INK });
    assert.equal((await css(h2, ['backgroundColor'], '::before')).backgroundColor, SHU, 'a small seal before each heading');
  }
  const cover = r.locator('.rd img.cover');
  if (await cover.count()) assert.equal((await css(cover, ['borderTopColor'])).borderTopColor, INK);
  await shot(page, 'woodblock-reader');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('Woodblock on a phone: the tray and window controls at touch size, a full-width cartouche, the panel on screen', async t => {
  if (!(await needs(t, '/posts/'))) return;
  const page = await openLook(phone, '/', { hasTouch: true, isMobile: true });
  for (const d of await page.locator('#dock .dk').all()) {
    const b = await d.boundingBox();
    assert.ok(b.width >= 44 && b.height >= 44, `a launcher at touch size: ${JSON.stringify(b)}`);
  }
  assert.equal((await css(page.locator('#dock'), ['backgroundColor'])).backgroundColor, GUM);
  for (const el of await page.locator('#panel > *').filter({ visible: true }).all()) {
    const b = await el.boundingBox();
    assert.ok(b.x + b.width <= phone.width + 0.5, `${await el.evaluate(e => e.id || e.className)} fits the panel`);
  }
  await cards(page).first().click();
  const r = win(page, 'reader');
  await r.locator('.rd h1').waitFor();
  const tab = r.locator('.tab.on');
  assert.ok((await tab.boundingBox()).height >= 44);
  assert.deepEqual(await css(tab, ['backgroundColor', 'boxShadow']), { backgroundColor: SEA, boxShadow: 'none' }, 'the cartouche is the whole top edge');
  for (const c of ['.ctl.min', '.ctl.close']) {
    const b = await tab.locator(c).boundingBox();
    assert.ok(b.width >= 40 && b.height >= 36, `${c} ${JSON.stringify(b)}`);
  }
  assert.equal((await css(tab.locator('.ctl.close'), ['rotate'])).rotate, 'none', 'the seal sits square at touch size');
  assert.equal((await css(r.locator('.frame'), ['boxShadow'])).boxShadow, 'none', 'a full-screen window casts no shadow');
  await shot(page, 'woodblock-phone');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('Woodblock leaves nothing behind once another window style is on, its stylesheet still loaded', async t => {
  if (!(await needs(t, '/control-panel/'))) return;
  const page = await open(desktop, '/control-panel/');
  const cp = win(page, 'control-panel');
  await cp.locator('.cp').waitFor();
  await page.waitForFunction(() => [...document.styleSheets].some(s => /looks\/woodblock/.test(s.href || '')));
  assert.notEqual((await css(cp.locator('.frame'), ['borderTopColor'])).borderTopColor, INK);
  assert.notEqual((await css(cp.locator('.tab.on'), ['backgroundColor'])).backgroundColor, SEA);
  assert.notEqual((await css(cp.locator('.tab.on .ctl.close'), ['backgroundColor'])).backgroundColor, SHU);
  assert.doesNotMatch(await page.evaluate(() => getComputedStyle(document.body).fontFamily), /Fraunces/);
  assert.notEqual((await css(page.locator('#dock'), ['backgroundColor'])).backgroundColor, GUM);
  assert.equal((await css(page.locator('#desk'), ['writingMode'], '::after')).writingMode, 'horizontal-tb');
  // its thumbnails draw on their own colours
  const thumb = cp.locator('.cp-deco.woodblock');
  assert.equal((await css(thumb, ['backgroundColor'])).backgroundColor, PAPER);
  assert.equal((await css(thumb, ['backgroundColor'], '::before')).backgroundColor, SEA);
  assert.match((await css(cp.locator('.cp-wp.woodblock'), ['backgroundImage'])).backgroundImage, /svg\+xml/);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

const AXE = readFileSync(fileURLToPath(import.meta.resolve('axe-core/axe.min.js')), 'utf8');
async function audit(page) {
  await page.addScriptTag({ content: AXE });
  const { violations } = await page.evaluate(() => window.axe.run(document, { iframes: false, resultTypes: ['violations'] }));
  return violations.filter(v => ['serious', 'critical'].includes(v.impact))
    .flatMap(v => v.nodes.map(n => `${v.impact} ${v.id}: ${n.target.join(' ')} ${n.failureSummary?.split('\n')[1]?.trim() ?? ''}`));
}

test('axe: Woodblock at 1440 and 390, light and dark, desktop, reader and menu', async t => {
  if (!(await needs(t, '/posts/'))) return;
  const found = [];
  for (const [vp, w] of [[desktop, 1440], [phone, 390]]) {
    for (const scheme of ['light', 'dark']) {
      const page = await open(vp, '/', seed({ ...LOOK, theme: scheme }), { colorScheme: scheme });
      for (const v of await audit(page)) found.push(`[${w} ${scheme} desktop] ${v}`);
      await cards(page).first().click();
      await win(page, 'reader').locator('.rd h1').waitFor();
      for (const v of await audit(page)) found.push(`[${w} ${scheme} reader] ${v}`);
      await page.locator('#menuBtn').click();
      await page.locator('#menu .mn-it').first().waitFor();
      for (const v of await audit(page)) found.push(`[${w} ${scheme} menu] ${v}`);
      await page.context().close();
    }
  }
  assert.deepEqual(found, []);
});
