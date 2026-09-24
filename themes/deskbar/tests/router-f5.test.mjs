// Router edge cases against a fake browser: malformed hashes, failed start-up, late failures and hinted routes.
import { test } from 'node:test';
import assert from 'node:assert/strict';

let cur = new URL('https://example.org/post/#100%');
const assigned = [], pushed = [], listeners = [];
let reloads = 0;
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
globalThis.document = {
  title: 'start',
  addEventListener(type, fn) { listeners.push(['document', type, fn]); },
  removeEventListener(type, fn) { listeners.splice(listeners.findIndex(l => l[2] === fn), 1); },
};
globalThis.addEventListener = (type, fn) => listeners.push(['window', type, fn]);
globalThis.removeEventListener = (type, fn) => listeners.splice(listeners.findIndex(l => l[2] === fn), 1);
const popstate = e => listeners.find(l => l[1] === 'popstate')[2](e);

// fetch answers per key: a function returning a promise, so a test can hold or fail a response
const answers = new Map();
globalThis.fetch = key => (answers.get(key) || (() => Promise.reject(new Error('offline'))))();
const page = title => ({
  ok: true, status: 200, url: 'https://example.org' + title, text: async () => title,
});
const docs = new Map();
globalThis.DOMParser = class { parseFromString(key) { return docs.get(key); } };
function serve(path, title) {
  answers.set(path, () => Promise.resolve(page(path)));
  const main = { isConnected: false, dataset: { window: 'page', title }, childNodes: [], querySelectorAll: () => [], cloneNode: () => ({ childNodes: [] }) };
  docs.set(path, { title: title + ' - Site', querySelector: sel => (sel === 'main#content' ? main : null) });
}
const later = (ms, fn) => new Promise((ok, no) => setTimeout(() => fn(ok, no), ms));

const router = await import('../assets/js/deskbar/router.js');
const seen = [];
let broken = true;
router.register('page', (p, opts) => { if (broken) throw new Error('boom'); seen.push({ url: p.url, ...opts }); });

test('safeDecode leaves a malformed escape as it is', () => {
  assert.equal(router.safeDecode('100%'), '100%');
  assert.equal(router.safeDecode('a%20b'), 'a b');
});

test('a failed first render leaves no router listeners behind', () => {
  assert.throws(() => router.startRouter({ url: '/post/', kind: 'page', title: 'Post' }));
  assert.deepEqual(listeners, [], 'links keep working as plain links');
});

test('a malformed % in the hash does not stop start-up', () => {
  broken = false;
  router.startRouter({ url: '/post/', kind: 'page', title: 'Post' });
  assert.equal(seen.pop().hash, '100%');
  assert.deepEqual(listeners.map(l => l[1]).sort(), ['click', 'popstate']);
});

test('stopRouter removes the listeners again', () => {
  router.stopRouter();
  assert.deepEqual(listeners, []);
  router.startRouter({ url: '/post/', kind: 'page', title: 'Post' });
  seen.length = 0;
});

test('a failed navigation that finishes after a newer one does not load the page in full', async () => {
  answers.set('/slow/', () => later(40, (_, no) => no(new Error('offline'))));
  serve('/fast/', 'Fast');
  const slow = router.go('/slow/');
  await router.go('/fast/');
  await slow;
  assert.deepEqual(assigned, []);
  assert.equal(seen.pop().url, '/fast/');
});

test('the newest failed navigation still falls back to a full load', async () => {
  await router.go('/gone/');
  assert.deepEqual(assigned, ['/gone/']);
  assigned.length = 0;
});

test('a failed Back that finishes after a newer navigation does not reload', async () => {
  cur = new URL('https://example.org/slow-back/');
  answers.set('/slow-back/', () => later(40, (_, no) => no(new Error('offline'))));
  const pop = popstate({ state: null });
  serve('/after/', 'After');
  await router.go('/after/');
  await pop;
  assert.equal(reloads, 0);
});

test('a hinted route to the address already shown adds no history and sets the title', async () => {
  const n = pushed.length;
  await router.go('/tags/ai/', { kind: 'page', title: 'ai', docTitle: 'Ai - Site' });
  assert.equal(pushed.length, n + 1);
  assert.equal(document.title, 'Ai - Site');
  await router.go('/tags/ai/', { kind: 'page', title: 'ai', docTitle: 'Ai - Site' });
  assert.equal(pushed.length, n + 1, 'the same place twice is one entry');
  assert.equal(seen.pop().url, '/tags/ai/', 'the hinted page is still shown');
});

test('push with a title updates the document title', () => {
  router.push('/photos/?album=a', 'Photos - Site');
  assert.equal(document.title, 'Photos - Site');
});
