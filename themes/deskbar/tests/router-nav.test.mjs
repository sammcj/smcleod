// Router navigation against a minimal fake browser: start-up on any URL, redirects, alias stubs and Back hooks.
import { test } from 'node:test';
import assert from 'node:assert/strict';

let cur = new URL('https://example.org/tools/tiers.html');
const assigned = [], pushed = [];
let popstate = null, reloads = 0;
globalThis.location = {
  get href() { return cur.href; }, get pathname() { return cur.pathname; }, get search() { return cur.search; },
  get hash() { return cur.hash; }, get origin() { return cur.origin; },
  assign(u) { assigned.push(u); }, reload() { reloads++; },
};
globalThis.history = {
  state: null,
  pushState(s, _, h) { this.state = s; cur = new URL(h, cur); pushed.push(h); },
  replaceState(s, _, h) { this.state = s; if (h) cur = new URL(h, cur); },
};
globalThis.document = { title: '', addEventListener() {} };
globalThis.addEventListener = (type, fn) => { if (type === 'popstate') popstate = fn; };

const el = attrs => ({
  namespaceURI: 'http://www.w3.org/1999/xhtml', attrs,
  hasAttribute: a => a in attrs, getAttribute: a => attrs[a] ?? null, setAttribute(a, v) { attrs[a] = v; },
});
function main(kind, title, nodes = []) {
  return {
    isConnected: false, dataset: { window: kind, title }, childNodes: nodes,
    querySelectorAll: () => nodes, cloneNode: () => ({ childNodes: [], cloneNode: () => ({ childNodes: [] }) }),
  };
}
const doc = (title, { main: m = null, canonical, refresh } = {}) => ({
  title,
  querySelector: sel => sel === 'main#content' ? m
    : sel.startsWith('link') && canonical ? el({ href: canonical })
      : sel.startsWith('meta') && refresh ? el({ content: refresh }) : null,
});

// each fetch key maps to the URL the response ends up at and the document it parses to
const site = new Map();
globalThis.fetch = async key => {
  const s = site.get(key);
  if (!s) return { ok: false, status: 500, url: '', text: async () => '' };
  return { ok: true, status: 200, url: s.url, text: async () => key };
};
globalThis.DOMParser = class { parseFromString(key) { return site.get(key).doc; } };

const router = await import('../assets/js/deskbar/router.js');
const seen = [];
router.register('page', (page, opts) => seen.push({ kind: 'page', url: page.url, ...opts }));
router.register('reader', (page, opts) => seen.push({ kind: 'reader', url: page.url, page, ...opts }));

test('a null route has an empty key and start-up works on a URL with a file extension', () => {
  assert.equal(router.pageKey(null), '');
  assert.deepEqual(router.locationRoute({ pathname: '/tools/tiers.html', search: '?a=1', hash: '#x' }),
    { path: '/tools/tiers.html', search: '?a=1', hash: '#x', href: '/tools/tiers.html?a=1#x' });
  router.startRouter({ url: '/tools/tiers.html', kind: 'page', title: 'Tiers' });
  assert.deepEqual(seen.pop(), { kind: 'page', url: '/tools/tiers.html', hash: '', from: null, was: '', pop: false });
});

test('relative references resolve against the final URL after a trailing-slash redirect', async () => {
  const img = el({ src: 'cline-1.png' });
  site.set('/posts/cline', { url: 'https://example.org/posts/cline/', doc: doc('Cline', { main: main('reader', 'Cline', [img]) }) });
  await router.go('/posts/cline');
  assert.equal(img.attrs.src, '/posts/cline/cline-1.png');
  const s = seen.pop();
  assert.equal(s.url, '/posts/cline/');
  assert.equal(pushed.at(-1), '/posts/cline/', 'history records where the page really is');
});

test('an alias stub routes to its target in place, keeping the stub out of history', async () => {
  site.set('/old/wm/', { url: 'https://example.org/old/wm/', doc: doc('', { canonical: 'https://prod.example.net/2026/07/wm/' }) });
  site.set('/2026/07/wm/', { url: 'https://example.org/2026/07/wm/', doc: doc('WM', { main: main('reader', 'WM') }) });
  await router.go('/old/wm/#tiling');
  const s = seen.pop();
  assert.equal(s.url, '/2026/07/wm/');
  assert.equal(s.hash, 'tiling');
  assert.equal(pushed.at(-1), '/2026/07/wm/#tiling');
  assert.ok(!pushed.includes('/old/wm/#tiling'));
  assert.deepEqual(assigned, [], 'no full page load');
});

test('redirectTarget falls back to the meta refresh and ignores pages without either', () => {
  assert.equal(router.redirectTarget(doc('', { refresh: '0; url=https://example.org/a/b/' }), 'https://x.test/'), '/a/b/');
  assert.equal(router.redirectTarget(doc('', { refresh: "0;URL='/c/'" }), 'https://x.test/'), '/c/');
  assert.equal(router.redirectTarget(doc(''), 'https://x.test/'), null);
});

test('Back asks every onPop hook in order and stops routing at the first that handles it', async () => {
  const calls = [];
  router.onPop(key => { calls.push(['first', key]); return false; });
  router.onPop(key => { calls.push(['second', key]); return key === '/posts/cline/'; });
  const before = seen.length;
  cur = new URL('https://example.org/posts/cline/');
  await popstate({ state: { idx: 1 } });
  assert.deepEqual(calls, [['first', '/posts/cline/'], ['second', '/posts/cline/']]);
  assert.equal(seen.length, before, 'a handled pop does not route');
  assert.equal(reloads, 0);
});

test('a cached page shown again gets fresh nodes rather than the ones already placed', () => {
  const a = el({}), m = main('page', 'P', [a]);
  m.cloneNode = () => ({ cloneNode: () => ({ childNodes: ['copy'] }) });
  const p = router.pageFromMain(m, 'https://example.org/p/', 'P');
  assert.deepEqual(p.content(), [a], 'first mount moves the original nodes');
  assert.deepEqual(p.content(), ['copy']);
});

router.register('tool', (page, opts) => seen.push({ kind: 'tool', url: page.url, page, ...opts }));

test('a standalone HTML file opens framed in a tool window, titled from the file, without leaving the shell', async () => {
  site.set('/tiers.html', { url: 'https://example.org/tiers.html', doc: doc(' LLM tiers ') });
  const n = pushed.length;
  await router.go('/tiers.html');
  const s = seen.pop();
  assert.equal(s.kind, 'tool');
  assert.equal(s.page.frame, '/tiers.html');
  assert.equal(s.page.title, 'LLM tiers');
  assert.equal(pushed.length, n, 'reloading a file address would replace the site, so it stays out of history');
  assert.deepEqual(assigned, []);
});

test('a file with a tool page opens that page, found in the build-time map rather than by fetching', async () => {
  router.useFrames({ '/ai/index.html': '/tools/ai/' });
  site.set('/tools/ai/', { url: 'https://example.org/tools/ai/', doc: doc('AI', { main: main('tool', 'AI use') }) });
  await router.go('/ai/');
  const s = seen.pop();
  assert.equal(s.kind, 'tool');
  assert.equal(s.url, '/tools/ai/');
  assert.equal(pushed.at(-1), '/tools/ai/');
  assert.ok(!site.has('/ai/'), 'the file itself was never needed');
});

test('an onPop hook registered with first is asked before those already registered', async () => {
  const calls = [];
  router.onPop(() => { calls.push('home'); return true; }, { first: true });
  cur = new URL('https://example.org/somewhere/');
  await popstate({ state: { idx: 2 } });
  assert.deepEqual(calls, ['home']);
});
