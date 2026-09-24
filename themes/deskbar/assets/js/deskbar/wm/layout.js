// Shareable layouts (Architecture: URLs). The address bar always names the page on screen. A copied layout link
// adds ?layout=, which lists every open window's address and snap zone from the bottom of the stack to the top,
// plus the split between the left and right sides:
//   /2026/07/wm/?layout=s25,l/posts/,r/2026/07/wm/
// Tokens are comma separated: s<percent> is the split; otherwise an optional p for a post window of its own
// (reader.js openPosts), an optional zone (l r m tl tr bl br, m for maximised), then the window's path. The shell
// reads it once at load, drops it from the address and reopens the windows. Kept free of the DOM so it is unit
// tested; anything malformed is skipped rather than failing.
import { safeDecode } from '../router.js';

const MAX_WINS = 8;
const TOKEN = /^(p)?(tl|tr|bl|br|l|r|m)?(\/(?!\/).*)$/;
const zoneCode = snap => (snap === 'max' ? 'm' : snap || '');
// characters that would end the token or the parameter, and % itself, since decoding undoes exactly one level
const esc = s => s.replace(/[%,&#+ ]/g, encodeURIComponent);

// wins: [{ route, snap, own }] from bottom to top of the stack
export function encodeLayout(wins, split) {
  const list = wins.filter(w => w.route?.startsWith('/')).slice(-MAX_WINS);
  const sides = list.some(w => w.snap && w.snap !== 'max');
  return [sides ? 's' + Math.round(split * 100) : null, ...list.map(w => (w.own ? 'p' : '') + zoneCode(w.snap) + esc(w.route))].filter(Boolean).join(',');
}

export function decodeLayout(raw) {
  const out = { split: 0, wins: [] }, seen = new Set();
  for (const tok of String(raw || '').split(',').slice(0, MAX_WINS + 1)) {
    const t = safeDecode(tok), s = /^s(\d{1,2})$/.exec(t);
    if (s) {
      const n = Number(s[1]);
      if (n >= 10 && n <= 90) out.split = n / 100;
      continue;
    }
    const m = TOKEN.exec(t);
    if (!m || seen.has(m[3]) || out.wins.length === MAX_WINS) continue;
    seen.add(m[3]);
    out.wins.push({ route: m[3], snap: m[2] === 'm' ? 'max' : m[2] || null, ...(m[1] && { own: true }) });
  }
  return out;
}

// search: location.search. Returns the raw layout value (null without one) and the search without it.
export function takeLayout(search) {
  const parts = search.replace(/^\?/, '').split('&').filter(Boolean);
  const i = parts.findIndex(p => p.startsWith('layout='));
  if (i < 0) return { value: null, rest: search };
  const [hit] = parts.splice(i, 1);
  return { value: hit.slice(7), rest: parts.length ? '?' + parts.join('&') : '' };
}

// The link for primary (the address on screen, path and query) with the layout added
export const layoutHref = (primary, value) => (value ? primary + (primary.includes('?') ? '&' : '?') + 'layout=' + value : primary);
