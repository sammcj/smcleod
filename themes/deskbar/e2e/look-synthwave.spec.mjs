// Synthwave (css/deskbar/looks/synthwave.css): an 80s outrun night. Indigo windows edged in neon with sunset tabs,
// a striped sun over a perspective grid that stays behind everything and never takes the pointer, no Light mode,
// linked before first paint, nothing left behind when the look is off, and axe over its main states.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { env, useBrowser, open, needs, shot, win, cards, desktop, phone } from './lib.mjs';

useBrowser();

const LOOK = { deco: 'synthwave', wall: 'synthwave', dock: 'glass' };
const seed = look => `for (const [k, v] of Object.entries(${JSON.stringify(look)})) localStorage.setItem("deskbar:" + k, JSON.stringify(v));`;
const openLook = (vp, path, opts) => open(vp, path, seed(LOOK), opts);
const PINK = 'rgb(255, 62, 165)', INK = 'rgb(26, 11, 58)';
const css = (loc, props, pseudo) => loc.evaluate((el, [ps, p]) => {
  const s = getComputedStyle(el, p);
  return Object.fromEntries(ps.map(k => [k, s[k]]));
}, [props, pseudo]);
const bodyPseudo = (page, pseudo, props) => page.evaluate(([p, ps]) => {
  const s = getComputedStyle(document.body, p);
  return Object.fromEntries(ps.map(k => [k, s[k]]));
}, [pseudo, props]);
const lookHref = page => page.evaluate(() => JSON.parse(document.getElementById('deskbar-lazy').textContent)['look-synthwave'].css);

test('Synthwave: neon-edged indigo windows, a sunset tab in capitals, unlit post text and no Light mode', async t => {
  if (!(await needs(t, '/posts/'))) return;
  const page = await openLook(desktop, '/posts/');
  const w = win(page, 'tracker');
  await w.locator('.pc').first().waitFor();
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme), 'dark');

  const frame = w.locator('.frame'), tab = w.locator('.tab.on');
  const f = await css(frame, ['borderTopColor', 'borderBottomRightRadius', 'boxShadow']);
  assert.equal(f.borderTopColor, PINK);
  assert.equal(f.borderBottomRightRadius, '6px');
  assert.match(f.boxShadow, /rgba\(255, 62, 165/, 'the focused frame glows');
  const tb = await css(tab, ['backgroundImage', 'color', 'borderTopLeftRadius']);
  assert.match(tb.backgroundImage, /linear-gradient/);
  assert.equal(tb.color, INK);
  assert.equal(tb.borderTopLeftRadius, '6px');
  const tt = await css(tab.locator('.tt'), ['fontFamily', 'textTransform']);
  assert.match(tt.fontFamily, /Space Grotesk/);
  assert.equal(tt.textTransform, 'uppercase');
  // an unfocused window loses the neon
  await cards(page).first().click();
  await win(page, 'reader').locator('.rd h1').waitFor();
  assert.notEqual((await css(frame, ['borderTopColor'])).borderTopColor, PINK);
  assert.equal((await css(tab, ['backgroundImage'])).backgroundImage, 'none');
  // post text has no glow, for long reads; the title does
  const rd = win(page, 'reader').locator('.rd');
  assert.equal((await css(rd.locator('p').first(), ['textShadow'])).textShadow, 'none');
  assert.notEqual((await css(rd.locator('h1'), ['textShadow'])).textShadow, 'none');

  assert.equal(await page.locator('#themeBtn').isVisible(), false, 'dark only');
  await shot(page, 'synthwave');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('Synthwave: the Control panel turns off Colours, Mode and Dock while the look is on', async t => {
  if (!(await needs(t, '/control-panel/'))) return;
  const page = await openLook(desktop, '/control-panel/');
  const cp = win(page, 'control-panel');
  await cp.locator('.cp').waitFor();
  for (const g of ['palette', 'theme', 'dock']) {
    assert.equal(await cp.locator(`fieldset:has([name="cp-${g}"])`).evaluate(f => f.disabled), true, `${g} is the look's`);
  }
  assert.equal(await cp.locator('fieldset:has([name="cp-wall"])').evaluate(f => f.disabled), false);
  // both thumbnails are drawn: the glowing window, and the sun over the grid
  assert.equal((await css(cp.locator('.cp-deco.synthwave'), ['borderTopColor'], '::after')).borderTopColor, PINK);
  const sun = await css(cp.locator('.cp-wp.synthwave'), ['borderTopLeftRadius', 'maskImage'], '::before');
  assert.equal(sun.borderTopLeftRadius, '50%');
  assert.match(sun.maskImage, /linear-gradient/);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('Synthwave: the sun and grid sit behind the windows, never take a click, and hold still', async t => {
  if (!(await needs(t, '/posts/'))) return;
  const page = await openLook(desktop, '/posts/', { reducedMotion: 'no-preference' });
  const w = win(page, 'tracker');
  await w.locator('.pc').first().waitFor();
  const sun = await bodyPseudo(page, '::before', ['position', 'zIndex', 'pointerEvents', 'borderTopLeftRadius', 'maskImage']);
  assert.deepEqual({ ...sun, maskImage: /linear-gradient/.test(sun.maskImage) },
    { position: 'fixed', zIndex: '-1', pointerEvents: 'none', borderTopLeftRadius: '50%', maskImage: true });
  const grid = await bodyPseudo(page, '::after', ['position', 'zIndex', 'pointerEvents', 'transform', 'backgroundImage']);
  assert.equal(grid.position, 'fixed');
  assert.equal(grid.zIndex, '-1');
  assert.equal(grid.pointerEvents, 'none');
  assert.match(grid.transform, /^matrix3d/, 'tipped back in perspective');
  assert.match(grid.backgroundImage, /linear-gradient/);
  for (const p of ['::before', '::after']) assert.equal((await bodyPseudo(page, p, ['animationName'])).animationName, 'none', `${p} holds still`);
  // the wallpaper draws without stealing clicks from what is over it
  const card = w.locator('.pc').first(), b = await card.boundingBox();
  assert.equal(await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('.pc'), [b.x + b.width / 2, b.y + b.height / 2]), true);
  await card.click();
  await win(page, 'reader').locator('.rd h1').waitFor();
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('Synthwave is back before first paint on reload', async () => {
  const page = await openLook(desktop, '/');
  const href = await lookHref(page);
  await page.reload({ waitUntil: 'commit' });
  await page.waitForFunction(() => document.body);
  assert.equal(await page.evaluate(h => !!document.querySelector(`head link[rel=stylesheet][href="${h}"]`), href), true, 'linked from head.html');
  await page.waitForSelector('html.wm-ready');
  assert.equal((await bodyPseudo(page, '::before', ['position'])).position, 'fixed', 'the sun is up');
  await page.context().close();
});

test('Synthwave on a phone: a full-width title bar without corners, over the full-screen window', async t => {
  if (!(await needs(t, '/posts/'))) return;
  const page = await openLook(phone, '/');
  await cards(page).first().click();
  const w = win(page, 'reader');
  await w.locator('.rd h1').waitFor();
  const [tab, frame] = [await w.locator('.tab.on').boundingBox(), await w.locator('.frame').boundingBox()];
  assert.equal(Math.round(frame.width), phone.width, 'full width');
  assert.ok(Math.abs(tab.y + tab.height - frame.y) <= 1, 'title bar above the frame');
  assert.equal((await css(w.locator('.tab.on'), ['borderTopLeftRadius'])).borderTopLeftRadius, '0px');
  await shot(page, 'synthwave-phone');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('Synthwave leaves nothing behind when another look is on, though its stylesheet is loaded', async t => {
  if (!(await needs(t, '/control-panel/'))) return;
  const page = await open(desktop, '/control-panel/');
  const cp = win(page, 'control-panel');
  await cp.locator('.cp').waitFor();
  const href = await lookHref(page);
  await page.waitForFunction(h => !!document.querySelector(`head link[rel=stylesheet][href="${h}"]`)?.sheet, href);
  assert.notEqual((await css(cp.locator('.frame'), ['borderTopColor'])).borderTopColor, PINK);
  assert.equal((await bodyPseudo(page, '::before', ['content'])).content, 'none');
  assert.equal((await bodyPseudo(page, '::after', ['content'])).content, 'none');
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
};

test('axe: Synthwave over its main states at 1440 and 390, with either stored mode', async () => {
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
