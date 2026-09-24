import { h } from './dom.js';

// Midday avoids a date-only string shifting to the previous day in timezones west of UTC
const day = d => new Date(d + 'T12:00:00');
export const fmtDate = d => d ? day(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
export const shortDate = d => d ? day(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : '';
export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
export const excerpt = (s, n = 130) => s.length > n ? s.slice(0, n - 3).replace(/\s+\S*$/, '') + '...' : s;

// Every post in the index has a thumbnail (its own image or build-time art, see thumb-art.html) and a mini icon.
// A thumbnail that fails to load, such as a hotlinked cover that has gone, falls back once to the mini icon.
function pic(cls, src, fallback) {
  if (!src) return h('span', { class: cls });
  return h('img', {
    class: cls, src, alt: '', loading: 'lazy', decoding: 'async',
    onerror: e => { if (fallback && !e.target.dataset.fb) { e.target.dataset.fb = '1'; e.target.src = fallback; } },
  });
}
export const thumb = (p, cls = 'pc-img') => pic(cls, p.cover || p.mini, p.mini);
export const mini = (p, cls = 'tico') => pic(cls, p.mini);
