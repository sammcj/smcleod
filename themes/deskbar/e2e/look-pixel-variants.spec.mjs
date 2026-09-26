// Pixel's other colours, docks and wallpapers (css/deskbar/looks/pixel.css). Handheld, Pico and Quest colours apply
// only under the Pixel window style; the hotbar, Quest menu and cartridge docks and the Handheld, Pico and Quest
// wallpapers go with any window style, and each leaves nothing behind when off. Readable in both schemes, axe clean,
// and the reader toolbar still sticks under the title bar on phones. Skips without /control-panel/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { useBrowser, open, needs, shot, win, cards, desktop, phone, toolbarGaps } from './lib.mjs';

useBrowser();

const VARIANTS = ['pixel-handheld', 'pixel-pico', 'pixel-quest'];
// the presets' pairings (appearance.js)
const preset = v => ({ deco: 'pixel', palette: v, wall: v, dock: v === 'pixel-quest' ? 'pixel-quest' : 'pixel-cartridge' });
// settings as stored, following the browser's scheme, which a test sets
const seed = s => `localStorage.setItem('deskbar:theme', '"auto"');
  for (const [k, v] of Object.entries(${JSON.stringify(s)})) localStorage.setItem('deskbar:' + k, JSON.stringify(v));`;
const css = (loc, prop, pseudo = null) => loc.first().evaluate((el, [p, ps]) => getComputedStyle(el, ps)[p], [prop, pseudo]);
const snap = (loc, name) => process.env.SHOTS_DIR && loc.screenshot({ path: join(process.env.SHOTS_DIR, name + '.png') });
// WCAG contrast of an element's text on the nearest background colour behind it
const contrast = loc => loc.first().evaluate(el => {
  // rgb() or, from color-mix(), color(srgb) in 0 to 1
  const rgb = c => c.match(/[\d.]+/g).map((v, i) => (c.startsWith('color(') && i < 3 ? v * 255 : Number(v)));
  const lum = c => {
    const [r, g, b] = rgb(c).slice(0, 3).map(v => (v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  let bg = el;
  while (bg && (rgb(getComputedStyle(bg).backgroundColor)[3] ?? 1) === 0) bg = bg.parentElement;
  const [a, b] = [lum(getComputedStyle(el).color), lum(getComputedStyle(bg).backgroundColor)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
});
// the Posts window with a post opened from it: the post's window in front, Posts behind
async function twoWindows(page) {
  await win(page, 'tracker').locator('a[data-url]').first().click();
  await win(page, 'reader').locator('.rd h1').waitFor();
}

const FRAME = {
  'pixel-handheld': { light: 'rgb(139, 172, 15)', dark: 'rgb(19, 61, 19)' },
  'pixel-pico': { light: 'rgb(194, 195, 199)', dark: 'rgb(29, 43, 83)' },
};

test('each colour set dresses the Pixel window style, light and dark, with titles and text at 4.5:1', async t => {
  if (!(await needs(t, '/control-panel/'))) return;
  for (const v of VARIANTS) {
    for (const scheme of ['light', 'dark']) {
      const page = await open(desktop, '/posts/', seed(preset(v)), { colorScheme: scheme });
      await twoWindows(page);
      const front = page.locator('.win.active'), back = page.locator('.win:not(.active)'), at = `${v} ${scheme}`;
      assert.match(await css(front.locator('.tab'), 'borderImageSource'), /svg\+xml/, `${at}: ringed`);
      assert.match(await css(front.locator('.tab'), 'backgroundImage'), /repeating-conic-gradient/, `${at}: dithered bar`);
      if (FRAME[v]) assert.equal(await css(front.locator('.frame'), 'backgroundColor'), FRAME[v][scheme], `${at}: frame`);
      else assert.match(await css(front.locator('.frame'), 'backgroundImage'), /linear-gradient/, `${at}: a gradient menu window`);
      for (const [where, loc] of [['front title', front.locator('.tab .tt')], ['back title', back.locator('.tab .tt')],
        ['post text', front.locator('.rd p:not(.meta, .lede)')], ['panel', page.locator('#panel .task').first()],
        ['Posts', back.locator('.pc-t, .pc h3, .pc a').first()]]) {
        const c = await contrast(loc);
        assert.ok(c >= 4.5, `${at}: ${where} at ${c.toFixed(2)}:1`);
      }
      await shot(page, `${v}-${scheme}`);
      assert.deepEqual(page.errors, []);
      await page.context().close();
    }
  }
});

test('the colour sets apply only under the Pixel window style, and any other palette leaves Pixel its own', async t => {
  if (!(await needs(t, '/control-panel/'))) return;
  for (const v of VARIANTS) {
    // the wallpaper links the look's stylesheet, so its rules are there to not match
    const page = await open(desktop, '/posts/', seed({ deco: 'haiku', palette: v, wall: v }));
    const tab = page.locator('.win.active .tab');
    await tab.waitFor();
    assert.equal(await css(tab, 'borderImageSource'), 'none', v);
    assert.equal(await css(tab, 'backgroundImage'), 'none', v);
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--pk-sun')), '', v);
    assert.doesNotMatch(await css(page.locator('#panel'), 'fontFamily'), /Pixelify/);
    assert.equal(await css(page.locator('#dock'), 'borderImageSource'), 'none', 'the glass dock');
    await page.context().close();
  }
  const page = await open(desktop, '/posts/', seed({ deco: 'pixel', palette: 'beos' }));
  await page.locator('.win.active .tab').waitFor();
  assert.equal(await css(page.locator('.win.active .tab'), 'backgroundColor'), 'rgb(255, 205, 77)', 'the sun bar');
  assert.equal(await css(page.locator('#dock'), 'borderImageSource'), 'none', 'no hotbar without the dock setting');
  await page.context().close();
});

test('the docks go with any window style, point, lift and light up, and fit a phone', async t => {
  if (!(await needs(t, '/control-panel/'))) return;
  for (const dock of ['pixel', 'pixel-quest', 'pixel-cartridge']) {
    const page = await open(desktop, '/posts/', seed({ deco: 'haiku', dock }));
    await win(page, 'tracker').waitFor();
    const d = page.locator('#dock'), run = d.locator('.dk.run'), idle = d.locator('.dk:not(.run)');
    assert.ok(await run.count(), `${dock}: Posts runs`);
    const db = await d.boundingBox();
    for (const b of await d.locator('.dk, #homeBtn, #winsBtn').all()) {
      const bb = await b.boundingBox();
      assert.ok(bb.height >= 40 && bb.y >= db.y && bb.y + bb.height <= db.y + db.height + 1, `${dock}: launcher ${JSON.stringify(bb)} in the dock`);
    }
    assert.equal(await css(d, 'backdropFilter'), 'none', dock);
    if (dock === 'pixel') {
      assert.match(await css(d, 'borderImageSource'), /svg\+xml/);
      assert.equal(await css(d.locator('#homeBtn'), 'backgroundColor'), 'rgb(255, 205, 77)', 'Pixel colours of its own');
      assert.equal(await css(run, 'backgroundColor', '::after'), 'rgb(239, 125, 87)');
    } else if (dock === 'pixel-quest') {
      assert.match(await css(d, 'borderImageSource'), /svg\+xml/);
      assert.match(await css(d, 'backgroundImage'), /linear-gradient/);
      assert.equal(await css(idle, 'content', '::before'), 'none', 'no glove until pointed at');
      await idle.first().hover();
      assert.match(await css(idle, 'backgroundImage', '::before'), /svg\+xml/, 'the glove');
      const [glove, icon] = [await idle.first().evaluate(el => el.getBoundingClientRect().left + parseFloat(getComputedStyle(el, '::before').left) + 32),
        await idle.first().locator('.ico').boundingBox()];
      assert.ok(Math.abs(glove - icon.x) <= 2, 'the glove points at the icon');
      assert.equal(await css(run, 'backgroundColor', '::after'), 'rgb(255, 255, 255)', 'a pip under a running app');
      await snap(d, 'pixel-dock-quest');
    } else {
      assert.match(await css(idle, 'backgroundImage'), /svg\+xml/, 'a cartridge');
      assert.equal(await css(idle, 'backgroundColor', '::after'), 'rgb(88, 34, 42)', 'an unlit LED');
      assert.equal(await css(run, 'backgroundColor', '::after'), 'rgb(255, 59, 59)', 'a lit LED');
      assert.match(await css(d.locator('#homeBtn'), 'backgroundImage'), /svg\+xml/, 'the A button');
      assert.equal(await css(d, 'content', '::after'), '""', 'the slot lip');
      assert.equal(await css(d, 'pointerEvents', '::after'), 'none');
      const before = await idle.first().locator('.ico').boundingBox();
      await idle.first().hover();
      assert.ok((await idle.first().locator('.ico').boundingBox()).y < before.y - 4, 'pointing draws the cartridge out');
      await snap(d, 'pixel-dock-cartridge');
    }
    assert.deepEqual(page.errors, []);
    await page.context().close();

    const small = await open(phone, '/', seed({ deco: 'haiku', dock }));
    const sb = await small.locator('#dock').boundingBox();
    assert.ok(sb.x >= 0 && sb.x + sb.width <= phone.width, `${dock}: fits a phone ${JSON.stringify(sb)}`);
    for (const b of await small.locator('#dock .dk').all()) assert.ok((await b.boundingBox()).height >= 44, `${dock}: 44px tall on a phone`);
    await small.context().close();
  }
});

test('the wallpapers stay behind everything and never take the pointer', async t => {
  if (!(await needs(t, '/control-panel/'))) return;
  for (const wall of ['pixel', ...VARIANTS]) {
    for (const scheme of ['light', 'dark']) {
      const page = await open(desktop, '/', seed({ deco: 'haiku', wall }), { colorScheme: scheme });
      assert.match(await css(page.locator('body'), 'backgroundImage'), /svg\+xml/, wall);
      for (const ps of ['::before', '::after']) {
        const s = await page.locator('body').evaluate((el, p) => {
          const c = getComputedStyle(el, p);
          return { content: c.content, pointerEvents: c.pointerEvents, zIndex: c.zIndex, position: c.position };
        }, ps);
        if (s.content === 'none') continue;
        assert.deepEqual([s.pointerEvents, s.zIndex, s.position], ['none', '-1', 'fixed'], `${wall} ${scheme} ${ps}`);
      }
      // a spot on the bare desktop belongs to the desktop, whatever the wallpaper draws there
      const hit = await page.evaluate(() => document.elementFromPoint(innerWidth - 60, innerHeight - 160)?.closest('#desk') != null);
      assert.ok(hit, `${wall} ${scheme}: the desktop takes the pointer`);
      if (wall === 'pixel-quest') {
        const stars = await css(page.locator('body'), 'backgroundImage', '::before');
        assert[scheme === 'dark' ? 'match' : 'doesNotMatch'](stars, /svg\+xml/, `quest ${scheme}: stars by night only`);
        assert.match(await css(page.locator('body'), 'maskImage', '::after'), /svg\+xml/, 'the castle');
      }
      await page.context().close();
    }
  }
  // off: another wallpaper leaves nothing of them, with the stylesheet loaded by the dock
  const page = await open(desktop, '/', seed({ deco: 'haiku', dock: 'pixel-quest' }));
  assert.doesNotMatch(await css(page.locator('body'), 'backgroundImage'), /svg\+xml/);
  assert.equal(await css(page.locator('body'), 'content', '::before'), 'none');
  assert.equal(await css(page.locator('body'), 'content', '::after'), 'none');
  await page.context().close();
});

test('on a phone each colour set keeps its title bar and the reader toolbar sticks under it', async t => {
  if (!(await needs(t, '/control-panel/'))) return;
  for (const v of VARIANTS) {
    const page = await open(phone, '/', seed(preset(v)));
    await shot(page, `${v}-phone-home`);
    await cards(page).first().click();
    const w = win(page, 'reader');
    await w.locator('.rd h1').waitFor();
    const tb = await w.locator('.tab.on').boundingBox();
    assert.ok(tb.height >= 44 && tb.width >= phone.width - 1, `${v}: title bar ${JSON.stringify(tb)}`);
    for (const g of await toolbarGaps(page, w)) assert.ok(Math.abs(g) <= 8, `${v}: toolbar ${g}px from the title bar`);
    await shot(page, `${v}-phone`);
    assert.deepEqual(page.errors, []);
    await page.context().close();
  }
});

test('the Control panel draws a thumbnail of each dock and wallpaper', async t => {
  if (!(await needs(t, '/control-panel/'))) return;
  const page = await open(desktop, '/control-panel/');
  await win(page, 'control-panel').locator('.cp').waitFor();
  const thumb = (group, v, cls) => page.locator(`.cp-opt:has(input[name=cp-${group}][value=${v}]) > .${cls}`);
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.cp-dk.pixel-quest'), '::after').content !== 'none');
  for (const v of VARIANTS) assert.match(await css(thumb('wall', v, 'cp-wp'), 'backgroundImage'), /svg\+xml/, v);
  assert.match(await css(thumb('wall', 'pixel-quest', 'cp-wp'), 'maskImage', '::after'), /svg\+xml/, 'the castle');
  assert.match(await css(thumb('dock', 'pixel', 'cp-dk'), 'borderTopColor', '::before'), /rgb\(28, 26, 46\)/);
  assert.match(await css(thumb('dock', 'pixel-quest', 'cp-dk'), 'backgroundImage', '::after'), /svg\+xml/, 'the glove');
  assert.match(await css(thumb('dock', 'pixel-cartridge', 'cp-dk'), 'backgroundImage', '::before'), /repeating-linear-gradient/);
  await snap(page.locator('.cp-set').filter({ has: page.locator('input[name=cp-dock]') }), 'pixel-cp-docks');
  await snap(page.locator('.cp-set').filter({ has: page.locator('input[name=cp-wall]') }), 'pixel-cp-walls');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

// axe over each colour set's reading layout, the menu and the window switcher, at 1440 and 390, light and dark
const AXE = readFileSync(fileURLToPath(import.meta.resolve('axe-core/axe.min.js')), 'utf8');
async function audit(page) {
  await page.addScriptTag({ content: AXE });
  const { violations } = await page.evaluate(() => window.axe.run(document, { iframes: false, resultTypes: ['violations'] }));
  return violations.filter(v => ['serious', 'critical'].includes(v.impact))
    .flatMap(v => v.nodes.map(n => `${v.impact} ${v.id}: ${n.target.join(' ')}`));
}

test('axe: each colour set at 1440 and 390, light and dark', async t => {
  if (!(await needs(t, '/control-panel/'))) return;
  const found = [];
  for (const v of VARIANTS) {
    for (const [vp, w] of [[desktop, 1440], [phone, 390]]) {
      for (const theme of ['light', 'dark']) {
        const page = await open(vp, '/', seed(preset(v)), { colorScheme: theme });
        const tag = `[${v} ${w} ${theme}`;
        for (const x of await audit(page)) found.push(`${tag} home] ${x}`);
        await cards(page).first().click();
        await win(page, 'reader').locator('.rd h1').waitFor();
        for (const x of await audit(page)) found.push(`${tag} reader] ${x}`);
        await page.evaluate(() => window.deskbar.go('/posts/'));
        await win(page, 'tracker').waitFor();
        await page.locator('#winsBtn').click();
        await page.locator('#switcher .sw-tab').first().waitFor();
        for (const x of await audit(page)) found.push(`${tag} switcher] ${x}`);
        await page.keyboard.press('Escape');
        await page.locator('#menuBtn').click();
        await page.locator('#menu .mn-it').first().waitFor();
        for (const x of await audit(page)) found.push(`${tag} menu] ${x}`);
        await page.context().close();
      }
    }
  }
  assert.deepEqual(found, []);
});
