// Broadsheet (css/deskbar/looks/broadsheet.css): neo-brutalist newsprint. Slab title bars over ink-ruled windows with
// hard offset shadows, a black masthead panel, sticker-tab dock, typographic wallpaper, a night edition in dark mode,
// a scroll-driven reading bar that stays off under reduced motion, touch-sized on phones, nothing left behind when the
// look is off, and axe over its main states.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { useBrowser, open, needs, shot, win, cards, desktop, phone } from './lib.mjs';

useBrowser();

const LOOK = { deco: 'broadsheet', wall: 'broadsheet' };
const seed = look => `for (const [k, v] of Object.entries(${JSON.stringify(look)})) localStorage.setItem("deskbar:" + k, JSON.stringify(v));`;
const openLook = (vp, path, opts) => open(vp, path, seed(LOOK), opts);
const INK = 'rgb(18, 18, 18)', CREAM = 'rgb(235, 230, 217)', ACID = 'rgb(220, 255, 58)', TOMATO = 'rgb(255, 90, 54)', COBALT = 'rgb(42, 61, 255)';
const css = (loc, props, pseudo) => loc.evaluate((el, [ps, p]) => {
  const s = getComputedStyle(el, p);
  return Object.fromEntries(ps.map(k => [k, s[k]]));
}, [props, pseudo]);
const hard = (shadow, px, colour) => shadow === `${colour} ${px}px ${px}px 0px 0px`;

test('Broadsheet: slab title bars, ink-ruled windows on hard shadows, a masthead panel and newsprint type', async t => {
  if (!(await needs(t, '/posts/'))) return;
  const page = await openLook(desktop, '/posts/', { colorScheme: 'light' });
  const w = win(page, 'tracker');
  await w.locator('.pc').first().waitFor();

  const frame = w.locator('.frame'), tab = w.locator('.tab.on');
  const f = await css(frame, ['boxShadow', 'borderLeftWidth', 'borderLeftColor', 'borderTopWidth', 'borderTopLeftRadius']);
  assert.ok(hard(f.boxShadow, 7, INK), `a hard ink shadow on the focused window: ${f.boxShadow}`);
  assert.deepEqual([f.borderLeftWidth, f.borderLeftColor, f.borderTopWidth, f.borderTopLeftRadius], ['2px', INK, '0px', '0px'], 'ink rules, square corners');
  const tb = await css(tab, ['backgroundColor', 'color', 'boxShadow', 'borderBottomWidth']);
  assert.deepEqual([tb.backgroundColor, tb.color, tb.borderBottomWidth], [ACID, INK, '2px'], 'an acid slab ruled off from the content');
  assert.ok(hard(tb.boxShadow, 7, INK), 'the title bar casts the same shadow');
  assert.equal((await css(tab.locator('.tt'), ['textTransform'])).textTransform, 'uppercase');
  // a window on its own has its title bar across the whole top, joined to the frame
  const [tbb, fb] = [await tab.boundingBox(), await frame.boundingBox()];
  assert.ok(Math.abs(tbb.x - fb.x) <= 1 && Math.abs(tbb.width - fb.width) <= 1 && Math.abs(tbb.y + tbb.height - fb.y) <= 1, `slab ${JSON.stringify(tbb)} over ${JSON.stringify(fb)}`);
  for (const c of ['.ctl.min', '.ctl.max', '.ctl.close']) {
    const s = await css(tab.locator(c), ['borderTopWidth', 'backgroundColor', 'borderTopLeftRadius']);
    assert.deepEqual(s, { borderTopWidth: '2px', backgroundColor: 'rgb(255, 255, 255)', borderTopLeftRadius: '0px' }, `${c} is a boxed button`);
  }
  // cards sit on hard shadows too
  assert.ok(hard((await css(w.locator('.pc').first(), ['boxShadow'])).boxShadow, 3, INK));

  // the masthead: black, capitals, the menu on acid and the clock on tomato. The pointer starts at 0,0, over the Menu
  // button in some headless browsers, which would show its hover instead
  await page.mouse.move(desktop.width / 2, desktop.height - 150);
  assert.equal((await css(page.locator('#panel'), ['backgroundColor'])).backgroundColor, INK);
  assert.equal((await css(page.locator('#menuBtn'), ['backgroundColor'])).backgroundColor, ACID);
  assert.equal((await css(page.locator('#clock'), ['backgroundColor'])).backgroundColor, TOMATO);
  const font = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  assert.match(font, /^"?Space Grotesk"?/, 'grotesque chrome');
  assert.ok(await page.evaluate(() => document.fonts.check('700 12px "Space Grotesk"')), 'Space Grotesk is self-hosted and loaded');

  // the typographic wallpaper: ruled paper with a cobalt disc, the site's name huge in outline
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundImage);
  assert.ok(bg.includes(COBALT) && (bg.match(/gradient\(/g) || []).length >= 5, 'disc, rules and halftone');
  const name = await css(page.locator('#desk'), ['content', 'color', 'webkitTextStrokeWidth', 'fontSize'], '::after');
  assert.equal(name.color, 'rgba(0, 0, 0, 0)');
  assert.equal(name.webkitTextStrokeWidth, '2px');
  assert.ok(parseFloat(name.fontSize) >= 100, `set huge: ${name.fontSize}`);

  // sticker-tab dock: no bar behind, each launcher its own labelled card on a hard shadow, Home in reverse
  assert.equal((await css(page.locator('#dock'), ['backgroundColor'])).backgroundColor, 'rgba(0, 0, 0, 0)');
  const dks = page.locator('#dock .dk');
  assert.ok((await dks.count()) >= 2);
  for (const d of await dks.all()) {
    const s = await css(d, ['boxShadow', 'borderTopWidth', 'textTransform']);
    assert.ok(hard(s.boxShadow, 3, INK) && s.borderTopWidth === '2px' && s.textTransform === 'uppercase', JSON.stringify(s));
    assert.ok((await d.locator('.lbl').boundingBox()).width > 20, 'its label shows');
  }
  const posts = page.locator('#dock .dk.run').first();
  if (await posts.count()) assert.equal((await css(posts, ['backgroundColor'])).backgroundColor, ACID, 'a running app is on acid');
  assert.deepEqual(await css(page.locator('#dock #homeBtn'), ['backgroundColor', 'color']), { backgroundColor: INK, color: ACID });
  await shot(page, 'broadsheet');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('Broadsheet: a night edition in dark mode, the ink turned cream', async t => {
  if (!(await needs(t, '/posts/'))) return;
  const page = await openLook(desktop, '/posts/', { colorScheme: 'dark' });
  const w = win(page, 'tracker');
  await w.locator('.pc').first().waitFor();
  assert.ok(hard((await css(w.locator('.frame'), ['boxShadow'])).boxShadow, 7, CREAM), 'cream shadows on black newsprint');
  assert.deepEqual(await css(w.locator('.tab.on'), ['backgroundColor', 'color']), { backgroundColor: ACID, color: INK }, 'spot colours keep dark type');
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgb(21, 20, 18)');
  assert.equal(await page.locator('#themeBtn').isVisible(), true, 'the visitor keeps the theme switch');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('Broadsheet: the reader sets a grotesque headline over a serif body, and the reading bar follows the scroll', async t => {
  if (!(await needs(t, '/posts/'))) return;
  const page = await openLook(desktop, '/', { reducedMotion: 'no-preference' });
  await cards(page).first().click();
  const r = win(page, 'reader');
  await r.locator('.rd h1').waitFor();
  assert.match((await css(r.locator('.rd h1'), ['fontFamily'])).fontFamily, /Space Grotesk/);
  assert.match((await css(r.locator('.rd-body p').first(), ['fontFamily'])).fontFamily, /^"?Literata/);
  const meta = r.locator('.rd .meta');
  if (await meta.count()) assert.deepEqual(await css(meta, ['borderTopWidth', 'borderBottomWidth', 'textTransform']), { borderTopWidth: '2px', borderBottomWidth: '2px', textTransform: 'uppercase' }, 'the kicker sits between ink rules');

  const bar = await r.locator('.rd-scroll').evaluate(async el => {
    const s = () => getComputedStyle(el, '::before');
    const at = { supported: CSS.supports('animation-timeline: scroll()'), scrolls: el.scrollHeight > el.clientHeight + 100, name: s().animationName, position: s().position, from: parseFloat(s().backgroundSize) };
    el.scrollTop = (el.scrollHeight - el.clientHeight) / 2;
    await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
    return { ...at, to: parseFloat(s().backgroundSize) };
  });
  if (!bar.supported) {
    await page.context().close();
    return t.skip('no scroll-driven animations in this browser');
  }
  assert.equal(bar.name, 'bs-read');
  assert.equal(bar.position, 'sticky');
  if (bar.scrolls) assert.ok(bar.from < 5 && bar.to > 30 && bar.to < 70, `the bar fills with the scroll: ${bar.from}% then ${bar.to}%`);
  await shot(page, 'broadsheet-reader');
  assert.deepEqual(page.errors, []);
  await page.context().close();

  // under reduced motion there is no bar at all
  const still = await openLook(desktop, '/');
  await cards(still).first().click();
  await win(still, 'reader').locator('.rd h1').waitFor();
  assert.equal((await css(win(still, 'reader').locator('.rd-scroll'), ['content'], '::before')).content, 'none');
  await still.context().close();
});

test('Broadsheet on a phone: square stickers, a slab title bar and window controls at touch size, the panel on screen', async t => {
  if (!(await needs(t, '/posts/'))) return;
  const page = await openLook(phone, '/', { hasTouch: true, isMobile: true });
  const dks = page.locator('#dock .dk');
  for (const d of await dks.all()) {
    const b = await d.boundingBox();
    assert.ok(b.width >= 44 && b.height >= 44, `a sticker at touch size: ${JSON.stringify(b)}`);
    assert.ok(hard((await css(d, ['boxShadow'])).boxShadow, 3, INK));
    assert.ok((await d.locator('.lbl').boundingBox()).width <= 1, 'icons only, the label kept for screen readers');
  }
  for (const el of await page.locator('#panel > *').filter({ visible: true }).all()) {
    const b = await el.boundingBox();
    assert.ok(b.x + b.width <= phone.width + 0.5, `${await el.evaluate(e => e.id || e.className)} fits the panel`);
  }
  await cards(page).first().click();
  const r = win(page, 'reader');
  await r.locator('.rd h1').waitFor();
  assert.ok((await r.locator('.tab.on').boundingBox()).height >= 44);
  for (const c of ['.ctl.min', '.ctl.close']) {
    const b = await r.locator(`.tab.on ${c}`).boundingBox();
    assert.ok(b.width >= 40 && b.height >= 36, `${c} ${JSON.stringify(b)}`);
  }
  assert.equal((await css(r.locator('.frame'), ['boxShadow'])).boxShadow, 'none', 'a full-screen window casts no shadow');
  await shot(page, 'broadsheet-phone');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('Broadsheet leaves nothing behind once another window style is on, its stylesheet still loaded', async t => {
  if (!(await needs(t, '/control-panel/'))) return;
  const page = await open(desktop, '/control-panel/');
  const cp = win(page, 'control-panel');
  await cp.locator('.cp').waitFor();
  await page.waitForFunction(() => [...document.styleSheets].some(s => /looks\/broadsheet/.test(s.href || '')));
  assert.ok(!hard((await css(cp.locator('.frame'), ['boxShadow'])).boxShadow, 7, INK));
  assert.doesNotMatch(await page.evaluate(() => getComputedStyle(document.body).fontFamily), /Space Grotesk/);
  assert.notEqual((await css(page.locator('#dock'), ['backgroundColor'])).backgroundColor, 'rgba(0, 0, 0, 0)');
  assert.notEqual((await css(page.locator('#panel'), ['backgroundColor'])).backgroundColor, INK);
  // its thumbnails draw on their own colours
  const thumb = cp.locator('.cp-deco.broadsheet');
  assert.equal((await css(thumb, ['backgroundColor'])).backgroundColor, 'rgb(239, 235, 225)');
  assert.equal((await css(thumb, ['backgroundColor'], '::before')).backgroundColor, ACID);
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

test('axe: Broadsheet at 1440 and 390, light and dark, desktop, reader and menu', async t => {
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
