// The post index (home.deskbar.json) is fetched once and shared by Tracker and the phone home screen.
// Parsing is defensive because a site can override the template and a bad index must not stop the shell.

const str = v => typeof v === 'string' ? v : '';
const num = v => Number.isFinite(v) && v > 0 ? v : 0;
const strs = v => Array.isArray(v) ? v.filter(x => typeof x === 'string') : [];
const valid = x => x && typeof x.url === 'string' && x.url && typeof (x.title ?? x.name) === 'string';

export function parseIndex(raw) {
  const posts = (Array.isArray(raw?.posts) ? raw.posts : []).filter(valid).map(p => {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(p.date) ? p.date : '';
    return {
      title: p.title, url: p.url, date, year: date.slice(0, 4),
      tags: strs(p.tags), series: strs(p.series), categories: strs(p.categories), description: str(p.description), cover: str(p.cover),
      mini: str(p.mini), images: num(p.images), readingTime: num(p.readingTime), words: num(p.words),
    };
  }).sort((a, b) => b.date.localeCompare(a.date));
  const pages = (Array.isArray(raw?.pages) ? raw.pages : []).filter(valid)
    .map(p => ({ title: p.title, url: p.url, icon: str(p.icon) || 'doc' }));
  const terms = name => (Array.isArray(raw?.taxonomies?.[name]) ? raw.taxonomies[name] : []).filter(valid)
    .map(t => ({ name: t.name, url: t.url, count: num(t.count) }));
  const urlMap = m => Object.fromEntries(Object.entries(m && typeof m === 'object' ? m : {}).filter(([, u]) => typeof u === 'string' && u));
  return {
    posts, pages, tags: terms('tags'), series: terms('series'), categories: terms('categories'), taxURLs: urlMap(raw?.taxonomyURLs),
    sectionURL: str(raw?.sectionURL) || '/posts/',
    // standalone tool file -> the tool page that frames it
    frames: urlMap(raw?.frames),
    // list page URL -> its document title, for places shown without fetching the page
    docTitles: urlMap(raw?.docTitles),
  };
}

let pending = null;
export function loadIndex(url) {
  pending ||= (url ? fetch(url).then(r => (r.ok ? r.json() : {})) : Promise.resolve({}))
    .catch(() => ({}))
    .then(parseIndex);
  return pending;
}

// Tracker places: "all", "y:<year>", "<taxonomy>:<term>" (e.g. "tags:ai"). A search query overrides the place.
export function filterPosts(posts, place, query = '') {
  const q = query.trim().toLowerCase();
  if (q) return posts.filter(p => `${p.title} ${p.description} ${p.tags.join(' ')}`.toLowerCase().includes(q));
  if (place === 'all') return posts.slice();
  const i = place.indexOf(':');
  if (i < 0) return [];
  const kind = place.slice(0, i), term = place.slice(i + 1);
  if (kind === 'y') return posts.filter(p => p.year === term);
  return posts.filter(p => Array.isArray(p[kind]) && p[kind].includes(term));
}
