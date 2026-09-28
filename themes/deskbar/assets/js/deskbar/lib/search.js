// Search over the shell's post index (title, description, tags, series) and, for Spotlight (D28), the site index,
// which adds page body text. No dependency (D18): a few hundred entries is a linear scan of a few milliseconds per
// keystroke, and prefix plus substring matching with field weights ranks as well as a fuzzy matcher for titles
// people half remember, so no Fuse.js index is published.

// Case and accent insensitive, so "resume" finds "Resumé"
export const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
export const terms = q => norm(q).split(/\s+/).filter(Boolean);

const fieldCache = new WeakMap();
function fields(p) {
  let f = fieldCache.get(p);
  if (!f) {
    f = {
      title: norm(p.title), tags: (p.tags || []).map(norm), series: (p.series || []).map(norm), desc: norm(p.description),
      body: norm(p.body),
    };
    fieldCache.set(p, f);
  }
  return f;
}

// True when t starts a word in s ("mcp" in "local mcp servers", not in "tcmcp")
function wordStart(s, t) {
  for (let i = s.indexOf(t); i >= 0; i = s.indexOf(t, i + 1)) if (i === 0 || !/[\p{L}\p{N}]/u.test(s[i - 1])) return true;
  return false;
}

const best = (list, t, exact, prefix, part) =>
  list.reduce((m, x) => Math.max(m, x === t ? exact : x.startsWith(t) ? prefix : x.includes(t) ? part : 0), 0);

// Weights: a title hit beats a tag, a tag beats a series, the description only breaks ties and the body least of
// all. Body text only counts where a word starts with the term: long text holds most short strings somewhere.
function termScore(f, t) {
  const title = f.title.includes(t) ? (wordStart(f.title, t) ? 10 : 2) : 0;
  const desc = f.desc.includes(t) ? (wordStart(f.desc, t) ? 3 : 1) : 0;
  const body = f.body && wordStart(f.body, t) ? 1 : 0;
  return title + best(f.tags, t, 8, 5, 2) + best(f.series, t, 6, 4, 2) + desc + body;
}

// Every term must match somewhere. Ties go to the newer post.
export function scorePost(p, ts, phrase = '') {
  const f = fields(p);
  let s = 0;
  for (const t of ts) {
    const n = termScore(f, t);
    if (!n) return 0;
    s += n;
  }
  if (ts.length > 1 && f.title.includes(phrase)) s += 12;
  return s;
}

// [entry, score] pairs for every match, best first
export function rank(posts, query) {
  const ts = terms(query);
  if (!ts.length) return [];
  const phrase = ts.join(' ');
  return posts.map(p => [p, scorePost(p, ts, phrase)]).filter(x => x[1] > 0)
    .sort((a, b) => b[1] - a[1] || String(b[0].date || '').localeCompare(String(a[0].date || '')));
}

export const searchPosts = (posts, query, limit = Infinity) => rank(posts, query).slice(0, limit).map(x => x[0]);

// Menu entries and other labels: every term appears somewhere in the text
export const matches = (text, query) => {
  const s = norm(text);
  return terms(query).every(t => s.includes(t));
};
