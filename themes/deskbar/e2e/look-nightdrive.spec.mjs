// Night Drive (css/deskbar/looks/nightdrive.css): synthwave as an 80s sportswear tag. Rounded indigo windows, the
// focused one rimmed in a pink to cyan gradient, stripe-filled pill tabs, a flat striped wallpaper that stays behind
// everything, no Light mode, linked before first paint, nothing left behind when the look is off, and axe over its
// main states.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { env, useBrowser, open, needs, shot, win, cards, desktop, phone, toolbarGaps } from './lib.mjs';

useBrowser();

const LOOK = { deco: 'nightdrive', wall: 'nightdrive', dock: 'glass' };
const seed = look => `for (const [k, v] of Object.entries(${JSON.stringify(look)})) localStorage.setItem("deskbar:" + k, JSON.stringify(v));`;
const openLook = (vp, path, opts) => open(vp, path, seed(LOOK), opts);
const INK = 'rgb(26, 11, 58)', EDGE = 'rgb(74, 53, 128)';
const css = (loc, props, pseudo) => loc.evaluate((el, [ps, p]) => {
  const s = getComputedStyle(el, p);
  return Object.fromEntries(ps.map(k => [k, s[k]]));
}, [props, pseudo]);
const bodyStyle = (page, props, pseudo) => css(page.locator('body'), props, pseudo);
const lookHref = page => page.evaluate(() => JSON.parse(document.getElementById('deskbar-lazy').textContent)['look-nightdrive'].css);

test('Night Drive: a gradient rim, stripe pill tabs, a striped panel rule, plain post text and no Light mode', async t => {
  if (!(await needs(t, '/posts/'))) return;
  const page = await openLook(desktop, '/posts/');
  const w = win(page, 'tracker');
  await w.locator('.pc').first().waitFor();
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme), 'dark');

  const frame = w.locator('.frame'), tab = w.locator('.tab.on');
  const f = await css(frame, ['borderTopColor', 'borderBottomRightRadius', 'backgroundImage', 'boxShadow']);
  assert.equal(f.borderTopColor, 'rgba(0, 0, 0, 0)', 'the rim is the background under a clear border');
  assert.equal(f.borderBottomRightRadius, '12px');
  assert.match(f.backgroundImage, /linear-gradient\(135deg, rgb\(255, 62, 165\), rgb\(255, 158, 74\) 50%, rgb\(111, 227, 255\)\)/);
  assert.match(f.boxShadow, /rgba\(111, 227, 255/, 'the focused frame glows cyan on one side');
  const tb = await css(tab, ['backgroundImage', 'color', 'borderTopLeftRadius', 'borderBottomLeftRadius']);
  assert.match(tb.backgroundImage, /rgb\(255, 228, 94\) 22%, rgb\(255, 158, 74\) 0px/, 'hard-stop sunset bands');
  assert.equal(tb.color, INK);
  assert.equal(tb.borderBottomLeftRadius, '999px', 'a pill');
  const tt = await css(tab.locator('.tt'), ['fontFamily', 'fontStyle', 'textShadow']);
  assert.match(tt.fontFamily, /Space Grotesk/);
  assert.equal(tt.fontStyle, 'italic');
  assert.match(tt.textShadow, /rgba\(111, 227, 255/, 'a chromatic offset');
  // a keyboard focus ring on the stripes is ink, as cyan would vanish into them
  await page.keyboard.press('Shift');
  await tab.locator('.tt').focus();
  assert.equal(await tab.locator('.tt').evaluate(el => el.matches(':focus-visible') && getComputedStyle(el).outlineColor), INK);
  assert.match((await css(page.locator('#panel'), ['backgroundImage'])).backgroundImage, /rgb\(255, 228, 94\)/, 'the panel sits on a stripe');
  assert.equal((await css(page.locator('#dock'), ['borderTopLeftRadius'])).borderTopLeftRadius, '999px', 'a pill dock');

  // an unfocused window takes a plain indigo edge and tab
  await cards(page).first().click();
  const rd = win(page, 'reader').locator('.rd');
  await rd.locator('h1').waitFor();
  const off = await css(frame, ['borderTopColor', 'backgroundImage']);
  assert.equal(off.borderTopColor, EDGE);
  assert.equal(off.backgroundImage, 'none');
  assert.equal((await css(tab, ['backgroundImage'])).backgroundImage, 'none');
  // post text stays plain for long reads; the title carries the offset
  assert.equal((await css(rd.locator('p').first(), ['textShadow'])).textShadow, 'none');
  assert.notEqual((await css(rd.locator('h1'), ['textShadow'])).textShadow, 'none');

  assert.equal(await page.locator('#themeBtn').isVisible(), false, 'dark only');
  await shot(page, 'nightdrive');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('Night Drive: the Control panel turns off Colours, Mode and Dock and draws both thumbnails', async t => {
  if (!(await needs(t, '/control-panel/'))) return;
  const page = await openLook(desktop, '/control-panel/');
  const cp = win(page, 'control-panel');
  await cp.locator('.cp').waitFor();
  for (const g of ['palette', 'theme', 'dock']) {
    assert.equal(await cp.locator(`fieldset:has([name="cp-${g}"])`).evaluate(f => f.disabled), true, `${g} is the look's`);
  }
  assert.equal(await cp.locator('fieldset:has([name="cp-wall"])').evaluate(f => f.disabled), false);
  const win_ = await css(cp.locator('.cp-deco.nightdrive'), ['borderTopLeftRadius', 'backgroundImage'], '::after');
  assert.equal(win_.borderTopLeftRadius, '5px');
  assert.match(win_.backgroundImage, /135deg/, 'the rimmed window');
  assert.match((await css(cp.locator('.cp-wp.nightdrive'), ['backgroundImage'])).backgroundImage, /repeating-linear-gradient.*rgb\(255, 228, 94\)/, 'scanlines over the bands');
  await shot(page, 'nightdrive-cp');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('Night Drive: the wallpaper is flat bands under scanlines, behind the windows, and never takes a click', async t => {
  if (!(await needs(t, '/posts/'))) return;
  const page = await openLook(desktop, '/posts/');
  const w = win(page, 'tracker');
  await w.locator('.pc').first().waitFor();
  const bg = (await bodyStyle(page, ['backgroundImage'])).backgroundImage;
  assert.match(bg, /^repeating-linear-gradient/, 'scanlines on top');
  assert.doesNotMatch(bg, /url\(|radial-gradient/, 'flat: no image, no sun');
  for (const p of ['::before', '::after']) assert.equal((await bodyStyle(page, ['content'], p)).content, 'none', `no ${p} scene`);
  const card = w.locator('.pc').first(), b = await card.boundingBox();
  assert.equal(await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('.pc'), [b.x + b.width / 2, b.y + b.height / 2]), true);
  await card.click();
  await win(page, 'reader').locator('.rd h1').waitFor();
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('Night Drive is back before first paint on reload', async () => {
  const page = await openLook(desktop, '/');
  const href = await lookHref(page);
  await page.reload({ waitUntil: 'commit' });
  await page.waitForFunction(() => document.body);
  assert.equal(await page.evaluate(h => !!document.querySelector(`head link[rel=stylesheet][href="${h}"]`), href), true, 'linked from head.html');
  await page.waitForSelector('html.wm-ready');
  assert.match((await bodyStyle(page, ['backgroundImage'])).backgroundImage, /rgb\(255, 228, 94\)/, 'the bands are up');
  await page.context().close();
});

test('Night Drive on a phone: a square title bar on the full-screen window', async t => {
  if (!(await needs(t, '/posts/'))) return;
  const page = await openLook(phone, '/');
  await cards(page).first().click();
  const w = win(page, 'reader');
  await w.locator('.rd h1').waitFor();
  const [tab, frame] = [await w.locator('.tab.on').boundingBox(), await w.locator('.frame').boundingBox()];
  assert.equal(Math.round(frame.width), phone.width, 'full width');
  assert.ok(Math.abs(tab.y + tab.height - frame.y) <= 1, 'title bar on the frame');
  assert.equal((await css(w.locator('.tab.on'), ['borderTopLeftRadius'])).borderTopLeftRadius, '0px');
  assert.equal((await css(w.locator('.frame'), ['borderTopLeftRadius'])).borderTopLeftRadius, '0px');
  // the reader toolbar sticks straight under the title bar, with no band between them
  for (const g of await toolbarGaps(page, w)) assert.ok(Math.abs(g) <= 8, `toolbar ${g}px from the title bar`);
  await shot(page, 'nightdrive-phone');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('Night Drive leaves nothing behind when another look is on, though its stylesheet is loaded', async t => {
  if (!(await needs(t, '/control-panel/'))) return;
  const page = await open(desktop, '/control-panel/');
  const cp = win(page, 'control-panel');
  await cp.locator('.cp').waitFor();
  const href = await lookHref(page);
  await page.waitForFunction(h => !!document.querySelector(`head link[rel=stylesheet][href="${h}"]`)?.sheet, href);
  assert.notEqual((await css(cp.locator('.frame'), ['borderBottomRightRadius'])).borderBottomRightRadius, '12px');
  assert.notEqual((await css(cp.locator('.tab.on'), ['borderBottomLeftRadius'])).borderBottomLeftRadius, '999px');
  assert.doesNotMatch((await bodyStyle(page, ['backgroundImage'])).backgroundImage, /rgb\(255, 228, 94\)/);
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

test('axe: Night Drive over its main states at 1440 and 390, with either stored mode', async () => {
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
        if (theme === 'dark') await shot(page, `nightdrive-${name}-${w}`);
        for (const v of await audit(page, s.exclude)) found.push(`[${name} ${w} ${theme}] ${v}`);
        await ctx.close();
      }
    }
  }
  assert.deepEqual(found, []);
});
