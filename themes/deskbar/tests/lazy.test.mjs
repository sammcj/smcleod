// On-demand bundles (loader.js) and the About this desktop app built on them
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { loadLazy, lazyMount, loaded } from '../assets/js/deskbar/loader.js';
import { gzSize, shellFiles, kb } from '../assets/js/deskbar/lazy/about-desktop.js';

const js = src => 'data:text/javascript,' + encodeURIComponent(src);
const map = {
  demo: { js: js('export const mount = () => "mounted";'), css: '/demo.css' },
  broken: { js: js('export {'), css: '/broken.css' },
  // throws on its first mount, having built part of its view
  // a whole look (css/deskbar/looks/): a stylesheet and no script
  'look-demo': { css: '/look-demo.css' },
  flaky: { js: js('let n = 0; export const mount = (v, p, o) => { if (!n++) { v.el.append({ className: "half" }); throw new Error("boom"); } v.fresh = o.fresh; };') },
};
const sheets = [], styled = [];
globalThis.document = {
  getElementById: id => (id === 'deskbar-lazy' ? { textContent: JSON.stringify(map) } : null),
  createElement: tag => ({ tag, setAttribute(k, v) { this[k] = v; } }),
  head: { append: l => { sheets.push(l.href); setTimeout(() => { styled.push(l.href); l.onload(); }, 5); } },
};

test('a bundle loads once, with its stylesheet, before it resolves', async () => {
  const a = loadLazy('demo'), b = loadLazy('demo');
  assert.equal(a, b, 'one load for concurrent callers');
  assert.equal((await a).mount(), 'mounted');
  assert.ok(styled.includes('/demo.css'), 'stylesheet loaded first, so the app never shows unstyled');
  assert.equal(await loadLazy('demo'), await a);
  assert.deepEqual(sheets.filter(s => s === '/demo.css'), ['/demo.css']);
});

test('a stylesheet-only bundle (a look) resolves once its stylesheet has loaded', async () => {
  assert.equal(await loadLazy('look-demo'), undefined);
  assert.ok(styled.includes('/look-demo.css'));
});

test('an unknown name rejects, and a failed load is retried on the next call', async () => {
  await assert.rejects(loadLazy('nope'), /no lazy bundle named "nope"/);
  const first = loadLazy('broken');
  await assert.rejects(first);
  const second = loadLazy('broken');
  assert.notEqual(second, first, 'failure is not cached');
  await assert.rejects(second);
  assert.deepEqual(sheets.filter(s => s === '/broken.css'), ['/broken.css'], 'stylesheet added once across retries');
});

test('lazy modules import only lib/ helpers, never a shell module with state', () => {
  const dir = join(import.meta.dirname, '../assets/js/deskbar/lazy');
  const files = readdirSync(dir).filter(f => f.endsWith('.js'));
  assert.ok(files.length >= 1);
  for (const f of files) {
    const specs = [...readFileSync(join(dir, f), 'utf8').matchAll(/\bfrom\s+['"]([^'"]+)['"]|\bimport\s*\(?\s*['"]([^'"]+)['"]/g)].map(m => m[1] || m[2]);
    for (const s of specs) assert.match(s, /^\.\.\/lib\//, `${f} imports ${s}`);
  }
});

test('about-desktop measures gzipped size the way the budget script does', async () => {
  const text = 'deskbar '.repeat(500);
  const n = await gzSize('data:text/plain,' + encodeURIComponent(text));
  assert.ok(Math.abs(n - gzipSync(text).length) <= 8, `${n} vs ${gzipSync(text).length}`);
  assert.equal(kb(1536), '1.5KB');
});

test('about-desktop counts the shell script and stylesheet, plus Spotlight when the site has search', () => {
  const doc = btn => ({
    getElementById: id => (id === 'searchBtn' ? btn : null),
    querySelector: sel => (sel.startsWith('script') ? { src: '/js/deskbar.1.js' } : { href: '/css/deskbar.min.2.css' }),
  });
  assert.deepEqual(shellFiles(doc(null)), ['/js/deskbar.1.js', '/css/deskbar.min.2.css']);
  assert.deepEqual(shellFiles(doc({ dataset: { module: '/js/s.js', css: '/css/s.css' } })),
    ['/js/deskbar.1.js', '/css/deskbar.min.2.css', '/js/s.js', '/css/s.css']);
});

// Just enough of an element for lazyMount's loading and error notes
const el = tag => ({
  tag, kids: [], parent: null, isConnected: true,
  setAttribute(k, v) { this[k] = String(v); }, removeAttribute(k) { delete this[k]; },
  appendChild(c) { c.parent = this; this.kids.push(c); return c; },
  append(...cs) { for (const c of cs) this.appendChild(c); },
  replaceChildren(...cs) { this.kids = []; this.append(...cs); },
  remove() { if (this.parent) this.parent.kids = this.parent.kids.filter(k => k !== this); this.parent = null; },
  querySelector() { return this.kids.find(k => k.className === 'lazy-note') || null; },
});
globalThis.document.createElement = el;
const settle = () => new Promise(r => setTimeout(r, 50));

test('an app whose mount throws shows the error note, and mounts afresh when opened again', async () => {
  const mount = lazyMount('flaky'), v = { el: el('div') }, page = { title: 'Flaky', content: () => [] };
  const errs = [], log = console.error;
  console.error = e => errs.push(e.message);
  try {
    mount(v, page, {});
    await settle();
    assert.deepEqual(v.el.kids.map(k => k.className), ['lazy-note'], 'the half-built view is dropped for the note');
    assert.equal(v.el.kids[0].role, 'alert');
    assert.match(v.el.kids[0].textContent, /^Flaky didn't load/);
    assert.equal(v.el['aria-busy'], undefined);
    mount(v, page, {});
    await settle();
  } finally {
    console.error = log;
  }
  assert.equal(v.fresh, true, 'the retry is a fresh mount');
  assert.deepEqual(v.el.kids, [], 'note gone');
  assert.deepEqual(errs, ['boom']);
});

test('the loader lists the bundles it has resolved', async () => {
  await loadLazy('demo');
  await loadLazy('broken').catch(() => {});
  assert.ok(loaded().includes('demo'));
  assert.ok(!loaded().includes('broken'));
});
