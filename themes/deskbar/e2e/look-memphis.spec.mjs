// Memphis (css/deskbar/looks/memphis.css): Synthwave's colours as 80s Memphis graphics. Square windows in 2px rules
// on hard offset shadows with no blur, pink tabs, buttons that press into their shadows, a flat confetti wallpaper that
// stays behind everything and never takes the pointer, no Light mode, nothing left behind when the look is off, and axe
// over its main states.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { env, useBrowser, open, needs, shot, win, cards, desktop, phone, toolbarGaps } from './lib.mjs';

useBrowser();

const LOOK = { deco: 'memphis', wall: 'memphis', dock: 'glass' };
const seed = look => `for (const [k, v] of Object.entries(${JSON.stringify(look)})) localStorage.setItem("deskbar:" + k, JSON.stringify(v));`;
const openLook = (vp, path, opts) => open(vp, path, seed(LOOK), opts);
const PINK = 'rgb(255, 62, 165)', CYAN = 'rgb(111, 227, 255)', INK = 'rgb(26, 11, 58)';
const css = (loc, props, pseudo) => loc.evaluate((el, [ps, p]) => {
  const s = getComputedStyle(el, p);
  return Object.fromEntries(ps.map(k => [k, s[k]]));
}, [props, pseudo]);
const bodyStyle = (page, pseudo, props) => page.evaluate(([p, ps]) => {
  const s = getComputedStyle(document.body, p);
  return Object.fromEntries(ps.map(k => [k, s[k]]));
}, [pseudo, props]);
const lookHref = page => page.evaluate(() => JSON.parse(document.getElementById('deskbar-lazy').textContent)['look-memphis'].css);
// a hard shadow has no blur: "<colour> x y 0px"
const hard = (shadow, colour) => new RegExp(`${colour.replace(/[()]/g, '\\$&')} \\d+px \\d+px 0px`).test(shadow);

test('Memphis: square windows on hard shadows, a pink tab in capitals, unlit post text and no Light mode', async t => {
  if (!(await needs(t, '/posts/'))) return;
  const page = await openLook(desktop, '/posts/');
  const w = win(page, 'tracker');
  await w.locator('.pc').first().waitFor();
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme), 'dark');

  const frame = w.locator('.frame'), tab = w.locator('.tab.on');
  const f = await css(frame, ['borderTopColor', 'borderTopWidth', 'borderBottomRightRadius', 'boxShadow', 'backdropFilter']);
  assert.deepEqual([f.borderTopColor, f.borderTopWidth, f.borderBottomRightRadius, f.backdropFilter], [PINK, '2px', '0px', 'none']);
  assert.ok(hard(f.boxShadow, CYAN), `the focused frame sits on a hard cyan shadow: ${f.boxShadow}`);
  const tb = await css(tab, ['backgroundColor', 'color', 'boxShadow']);
  assert.deepEqual([tb.backgroundColor, tb.color], [PINK, INK]);
  assert.ok(hard(tb.boxShadow, CYAN), 'the tab has its own hard shadow');
  const tt = await css(tab.locator('.tt'), ['fontFamily', 'textTransform']);
  assert.match(tt.fontFamily, /Space Grotesk/);
  assert.equal(tt.textTransform, 'uppercase');
  // the dock is a flat bar on a hard shadow
  const dock = await css(page.locator('#dock'), ['borderTopLeftRadius', 'boxShadow', 'backdropFilter']);
  assert.deepEqual([dock.borderTopLeftRadius, dock.backdropFilter], ['0px', 'none']);
  assert.ok(hard(dock.boxShadow, CYAN));
  await shot(page, 'memphis-posts');

  // an unfocused window keeps a hard shadow but loses the pink
  await cards(page).first().click();
  await win(page, 'reader').locator('.rd h1').waitFor();
  const off = await css(frame, ['borderTopColor', 'boxShadow']);
  assert.notEqual(off.borderTopColor, PINK);
  assert.doesNotMatch(off.boxShadow, /111, 227, 255/);
  assert.ok(/ \d+px \d+px 0px/.test(off.boxShadow), 'still hard');
  // post text is plain, for long reads
  const rd = win(page, 'reader').locator('.rd');
  assert.equal((await css(rd.locator('p').first(), ['textShadow'])).textShadow, 'none');
  assert.equal(await page.locator('#themeBtn').isVisible(), false, 'dark only');
  await shot(page, 'memphis');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('Memphis: a pressed toolbar button drops into its shadow', async t => {
  if (!(await needs(t, '/posts/'))) return;
  const page = await openLook(desktop, '/');
  await cards(page).first().click();
  const btn = win(page, 'reader').locator('.toolbar .tb:not(:disabled)').first();
  await btn.waitFor();
  const b = await btn.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  const s = await css(btn, ['translate', 'boxShadow']);
  await page.mouse.up();
  assert.deepEqual(s, { translate: '2px 2px', boxShadow: 'none' });
  await page.context().close();
});

test('Memphis: the Control panel turns off Colours, Mode and Dock, and draws both thumbnails', async t => {
  if (!(await needs(t, '/control-panel/'))) return;
  const page = await openLook(desktop, '/control-panel/');
  const cp = win(page, 'control-panel');
  await cp.locator('.cp').waitFor();
  for (const g of ['palette', 'theme', 'dock']) {
    assert.equal(await cp.locator(`fieldset:has([name="cp-${g}"])`).evaluate(f => f.disabled), true, `${g} is the look's`);
  }
  assert.equal(await cp.locator('fieldset:has([name="cp-wall"])').evaluate(f => f.disabled), false);
  const deco = await css(cp.locator('.cp-deco.memphis'), ['borderTopColor', 'boxShadow'], '::after');
  assert.equal(deco.borderTopColor, PINK);
  assert.ok(hard(deco.boxShadow, CYAN));
  assert.match((await css(cp.locator('.cp-wp.memphis'), ['backgroundImage'])).backgroundImage, /radial-gradient.*conic-gradient/);
  await cp.locator('.cp-wp.memphis').scrollIntoViewIfNeeded();
  await shot(page, 'memphis-cp');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('Memphis: the confetti wallpaper is flat gradients behind the windows, never takes a click, and holds still', async t => {
  if (!(await needs(t, '/posts/'))) return;
  const page = await openLook(desktop, '/posts/', { reducedMotion: 'no-preference' });
  const w = win(page, 'tracker');
  await w.locator('.pc').first().waitFor();
  const body = await bodyStyle(page, null, ['backgroundImage', 'animationName']);
  assert.doesNotMatch(body.backgroundImage, /url\(/, 'gradients only');
  assert.ok((body.backgroundImage.match(/gradient\(/g) || []).length >= 10, 'a tile of many shapes');
  assert.equal(body.animationName, 'none');
  for (const p of ['::before', '::after']) assert.equal((await bodyStyle(page, p, ['content'])).content, 'none', `no ${p} scene`);
  const card = w.locator('.pc').first(), b = await card.boundingBox();
  assert.equal(await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('.pc'), [b.x + b.width / 2, b.y + b.height / 2]), true);
  await card.click();
  await win(page, 'reader').locator('.rd h1').waitFor();
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('Memphis is back before first paint on reload', async () => {
  const page = await openLook(desktop, '/');
  const href = await lookHref(page);
  await page.reload({ waitUntil: 'commit' });
  await page.waitForFunction(() => document.body);
  assert.equal(await page.evaluate(h => !!document.querySelector(`head link[rel=stylesheet][href="${h}"]`), href), true, 'linked from head.html');
  await page.context().close();
});

test('Memphis on a phone: a full-width square title bar over the full-screen window', async t => {
  if (!(await needs(t, '/posts/'))) return;
  const page = await openLook(phone, '/');
  await shot(page, 'memphis-phone-home');
  await cards(page).first().click();
  const w = win(page, 'reader');
  await w.locator('.rd h1').waitFor();
  const [tab, frame] = [await w.locator('.tab.on').boundingBox(), await w.locator('.frame').boundingBox()];
  assert.equal(Math.round(frame.width), phone.width, 'full width');
  assert.ok(Math.abs(tab.y + tab.height - frame.y) <= 1, 'title bar above the frame');
  const tb = await css(w.locator('.tab.on'), ['borderTopLeftRadius', 'boxShadow']);
  assert.deepEqual(tb, { borderTopLeftRadius: '0px', boxShadow: 'none' });
  for (const g of await toolbarGaps(page, w)) assert.ok(Math.abs(g) <= 8, `toolbar ${g}px from the title bar`);
  await shot(page, 'memphis-phone');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('Memphis leaves nothing behind when another look is on, though its stylesheet is loaded', async t => {
  if (!(await needs(t, '/control-panel/'))) return;
  const page = await open(desktop, '/control-panel/');
  const cp = win(page, 'control-panel');
  await cp.locator('.cp').waitFor();
  const href = await lookHref(page);
  await page.waitForFunction(h => !!document.querySelector(`head link[rel=stylesheet][href="${h}"]`)?.sheet, href);
  const f = await css(cp.locator('.frame'), ['borderTopColor', 'boxShadow']);
  assert.notEqual(f.borderTopColor, PINK);
  assert.doesNotMatch(f.boxShadow, /111, 227, 255/);
  assert.doesNotMatch((await bodyStyle(page, null, ['backgroundImage'])).backgroundImage, /255, 228, 94/);
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

test('axe: Memphis over its main states at 1440 and 390, with either stored mode', async () => {
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
        if (w === 1440 && theme === 'dark' && ['menu', 'switcher', 'spotlight'].includes(name)) await shot(page, `memphis-${name}`);
        for (const v of await audit(page, s.exclude)) found.push(`[${name} ${w} ${theme}] ${v}`);
        await ctx.close();
      }
    }
  }
  assert.deepEqual(found, []);
});
