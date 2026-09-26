// CRT effects (css/deskbar/effects/crt.css): overlays on <html>'s pseudo-elements over any look. Each shows only with
// its own data-crt value, never takes a click, leaves the windows where they were, holds still under reduced motion,
// keeps post text at 4.5:1 as drawn on screen, and passes axe, on a desktop and a phone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { env, useBrowser, open, needs, shot, win, cards, desktop, phone } from './lib.mjs';

useBrowser();

const EFFECTS = ['scanlines', 'tube', 'grille', 'amber', 'green'];
// the effects drawn in two layers, ::before as well as ::after
const TWO = ['tube', 'grille', 'amber', 'green'];
const seed = s => `for (const [k, v] of Object.entries(${JSON.stringify(s)})) localStorage.setItem("deskbar:" + k, JSON.stringify(v));`;
const setCrt = (page, v) => page.evaluate(v => { const d = document.documentElement.dataset; if (v) d.crt = v; else delete d.crt; }, v);
const layer = (page, pseudo, props) => page.evaluate(([p, ps]) => {
  const s = getComputedStyle(document.documentElement, p);
  return Object.fromEntries(ps.map(k => [k, s[k]]));
}, [pseudo, props]);
const rects = page => page.locator('.win:not([hidden]), #panel, #dock').evaluateAll(els => els.map(el => JSON.stringify(el.getBoundingClientRect())));
const hitsCard = (page, b) => page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('.pc'), [b.x + b.width / 2, b.y + b.height / 2]);

test('each effect draws only under its own value, over everything, and nothing with it off', async t => {
  if (!(await needs(t, '/control-panel/'))) return;
  const page = await open(desktop, '/control-panel/');
  await win(page, 'control-panel').locator('.cp').waitFor();
  // the Control panel loads the effects' stylesheet for its thumbnails, which alone draws nothing
  const href = await page.evaluate(() => JSON.parse(document.getElementById('deskbar-lazy').textContent)['effect-crt'].css);
  await page.waitForFunction(h => !!document.querySelector(`head link[rel=stylesheet][href="${h}"]`)?.sheet, href);
  for (const p of ['::before', '::after']) assert.equal((await layer(page, p, ['content'])).content, 'none', `no ${p} with the effect off`);

  const winZ = await win(page, 'control-panel').evaluate(el => +getComputedStyle(el).zIndex || 0);
  for (const v of EFFECTS) {
    await setCrt(page, v);
    const after = await layer(page, '::after', ['content', 'position', 'pointerEvents', 'zIndex', 'backgroundImage', 'width']);
    assert.equal(after.position, 'fixed', v);
    assert.equal(after.pointerEvents, 'none', v);
    assert.ok(+after.zIndex > winZ, `${v} over the windows`);
    assert.notEqual(after.backgroundImage, 'none', `${v} draws`);
    const before = await layer(page, '::before', ['content', 'pointerEvents', 'mixBlendMode', 'width', 'height']);
    if (TWO.includes(v)) {
      assert.equal(before.pointerEvents, 'none', v);
      assert.deepEqual([before.width, before.height], [`${desktop.width}px`, `${desktop.height}px`], `${v} covers the screen`);
    } else assert.equal(before.content, 'none', `${v} is one layer`);
    if (v === 'amber' || v === 'green') assert.equal(before.mixBlendMode, 'color', `${v} keeps lightness, so contrast holds`);
    // nothing on the root or body that would become the fixed windows' containing block
    assert.deepEqual(await page.evaluate(() => [document.documentElement, document.body].map(el => {
      const s = getComputedStyle(el);
      return [s.filter, s.transform, s.backdropFilter, s.contain];
    }).flat()), ['none', 'none', 'none', 'none', 'none', 'none', 'none', 'none'], v);
  }
  await setCrt(page, null);
  for (const p of ['::before', '::after']) assert.equal((await layer(page, p, ['content'])).content, 'none', `${p} gone again`);

  // a thumbnail for every choice, each drawn over the same plain screen
  await win(page, 'control-panel').locator('.cp-crt.off').scrollIntoViewIfNeeded();
  await shot(page, 'crt-thumbnails');
  const thumbs = await win(page, 'control-panel').locator('.cp-crt').evaluateAll(els => els.map(el => [
    [...el.classList].find(c => !['cp-art', 'cp-crt'].includes(c)), getComputedStyle(el).backgroundImage !== 'none', getComputedStyle(el, '::after').content,
  ]));
  assert.deepEqual(thumbs.map(t => t[0]), ['off', ...EFFECTS]);
  for (const [v, drawn, over] of thumbs) {
    assert.ok(drawn, `${v} thumbnail`);
    assert.equal(over === 'none', v === 'off', `${v} thumbnail overlay`);
  }
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('an effect never takes a click or tap and leaves every window where it was, on a desktop and a phone', async t => {
  if (!(await needs(t, '/posts/'))) return;
  for (const vp of [desktop, phone]) {
    const page = await open(vp, '/posts/', seed({ crt: 'scanlines' }));
    const card = win(page, 'tracker').locator('.pc').first();
    await card.waitFor();
    await setCrt(page, null);
    const [plain, b] = [await rects(page), await card.boundingBox()];
    for (const v of EFFECTS) {
      await setCrt(page, v);
      assert.deepEqual(await rects(page), plain, `${v} at ${vp.width} moves nothing`);
      assert.equal(await hitsCard(page, b), true, `${v} at ${vp.width} lets the pointer through`);
    }
    await card.click();
    await win(page, 'reader').locator('.rd h1').waitFor();
    await shot(page, `crt-green-${vp.width}`);
    assert.deepEqual(page.errors, []);
    await page.context().close();
  }
});

test('only the tube moves, a refresh band that reduced motion takes away', async t => {
  if (!(await needs(t, '/posts/'))) return;
  const moving = await open(desktop, '/posts/', seed({ crt: 'tube' }), { reducedMotion: 'no-preference' });
  const band = await layer(moving, '::after', ['animationName', 'display']);
  assert.deepEqual(band, { animationName: 'crt-roll', display: 'block' });
  const rolls = page => page.evaluate(() => document.getAnimations().filter(a => a.animationName?.startsWith('crt-')).length);
  assert.equal(await rolls(moving), 1);
  for (const v of EFFECTS.filter(v => v !== 'tube')) {
    await setCrt(moving, v);
    assert.equal(await rolls(moving), 0, `${v} is still`);
  }
  await moving.context().close();

  const still = await open(desktop, '/posts/', seed({ crt: 'tube' }));
  assert.equal((await layer(still, '::after', ['display'])).display, 'none', 'no band under reduced motion');
  assert.equal(await rolls(still), 0);
  await still.context().close();
});

// WCAG contrast of a post's first paragraph as the screen shows it: the ink (the darkest or lightest few pixels, as
// the mode has it) against the paper (the median), read from a screenshot so the overlays count
async function onScreenContrast(page) {
  const p = win(page, 'reader').locator('.rd p').first();
  const b = await p.boundingBox();
  const png = await page.screenshot({ clip: { x: b.x, y: b.y, width: Math.min(b.width, 600), height: Math.min(b.height, 80) } });
  return page.evaluate(async src => {
    const img = await createImageBitmap(await (await fetch(src)).blob());
    const c = new OffscreenCanvas(img.width, img.height).getContext('2d');
    c.drawImage(img, 0, 0);
    const d = c.getImageData(0, 0, img.width, img.height).data, lin = v => (v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    const ls = [];
    for (let i = 0; i < d.length; i += 4) ls.push(0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2]));
    ls.sort((a, b) => a - b);
    const q = f => ls[Math.floor(f * (ls.length - 1))], paper = q(0.5);
    const ink = paper > 0.2 ? q(0.02) : q(0.98);
    return (Math.max(ink, paper) + 0.05) / (Math.min(ink, paper) + 0.05);
  }, `data:image/png;base64,${png.toString('base64')}`);
}

test('post text stays at 4.5:1 or better on screen under every effect, in light and dark', async () => {
  const low = [];
  for (const theme of ['light', 'dark']) {
    const page = await open(desktop, '/', seed({ theme, crt: 'scanlines' }), { colorScheme: theme });
    await cards(page).first().click();
    await win(page, 'reader').locator('.rd p').first().waitFor();
    for (const v of EFFECTS) {
      await setCrt(page, v);
      const r = await onScreenContrast(page);
      if (r < 4.5) low.push(`${v} ${theme} ${r.toFixed(2)}`);
      await shot(page, `crt-${v}-${theme}`);
    }
    await page.context().close();
  }
  assert.deepEqual(low, []);
});

// axe over a post and the Posts window with each effect on, at 1440 and 390, the modes taking turns
const AXE = readFileSync(fileURLToPath(import.meta.resolve('axe-core/axe.min.js')), 'utf8');
test('axe: every effect over a post and Posts, on a desktop and a phone', async t => {
  if (!(await needs(t, '/posts/'))) return;
  const found = [];
  for (const [i, v] of EFFECTS.entries()) {
    for (const vp of [desktop, phone]) {
      const theme = (i + vp.width) % 2 ? 'dark' : 'light';
      const ctx = await env.browser.newContext({ viewport: vp, reducedMotion: 'reduce', colorScheme: theme });
      await ctx.addInitScript(seed({ crt: v, theme }));
      const page = await ctx.newPage();
      await page.goto(env.base + '/posts/');
      await page.waitForSelector('html.wm-ready');
      await win(page, 'tracker').locator('a[data-url]').first().click();
      await win(page, 'reader').locator('.rd h1').waitFor();
      await page.addScriptTag({ content: AXE });
      const { violations } = await page.evaluate(() => window.axe.run(document, { iframes: false, resultTypes: ['violations'] }));
      for (const x of violations.filter(x => ['serious', 'critical'].includes(x.impact))) {
        for (const n of x.nodes) found.push(`[${v} ${vp.width} ${theme}] ${x.impact} ${x.id}: ${n.target.join(' ')}`);
      }
      await ctx.close();
    }
  }
  assert.deepEqual(found, []);
});
