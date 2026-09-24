// Visitor settings, kept in localStorage (lib/store.js). head.html applies the stored ones before first paint.
// The panel's theme button and the reader's A-/A+ and width buttons change them here, and the Control panel and the
// Terminal (lazy/) through window.deskbar.settings: { get, set, on, shown }.
import { store } from './lib/store.js';

// Reader measure; reader.css maps each to a width
export const WIDTHS = ['narrow', 'normal', 'wide'];
export const nextWidth = w => WIDTHS[(WIDTHS.indexOf(w) + 1) % WIDTHS.length];

// The <html> data attribute each setting shows as. A default is stored as nothing and leaves its attribute off, so
// the core CSS applies alone and head.html has no extra stylesheet to load. theme auto follows the OS.
const ATTR = { theme: 'theme', palette: 'palette', deco: 'deco', wall: 'wall', dock: 'dock', readerWidth: 'rdWidth', readerFont: 'rdFont' };
export const DEFAULT = {
  theme: 'auto', palette: 'haiku', deco: 'haiku', wall: 'rings', dock: 'glass', readerWidth: 'normal', readerFont: 'serif', textSize: 18,
};
const subs = new Set();
// Choices the theme no longer offers, which visitors may still have stored
const RETIRED = { dock: 'minimal' };

// Stored values are checked on the way out, since anything can be in localStorage
function valid(k, v) {
  if (k === 'textSize') return Math.min(24, Math.max(14, Math.round(v) || 18));
  return typeof v === 'string' && v && v !== RETIRED[k] && (k !== 'readerWidth' || WIDTHS.includes(v)) ? v : DEFAULT[k];
}

export const get = k => valid(k, store.get(k));

// set(k) goes back to the default. Listeners hear every change, whichever control made it.
export function set(k, v) {
  v = valid(k, v);
  const d = document.documentElement, dflt = v === DEFAULT[k];
  store.set(k, dflt ? null : v);
  if (k === 'textSize') d.style.setProperty('--rd-size', v + 'px');
  else if (dflt) delete d.dataset[ATTR[k]];
  else d.dataset[ATTR[k]] = v;
  for (const fn of subs) fn(k, v);
  return v;
}

// on(fn(key, value)) returns a function that stops listening
export const on = fn => (subs.add(fn), () => subs.delete(fn));

// The theme on screen: the chosen one, or the system's while following it (no data-theme)
export const shown = () => document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

const setTheme = t => set('theme', t ?? (shown() === 'dark' ? 'light' : 'dark'));

export const textSize = delta => set('textSize', get('textSize') + delta);

export const settings = { get, set, on, shown };

export function initSettings() {
  // head.html shows a retired choice as it was stored; this puts back the default and forgets it
  for (const k in RETIRED) if (document.documentElement.dataset[ATTR[k]] === RETIRED[k]) set(k);
  document.getElementById('themeBtn')?.addEventListener('click', () => setTheme());
}
