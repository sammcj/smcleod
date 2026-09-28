// Every look in appearance.js, from its lists, so a new look, colour set, wallpaper or dock is covered by adding it
// there. A look's window style, wallpaper and dock each restyle their own part of the screen and nothing else, leave
// nothing behind when switched away from, and hold up in light and dark, on a desktop and a phone: readable text, touch
// targets, a wallpaper that never takes the pointer. A few computed values per look (SIGNS) confirm its own styles
// apply. What only one look does is in look-details.spec.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { env, useBrowser, open, openLook, needs, box, css, win, cards, desktop, phone, toolbarGaps, axeRuns, axeRun, auditState } from './lib.mjs';
import { PRESETS, LOOKS, DECOS, WALLS, DOCKS, CRTS, PALETTES, lookSheet, coloursFor, ownsColours } from '../assets/js/deskbar/lib/appearance.js';

useBrowser();

const settingsOf = ({ id, label, ...s }) => s;
const CLASSIC = settingsOf(PRESETS.find(p => p.id === 'classic'));
const LOOK_PRESETS = PRESETS.filter(p => LOOKS[p.deco]);
const LOOK_WALLS = WALLS.map(([v]) => v).filter(lookSheet);
const LOOK_DOCKS = DOCKS.map(([v]) => v).filter(lookSheet);

// The screen's parts, each drawn by one setting: window style (with the panel it restyles), wallpaper and dock. A
// window's content is the window style's too, as a look's colours (Sunrise) may restyle only what sits in a window.
const PARTS = {
  window: ['.win.active .frame', '.win.active .tab.on', '.win.active .tab.on .tt', '.win.active .tab.on .ctl.close', '.win.active .tab.on .ctl.close::before',
    '.win:not(.active) .frame', '.win:not(.active) .tab.on', '.win:not(.active) .tab.on .tt',
    '.win.active .views', '.win:not(.active) .views', '.win .pc', '.win .rd h1'],
  panel: ['#panel', '#panel::before', '#menuBtn', '#menuBtn::before', '#themeBtn', '#clock'],
  wall: ['html', 'body', 'body::before', 'body::after', '#desk::after'],
  dock: ['#dock', '#dock::after', '#dock .dk', '#dock .dk::after', '#dock .dk .lbl'],
};
// Sizes and offsets follow window placement, which a dock's height moves, so the comparisons leave them out
const GEOMETRY = '^(width|height|inline-size|block-size|top|left|right|bottom|inset.*|(min|max)-.*|transform-origin|perspective-origin)$';
const styles = page => page.evaluate(([parts, geometry]) => {
  const skip = new RegExp(geometry), out = {};
  for (const [part, sels] of Object.entries(parts)) {
    out[part] = {};
    for (const s of sels) {
      const [sel, pseudo] = s.split(/(?=::)/), el = document.querySelector(sel);
      const cs = el && getComputedStyle(el, pseudo ?? null);
      // custom properties are inputs, inherited everywhere; what they draw shows in the rest
      out[part][s] = cs && Object.fromEntries([...cs].filter(p => !p.startsWith('--') && !skip.test(p)).map(p => [p, cs.getPropertyValue(p)]));
    }
  }
  return out;
}, [PARTS, GEOMETRY]);
// The first few properties that differ between two styles() results, for assertion messages
const diff = (a, b) => Object.keys(a).flatMap(part => Object.keys(a[part]).flatMap(s => Object.keys({ ...a[part][s], ...b[part][s] })
  .filter(p => a[part][s]?.[p] !== b[part][s]?.[p]).map(p => `${s} ${p}: ${a[part][s]?.[p]} / ${b[part][s]?.[p]}`))).slice(0, 6).join('\n');
const same = (a, b, parts, what) => {
  const pick = x => Object.fromEntries(parts.map(p => [p, x[p]]));
  assert.ok(JSON.stringify(pick(a)) === JSON.stringify(pick(b)), `${what}:\n${diff(pick(a), pick(b))}`);
};

// A look's own styles, a value or two each, on the Control panel window in front and the Posts and post windows behind.
// Sunrise shares the night's chrome, so its light pages inside the windows are what set it apart.
const SIGNS = {
  platinum: [['.win.active .tab.on', 'backgroundImage', /repeating-linear-gradient/], ['#menuBtn::before', 'backgroundImage', /rgb\(94, 189, 62\).*rgb\(0, 156, 223\)/]],
  clearlooks: [['.win.active .tab.on', 'backgroundImage', /linear-gradient/], ['body', 'fontFamily', /DejaVu Sans/]],
  phosphor: [['.win.active .frame', 'borderTopStyle', 'double'], ['#desk::after', 'content', /^"LOGIN: /], ['#dock .dk::before', 'content', 'counter(fk)']],
  broadsheet: [['#panel', 'backgroundColor', 'rgb(18, 18, 18)'], ['.win.active .frame', 'boxShadow', 'rgb(18, 18, 18) 7px 7px 0px 0px']],
  synthwave: [['body::before', 'borderTopLeftRadius', '50%'], ['body::after', 'transform', /^matrix3d/], ['.win.active .tab.on .tt', 'textTransform', 'uppercase']],
  'synthwave-sunrise': [['body', 'backgroundImage', /rgb\(143, 124, 240\)/], ['.win.active .frame', 'backgroundColor', 'rgb(33, 21, 70)'],
    ['.win .pc:not(.open)', 'backgroundColor', 'rgb(252, 247, 255)'], ['.win .rd h1', 'color', 'rgb(192, 19, 122)']],
  'sunrise-rings': [['.win.active .frame', 'backgroundColor', 'rgb(33, 21, 70)'], ['body::before', 'content', 'none'],
    ['.win .pc:not(.open)', 'backgroundColor', 'rgb(252, 247, 255)'], ['.win .rd h1', 'color', 'rgb(192, 19, 122)']],
  vector: [['.win.active .tab.on', 'clipPath', /^polygon/], ['.win.active .frame', 'borderTopColor', 'rgb(111, 227, 255)']],
  memphis: [['.win.active .frame', 'boxShadow', /rgb\(111, 227, 255\) \d+px \d+px 0px/], ['#dock', 'borderTopLeftRadius', '0px']],
  nightdrive: [['.win.active .frame', 'backgroundImage', /linear-gradient\(135deg/], ['#dock', 'borderTopLeftRadius', '999px']],
  pixel: [['.win.active .tab.on', 'backgroundImage', /repeating-conic-gradient/], ['#panel', 'fontFamily', /Pixelify Sans/]],
  'pixel-pico': [['.win.active .frame', 'backgroundColor', 'rgb(255, 204, 170)'], ['#dock .dk:not(.run)', 'backgroundImage', /svg\+xml/]],
};
// Looks whose title bar spans the whole top of its window, rather than sitting on it as a tab
const SPANS = ['platinum', 'clearlooks', 'broadsheet', 'pixel'];
// Phone title bars taller than the usual 36px, as touch targets
const BAR = { platinum: 44, broadsheet: 44, pixel: 44 };

// Every look, colour set and effect stylesheet, loaded as the Control panel would, though none applies yet
const loadSheets = page => page.evaluate(async () => {
  const lazy = JSON.parse(document.getElementById('deskbar-lazy').textContent);
  await Promise.all(Object.entries(lazy).filter(([k]) => /^(look|palette|effect)-/.test(k)).map(([, { css: href }]) => {
    if (document.querySelector(`link[rel=stylesheet][href="${href}"]`)) return null;
    const l = Object.assign(document.createElement('link'), { rel: 'stylesheet', href });
    document.head.append(l);
    return new Promise(res => { l.onload = l.onerror = res; });
  }));
});
// Settings through settings.js, as the Control panel sets them, once what they start has run: transitions and other
// finite animations (with motion allowed), rather than the loops a wallpaper may run
const apply = (page, s = {}) => page.evaluate(async s => {
  for (const [k, v] of Object.entries(s)) window.deskbar.settings.set(k, v);
  await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
  await Promise.all(document.getAnimations().filter(a => a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => {})));
}, s);
// WCAG contrast of each element's text on the first mostly opaque background colour behind it, as [ratio, what]. A
// gradient over a see-through background on the way leaves the ratio unknown (null), as it does for axe.
const contrasts = loc => loc.evaluateAll(els => {
  // color-mix() computes to color(srgb 0-1 ...), the rest to rgb(0-255 ...)
  const rgb = s => { const n = s.match(/[\d.]+/g).map(Number); return s.startsWith('color(') ? [...n.slice(0, 3).map(v => v * 255), n[3] ?? 1] : [...n.slice(0, 3), n[3] ?? 1]; };
  const lum = c => { const [r, g, b] = c.slice(0, 3).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
  return els.map(el => {
    let bg = el;
    for (; bg && rgb(getComputedStyle(bg).backgroundColor)[3] < .5; bg = bg.parentElement) {
      if (/gradient/.test(getComputedStyle(bg).backgroundImage)) return [null, `${el.localName}.${el.className}`];
    }
    const [a, b] = [lum(rgb(getComputedStyle(el).color)), lum(rgb(getComputedStyle(bg ?? document.body).backgroundColor))].sort((x, y) => y - x);
    return [Math.round((a + .05) / (b + .05) * 100) / 100, `${el.localName}.${el.className} on ${bg?.localName}.${bg?.className}`];
  });
});
const readable = async (loc, what) => {
  const found = await contrasts(loc.filter({ visible: true }));
  assert.ok(found.length, `${what}: some shown`);
  for (const [r, el] of found) assert.ok(r === null || r >= 4.5, `${what}: ${el} at ${r}:1`);
};
// The Posts window with a post opened from it: the post's window in front, Posts behind
async function twoWindows(page) {
  await win(page, 'tracker').locator('a[data-url]').first().click();
  await win(page, 'reader').locator('.rd h1').waitFor();
}

test('every look preset, and only those, has signature values', () => {
  assert.deepEqual(Object.keys(SIGNS).sort(), LOOK_PRESETS.map(p => p.id).sort());
});

for (const vp of [desktop, phone]) {
  test(`presets at ${vp.width}: each sets every setting and restyles its parts, and going back to Classic leaves nothing behind`, async t => {
    if (!(await needs(t, '/control-panel/'))) return;
    // the Control panel in front of a post and the Posts window, with the look, palette and effect stylesheets or not
    const setUp = async withSheets => {
      const page = await open(vp, '/');
      if (!withSheets) await page.context().route(/\/css\/deskbar\/(looks|palettes|effects)\//, r => r.abort());
      await page.goto(env.base + '/posts/');
      await page.waitForSelector('html.wm-ready');
      await twoWindows(page);
      await page.evaluate(() => window.deskbar.go('/control-panel/'));
      await win(page, 'control-panel').locator('.cp').waitFor();
      if (withSheets) await loadSheets(page);
      return page;
    };
    // Classic without the other stylesheets, so a rule of theirs that matches without its setting shows up
    const bare = await setUp(false), classic = await styles(bare);
    await bare.context().close();
    const page = await setUp(true), cp = win(page, 'control-panel');
    same(await styles(page), classic, Object.keys(PARTS), 'the stylesheets alone change nothing');
    const pick = async p => {
      await cp.locator(`input[name=cp-preset][value="${p.id}"]`).check();
      await page.waitForFunction(p => Object.keys(p).every(k => window.deskbar.settings.get(k) === p[k]), settingsOf(p));
      await page.evaluate(() => document.fonts.ready);
    };
    for (const p of PRESETS.filter(p => p.id !== 'classic')) {
      await pick(p);
      const s = settingsOf(p), got = await styles(page);
      // each part a setting draws changes when the preset changes that setting
      const changed = { window: s.deco !== CLASSIC.deco || s.palette !== CLASSIC.palette, wall: s.wall !== CLASSIC.wall, dock: s.dock !== CLASSIC.dock };
      for (const [part, yes] of Object.entries(changed)) {
        if (yes) assert.notEqual(JSON.stringify(got[part]), JSON.stringify(classic[part]), `${p.id}: restyles the ${part}`);
      }
      if (vp === desktop) {
        for (const [s, prop, want] of LOOKS[p.deco] ? SIGNS[p.id] : []) {
          const [sel, pseudo] = s.split(/(?=::)/), v = await css(page.locator(sel), prop, pseudo);
          if (want instanceof RegExp) assert.match(v, want, `${p.id}: ${s} ${prop}`);
          else assert.equal(v, want, `${p.id}: ${s} ${prop}`);
        }
      }
      // a look with colours of its own offers only those, and one with a mode of its own turns Mode off
      const offered = await cp.locator('fieldset:has([name="cp-palette"]) .cp-opt:not([hidden]) input').evaluateAll(rs => rs.map(r => r.value));
      assert.deepEqual(offered, coloursFor(s.deco).map(([v]) => v), `${p.id}: colours offered`);
      const off = await cp.locator('fieldset:has([name^="cp-"])').evaluateAll(fs => Object.fromEntries(fs.map(f => [f.querySelector('[name^="cp-"]').name.slice(3), f.disabled])));
      assert.equal(off.palette, ownsColours(s.deco), `${p.id}: Colours`);
      assert.equal(off.theme, !!LOOKS[s.deco]?.dark, `${p.id}: Mode`);
      for (const k of ['deco', 'wall', 'dock', 'crt']) assert.equal(off[k], false, `${p.id}: ${k} stays the visitor's`);
      // the fonts the chrome names load
      for (const sel of ['#panel', '.win.active .tab.on .tt', 'body']) {
        const family = (await css(page.locator(sel), 'fontFamily')).split(',')[0];
        assert.ok(await page.evaluate(f => document.fonts.check(`12px ${f}`), family), `${p.id}: ${family} loads`);
      }
      await pick(PRESETS.find(p => p.id === 'classic'));
      same(await styles(page), classic, Object.keys(PARTS), `${p.id} leaves nothing behind`);
    }
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });
}

test('a look wallpaper restyles only the desktop, stays behind everything and never takes the pointer, light and dark', async () => {
  for (const theme of ['light', 'dark']) {
    const page = await open(desktop, '/', undefined, { colorScheme: theme, reducedMotion: theme === 'light' ? 'no-preference' : 'reduce' });
    await apply(page, { theme });
    await loadSheets(page);
    await apply(page);
    const plain = await styles(page);
    const card = win(page, 'tracker').locator('.pc').first();
    await card.waitFor();
    for (const wall of LOOK_WALLS) {
      await apply(page, { wall });
      const got = await styles(page);
      assert.notEqual(JSON.stringify(got.wall), JSON.stringify(plain.wall), `${wall} ${theme}: draws`);
      same(got, plain, ['window', 'panel', 'dock'], `${wall} ${theme}: the rest as it was`);
      const layers = await page.evaluate(() => ['::before', '::after'].map(p => getComputedStyle(document.body, p))
        .filter(s => s.content !== 'none').map(s => [s.position, s.zIndex, s.pointerEvents]));
      for (const l of layers) assert.deepEqual(l, ['fixed', '-1', 'none'], `${wall} ${theme}: a layer behind`);
      const b = await box(card);
      const hits = await page.evaluate(([x, y]) => [
        !!document.elementFromPoint(x, y)?.closest('.pc'), !!document.elementFromPoint(innerWidth - 60, innerHeight - 160)?.closest('#desk'),
      ], [b.x + b.width / 2, b.y + b.height / 2]);
      assert.deepEqual(hits, [true, true], `${wall} ${theme}: the card and the bare desktop take the pointer`);
      // with motion allowed (light here) only Pixel's sky moves; reduced motion (dark here) stills that too
      const loops = await page.evaluate(() => document.getAnimations().filter(a => a.effect?.getComputedTiming().iterations === Infinity).length);
      if (theme === 'dark' || !wall.startsWith('pixel')) assert.equal(loops, 0, `${wall} ${theme}: holds still`);
    }
    assert.deepEqual(page.errors, []);
    await page.context().close();
  }
});

for (const vp of [desktop, phone]) {
  test(`a look dock at ${vp.width} restyles only the dock and holds its launchers, light and dark`, async () => {
    for (const theme of ['light', 'dark']) {
      // a phone shows the dock on its home screen, under no window
      const page = await open(vp, vp === phone ? '/' : '/posts/', undefined, { colorScheme: theme });
      if (vp === desktop) await win(page, 'tracker').locator('.pc').first().waitFor();
      await apply(page, { theme });
      await loadSheets(page);
      const glass = await styles(page);
      for (const dock of LOOK_DOCKS) {
        await apply(page, { dock });
        const got = await styles(page), at = `${dock} ${theme}`;
        assert.notEqual(JSON.stringify(got.dock), JSON.stringify(glass.dock), `${at}: draws`);
        same(got, glass, ['window', 'wall'], `${at}: windows and wallpaper as they were`);
        const d = await box(page.locator('#dock'));
        assert.ok(d.x >= 0 && d.x + d.width <= vp.width + 0.5 && d.y + d.height <= vp.height + 0.5, `${at}: on screen ${JSON.stringify(d)}`);
        for (const l of await page.locator('#dock :is(.dk, #homeBtn, #winsBtn)').filter({ visible: true }).all()) {
          const b = await l.boundingBox();
          assert.ok(b.y >= d.y - 0.5 && b.y + b.height <= d.y + d.height + 1, `${at}: launcher ${JSON.stringify(b)} in the dock`);
          if (vp === phone && await l.evaluate(e => e.matches('.dk'))) assert.ok(b.height >= 44, `${at}: launcher ${b.height}px tall on a phone`);
        }
      }
      assert.deepEqual(page.errors, []);
      await page.context().close();
    }
  });
}

// A look's window style keeps to the windows and panel: the glass dock keeps its shape and icons under it. Colours from
// outside a look's own set leave it its own; its own colours under another window style do nothing.
test('a look window style leaves the dock alone, and colours apply only where they belong', async () => {
  const page = await open(desktop, '/posts/');
  await twoWindows(page);
  await loadSheets(page);
  const dockShape = () => page.locator('#dock').evaluate(d => {
    const s = getComputedStyle(d), k = d.querySelector('.dk'), r = d.getBoundingClientRect();
    return [Math.round(r.x), Math.round(r.width), Math.round(r.height), s.borderTopLeftRadius, getComputedStyle(d, '::after').content,
      getComputedStyle(k).borderTopLeftRadius, k.querySelector('.lbl').getBoundingClientRect().width <= 1, k.querySelector('.ico').checkVisibility()];
  });
  const glass = await dockShape(), haiku = await styles(page);
  for (const deco of Object.keys(LOOKS)) {
    await apply(page, { deco, palette: coloursFor(deco)[0][0] });
    assert.deepEqual(await dockShape(), glass, `${deco}: the glass dock`);
    // any other palette: the look's own colours stay, as the palette reaches only the plain wallpaper and dock
    const own = await styles(page), other = PALETTES.find(([v]) => v !== 'haiku' && !LOOKS[deco].colours?.some(([c]) => c === v))[0];
    await apply(page, { palette: other });
    same(await styles(page), own, ['window', 'panel'], `${deco}: ${other} leaves it its own colours`);
    for (const [c] of LOOKS[deco].colours ?? []) {
      await apply(page, { deco: 'haiku', palette: c });
      same(await styles(page), haiku, Object.keys(PARTS), `${c} under Haiku windows`);
    }
    await apply(page, { deco: 'haiku', palette: 'haiku' });
  }
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('the Control panel draws a thumbnail of its own for every window style, wallpaper, dock and effect', async t => {
  if (!(await needs(t, '/control-panel/'))) return;
  const page = await open(desktop, '/control-panel/');
  await win(page, 'control-panel').locator('.cp').waitFor();
  await loadSheets(page);
  for (const [group, cls, list] of [['deco', 'cp-deco', DECOS], ['wall', 'cp-wp', WALLS], ['dock', 'cp-dk', DOCKS], ['crt', 'cp-crt', CRTS]]) {
    const drawn = await page.locator(`.cp-opt:has(input[name=cp-${group}]) > .${cls}`).evaluateAll((els, geometry) => els.map(el => {
      const skip = new RegExp(geometry), look = p => {
        const cs = getComputedStyle(el, p);
        return [...cs].filter(k => !skip.test(k)).map(k => cs.getPropertyValue(k)).join(';');
      };
      return [[...el.classList].at(-1), [null, '::before', '::after'].map(look).join('|')];
    }), GEOMETRY);
    assert.deepEqual(drawn.map(([v]) => v), list.map(([v]) => v), group);
    const seen = new Map();
    for (const [v, s] of drawn) {
      assert.ok(!seen.has(s), `${group}: ${v} is drawn as ${seen.get(s)} is`);
      seen.set(s, v);
    }
  }
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

for (const [i, p] of LOOK_PRESETS.entries()) {
  const family = p.deco, theme = i % 2 ? 'dark' : 'light';
  test(`${p.label}: the title bar on its frame, readable text in light and dark, on before first paint`, async () => {
    for (const mode of ['light', 'dark']) {
      const page = await openLook(desktop, '/posts/', { preset: p.id, theme: mode });
      await twoWindows(page);
      const front = page.locator('.win.active'), at = `${p.id} ${mode}`;
      const [tb, fb, rb] = [await box(front.locator('.tab.on')), await box(front.locator('.frame')), await box(front.locator('.tabs'))];
      assert.ok(tb.y <= fb.y + 1 && tb.y + tb.height >= fb.y - 1 && tb.x >= fb.x - 1 && tb.x + tb.width <= fb.x + fb.width + 1, `${at}: title bar ${JSON.stringify(tb)} on its frame ${JSON.stringify(fb)}`);
      if (SPANS.includes(family)) assert.ok(Math.abs(tb.x - rb.x) <= 1 && Math.abs(tb.width - rb.width) <= 1, `${at}: title bar spans ${JSON.stringify(rb)}`);
      await readable(page.locator('.win.active .tab.on .tt, .win:not(.active) .tab.on .tt'), `${at} titles`);
      await readable(front.locator('.rd :is(h1, h2, p, li)'), `${at} post`);
      await readable(front.locator('.toolbar .tb'), `${at} post toolbar`);
      await readable(win(page, 'tracker').locator('.pc-t, .pc-d'), `${at} Posts`);
      await readable(page.locator('#panel :is(.task, #clock)'), `${at} panel`);
      // post text stays plain for long reads
      assert.equal(await css(front.locator('.rd p'), 'textShadow'), 'none', `${at}: plain post text`);
      const blocking = await page.evaluate(k => {
        const href = JSON.parse(document.getElementById('deskbar-lazy').textContent)[k].css;
        return performance.getEntriesByName(new URL(href, location).href)[0]?.renderBlockingStatus;
      }, lookSheet(family));
      assert.equal(blocking, 'blocking', `${at}: linked before first paint`);
      assert.equal(await page.locator('#themeBtn').isVisible(), !LOOKS[family].dark, `${at}: the theme switch`);
      assert.deepEqual(page.errors, []);
      await page.context().close();
    }
  });

  test(`${p.label} on a phone: a full-screen window under a title bar, touch-sized controls and launchers`, async () => {
    const page = await openLook(phone, '/', { preset: p.id, theme }, { hasTouch: true, isMobile: true });
    const at = `${p.id} ${theme}`;
    for (const d of await page.locator('#dock .dk').filter({ visible: true }).all()) {
      const b = await d.boundingBox();
      assert.ok(b.height >= 44 && b.x >= 0 && b.x + b.width <= phone.width + 0.5, `${at}: launcher ${JSON.stringify(b)}`);
    }
    for (const el of await page.locator('#panel > *').filter({ visible: true }).all()) {
      const b = await el.boundingBox();
      assert.ok(b.x + b.width <= phone.width + 0.5, `${at}: ${await el.evaluate(e => e.id || e.className)} fits the panel`);
    }
    await readable(page.locator('#recent .pc-t'), `${at} Latest posts`);
    await cards(page).first().click();
    const w = win(page, 'reader');
    await w.locator('.rd h1').waitFor();
    const [tb, fb] = [await box(w.locator('.tab.on')), await box(w.locator('.frame'))];
    assert.equal(Math.round(fb.width), phone.width, `${at}: full width`);
    assert.ok(Math.abs(tb.y + tb.height - fb.y) <= 4 && tb.width >= phone.width - 1 && tb.height >= (BAR[family] ?? 36), `${at}: title bar ${JSON.stringify(tb)} over ${JSON.stringify(fb)}`);
    const close = await box(w.locator('.tab.on .ctl.close'));
    assert.ok(close.width >= 32 && close.height >= 30, `${at}: close ${close.width}x${close.height}`);
    for (const g of await toolbarGaps(page, w)) assert.ok(Math.abs(g) <= 8, `${at}: toolbar ${g}px from the title bar`);
    await readable(w.locator('.rd :is(h1, p)'), `${at} post`);
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });
}

// axe over each look preset's states, each state in one of the preset's two viewport and mode pairs as lib.mjs axeRun
// picks it (every pair with AXE_ALL=1). The plain window styles and palettes are palettes.spec.mjs's, and the default
// look a11y.spec.mjs's. Spotlight's marks on the selected result and the Terminal's prompt are where a look's light and
// dark colours have clashed, so those two are audited in both pairs.
const STATES = ['home', 'reader', 'tracker', 'menu', 'switcher', 'controlpanel'];
const BOTH = ['spotlight', 'terminal'];
for (const [i, p] of LOOK_PRESETS.entries()) {
  test(`axe: ${p.label} preset`, async () => {
    const found = [];
    for (const [j, state] of [...STATES, ...BOTH].entries()) {
      for (const run of BOTH.includes(state) ? axeRuns(i) : axeRun(i, j)) found.push(...(await auditState(state, run, settingsOf(p), `${p.id} `) ?? []));
    }
    assert.deepEqual(found, []);
  });
}
