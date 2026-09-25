// Vector (css/deskbar/looks/vector.css): Synthwave's colours on a vector display. Square windows on a cyan line with
// a pink hairline inside when focused, cut cyan tabs in spaced capitals, a flat square panel and dock, and a flat
// lattice wallpaper that never takes the pointer. No Light mode, nothing left behind when the look is off, and axe
// over its main states.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { env, useBrowser, open, needs, shot, win, cards, desktop, phone, toolbarGaps } from './lib.mjs';

useBrowser();

const LOOK = { deco: 'vector', wall: 'vector', dock: 'glass' };
const seed = look => `for (const [k, v] of Object.entries(${JSON.stringify(look)})) localStorage.setItem("deskbar:" + k, JSON.stringify(v));`;
const openLook = (vp, path, opts) => open(vp, path, seed(LOOK), opts);
const CYAN = 'rgb(111, 227, 255)', INK = 'rgb(26, 11, 58)';
const css = (loc, props, pseudo) => loc.evaluate((el, [ps, p]) => {
  const s = getComputedStyle(el, p);
  return Object.fromEntries(ps.map(k => [k, s[k]]));
}, [props, pseudo]);
const bodyStyle = (page, props, pseudo) => css(page.locator('body'), props, pseudo);
const lookHref = page => page.evaluate(() => JSON.parse(document.getElementById('deskbar-lazy').textContent)['look-vector'].css);

test('Vector: square cyan-ruled windows, a cut cyan tab in spaced capitals, unlit post text and no Light mode', async t => {
  if (!(await needs(t, '/posts/'))) return;
  const page = await openLook(desktop, '/posts/');
  const w = win(page, 'tracker');
  await w.locator('.pc').first().waitFor();
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme), 'dark');

  const frame = w.locator('.frame'), tab = w.locator('.tab.on');
  const f = await css(frame, ['borderTopColor', 'borderBottomRightRadius', 'boxShadow']);
  assert.equal(f.borderTopColor, CYAN);
  assert.equal(f.borderBottomRightRadius, '0px');
  assert.match(f.boxShadow, /rgb\(255, 62, 165\) 0px 0px 0px 3px inset/, 'a pink hairline inside the cyan line');
  const tb = await css(tab, ['backgroundColor', 'color', 'clipPath']);
  assert.deepEqual([tb.backgroundColor, tb.color], [CYAN, INK]);
  assert.match(tb.clipPath, /^polygon/, 'the tab has cut ends');
  const tt = await css(tab.locator('.tt'), ['fontFamily', 'textTransform', 'letterSpacing']);
  assert.match(tt.fontFamily, /Space Grotesk/);
  assert.equal(tt.textTransform, 'uppercase');
  assert.notEqual(tt.letterSpacing, 'normal');
  // the panel and dock are flat and square, on a cyan hairline rather than a glow
  const panel = await css(page.locator('#panel'), ['borderBottomColor', 'boxShadow']);
  assert.equal(panel.borderBottomColor, CYAN);
  assert.match(panel.boxShadow, /0px 1px 0px 0px$/, 'a second hairline, no blur');
  const dock = await css(page.locator('#dock'), ['borderTopColor', 'borderTopLeftRadius', 'backdropFilter']);
  assert.deepEqual(dock, { borderTopColor: CYAN, borderTopLeftRadius: '0px', backdropFilter: 'none' });
  await shot(page, 'vector');

  // an unfocused window goes to dim indigo lines with no neon
  await cards(page).first().click();
  await win(page, 'reader').locator('.rd h1').waitFor();
  const off = await css(frame, ['borderTopColor', 'boxShadow']);
  assert.notEqual(off.borderTopColor, CYAN);
  assert.doesNotMatch(off.boxShadow, /255, 62, 165|111, 227, 255/);
  assert.notEqual((await css(tab, ['backgroundColor'])).backgroundColor, CYAN);
  // post text has no glow, for long reads
  const rd = win(page, 'reader').locator('.rd');
  assert.equal((await css(rd.locator('p').first(), ['textShadow'])).textShadow, 'none');
  assert.equal((await css(rd.locator('h1'), ['color'])).color, CYAN);

  assert.equal(await page.locator('#themeBtn').isVisible(), false, 'dark only');
  await shot(page, 'vector-reader');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('Vector: the Control panel turns off Colours, Mode and Dock, and draws both thumbnails', async t => {
  if (!(await needs(t, '/control-panel/'))) return;
  const page = await openLook(desktop, '/control-panel/');
  const cp = win(page, 'control-panel');
  await cp.locator('.cp').waitFor();
  for (const g of ['palette', 'theme', 'dock']) {
    assert.equal(await cp.locator(`fieldset:has([name="cp-${g}"])`).evaluate(f => f.disabled), true, `${g} is the look's`);
  }
  assert.equal(await cp.locator('fieldset:has([name="cp-wall"])').evaluate(f => f.disabled), false);
  const deco = cp.locator('.cp-deco.vector');
  assert.equal((await css(deco, ['borderTopColor'], '::after')).borderTopColor, CYAN);
  assert.match((await css(deco, ['clipPath'], '::before')).clipPath, /^polygon/);
  const wp = (await css(cp.locator('.cp-wp.vector'), ['backgroundImage'])).backgroundImage;
  assert.ok((wp.match(/linear-gradient/g) || []).length >= 6, 'the lattice is drawn');
  await shot(page, 'vector-cp');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('Vector: the wallpaper is flat CSS lines behind the windows, and never takes a click', async t => {
  if (!(await needs(t, '/posts/'))) return;
  const page = await openLook(desktop, '/posts/');
  const w = win(page, 'tracker');
  await w.locator('.pc').first().waitFor();
  const bg = (await bodyStyle(page, ['backgroundImage'])).backgroundImage;
  assert.match(bg, /linear-gradient\(to right top/);
  assert.doesNotMatch(bg, /url\(/, 'no images');
  for (const p of ['::before', '::after']) assert.equal((await bodyStyle(page, ['content'], p)).content, 'none', `no ${p} scene`);
  const card = w.locator('.pc').first(), b = await card.boundingBox();
  assert.equal(await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('.pc'), [b.x + b.width / 2, b.y + b.height / 2]), true);
  // reloads with the look linked before first paint
  const href = await lookHref(page);
  await page.reload({ waitUntil: 'commit' });
  await page.waitForFunction(() => document.body);
  assert.equal(await page.evaluate(h => !!document.querySelector(`head link[rel=stylesheet][href="${h}"]`), href), true, 'linked from head.html');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('Vector on a phone: a full-width title bar without cut ends, over the full-screen window', async t => {
  if (!(await needs(t, '/posts/'))) return;
  const page = await openLook(phone, '/');
  await shot(page, 'vector-phone-home');
  await cards(page).first().click();
  const w = win(page, 'reader');
  await w.locator('.rd h1').waitFor();
  const [tab, frame] = [await w.locator('.tab.on').boundingBox(), await w.locator('.frame').boundingBox()];
  assert.equal(Math.round(frame.width), phone.width, 'full width');
  assert.ok(Math.abs(tab.y + tab.height - frame.y) <= 1, 'title bar above the frame');
  assert.equal((await css(w.locator('.tab.on'), ['clipPath'])).clipPath, 'none');
  // the reader toolbar sticks straight under the title bar, with no band between them
  for (const g of await toolbarGaps(page, w)) assert.ok(Math.abs(g) <= 8, `toolbar ${g}px from the title bar`);
  await shot(page, 'vector-phone');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('Vector leaves nothing behind when another look is on, though its stylesheet is loaded', async t => {
  if (!(await needs(t, '/control-panel/'))) return;
  const page = await open(desktop, '/control-panel/');
  const cp = win(page, 'control-panel');
  await cp.locator('.cp').waitFor();
  const href = await lookHref(page);
  await page.waitForFunction(h => !!document.querySelector(`head link[rel=stylesheet][href="${h}"]`)?.sheet, href);
  assert.notEqual((await css(cp.locator('.frame'), ['borderTopColor'])).borderTopColor, CYAN);
  assert.equal((await css(cp.locator('.tab.on'), ['clipPath'])).clipPath, 'none');
  assert.doesNotMatch((await bodyStyle(page, ['backgroundImage'])).backgroundImage, /to right top/);
  assert.notEqual((await css(page.locator('#panel'), ['borderBottomColor'])).borderBottomColor, CYAN);
  assert.equal(await page.locator('#themeBtn').isVisible(), true);
  await page.context().close();
});

// axe over the look's main states, as a11y.spec.mjs does for the shell
const AXE = readFileSync(fileURLToPath(import.meta.resolve('axe-core/axe.min.js')), 'utf8');
async function audit(page, exclude = []) {
  await page.addScriptTag({ content: AXE });
  const { violations } = await page.evaluate(x => window.axe.run({ exclude: x }, { iframes: false, resultTypes: ['violations'] }), exclude);
  return violations.filter(v => ['serious', 'critical'].includes(v.impact))
    .flatMap(v => v.nodes.map(n => `${v.impact} ${v.id}: ${n.target.join(' ')} ${n.failureSummary?.split('\n')[1]?.trim() ?? ''}`));
}
const states = {
  posts: { path: '/posts/', setup: page => win(page, 'tracker').locator('.pc').first().waitFor() },
  reader: { path: '/', async setup(page) { await cards(page).first().click(); await win(page, 'reader').locator('.rd h1').waitFor(); } },
  // axe measures the desktop icons' labels against the menu row over them, though the menu hides them
  menu: { path: '/', exclude: ['#icons'], async setup(page) { await page.locator('#menuBtn').click(); await page.locator('#menu .mn-it').first().waitFor(); } },
  switcher: {
    path: '/posts/',
    async setup(page) {
      await win(page, 'tracker').locator('a[data-url]').first().click();
      await win(page, 'reader').locator('.rd h1').waitFor();
      await page.locator('#winsBtn').click();
      await page.locator('#switcher .sw-tab').first().waitFor();
    },
  },
  controlpanel: { path: '/control-panel/', need: '/control-panel/', setup: page => win(page, 'control-panel').locator('.cp').waitFor() },
  spotlight: {
    path: '/',
    async setup(page) {
      await page.locator('#searchBtn').click();
      await page.locator('dialog.spotlight .sp-q').fill('window');
      await page.locator('dialog.spotlight .sp-opt').first().waitFor();
    },
  },
};

test('axe: Vector over its main states at 1440 and 390, with either stored mode', async () => {
  const found = [];
  for (const [name, s] of Object.entries(states)) {
    if (s.need && !(await fetch(env.base + s.need)).ok) continue;
    for (const [vp, w] of [[desktop, 1440], [phone, 390]]) {
      for (const theme of ['light', 'dark']) {
        const ctx = await env.browser.newContext({ viewport: vp, reducedMotion: 'reduce', colorScheme: theme });
        await ctx.addInitScript(seed({ ...LOOK, theme }));
        const page = await ctx.newPage();
        await page.goto(env.base + s.path);
        await page.waitForSelector('html.wm-ready');
        await s.setup(page);
        for (const v of await audit(page, s.exclude)) found.push(`[${name} ${w} ${theme}] ${v}`);
        await ctx.close();
      }
    }
  }
  assert.deepEqual(found, []);
});
