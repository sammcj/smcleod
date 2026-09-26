// Control panel (`window: control-panel`): every visitor setting, in panes after Haiku's Preferences. Appearance is
// the desktop's look (a theme, then window style, colours, mode, dock, wallpaper and CRT effect one by one), Posts is
// the reader (width, font, text size) and System is the rest (which screen saver, and when). A choice applies at
// once, so the desktop behind the window is the preview. Each pane has an address, ?pane=<id> (none for the first),
// which the window's route follows, so a link, a copied layout or Open in new tab comes back to the same pane. The
// settings live in the shell (settings.js, through window.deskbar.settings), which also serves the panel's theme
// button and the reader's own controls, and head.html reapplies them before first paint. Loaded on first open
// through lazyApp (loader.js).
import { h, ico, plainClick } from '../lib/dom.js';
import { store } from '../lib/store.js';
import { PALETTES, MODES, DECOS, DOCKS, WALLS, CRTS, LOOKS, KEYS, PRESETS, lookSheet, coloursFor, ownsColours } from '../lib/appearance.js';

// [setting, legend, [[value, label, art argument]], art]. Defaults are in settings.js; the choices in lib/appearance.js.
const swatch = sw => {
  const [a, b, c] = sw.split(' ');
  return h('span', { class: 'cp-art cp-sw', style: `--a:${a};--b:${b};--c:${c}` });
};
const thumb = cls => (_, v) => h('span', { class: `cp-art ${cls} ${v}` });
// Colours lists every palette and every window style's own colours; sync() shows the ones the style on offers
const PALETTE = ['palette', 'Colours', [...PALETTES, ...Object.values(LOOKS).flatMap(l => l.colours || [])], swatch];
const MODE = ['theme', 'Mode', MODES];
const DECO = ['deco', 'Window style', DECOS, thumb('cp-deco')];
const WALL = ['wall', 'Wallpaper', WALLS, thumb('cp-wp')];
const DOCK = ['dock', 'Dock', DOCKS, thumb('cp-dk')];
const CRT = ['crt', 'CRT effect', CRTS, thumb('cp-crt')];
// A theme's card (a preset, in code, as theme is already the light or dark mode): its window style over its wallpaper, in its palette's colours where the style takes them
const swatchOf = v => PALETTE[2].find(o => o[0] === v)?.[2].split(' ') || [];
const presetArt = p => {
  const [tab, frame, desk] = swatchOf(p.palette);
  return h('span', { class: 'cp-art cp-pre', style: tab ? `--tab:${tab};--tab-hi:${tab};--frame:${frame};--frame-hi:${frame};--wall-1:${desk};--wall-2:${desk};--wall-3:${desk}` : '' },
    h('span', { class: `cp-art cp-wp ${p.wall}` }), h('span', { class: `cp-art cp-deco ${p.deco}` }));
};
const PRESET = ['preset', 'Themes', PRESETS.map(p => [p.id, p.label, p]), presetArt];
// The Mac startup chime, synthesised rather than recorded: a slightly strummed F sharp major chord of detuned saws
// through a closing low-pass filter, with a short echo for the room. Played only when the visitor picks Platinum,
// as browsers allow sound only in answer to a press.
const HELLO = {};
HELLO.platinum = () => {
  if (!window.AudioContext) return;
  const ctx = new AudioContext(), t = ctx.currentTime + 0.05, out = ctx.createGain(), lp = ctx.createBiquadFilter();
  const echo = ctx.createDelay(), back = ctx.createGain();
  out.gain.value = 0.07;
  lp.frequency.setValueAtTime(3200, t);
  lp.frequency.exponentialRampToValueAtTime(700, t + 2.5);
  echo.delayTime.value = 0.11;
  back.gain.value = 0.3;
  lp.connect(out).connect(ctx.destination);
  out.connect(echo).connect(back).connect(echo);
  back.connect(ctx.destination);
  [92.5, 185, 277.18, 369.99, 466.16, 554.37, 739.99].forEach((f, i) => {
    const g = ctx.createGain(), at = t + i * 0.008;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(1, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 3.8);
    g.connect(lp);
    for (const cents of [-5, 5]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = cents;
      o.connect(g);
      o.start(at);
      o.stop(at + 4);
    }
  });
  setTimeout(() => ctx.close(), 4800);
};
// a stylesheet, loaded once; a choice without one goes ahead at once
const sheet = k => (k ? window.deskbar.loadLazy(k).catch(() => {}) : Promise.resolve());
// what has to load before an Appearance choice shows whole; a look's colours come with the look's stylesheet
const sheetFor = (k, v) =>
  sheet(k === 'palette' ? (PALETTES.some(o => o[0] === v) ? 'palette-' + v : lookSheet(v)) : k === 'crt' ? 'effect-crt' : lookSheet(v));
const WIDTH = ['readerWidth', 'Width', [['narrow', 'Narrow'], ['normal', 'Normal'], ['wide', 'Wide']]];
// Sans and Mono are the theme's UI and code fonts, already loaded; Atkinson Hyperlegible loads once chosen
const FONT = ['readerFont', 'Font', [['serif', 'Serif'], ['sans', 'Sans'], ['atkinson', 'Atkinson Hyperlegible'], ['mono', 'Mono']]];
// Which screen saver runs (SAVERS in lazy/screensaver.js, which reads it as it starts). Kept as deskbar:saverKind,
// with nothing stored for Sheep (SAVER there).
const KIND = ['saverKind', 'Screen saver', [['leaves', 'Leaves'], ['sheep', 'Sheep']], thumb('cp-sv')];
const kind = () => (KIND[2].some(o => o[0] === store.get('saverKind')) ? store.get('saverKind') : 'sheep');
// Minutes without input before the screen saver starts, 0 for never. Kept as deskbar:saver, which main.js reads on
// every input, so a choice applies at once; with none stored the site's own delay (data-saver) holds.
const SAVER = ['saver', 'Start after', [['0', 'Off'], ['1', '1 min'], ['5', '5 min'], ['10', '10 min'], ['30', '30 min']]];

// In list order. groups are the pane's settings; keys are everything its Reset puts back. A new setting is a group
// here plus its place in build()'s layout.
export const PANES = [
  { id: 'appearance', label: 'Appearance', icon: 'appearance', groups: [DECO, PALETTE, MODE, DOCK, WALL, CRT] },
  { id: 'posts', label: 'Posts', icon: 'doc', groups: [WIDTH, FONT], more: ['textSize'] },
  { id: 'system', label: 'System', icon: 'control-panel', groups: [KIND, SAVER] },
].map(p => ({ ...p, keys: [...p.groups.map(g => g[0]), ...(p.more || [])] }));

const byId = id => PANES.find(p => p.id === id);
export const paneOf = url => (byId(new URL(url, 'http://x').searchParams.get('pane'))?.id || PANES[0].id);
export const paneUrl = (base, id) => (id === PANES[0].id ? base : `${base}?pane=${id}`);
// The preset the current settings add up to, if any
export const presetOf = get => PRESETS.find(p => KEYS.every(k => get(k) === p[k]));
// The palette a window style change leaves: the same one if the new style offers it, else the style's own colours,
// or the default for one that takes the palettes. A style drawn in its own colours keeps a plain palette for the
// next style and drops another look's colours.
export function paletteFor(deco, palette) {
  if (ownsColours(deco)) return PALETTES.some(o => o[0] === palette) ? palette : undefined;
  const opts = coloursFor(deco);
  return opts.some(o => o[0] === palette) ? palette : LOOKS[deco] ? opts[0][0] : undefined;
}

function group([key, legend, opts, art]) {
  return h('fieldset', { class: 'cp-set' }, h('legend', {}, legend),
    h('div', { class: 'cp-opts' + (art ? '' : ' seg-opts') },
      opts.map(([v, label, x]) => h('label', { class: 'cp-opt', 'data-v': v },
        h('input', { class: 'cp-in', type: 'radio', name: 'cp-' + key, value: v }), art?.(x, v), h('span', {}, label)))));
}

// Builds the window once and returns show(paneId)
function build(v, page) {
  const s = window.deskbar.settings, base = new URL(page.url, location.href).pathname;
  const set = Object.fromEntries([PRESET, ...PANES.flatMap(p => p.groups)].map(g => [g[0], group(g)]));
  const size = h('input', { type: 'range', id: 'cp-size', min: 14, max: 24, step: 1 });
  // the slider announces its own value, so this copy of it is for the eyes only
  const px = h('span', { 'aria-hidden': 'true' });
  const test = h('button', { class: 'tb cp-test', type: 'button' }, 'Test screen saver');
  test.addEventListener('click', () => window.deskbar.loadLazy('screensaver').then(m => m.start()));
  set.saverKind.append(test);
  set.preset.classList.add('cp-presets');
  const layout = {
    appearance: [set.preset, set.deco, set.palette, set.theme, set.dock, set.wall, set.crt],
    posts: [
      h('div', { class: 'cp-row' }, set.readerWidth,
        h('div', { class: 'cp-set' }, h('label', { class: 'cp-lbl', for: 'cp-size' }, 'Text size'), h('div', { class: 'cp-size' }, size, px))),
      set.readerFont,
      h('p', { class: 'cp-sample' }, 'Posts open in the reader at this width, size and font.'),
    ],
    system: [set.saverKind, set.saver],
  };
  const links = {}, panes = {};
  for (const p of PANES) {
    links[p.id] = h('a', { href: paneUrl(base, p.id), id: 'cp-t-' + p.id, 'data-pane': p.id }, ico('i-' + p.icon), h('span', {}, p.label));
    panes[p.id] = h('section', { class: 'cp-pane', id: 'cp-' + p.id, 'aria-labelledby': 'cp-t-' + p.id, hidden: true }, layout[p.id]);
  }
  const nav = h('nav', { class: 'cp-nav', 'aria-label': 'Settings' }, Object.values(links));
  const form = h('form', { class: 'cp', 'aria-label': 'Control panel' }, Object.values(panes));
  const status = h('output', { role: 'status' });
  let shown = PANES[0];

  const show = id => {
    shown = byId(id);
    for (const p of PANES) {
      panes[p.id].hidden = p !== shown;
      if (p === shown) links[p.id].setAttribute('aria-current', 'page');
      else links[p.id].removeAttribute('aria-current');
    }
    status.value = '';
    // the window's route names the pane; the address bar follows when it names this window
    const was = v.url, url = paneUrl(base, shown.id);
    v.url = url;
    if (url !== was && location.pathname + location.search === was) window.deskbar.router.replace(url);
  };
  nav.addEventListener('click', e => {
    const a = e.target.closest('a[data-pane]');
    if (!a || !plainClick(e)) return;
    e.preventDefault();
    show(a.dataset.pane);
  });

  // A choice applies once its stylesheet has loaded, so a look never shows half-drawn. A preset sets every
  // Appearance choice but the mode; a window style keeps the rest, bar a palette the new style doesn't offer.
  const apply = (want, hello) => {
    HELLO[hello]?.();
    return Promise.all(Object.entries(want).map(([k, x]) => x && sheetFor(k, x))).then(() => {
      for (const [k, x] of Object.entries(want)) s.set(k, x);
    });
  };
  form.addEventListener('submit', e => e.preventDefault());
  form.addEventListener('change', e => {
    const k = e.target.name?.startsWith('cp-') && e.target.name.slice(3), x = e.target.value;
    if (k === 'saver') store.set(k, +x);
    else if (k === 'saverKind') store.set(k, x === 'sheep' ? null : x);
    else if (k === 'preset') { const p = PRESETS.find(o => o.id === x); apply(Object.fromEntries(KEYS.map(n => [n, p[n]])), p.deco); }
    else if (k === 'deco') apply({ deco: x, palette: paletteFor(x, s.get('palette')) }, x);
    else if (KEYS.includes(k)) apply({ [k]: x });
    else if (k) s.set(k, x);
  });
  size.addEventListener('input', () => s.set('textSize', +size.value));
  const check = (k, x) => {
    for (const r of form.querySelectorAll(`[name="cp-${k}"]`)) r.checked = r.value === x;
  };
  // the panel's theme button and the reader's controls change the same settings while this window is open
  const sync = k => {
    for (const g of PANES.flatMap(p => p.groups)) check(g[0], g === SAVER ? String(store.get('saver', +document.documentElement.dataset.saver)) : g === KIND ? kind() : s.get(g[0]));
    check('preset', presetOf(s.get)?.id);
    const deco = s.get('deco'), offer = coloursFor(deco);
    for (const o of set.palette.querySelectorAll('.cp-opt')) o.hidden = !offer.some(c => c[0] === o.dataset.v);
    set.palette.disabled = ownsColours(deco);
    set.theme.disabled = !!LOOKS[deco]?.dark;
    size.value = s.get('textSize');
    px.textContent = size.value + 'px';
    status.value = '';
    // a dock of another height changes the room windows have
    if (k === 'dock') dispatchEvent(new Event('resize'));
  };
  const reset = () => {
    for (const k of shown.keys) {
      if (k === 'saver' || k === 'saverKind') store.set(k, null);
      else s.set(k);
    }
    sync();
    status.value = `${shown.label} is back to the defaults.`;
  };
  // Every palette's, look's and effect's stylesheet, for the thumbnails they draw and so picking one applies at once.
  // Palettes go first: a look outranks them, and both lose ties to whatever loaded later.
  for (const [n] of PALETTES) sheet('palette-' + n);
  for (const n of new Set([...DECOS, ...WALLS, ...DOCKS].map(o => lookSheet(o[0])))) if (n) sheet(n);
  sheet('effect-crt');
  sync();
  v.teardown = s.on(sync);
  v.el.append(h('div', { class: 'cp-body' }, nav, form),
    h('div', { class: 'toolbar cp-foot' }, status, h('button', { class: 'tb', type: 'button', onclick: reset }, 'Reset to defaults')));
  return show;
}

export function mount(v, page, { fresh }) {
  if (fresh) v.showPane = build(v, page);
  v.showPane(paneOf(page.url));
}
