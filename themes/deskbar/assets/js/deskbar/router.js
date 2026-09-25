// Real-path routing (Architecture: Page model). Internal link clicks fetch the target page, pull out its
// <main id="content"> and hand it to the handler for its data-window kind. Unknown kinds fall back to "page".
// Same-origin HTML with no <main> (a standalone tool such as /tiers.html) opens framed in a tool window, so
// tools never replace the site. Anything else that is not a same-origin page URL loads natively.
import { markExecuted } from './content.js';
import { plainClick } from './lib/dom.js';
import { transition } from './wm/windows.js';

// A hash is typed or pasted by people, so a stray % (#100%) must not throw
export function safeDecode(s) {
  try { return decodeURIComponent(s); } catch { return s; }
}

// Returns the routable parts of href, or null when the browser should handle it
export function routeFor(href, base) {
  let u, b;
  try { u = new URL(href, base); b = new URL(base); } catch { return null; }
  if (u.origin !== b.origin || !/^https?:$/.test(u.protocol)) return null;
  // files (feeds, images, archives) are not shell pages; .html files may be standalone tools
  if (/\.[a-z0-9]+$/i.test(u.pathname) && !/\.html?$/i.test(u.pathname)) return null;
  return { path: u.pathname, search: u.search, hash: u.hash, href: u.pathname + u.search + u.hash };
}

// /tool/index.html and /tool/ are the same file
export const framePath = path => path.replace(/\/index\.html?$/i, '/');

// A standalone HTML file as a page for the tool app, which frames it
export const framePage = (url, title) =>
  ({ url, kind: 'tool', title: title || url, slug: '', place: '', icon: 'tools', docTitle: '', frame: url, content: () => [] });

// Tool pages that embed a standalone file ({ '/tiers.html': '/tools/tiers/' }, from the post index). A link to the
// file opens its tool page, so the window gets the page's title and a real address, without fetching anything.
let frames = Promise.resolve(new Map());
export function useFrames(map) {
  frames = Promise.resolve(map)
    .then(m => new Map(Object.entries(m || {}).map(([file, page]) => [framePath(file), page])))
    .catch(() => new Map());
}

// The address bar as a route. Whatever the browser loaded is the page on screen, file extension or not.
export const locationRoute = (loc = location) =>
  ({ path: loc.pathname, search: loc.search, hash: loc.hash, href: loc.pathname + loc.search + loc.hash });

export const pageKey = r => (r ? r.path + r.search : '');

// Content keeps its links and images working once the address bar has moved on (Home, another post),
// so same-origin relative references are rewritten to absolute paths. External and scheme URLs are left alone.
export function resolveRef(value, base) {
  const v = value.trim();
  if (!v || /^[a-z][a-z0-9+.-]*:/i.test(v) || v.startsWith('//')) return value;
  const u = new URL(v, base);
  return u.pathname + u.search + u.hash;
}

const resolveSrcset = (value, base) => value.split(',').map(part => {
  const [url, ...rest] = part.trim().split(/\s+/);
  return [resolveRef(url, base), ...rest].join(' ');
}).join(', ');

export function absolutise(root, base) {
  for (const el of root.querySelectorAll('[href], [src], [srcset], [poster]')) {
    if (el.namespaceURI !== 'http://www.w3.org/1999/xhtml') continue;
    for (const a of ['href', 'src', 'poster']) if (el.hasAttribute(a)) el.setAttribute(a, resolveRef(el.getAttribute(a), base));
    if (el.hasAttribute('srcset')) el.setAttribute('srcset', resolveSrcset(el.getAttribute('srcset'), base));
  }
}

// Hugo alias pages are stubs with no <main>: a canonical link and a meta refresh to the real page. Both hold
// the absolute permalink, which names the production host in local builds, so only the path is kept.
export function redirectTarget(doc, base) {
  const refresh = doc.querySelector('meta[http-equiv="refresh" i]')?.getAttribute('content') || '';
  const raw = doc.querySelector('link[rel="canonical"]')?.getAttribute('href') || /url\s*=\s*['"]?([^'"]+)/i.exec(refresh)?.[1];
  if (!raw) return null;
  try {
    const u = new URL(raw.trim(), base);
    return u.pathname + u.search + u.hash;
  } catch {
    return null;
  }
}

// A page as the shell sees it. href is where the page really came from, after any redirect.
export function pageFromMain(main, href, docTitle) {
  const u = new URL(href);
  absolutise(main, href);
  // isConnected alone is also true inside a DOMParser document
  if (main.isConnected && main.ownerDocument === globalThis.document) markExecuted(main);
  const src = main.cloneNode(true), d = main.dataset;
  let first = main;
  return {
    url: u.pathname + u.search, kind: d.window || 'page', title: d.title || docTitle, slug: d.slug || '',
    place: d.place || '', icon: d.icon || 'doc', width: Number(d.width) || 0, height: Number(d.height) || 0, besidePosts: 'besidePosts' in d, docTitle,
    // The first call hands over the original nodes, so anything the page's own scripts bound to them keeps
    // working. Later calls (a cached page shown again) get fresh copies.
    content: () => {
      const nodes = [...(first || src.cloneNode(true)).childNodes];
      first = null;
      return nodes;
    },
  };
}

const handlers = {};
const cache = new Map();
const popHooks = [];
let token = 0, shown = '';

export const register = (kind, fn) => { handlers[kind] = fn; };
// Extension point: onPop(fn) adds fn(key) => boolean, asked in order on Back/Forward before any routing.
// key is the path + query being returned to. Return true when the hook has put the screen right itself.
// first: ask this hook before the others. Home uses it, as its snapshot covers every window, including an app's
// whose own hook would otherwise answer first and restore only that app.
export const onPop = (fn, { first = false } = {}) => { if (first) popHooks.unshift(fn); else popHooks.push(fn); };
export const currentPath = () => pageKey(locationRoute());

async function fetchPage(key) {
  const res = await fetch(key, { headers: { Accept: 'text/html' } });
  if (!res.ok && res.status !== 404) throw new Error('HTTP ' + res.status);
  if (!/html/i.test(res.headers?.get('content-type') || 'text/html')) throw new Error('not HTML');
  const html = await res.text();
  // relative references resolve against the final URL: a server that adds the trailing slash changes the base
  const url = res.url || new URL(key, location.href).href;
  const doc = new DOMParser().parseFromString(html, 'text/html'), main = doc.querySelector('main#content');
  if (main) return pageFromMain(main, url, doc.title);
  const to = redirectTarget(doc, url);
  if (to) return { redirect: to };
  const u = new URL(url);
  return framePage(u.pathname + u.search, doc.title.trim());
}

async function load(r) {
  const key = pageKey(r);
  if (!cache.has(key)) {
    cache.set(key, fetchPage(key));
    if (cache.size > 40) cache.delete(cache.keys().next().value);
  }
  try {
    return await cache.get(key);
  } catch (err) {
    cache.delete(key);
    throw err;
  }
}

// Follows one alias hop; the route returned is the page's real address, which is what history records
async function resolve(r) {
  let page = await load(r);
  if (page.redirect) {
    const to = routeFor(page.redirect, location.href);
    if (!to) throw new Error('redirect leaves the shell');
    r = to.hash || !r.hash ? to : { ...to, hash: r.hash, href: to.path + to.search + r.hash };
    page = await load(r);
    if (page.redirect) throw new Error('redirect chain');
  }
  if (page.url !== pageKey(r)) {
    const u = new URL(page.url + r.hash, location.href);
    r = { path: u.pathname, search: u.search, hash: u.hash, href: page.url + r.hash };
  }
  return { page, r };
}

// pop: shown by Back or Forward rather than a new navigation. opts: go's, passed on to the handler.
// The handler also gets the path and title being left (from, was), for a view that can put them back.
function show(page, r, from, pop = false, opts) {
  shown = pageKey(r);
  const was = document.title;
  if (page.docTitle) document.title = page.docTitle;
  transition(() => (handlers[page.kind] || handlers.page)(page, { hash: safeDecode(r.hash.slice(1)), from, was, pop, ...opts }));
}

const sameDoc = r => handlers.hash?.(r);

// hint skips the fetch when the caller already knows what the URL shows (e.g. a Tracker place).
// opts.replace: replace the current history entry rather than add one; opts.keep: keyboard focus stays where it is.
// Tracker's arrow keys use both, so the reader follows the selection like a mail client's preview pane.
// opts.into: the key of a post window of its own (reader.js) that a link was pressed in, or that steps back or forward.
// That window shows the page, even one another window shows at this address, and its history entry keeps the key
// so Back and Forward return there. A folder window's key does the same for a folder (apps/index.js).
export async function go(href, hint, opts) {
  const asked = routeFor(href, location.href);
  if (!asked) { location.assign(href); return; }
  const tool = (await frames).get(framePath(asked.path));
  if (tool && tool !== asked.path) return go(tool);
  const from = currentPath(), here = pageKey(asked) === from;
  if (here && !hint && !opts?.into) {
    history.replaceState(history.state, '', asked.href);
    return sameDoc(asked);
  }
  const t = ++token;
  let page, r = asked;
  try {
    if (hint) page = { url: pageKey(r), ...hint };
    else ({ page, r } = await resolve(asked));
  } catch {
    // a newer navigation owns the screen now, so a late failure must not load this page over it
    if (t === token) location.assign(asked.href);
    return;
  }
  if (t !== token) return;
  // a standalone file stays out of history: reloading its address would load the tool in place of the site
  if (page.frame) return transition(() => (handlers.tool || handlers.page)(page, { hash: '', from }));
  // a hinted place already at this address (the same Tracker place twice) is shown again without a new entry
  if (here || opts?.replace) replace(r.href); else push(r.href, '', opts?.into);
  show(page, r, from, false, opts);
}

// Loads href for a window beside the page the address names (a shared layout, ?layout=, or posts opened in windows of
// their own). Resolves to a function that opens it without touching history, the address bar or the title, passing
// its opts on to the handler and returning what the handler does, or null for Home. Rejects when the page can't be
// loaded. Loading and opening are separate so the caller can drop the window if the visitor has moved on.
export async function loadAside(href) {
  const asked = routeFor(href, location.href);
  if (!asked) throw new Error('not a shell page');
  const { page, r } = await resolve(asked);
  if (page.kind === 'home') return null;
  return opts => (handlers[page.kind] || handlers.page)(page, { hash: safeDecode(r.hash.slice(1)), from: null, pop: false, ...opts });
}

// New history entry without routing, for state the caller has already applied (Home toggle, a Photos album).
// title: the document title for that state, since no page load sets it. into: the view that shows it (go's opts).
export function push(href, title, into) {
  history.pushState(into ? { into } : null, '', href);
  shown = currentPath();
  if (title) document.title = title;
}

// Records state that should not add history (headings, closed windows)
export function replace(href, title) {
  history.replaceState(history.state, '', href);
  shown = currentPath();
  if (title) document.title = title;
}

// Back one entry to key, the entry just before this one, for state the caller has already applied (Escape closing a
// post). The entry left becomes Forward rather than a duplicate that Back would revisit.
let expected = null;
export function backTo(key, title) {
  expected = { key, title };
  history.back();
}

function onClick(e) {
  if (!plainClick(e)) return;
  const a = e.target.closest?.('a[href]');
  if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
  const r = routeFor(a.getAttribute('href'), location.href);
  if (!r) return;
  e.preventDefault();
  go(r.href, null, { into: a.closest('.view:is([data-key^="post:"], [data-key^="folder:"])')?.dataset.key });
}

async function onPopState() {
  // any Back or Forward supersedes a navigation still loading, even one a hook answers
  const t = ++token;
  const r = locationRoute(), key = pageKey(r), from = shown, was = expected;
  expected = null;
  if (key === was?.key) { shown = key; if (was.title) document.title = was.title; return; }
  if (key === from) return sameDoc(r);
  if (popHooks.some(fn => fn(key))) { shown = key; return; }
  try {
    const page = await load(r);
    if (page.redirect) throw new Error('redirect in history');
    if (t === token) show(page, r, from, true, history.state);
  } catch {
    if (t === token) location.reload();
  }
}

// initial: the page already in the document, so the first render needs no fetch. Links are taken over only
// once that render has worked; if it throws, the page stays a plain document with plain links.
// opts: the handler's, for a page a shared layout shows in a post window of its own.
export function startRouter(initial, opts) {
  show(initial, locationRoute(), null, false, opts);
  document.addEventListener('click', onClick);
  addEventListener('popstate', onPopState);
}

// The shell's fallback when boot fails after the router has started
export function stopRouter() {
  document.removeEventListener('click', onClick);
  removeEventListener('popstate', onPopState);
}
