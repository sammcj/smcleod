// Control panel (`window: control-panel`): every visitor setting, in panes after Haiku's Preferences. Appearance is
// the desktop's look (colours, mode, window style, wallpaper, dock), Posts is the reader (width, font, text size) and
// System is the rest (which screen saver, and when). A choice applies at once, so the desktop behind the window is
// the preview. Each pane has an address, ?pane=<id> (none for the first), which the window's route follows, so a
// link, a copied layout or Open in new tab comes back to the same pane. The settings live in the shell (settings.js,
// through window.deskbar.settings), which also serves the panel's theme button and the reader's own controls, and
// head.html reapplies them before first paint. Loaded on first open through lazyApp (loader.js).
import { h, ico, plainClick } from '../lib/dom.js';
import { store } from '../lib/store.js';

// [setting, legend, [[value, label, art argument]], art]. Defaults are in settings.js; the looks in control-panel.css.
const swatch = sw => {
  const [a, b, c] = sw.split(' ');
  return h('span', { class: 'cp-art cp-sw', style: `--a:${a};--b:${b};--c:${c}` });
};
const thumb = cls => (_, v) => h('span', { class: `cp-art ${cls} ${v}` });
const PALETTE = ['palette', 'Colours', [
  ['haiku', 'Haiku', '#ffcb00 #d8d8d8 #2b4b72'], ['beos', 'BeOS', '#ffcb00 #d8d8d8 #336698'],
  ['xfce', 'Xfce', '#a3bddf #d9dde3 #3f6189'], ['sage', 'Sage', '#b5cf9c #d9dbd3 #4d6a43'],
  ['snow', 'Snow', '#bcd7fb #f2f5f9 #7eaee8'], ['mint', 'Mint', '#aee8d3 #f1f7f4 #5cc3a1'], ['peach', 'Peach', '#ffcfba #fbf6f3 #f59e7e'],
  ['synthwave', 'Synthwave', '#ff8fcb #e6def5 #4a2590'],
], swatch];
const MODE = ['theme', 'Mode', [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']]];
const DECO = ['deco', 'Window style', [['haiku', 'Haiku'], ['beos', 'BeOS'], ['flat', 'Flat'], ['clear', 'Clear'], ['liquid', 'Liquid Ass'],
  ['platinum', 'Platinum'], ['clearlooks', 'Clearlooks'], ['phosphor', 'Phosphor'], ['broadsheet', 'Broadsheet'], ['synthwave', 'Synthwave']], thumb('cp-deco')];
const WALL = ['wall', 'Wallpaper', [['rings', 'Rings'], ['plain', 'Plain'], ['grid', 'Grid'], ['dots', 'Dots'], ['hills', 'Hills'], ['liquid', 'Liquid'], ['clear', 'Clear'],
  ['platinum', 'Platinum'], ['clearlooks', 'Clearlooks'], ['phosphor', 'Phosphor'], ['broadsheet', 'Broadsheet'], ['synthwave', 'Synthwave']], thumb('cp-wp')];
// Whole looks: window styles that bring their own wallpaper and dock (deco() below). owns: the Appearance groups a
// look sets itself, disabled while it is on. Platinum and the rest are css/deskbar/looks/<name>.css, which draws
// the window style, wallpaper, dock and both thumbnails; Liquid Ass and Clear live in control-panel.css.
const LOOKS = {
  liquid: { wall: 'liquid', dock: 'glass' },
  clear: { wall: 'clear', dock: 'glass' },
  platinum: { wall: 'platinum', dock: 'glass', owns: ['palette', 'dock'] },
  clearlooks: { wall: 'clearlooks', dock: 'panel', owns: ['palette', 'dock'] },
  phosphor: { wall: 'phosphor', dock: 'panel', owns: ['palette', 'dock', 'theme'] },
  broadsheet: { wall: 'broadsheet', dock: 'glass', owns: ['palette', 'dock'] },
  synthwave: { wall: 'synthwave', dock: 'glass', owns: ['palette', 'dock', 'theme'] },
};
// The Mac startup chime, synthesised rather than recorded: a slightly strummed F sharp major chord of detuned saws
// through a closing low-pass filter, with a short echo for the room. Played only when the visitor picks Platinum,
// as browsers allow sound only in answer to a press.
LOOKS.platinum.hello = () => {
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
// a look's stylesheet, loaded once; anything else has none, and goes ahead at once
const look = v => window.deskbar.loadLazy('look-' + v).catch(() => {});
const DOCK = ['dock', 'Dock', [['glass', 'Glass'], ['deskbar', 'Deskbar'], ['panel', 'Panel']], thumb('cp-dk')];
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

// In list order. groups are the pane's radio sets; keys are everything its Reset puts back. A new setting is a group
// here plus its place in build()'s layout.
export const PANES = [
  { id: 'appearance', label: 'Appearance', icon: 'appearance', groups: [PALETTE, MODE, DECO, WALL, DOCK] },
  { id: 'posts', label: 'Posts', icon: 'doc', groups: [WIDTH, FONT], more: ['textSize'] },
  { id: 'system', label: 'System', icon: 'control-panel', groups: [KIND, SAVER] },
].map(p => ({ ...p, keys: [...p.groups.map(g => g[0]), ...(p.more || [])] }));

const byId = id => PANES.find(p => p.id === id);
export const paneOf = url => (byId(new URL(url, 'http://x').searchParams.get('pane'))?.id || PANES[0].id);
export const paneUrl = (base, id) => (id === PANES[0].id ? base : `${base}?pane=${id}`);

function group([key, legend, opts, art]) {
  return h('fieldset', { class: 'cp-set' }, h('legend', {}, legend),
    h('div', { class: 'cp-opts' + (art ? '' : ' seg-opts') },
      opts.map(([v, label, x]) => h('label', { class: 'cp-opt' },
        h('input', { class: 'cp-in', type: 'radio', name: 'cp-' + key, value: v }), art?.(x, v), h('span', {}, label)))));
}

// Builds the window once and returns show(paneId)
function build(v, page) {
  const s = window.deskbar.settings, base = new URL(page.url, location.href).pathname;
  const set = Object.fromEntries(PANES.flatMap(p => p.groups).map(g => [g[0], group(g)]));
  const size = h('input', { type: 'range', id: 'cp-size', min: 14, max: 24, step: 1 });
  // the slider announces its own value, so this copy of it is for the eyes only
  const px = h('span', { 'aria-hidden': 'true' });
  const test = h('button', { class: 'tb cp-test', type: 'button' }, 'Test screen saver');
  test.addEventListener('click', () => window.deskbar.loadLazy('screensaver').then(m => m.start()));
  set.saverKind.append(test);
  const layout = {
    appearance: [set.palette, set.theme, set.deco, set.wall, set.dock],
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

  form.addEventListener('submit', e => e.preventDefault());
  form.addEventListener('change', e => {
    const k = e.target.name?.startsWith('cp-') && e.target.name.slice(3);
    if (k === 'saver') store.set(k, +e.target.value);
    else if (k === 'saverKind') store.set(k, e.target.value === 'sheep' ? null : e.target.value);
    else if (k === 'deco') { LOOKS[e.target.value]?.hello?.(); deco(e.target.value); }
    else if (k === 'wall') look(e.target.value).then(() => s.set(k, e.target.value));
    else if (k) s.set(k, e.target.value);
  });
  // A look's wallpaper and dock replace the visitor's, which are kept (deskbar:lookWas, so a reload in between doesn't
  // lose them) and put back when a style that isn't a look is picked, unless the visitor has changed them since.
  // Going from one look to another swaps whichever of them still match the first look. A look with a stylesheet
  // applies once it has loaded, so its window style never shows half-drawn.
  function deco(v) {
    return look(v).then(() => {
      const from = LOOKS[s.get('deco')], to = LOOKS[v];
      s.set('deco', v);
      if (to && !from) {
        store.set('lookWas', { wall: store.get('wall'), dock: store.get('dock') });
        s.set('wall', to.wall);
        s.set('dock', to.dock);
      } else if (to && from) {
        if (s.get('wall') === from.wall) s.set('wall', to.wall);
        if (s.get('dock') === from.dock) s.set('dock', to.dock);
      } else if (from) {
        const old = store.get('lookWas') || {};
        if (s.get('wall') === from.wall) s.set('wall', old.wall);
        if (s.get('dock') === from.dock) s.set('dock', old.dock);
        store.set('lookWas', null);
      }
    });
  }
  size.addEventListener('input', () => s.set('textSize', +size.value));
  // the panel's theme button and the reader's controls change the same settings while this window is open
  const sync = k => {
    for (const g of PANES.flatMap(p => p.groups)) {
      form.elements['cp-' + g[0]].value = g === SAVER ? String(store.get('saver', +document.documentElement.dataset.saver)) : g === KIND ? kind() : s.get(g[0]);
    }
    const owns = LOOKS[s.get('deco')]?.owns || [];
    for (const g of PANES[0].groups) set[g[0]].disabled = owns.includes(g[0]);
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
      if (k === 'deco') store.set('lookWas', null);
    }
    sync();
    status.value = `${shown.label} is back to the defaults.`;
  };
  // every look's stylesheet, for the thumbnails it draws and so picking one applies at once
  for (const n in LOOKS) look(n);
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
