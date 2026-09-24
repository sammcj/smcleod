// Context menu trigger (context-menu-trigger.js) and the lazy menu's pure parts, sharing and Copy as markdown
// (lazy/context-menu.js), with the browser APIs they use stubbed
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const el = () => ({
  children: [], classList: { set: new Set(), add(c) { this.set.add(c); }, remove(c) { this.set.delete(c); } },
  setAttribute(k, v) { this[k] = v; }, addEventListener() {}, append(...k) { this.children.push(...k); },
  appendChild(k) { this.children.push(k); return k; },
});
globalThis.document = { createElement: el, body: el() };
globalThis.location = { href: 'https://example.org/2024/01/a-post/', origin: 'https://example.org' };
const setNavigator = nav => Object.defineProperty(globalThis, 'navigator', { value: nav, configurable: true, writable: true });

const { ownsMenu } = await import('../assets/js/deskbar/context-menu-trigger.js');
const { tidy, position, share, copyLink, copyMarkdown } = await import('../assets/js/deskbar/lazy/context-menu.js');

// A stand-in element: matches holds the selectors that closest() finds it inside
const target = (...inside) => ({ closest: sel => (sel.split(',').some(s => inside.includes(s.trim())) ? {} : null) });

test('the shell menu covers the desktop but leaves post text, fields and dialogs to the browser', () => {
  assert.ok(ownsMenu(target('.wm body')), 'desktop');
  assert.ok(ownsMenu(target('.wm body', '.ctx')), 'the menu itself, so the browser menu never covers it');
  for (const inner of ['.rd', 'input', 'textarea', '[contenteditable]', 'dialog', '[role=dialog]']) assert.ok(!ownsMenu(target('.wm body', inner)), inner);
  assert.ok(!ownsMenu(target()), 'before the shell starts, or after it fails');
  assert.ok(!ownsMenu(null));
  assert.ok(!ownsMenu({}), 'a non-element target');
});

test('tidy drops left-out items and stray separators', () => {
  const a = { label: 'a' }, b = { label: 'b' };
  assert.deepEqual(tidy(['-', a, false, '-', '-', null, b, '-']), [a, '-', b]);
  assert.deepEqual(tidy([false, '-', undefined]), []);
});

test('position opens beside the pointer, flips at the edges, and uses the target for the keyboard', () => {
  const r = { left: 100, top: 50, width: 200, height: 24, bottom: 74 };
  assert.deepEqual(position({ clientX: 300, clientY: 200 }, r, 180, 120, 1000, 800), { x: 302, y: 202 });
  assert.deepEqual(position({ clientX: 950, clientY: 750 }, r, 180, 120, 1000, 800), { x: 772, y: 632 }, 'flipped left and up');
  assert.deepEqual(position(null, r, 180, 120, 1000, 800), { x: 116, y: 74 }, 'keyboard: below a tab');
  assert.deepEqual(position(null, { left: 0, top: 0, width: 1000, height: 800, bottom: 800 }, 180, 120, 1000, 800), { x: 16, y: 32 }, 'keyboard: the page');
  assert.deepEqual(position({ clientX: 0, clientY: 0 }, r, 180, 120, 1000, 800), { x: 116, y: 74 }, 'a keyboard contextmenu event has no position');
  assert.deepEqual(position({ clientX: 10, clientY: 10 }, r, 1200, 900, 1000, 800), { x: 4, y: 4 }, 'larger than the screen');
});

let written;
const clipboard = { writeText: async t => { written = t; } };
beforeEach(() => {
  written = undefined;
  delete globalThis.ClipboardItem;
});

test('share uses Web Share when there is one, and a dismissed share sheet copies nothing', async () => {
  const calls = [];
  setNavigator({ clipboard, share: async d => { calls.push(d); } });
  await share('A post', '/2024/01/a-post/');
  assert.deepEqual(calls, [{ title: 'A post', url: 'https://example.org/2024/01/a-post/' }]);
  setNavigator({ clipboard, share: async () => { throw Object.assign(new Error('cancelled'), { name: 'AbortError' }); } });
  await share('A post', '/x/');
  assert.equal(written, undefined);
});

test('without Web Share, or when it fails, sharing copies the link and says so', async () => {
  setNavigator({ clipboard });
  await share('A post', '/2024/01/a-post/#heading');
  assert.equal(written, 'https://example.org/2024/01/a-post/#heading');
  setNavigator({ clipboard, share: async () => { throw Object.assign(new Error('no'), { name: 'NotAllowedError' }); } });
  await share('A post', '/other/');
  assert.equal(written, 'https://example.org/other/');
  await new Promise(r => setTimeout(r, 80));
  const note = document.body.children.find(c => c.className === 'ctx-note');
  assert.equal(note.textContent, 'Link copied');
  assert.ok(note.classList.set.has('on'), 'shown');
  assert.equal(note.role, 'status');
});

test('Copy as markdown fetches the page\'s markdown into a ClipboardItem, so Safari keeps the press', async () => {
  const items = [];
  globalThis.ClipboardItem = class { constructor(data) { this.data = data; } };
  setNavigator({ clipboard: { ...clipboard, write: async list => { items.push(...list); } } });
  const fetched = [];
  globalThis.fetch = async u => { fetched.push(u); return { ok: true, text: async () => '# A post\n\nBody' }; };
  const view = { el: { querySelector: s => (s === '.rd[data-md]' ? { dataset: { md: '/2024/01/a-post/index.md' } } : null) } };
  await copyMarkdown(view);
  assert.deepEqual(fetched, ['/2024/01/a-post/index.md']);
  assert.equal(items.length, 1);
  const blob = await items[0].data['text/plain'];
  assert.equal(blob.type, 'text/plain');
  assert.equal(await blob.text(), '# A post\n\nBody');
  assert.equal(document.body.children.find(c => c.className === 'ctx-note').textContent, 'Markdown copied');

  // a page without markdown has nothing to copy
  assert.equal(copyMarkdown({ el: { querySelector: () => null } }), undefined);
});

test('a failed copy says so rather than claiming success', async () => {
  globalThis.fetch = async () => ({ ok: false, status: 404 });
  setNavigator({ clipboard });
  const errors = [], orig = console.error;
  console.error = e => errors.push(e);
  try {
    await copyMarkdown({ el: { querySelector: () => ({ dataset: { md: '/gone/index.md' } }) } });
    assert.equal(document.body.children.find(c => c.className === 'ctx-note').textContent, "Couldn't copy the markdown");
    // a link the clipboard refuses is shown to copy by hand
    const prompted = [];
    globalThis.prompt = (...a) => prompted.push(a);
    setNavigator({});
    await copyLink('/x/');
    assert.deepEqual(prompted, [['Copy this link', 'https://example.org/x/']]);
  } finally {
    console.error = orig;
    delete globalThis.prompt;
  }
  assert.equal(errors.length, 2);
});
