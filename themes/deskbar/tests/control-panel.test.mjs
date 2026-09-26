// Visitor settings (settings.js), the pre-paint script in head.html that reapplies them, and the Control panel's
// panes and choices (lazy/control-panel.js) against the styles that implement them (css/deskbar/lazy/control-panel.css)
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { get, set, on, DEFAULT, initSettings } from '../assets/js/deskbar/settings.js';
import { PANES, paneOf, paneUrl, presetOf, paletteFor } from '../assets/js/deskbar/lazy/control-panel.js';
import { PRESETS, KEYS, LOOKS, PALETTES, coloursFor, ownsColours, lookSheet } from '../assets/js/deskbar/lib/appearance.js';
import { SAVERS } from '../assets/js/deskbar/lazy/screensaver.js';

const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const mem = new Map();
globalThis.localStorage = {
  getItem: k => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: k => mem.delete(k),
};
const root = { dataset: {}, style: { props: {}, setProperty(k, v) { this.props[k] = v; } } };
globalThis.document = { documentElement: root, getElementById: () => null };

beforeEach(() => {
  mem.clear();
  root.dataset = {};
  root.style.props = {};
});

// the screen saver's own keys are kept by the Control panel and read by the saver, outside settings.js
const SAVER_KEYS = ['saverKind', 'saver'];
const settingKeys = PANES.flatMap(p => p.keys).filter(k => !SAVER_KEYS.includes(k));

test('nothing stored reads as the defaults, and bad stored values fall back to them', () => {
  for (const k of settingKeys) assert.equal(get(k), DEFAULT[k], k);
  mem.set('deskbar:readerWidth', '"huge"');
  mem.set('deskbar:textSize', '99');
  mem.set('deskbar:palette', '42');
  mem.set('deskbar:deco', '"');
  mem.set('deskbar:dock', '7');
  assert.equal(get('readerWidth'), 'normal');
  assert.equal(get('textSize'), 24);
  assert.equal(get('palette'), 'haiku');
  assert.equal(get('deco'), 'haiku');
  assert.equal(get('dock'), 'glass');
  mem.set('deskbar:textSize', '"big"');
  assert.equal(get('textSize'), 18);
});

test('the retired Minimal dock reads as the default, and start-up clears it', () => {
  mem.set('deskbar:dock', '"minimal"');
  assert.equal(get('dock'), 'glass');
  // head.html has already shown it as data-dock before the shell starts
  root.dataset.dock = 'minimal';
  const heard = [];
  const off = on((k, v) => heard.push(`${k}=${v}`));
  initSettings();
  off();
  assert.deepEqual(root.dataset, {}, 'no attribute, so the core glass dock shows');
  assert.equal(mem.size, 0, 'nothing left stored');
  assert.deepEqual(heard, ['dock=glass']);
  // a stored choice that is still offered is left alone
  set('dock', 'panel');
  initSettings();
  assert.equal(root.dataset.dock, 'panel');
});

test('the retired Woodblock look reads as the defaults, and start-up clears it', () => {
  mem.set('deskbar:deco', '"woodblock"');
  mem.set('deskbar:wall', '"woodblock"');
  assert.equal(get('deco'), 'haiku');
  assert.equal(get('wall'), 'rings');
  Object.assign(root.dataset, { deco: 'woodblock', wall: 'woodblock' });
  initSettings();
  assert.equal(root.dataset.deco, undefined);
  assert.equal(root.dataset.wall, undefined);
  assert.equal(mem.size, 0, 'nothing left stored');
});

test('a choice is stored and shown on <html>; the default removes both', () => {
  set('palette', 'xfce');
  set('readerWidth', 'wide');
  set('textSize', 21);
  set('dock', 'deskbar');
  set('readerFont', 'atkinson');
  assert.equal(mem.get('deskbar:palette'), '"xfce"');
  assert.deepEqual(root.dataset, { palette: 'xfce', rdWidth: 'wide', dock: 'deskbar', rdFont: 'atkinson' });
  assert.equal(root.style.props['--rd-size'], '21px');
  assert.equal(get('palette'), 'xfce');

  set('palette', 'haiku');
  set('readerWidth');
  set('textSize', 18);
  set('dock', 'glass');
  set('readerFont');
  assert.deepEqual(root.dataset, {}, 'no attribute for a default, so the core CSS applies alone');
  assert.equal(mem.size, 0, 'defaults are not stored');
  assert.equal(root.style.props['--rd-size'], '18px');
});

test('listeners hear every change until they stop listening', () => {
  const heard = [];
  const off = on((k, v) => heard.push(`${k}=${v}`));
  set('theme', 'dark');
  set('textSize', 40);
  off();
  set('theme');
  assert.deepEqual(heard, ['theme=dark', 'textSize=24']);
});

// The inline scripts as head.html ships them, run in order against stored settings
function prePaint(stored) {
  const src = [...read('../layouts/_partials/deskbar/head.html').matchAll(/<script>\n([\s\S]*?)<\/script>/g)].map(m => m[1]).join(';');
  const html = { dataset: {}, classList: { add() {}, contains: () => true, remove() {} }, style: { setProperty(k, v) { html[k] = v; } } };
  const written = [];
  const doc = {
    documentElement: html,
    write: s => written.push(s),
    getElementById: id => (id === 'deskbar-lazy' ? { textContent: JSON.stringify({ 'control-panel': { js: '/a.js', css: '/a.css' }, 'look-demo': { css: '/demo.css' }, 'palette-demo': { css: '/pal.css' }, 'effect-crt': { css: '/crt.css' } }) } : null),
  };
  const ls = {
    getItem: k => (k.slice(8) in stored ? JSON.stringify(stored[k.slice(8)]) : null),
    setItem: (k, v) => { stored[k.slice(8)] = JSON.parse(v); },
    removeItem: k => { delete stored[k.slice(8)]; },
  };
  new Function('document', 'localStorage', 'setTimeout', src)(doc, ls, () => {});
  return { dataset: html.dataset, size: html['--rd-size'], written, stored };
}

test("before first paint, a visitor from before whole looks came apart keeps the look's dock and tube", () => {
  const old = prePaint({ deco: 'phosphor', wall: 'phosphor', dock: 'panel', lookWas: {} });
  assert.deepEqual(old.dataset, { deco: 'phosphor', wall: 'phosphor', dock: 'phosphor', crt: 'tube' });
  assert.deepEqual(old.stored, { deco: 'phosphor', wall: 'phosphor', dock: 'phosphor', crt: 'tube' }, 'stored, and the marker gone');
  assert.equal(prePaint({ deco: 'platinum', lookWas: {} }).dataset.dock, 'platinum');
  assert.equal(prePaint({ deco: 'synthwave', dock: 'deskbar', lookWas: {} }).dataset.dock, 'deskbar', 'a dock they chose stays');
  const plain = prePaint({ deco: 'haiku', lookWas: {} });
  assert.deepEqual(plain.stored, { deco: 'haiku' }, 'only a look brings anything');
  assert.deepEqual(prePaint({ deco: 'phosphor' }).dataset, { deco: 'phosphor' }, 'without the marker nothing changes');
});

test('before first paint, stored settings are applied and the stylesheet is linked only when one needs it', () => {
  const plain = prePaint({ theme: 'dark', readerWidth: 'wide', textSize: 20 });
  assert.deepEqual(plain.dataset, { theme: 'dark', rdWidth: 'wide' });
  assert.equal(plain.size, '20px');
  assert.deepEqual(plain.written, [], 'theme, width and size are in the core CSS');

  const styled = prePaint({ palette: 'sage', deco: 'flat', wall: 'dots' });
  assert.deepEqual(styled.dataset, { palette: 'sage', deco: 'flat', wall: 'dots' });
  assert.deepEqual(styled.written, ['<link rel=stylesheet href="/a.css">']);
  // after the core and site stylesheets, where loader.js appends it when the app opens
  const head = read('../layouts/_partials/deskbar/head.html');
  assert.ok(head.indexOf('document.write') > head.indexOf('site.Params.deskbar.stylesheets'), 'written after the other stylesheets');

  for (const [k, v, attr] of [['dock', 'panel', 'dock'], ['readerFont', 'mono', 'rdFont']]) {
    const one = prePaint({ [k]: v });
    assert.deepEqual(one.dataset, { [attr]: v }, k);
    assert.deepEqual(one.written, ['<link rel=stylesheet href="/a.css">'], `${k} needs the stylesheet`);
  }
});

test("before first paint, a whole look's stylesheet follows the Control panel's, once, and a palette's comes before it", () => {
  const link = h => `<link rel=stylesheet href="${h}">`;
  assert.deepEqual(prePaint({ deco: 'demo', wall: 'demo' }).written, [link('/a.css'), link('/demo.css')]);
  assert.deepEqual(prePaint({ wall: 'demo' }).written, [link('/a.css'), link('/demo.css')], 'its wallpaper under another style');
  assert.deepEqual(prePaint({ dock: 'demo' }).written, [link('/a.css'), link('/demo.css')], 'its dock under another style');
  assert.deepEqual(prePaint({ deco: 'haiku', dock: 'demo-bar', wall: 'demo-sky' }).written, [link('/a.css'), link('/demo.css')], "variants are in their family's stylesheet, linked once");
  assert.deepEqual(prePaint({ deco: 'liquid', wall: 'liquid' }).written, [link('/a.css')], 'Liquid Ass has no stylesheet of its own');
  assert.deepEqual(prePaint({ palette: 'demo', deco: 'demo' }).written, [link('/pal.css'), link('/a.css'), link('/demo.css')]);
  const crt = prePaint({ crt: 'tube', deco: 'demo' });
  assert.deepEqual(crt.dataset, { crt: 'tube', deco: 'demo' });
  assert.deepEqual(crt.written, [link('/a.css'), link('/demo.css'), link('/crt.css')], 'a CRT effect comes last');
});

test('Liquid Ass: a window style with a wallpaper of its own, shown before first paint, with fallbacks', () => {
  const opts = key => PANES[0].groups.find(g => g[0] === key)[2];
  assert.deepEqual(opts('deco').find(o => o[0] === 'liquid')?.[1], 'Liquid Ass');
  assert.equal(opts('deco').find(o => o[0] === 'clear')?.[1], 'Clear', 'Liquid Ass without the joke');
  assert.ok(opts('wall').some(o => o[0] === 'liquid'));
  const one = prePaint({ deco: 'liquid', wall: 'liquid' });
  assert.deepEqual(one.dataset, { deco: 'liquid', wall: 'liquid' });
  assert.deepEqual(one.written, ['<link rel=stylesheet href="/a.css">']);

  const css = read('../assets/css/deskbar/lazy/control-panel.css');
  // Safari still wants the prefix, and without either the glass turns nearly opaque rather than see-through
  assert.ok(css.match(/(?<!-)backdrop-filter:\s*var\(--lq-blur/g)?.length >= 2, 'glass frames, panel, menus and tabs');
  assert.equal(css.match(/(?<!-)backdrop-filter:/g).length, css.match(/-webkit-backdrop-filter:/g).length, 'each one prefixed too');
  assert.match(css, /@supports not \(\(backdrop-filter: blur\(1px\)\) or \(-webkit-backdrop-filter: blur\(1px\)\)\) \{\s*:root:is\(\[data-deco=liquid\], \[data-deco=clear\]\)/);
  // the jelly wobble is only for those who allow motion
  const motion = css.indexOf('@media (prefers-reduced-motion: no-preference)');
  assert.ok(motion > 0 && css.indexOf('animation: lq-jelly') > motion, 'inside the no-preference query');
  assert.equal(css.split('animation: lq-jelly').length, 2, 'and nowhere else');
});

test('three panes, Appearance first, each with its own address', () => {
  assert.deepEqual(PANES.map(p => p.id), ['appearance', 'posts', 'system']);
  assert.deepEqual(PANES[0].keys, ['deco', 'palette', 'theme', 'dock', 'wall', 'crt'], 'Appearance is the OS look only, docks before wallpapers');
  assert.deepEqual(PANES[1].keys, ['readerWidth', 'readerFont', 'textSize']);
  assert.deepEqual(PANES[2].keys, SAVER_KEYS);
  assert.deepEqual([...settingKeys].sort(), Object.keys(DEFAULT).sort(), 'every setting is in exactly one pane');

  assert.equal(paneUrl('/control-panel/', 'appearance'), '/control-panel/', 'the first pane is the bare address');
  assert.equal(paneUrl('/control-panel/', 'system'), '/control-panel/?pane=system');
  assert.equal(paneOf('/control-panel/'), 'appearance');
  assert.equal(paneOf('/control-panel/?pane=posts'), 'posts');
  assert.equal(paneOf('/control-panel/?x=1&pane=system'), 'system');
  assert.equal(paneOf('/control-panel/?pane=nope'), 'appearance', 'an unknown pane shows the first');
});

// The stylesheet that draws a choice: a palette's own, a look's (a window style, wallpaper or dock of its family, or a
// window style's own colours), the CRT effects', or the Control panel's
function stylesFor(key, v) {
  const at = p => new URL(`../assets/css/deskbar/${p}.css`, import.meta.url);
  const family = at(`looks/${v.split('-')[0]}`);
  const file = key === 'crt' ? at('effects/crt') : key === 'palette' && existsSync(at(`palettes/${v}`)) ? at(`palettes/${v}`)
    : ['deco', 'wall', 'dock', 'palette'].includes(key) && existsSync(family) ? family : at('lazy/control-panel');
  return readFileSync(file, 'utf8');
}

test('every choice offered is a valid setting with styles behind it', () => {
  const css = read('../assets/css/deskbar/lazy/control-panel.css');
  const attr = { palette: 'data-palette', deco: 'data-deco', wall: 'data-wall', dock: 'data-dock', crt: 'data-crt', readerFont: 'data-rd-font' };
  const groups = PANES.flatMap(p => p.groups).filter(g => !SAVER_KEYS.includes(g[0]));
  assert.ok(groups.length >= 8);
  for (const [key, , opts] of groups) {
    assert.ok(opts.some(([v]) => v === DEFAULT[key]), `${key} offers its default`);
    assert.equal(new Set(opts.map(o => o[0])).size, opts.length, `${key} lists each choice once`);
    for (const [v] of opts) {
      set(key, v);
      assert.equal(get(key), v, `${key}=${v} round-trips`);
      // a look's own colours are the look's (no rule names them), as are its defaults
      if (attr[key] && v !== DEFAULT[key] && !(key === 'palette' && LOOKS[v])) assert.ok(stylesFor(key, v).includes(`[${attr[key]}=${v}]`), `${key}=${v} has styles`);
    }
  }
  // every dock, wallpaper and CRT effect draws its own thumbnail; each default is the base art
  for (const [key, cls] of [['dock', 'cp-dk'], ['wall', 'cp-wp'], ['crt', 'cp-crt']]) {
    for (const [v] of groups.find(g => g[0] === key)[2]) if (v !== DEFAULT[key]) {
      assert.match(stylesFor(key, v), new RegExp(`\\.${cls}(:is\\([^)]*)?\\.${v}(?![\\w-])`), `${cls}.${v}`);
    }
  }
  assert.deepEqual(groups.find(g => g[0] === 'dock')[2].slice(0, 3).map(o => o[0]), ['glass', 'deskbar', 'panel'], 'the three plain docks first');
  assert.ok(!/minimal/i.test(css), 'no Minimal dock styles left behind');
  assert.deepEqual(PANES[2].groups[0][2].map(o => o[0]), SAVERS, 'screen saver: each one the saver has');
  assert.deepEqual(PANES[2].groups[1][2].map(o => o[0]), ['0', '1', '5', '10', '30'], 'delay: off or minutes');
});

test('each preset names every Appearance choice but the mode, each one offered, with colours its window style takes', () => {
  const offered = key => PANES[0].groups.find(g => g[0] === key)[2].map(o => o[0]);
  assert.deepEqual(KEYS.toSorted(), PANES[0].keys.filter(k => k !== 'theme').toSorted());
  assert.equal(new Set(PRESETS.map(p => p.id)).size, PRESETS.length, 'ids are unique');
  assert.equal(PRESETS[0].id, 'classic');
  for (const k of KEYS) assert.equal(PRESETS[0][k], DEFAULT[k], `Deskbar Classic is the defaults (${k})`);
  for (const p of PRESETS) {
    assert.ok(p.label, p.id);
    for (const k of KEYS) assert.ok(offered(k).includes(p[k]), `${p.id}: ${k}=${p[k]} is offered`);
    if (!ownsColours(p.deco)) assert.ok(coloursFor(p.deco).some(o => o[0] === p.palette), `${p.id}: ${p.palette} goes with ${p.deco}`);
  }
  // the preset shown is the one the settings add up to; changing any one of them leaves none shown
  const now = { ...PRESETS.find(p => p.id === 'synthwave') };
  assert.equal(presetOf(k => now[k]).id, 'synthwave');
  now.dock = 'glass';
  assert.equal(presetOf(k => now[k]), undefined);
});

test('a window style change keeps the palette when it can, and otherwise picks one the style takes', () => {
  assert.equal(paletteFor('flat', 'mint'), 'mint', 'palettes go with the plain styles');
  assert.equal(paletteFor('synthwave', 'mint'), 'mint', 'a style in its own colours leaves the palette for later');
  assert.equal(paletteFor('pixel', 'mint'), 'pixel', "a style with colour variants starts on its own");
  assert.equal(paletteFor('pixel', 'pixel-pico'), 'pixel-pico');
  assert.equal(paletteFor('haiku', 'pixel-pico'), undefined, "another style's variant goes back to the default");
  assert.equal(paletteFor('synthwave', 'pixel-pico'), undefined, 'and is dropped under a style in its own colours');
  // every look's stylesheet has a LOOKS entry, so lookSheet asks only for sheets that exist
  const sheets = readdirSync(new URL('../assets/css/deskbar/looks/', import.meta.url)).filter(f => f.endsWith('.css'));
  assert.deepEqual(sheets.map(f => f.slice(0, -4)).sort(), Object.keys(LOOKS).sort());
  assert.equal(lookSheet('pixel-pico'), 'look-pixel');
  assert.equal(lookSheet('liquid'), null, 'Liquid Ass is in the Control panel stylesheet');
  // every look's colour variant is in its own stylesheet, and none is also a palette
  for (const [name, l] of Object.entries(LOOKS)) for (const [v] of l.colours || []) {
    assert.ok(v === name || v.startsWith(name + '-'), v);
    assert.ok(!PALETTES.some(o => o[0] === v), v);
  }
});

test('Atkinson Hyperlegible is self-hosted and only fetched once chosen', () => {
  const css = read('../assets/css/deskbar/lazy/control-panel.css');
  const faces = [...css.matchAll(/@font-face\s*{[^}]*}/g)].map(m => m[0]);
  assert.equal(faces.length, 4, 'regular, italic, bold, bold italic');
  for (const f of faces) {
    const file = /url\(([^)]+)\)/.exec(f)[1].replace(/^\.\.\/\.\.\/\.\.\//, '');
    assert.ok(readFileSync(new URL('../static/' + file, import.meta.url)).subarray(0, 4).toString() === 'wOF2', file);
  }
  // an @font-face file loads only when text uses the family, which only the chosen font's rule does
  const rules = [...css.replace(/@font-face\s*{[^}]*}/g, '').matchAll(/([^{}]*){([^}]*)}/g)].filter(m => m[2].includes('Atkinson'));
  assert.equal(rules.length, 1, 'one rule names the family');
  assert.match(rules[0][1].trim(), /^:root\[data-rd-font=atkinson\]$/);
});
