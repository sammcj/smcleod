// Synthwave (css/deskbar/looks/synthwave.css): an 80s outrun night. Indigo windows edged in neon with sunset tabs,
// a striped sun over a perspective grid that stays behind everything and never takes the pointer, a neon dock that
// also stands on its own, no Light mode, linked before first paint, nothing left behind when the look is off, and axe
// over its main states. Sunrise, its light colours, keeps that chrome around light pages over a dawn wallpaper.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { env, useBrowser, open, needs, shot, win, cards, desktop, phone, toolbarGaps, axeViolations } from './lib.mjs';

useBrowser();

const LOOK = { deco: 'synthwave', wall: 'synthwave', dock: 'synthwave' };
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
  assert.equal((await css(page.locator('#dock'), ['borderTopColor'])).borderTopColor, 'rgba(255, 62, 165, 0.6)', 'the neon dock');
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

test('Synthwave: the Control panel offers only its own colours, turns off Mode, and draws its thumbnails', async t => {
  if (!(await needs(t, '/control-panel/'))) return;
  const page = await openLook(desktop, '/control-panel/');
  const cp = win(page, 'control-panel');
  await cp.locator('.cp').waitFor();
  assert.equal(await cp.locator('fieldset:has([name="cp-theme"])').evaluate(f => f.disabled), true, 'Mode is the look\'s');
  for (const g of ['palette', 'wall', 'dock']) assert.equal(await cp.locator(`fieldset:has([name="cp-${g}"])`).evaluate(f => f.disabled), false, `${g} stays the visitor's`);
  const colours = await cp.locator('fieldset:has([name="cp-palette"]) .cp-opt:not([hidden]) input').evaluateAll(rs => rs.map(r => r.value));
  assert.deepEqual(colours, ['synthwave-night', 'synthwave-sunrise']);
  // the thumbnails are drawn: the glowing window, the sun over the grid, and the neon-rimmed dock
  assert.equal((await css(cp.locator('fieldset:has([name="cp-deco"]) .cp-deco.synthwave'), ['borderTopColor'], '::after')).borderTopColor, PINK);
  const sun = await css(cp.locator('fieldset:has([name="cp-wall"]) .cp-wp.synthwave'), ['borderTopLeftRadius', 'maskImage'], '::before');
  assert.equal(sun.borderTopLeftRadius, '50%');
  assert.match(sun.maskImage, /linear-gradient/);
  assert.match((await css(cp.locator('.cp-dk.synthwave'), ['boxShadow'], '::before')).boxShadow, /rgba\(255, 62, 165/);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('Synthwave: its dock is drawn under another window style in either mode, and nothing of it is on the glass dock', async t => {
  if (!(await needs(t, '/posts/'))) return;
  const lamp = page => css(page.locator('#dock .dk.run').first(), ['backgroundColor'], '::after');
  for (const theme of ['light', 'dark']) {
    const page = await open(desktop, '/posts/', seed({ deco: 'haiku', dock: 'synthwave', theme }));
    const w = win(page, 'tracker');
    await w.locator('.pc').first().waitFor();
    assert.notEqual((await css(w.locator('.frame'), ['borderTopColor'])).borderTopColor, PINK, 'Haiku windows');
    const d = await css(page.locator('#dock'), ['borderTopColor', 'borderTopLeftRadius', 'boxShadow']);
    assert.deepEqual([d.borderTopColor, d.borderTopLeftRadius], ['rgba(255, 62, 165, 0.6)', '12px']);
    assert.match(d.boxShadow, /rgba\(255, 62, 165/, 'the dock glows');
    assert.equal((await lamp(page)).backgroundColor, 'rgb(111, 227, 255)', 'cyan lamps');
    await shot(page, `synthwave-dock-${theme}`);
    assert.deepEqual(page.errors, []);
    await page.context().close();
  }
  const page = await open(desktop, '/posts/', seed({ ...LOOK, dock: 'glass' }));
  const w = win(page, 'tracker');
  await w.locator('.pc').first().waitFor();
  assert.equal((await css(w.locator('.frame'), ['borderTopColor'])).borderTopColor, PINK, 'Synthwave windows');
  const d = await css(page.locator('#dock'), ['borderTopLeftRadius', 'boxShadow']);
  assert.equal(d.borderTopLeftRadius, '8px');
  assert.doesNotMatch(d.boxShadow, /rgba\(255, 62, 165/);
  assert.notEqual((await lamp(page)).backgroundColor, 'rgb(111, 227, 255)');
  await shot(page, 'synthwave-glass-dock');
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
  // the reader toolbar sticks straight under the title bar, with no band between them, scrolled or not
  for (const g of await toolbarGaps(page, w)) assert.ok(Math.abs(g) <= 8, `toolbar ${g}px from the title bar`);
  await shot(page, 'synthwave-phone');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

// Sunrise, its light colours: the night's chrome around light pages, the Posts cards and the phone's Latest posts
const SUNRISE = { ...LOOK, palette: 'synthwave-sunrise', wall: 'synthwave-sunrise' };
const FRAME = 'rgb(33, 21, 70)', PAGE = 'rgb(252, 247, 255)';
// the contrast of each element's text against the first opaque background behind it
const contrasts = (loc) => loc.evaluateAll(els => {
  // color-mix() computes to color(srgb 0-1 ...), the rest to rgb(0-255 ...)
  const rgb = s => { const n = s.match(/[\d.]+/g).map(Number); return s.startsWith('color(') ? [...n.slice(0, 3).map(v => v * 255), n[3]] : n; };
  const lum = c => { const [r, g, b] = c.slice(0, 3).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
  return els.map(el => {
    let bg = el;
    // a faint tint, such as the rows' zebra, counts as what is under it
    while (bg && rgb(getComputedStyle(bg).backgroundColor)[3] < .5) bg = bg.parentElement;
    const [a, b] = [lum(rgb(getComputedStyle(el).color)), lum(rgb(getComputedStyle(bg).backgroundColor))].sort((x, y) => y - x);
    return [Math.round((a + .05) / (b + .05) * 100) / 100, `${el.localName}.${el.className} on ${bg.localName}.${bg.className}`];
  });
});
const readable = async (loc, what) => {
  const found = await contrasts(loc);
  assert.ok(found.length, `${what}: some shown`);
  for (const [r, el] of found) assert.ok(r >= 4.5, `${what}: ${el} at ${r}:1`);
};

test('Sunrise: dark neon chrome around light pages, with dark text at 4.5:1 in the cards and the reader', async t => {
  if (!(await needs(t, '/posts/'))) return;
  const page = await open(desktop, '/posts/', seed(SUNRISE));
  const w = win(page, 'tracker');
  await w.locator('.pc').first().waitFor();
  // the chrome is the night's: the panel, the frame, the sunset tab
  assert.match((await css(page.locator('#panel'), ['backgroundImage'])).backgroundImage, /rgb\(42, 19, 86\)/);
  const f = await css(w.locator('.frame'), ['backgroundColor', 'borderTopColor']);
  assert.deepEqual([f.backgroundColor, f.borderTopColor], [FRAME, PINK]);
  assert.match((await css(w.locator('.tab.on'), ['backgroundImage'])).backgroundImage, /linear-gradient/);
  // the pages are light
  assert.equal((await css(w.locator('.pc').first(), ['backgroundColor'])).backgroundColor, PAGE);
  await readable(w.locator('.pc-t, .pc-d, .pc-row small, .pv-year, .row').filter({ visible: true }), 'Posts cards and rows');
  await w.locator('.pc').first().click();
  const rd = win(page, 'reader').locator('.rd');
  await rd.locator('h1').waitFor();
  assert.equal((await css(rd.locator('h1'), ['color'])).color, 'rgb(192, 19, 122)', 'a deeper pink title by day');
  await readable(rd.locator(':is(h1, h2, p, li, a)').filter({ visible: true }), 'reader text');
  await readable(win(page, 'reader').locator('.toolbar .tb').filter({ visible: true }), 'reader toolbar');
  // the dawn wallpaper: a pastel sky, and the sun and grid over it
  assert.match(await page.evaluate(() => getComputedStyle(document.body).backgroundImage), /rgb\(143, 124, 240\)/);
  assert.equal((await bodyPseudo(page, '::before', ['borderTopLeftRadius'])).borderTopLeftRadius, '50%');
  await shot(page, 'synthwave-sunrise');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('Sunrise on a phone: the Latest posts go light under the dark panel, and so does the post', async t => {
  if (!(await needs(t, '/posts/'))) return;
  const page = await open(phone, '/', seed(SUNRISE));
  const list = page.locator('#recent .recent-list');
  await list.locator('.pc').first().waitFor();
  assert.equal((await css(list.locator('.pc').first(), ['backgroundColor'])).backgroundColor, PAGE);
  await readable(list.locator('.pc-t, .pc-d, .pc-row small').filter({ visible: true }), 'Latest posts');
  await cards(page).first().click();
  const w = win(page, 'reader');
  await w.locator('.rd h1').waitFor();
  assert.equal((await css(w.locator('.frame'), ['backgroundColor'])).backgroundColor, FRAME);
  await readable(w.locator('.rd :is(h1, p)').filter({ visible: true }), 'reader text');
  await shot(page, 'synthwave-sunrise-phone');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('Sunrise applies only under the Synthwave window style, and the night is as it was', async t => {
  if (!(await needs(t, '/posts/'))) return;
  const reader = async look => {
    const page = await open(desktop, '/posts/', seed(look));
    await win(page, 'tracker').locator('.pc').first().click();
    const rd = win(page, 'reader').locator('.rd');
    await rd.locator('h1').waitFor();
    const r = { p: (await css(rd.locator('p').first(), ['color'])).color, h1: (await css(rd.locator('h1'), ['color'])).color };
    assert.deepEqual(page.errors, []);
    await page.context().close();
    return r;
  };
  // the first paragraph is the summary, in the muted colour
  const night = { p: 'rgb(182, 168, 220)', h1: 'rgb(255, 143, 203)' };
  assert.deepEqual(await reader(LOOK), night, 'a visitor with no Synthwave colours stored');
  assert.deepEqual(await reader({ ...LOOK, palette: 'synthwave-night' }), night);
  const haiku = await reader({ deco: 'haiku', palette: 'synthwave-sunrise', wall: 'synthwave-sunrise', theme: 'dark' });
  assert.notEqual(haiku.p, 'rgb(98, 80, 138)', 'no Sunrise pages under Haiku windows');
  assert.notEqual(haiku.h1, 'rgb(192, 19, 122)');
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
  const violations = await axeViolations(page, exclude);
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

test('axe: Synthwave and Sunrise over their main states at 1440 and 390, with either stored mode', async () => {
  const found = [];
  for (const [look, colours] of [['night', LOOK], ['sunrise', SUNRISE]]) {
    for (const [name, s] of Object.entries(states)) {
      if (s.need && !(await fetch(env.base + s.need)).ok) continue;
      for (const [vp, w] of [[desktop, 1440], [phone, 390]]) {
        for (const theme of ['light', 'dark']) {
          const ctx = await env.browser.newContext({ viewport: vp, reducedMotion: 'reduce', colorScheme: theme });
          await ctx.addInitScript(seed({ ...colours, theme }));
          const page = await ctx.newPage();
          await page.goto(env.base + s.path);
          await page.waitForSelector('html.wm-ready');
          await s.setup(page);
          for (const v of await audit(page, s.exclude)) found.push(`[${look} ${name} ${w} ${theme}] ${v}`);
          await ctx.close();
        }
      }
    }
  }
  assert.deepEqual(found, []);
});
