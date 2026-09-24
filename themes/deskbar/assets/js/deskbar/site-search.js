// Site-wide search for Spotlight (D28): parsing the site index, grouping ranked results and body snippets.
// DOM free so it is unit tested in Node. The index comes from layouts/home.deskbarsearch.json; a site can
// override that template, so parsing drops anything unusable rather than failing.
import { rank, terms, norm } from './search.js';
import { findOffsets } from './lib/offsets.js';

// Result groups in their default order. Series share the tags group.
export const GROUPS = [
  { kind: 'post', label: 'Posts', limit: 8 },
  { kind: 'page', label: 'Pages', limit: 5 },
  { kind: 'tool', label: 'Tools', limit: 5 },
  { kind: 'photo', label: 'Photos', limit: 5 },
  { kind: 'tag', label: 'Tags and series', limit: 6 },
];
const KINDS = ['post', 'page', 'tool', 'photo', 'tag', 'series'];
export const groupOf = kind => (kind === 'series' ? 'tag' : kind);

const str = v => (typeof v === 'string' ? v : '');
const strs = v => (Array.isArray(v) ? v.filter(x => typeof x === 'string') : []);

export function parseSiteIndex(raw) {
  const list = Array.isArray(raw?.entries) ? raw.entries : [];
  return list.filter(e => str(e?.title) && str(e?.url)).map(e => ({
    title: e.title, url: e.url, kind: KINDS.includes(e.kind) ? e.kind : 'page', date: str(e.date),
    tags: strs(e.tags), series: strs(e.series), description: str(e.description), body: str(e.body), thumb: str(e.thumb),
    count: Number.isFinite(e.count) && e.count > 0 ? e.count : 0,
  }));
}

// [{ kind, label, items }] for a query. Groups with a hit are ordered by their best score, so the likeliest
// answer is on top whatever its kind; GROUPS order breaks ties.
export function searchSite(entries, query) {
  const byGroup = new Map(GROUPS.map(g => [g.kind, { ...g, items: [], top: 0 }]));
  for (const [e, score] of rank(entries, query)) {
    const g = byGroup.get(groupOf(e.kind));
    if (g.items.length >= g.limit) continue;
    if (!g.items.length) g.top = score;
    g.items.push(e);
  }
  return [...byGroup.values()].filter(g => g.items.length)
    .sort((a, b) => b.top - a.top)
    .map(({ kind, label, items }) => ({ kind, label, items }));
}

// When a query only matched an entry's body text, a slice of the body around the first such match shows why it
// is there. Otherwise the description does. Offsets come from a canonical (NFD) folding, which keeps the length of
// the original text, so the slice lines up with it. norm()'s compatibility folding would turn "…" into "...".
const flat = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function snippet(e, query, width = 140) {
  const ts = terms(query), shown = norm(e.title + ' ' + e.description);
  const body = flat(e.body).length === e.body.length ? flat(e.body) : e.body.toLowerCase();
  const t = ts.find(x => !shown.includes(x) && body.includes(x));
  if (!t) return e.description;
  // prefer a match at the start of a word, which is what ranked it
  let i = body.indexOf(t);
  for (let j = i; j > 0; j = body.indexOf(t, j + 1)) if (!/[\p{L}\p{N}]/u.test(body[j - 1])) { i = j; break; }
  // a short lead-in keeps the match on screen in a phone-width row
  let start = Math.max(0, i - 20);
  // start on a word, unless the match sits inside one long token such as a URL
  const sp = e.body.indexOf(' ', start);
  if (start > 0 && sp >= 0 && sp < i) start = sp + 1;
  const end = Math.min(e.body.length, start + width);
  return (start > 0 ? '...' : '') + e.body.slice(start, end).trim() + (end < e.body.length ? '...' : '');
}

// Ranges [start, end) of every query term in text, merged, for highlighting
export function marks(text, query) {
  const out = [];
  for (const t of terms(query)) for (const i of findOffsets(text, t)) out.push([i, i + t.length]);
  out.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const r of out) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push(r);
  }
  return merged;
}
