// Spotlight (D28): full-text ranking, grouping, snippets and the shortcut rules
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rank, searchPosts } from '../assets/js/deskbar/search.js';
import { parseSiteIndex, searchSite, snippet, marks } from '../assets/js/deskbar/site-search.js';
import { shortcut, isTyping } from '../assets/js/deskbar/spotlight-trigger.js';

const e = (title, extra = {}) => ({ title, url: '/' + title.toLowerCase().replace(/\W+/g, '-') + '/', kind: 'post', ...extra });
const entries = parseSiteIndex({
  version: 1,
  entries: [
    e('Kubernetes on a budget', { date: '2020-01-01', tags: ['k8s'], body: 'Running clusters cheaply with spot instances.' }),
    e('Homelab notes', { date: '2024-01-01', tags: ['kubernetes'], body: 'Networking for the rack.' }),
    e('Storage tiers', { date: '2023-01-01', series: ['Kubernetes at home'], body: 'Ceph and ZFS.' }),
    e('Quiet fans', { date: '2025-01-01', description: 'Kubernetes nodes that do not roar', body: 'Noctua everywhere.' }),
    e('Old rant', { date: '2026-01-01', body: 'Years ago I moved everything to Kubernetes and regretted it. Also mentions wasm.' }),
    e('Unrelated', { date: '2026-02-01', body: 'Nothing about orchestration, only minikubes-style words inside other words: akubernetes.' }),
    e('Tier List Creator', { kind: 'tool', description: 'Drag items into tiers', body: '' }),
    e('About', { kind: 'page', body: 'Sam lives in Melbourne and writes about Kubernetes sometimes.' }),
    e('Holiday', { kind: 'photo', url: '/photos/?album=holiday', count: 12, thumb: '/t.jpg' }),
    e('kubernetes', { kind: 'tag', url: '/tags/kubernetes/', count: 9 }),
    e('Kubernetes at home', { kind: 'series', url: '/series/kubernetes-at-home/', count: 3 }),
    { title: '', url: '/bad/' }, { url: '/no-title/' }, { title: 'No url' }, null,
    e('Odd kind', { kind: 'bogus' }),
  ],
});
const titles = r => r.map(x => x.title);

test('the index parser drops unusable entries and defaults unknown kinds to page', () => {
  assert.equal(entries.length, 12);
  assert.equal(entries.find(x => x.title === 'Odd kind').kind, 'page');
  assert.deepEqual(parseSiteIndex(null), []);
  assert.deepEqual(parseSiteIndex({ entries: 'nope' }), []);
});

test('title beats tags beats series beats description beats body', () => {
  const posts = entries.filter(x => x.kind === 'post');
  assert.deepEqual(titles(searchPosts(posts, 'kubernetes')),
    ['Kubernetes on a budget', 'Homelab notes', 'Storage tiers', 'Quiet fans', 'Old rant']);
});

test('body text alone finds a page, but only where a word starts with the term', () => {
  assert.deepEqual(titles(searchPosts(entries, 'regretted')), ['Old rant']);
  assert.deepEqual(titles(searchPosts(entries, 'regret')), ['Old rant'], 'prefix of a body word');
  assert.deepEqual(searchPosts(entries, 'egretted'), [], 'not from the middle of a word');
  assert.ok(!titles(searchPosts(entries, 'kubernetes')).includes('Unrelated'), '"akubernetes" is not a match');
});

test('every term must match, across fields including the body', () => {
  assert.deepEqual(titles(searchPosts(entries, 'kubernetes wasm')), ['Old rant']);
  assert.deepEqual(titles(searchPosts(entries, 'budget spot')), ['Kubernetes on a budget'], 'title term plus body term');
  assert.deepEqual(searchPosts(entries, 'kubernetes nonsenseword'), []);
});

test('rank returns scores, best first, with a body-only hit scoring lowest', () => {
  const r = rank(entries, 'kubernetes');
  for (let i = 1; i < r.length; i++) assert.ok(r[i - 1][1] >= r[i][1]);
  const score = t => r.find(x => x[0].title === t)[1];
  assert.ok(score('Quiet fans') > score('Old rant'));
  assert.equal(score('Old rant'), 1);
});

test('searchSite groups results by kind and puts the group with the best hit first', () => {
  const g = searchSite(entries, 'kubernetes');
  assert.deepEqual(g.map(x => x.kind), ['post', 'tag', 'page']);
  assert.deepEqual(titles(g[1].items), ['kubernetes', 'Kubernetes at home'], 'series share the tags group');
  assert.equal(g[1].label, 'Tags and series');
  assert.deepEqual(searchSite(entries, 'tier').map(x => x.kind)[0], 'tool', 'a tool title beats a post title word-part');
  assert.deepEqual(titles(searchSite(entries, 'holiday')[0].items), ['Holiday']);
  assert.deepEqual(searchSite(entries, '  '), []);
});

test('groups are capped', () => {
  const many = parseSiteIndex({ entries: Array.from({ length: 30 }, (_, i) => e('Post ' + i, { date: `2020-01-${String(i + 1).padStart(2, '0')}` })) });
  assert.equal(searchSite(many, 'post')[0].items.length, 8);
});

test('snippets show the body around a body-only match, else the description', () => {
  const rant = entries.find(x => x.title === 'Old rant');
  assert.equal(snippet(rant, 'wasm'), '...it. Also mentions wasm.', 'starts on a word boundary about 20 characters back');
  assert.equal(snippet(rant, 'old'), '', 'a title match needs no snippet (no description)');
  const fans = entries.find(x => x.title === 'Quiet fans');
  assert.equal(snippet(fans, 'kubernetes'), 'Kubernetes nodes that do not roar');
  const long = { title: 'x', description: '', body: 'word '.repeat(100) + 'needle ' + 'tail '.repeat(100) };
  const s = snippet(long, 'needle');
  assert.ok(s.startsWith('...') && s.endsWith('...') && s.includes('needle'));
  assert.ok(s.length <= 146);
  const ellipses = { title: 'x', description: '', body: 'Wait… '.repeat(15) + 'here is the zebra and more text follows' };
  assert.ok(snippet(ellipses, 'zebra').includes('zebra'), 'typographic ellipses do not shift the slice');
  const url = { title: 'x', description: '', body: 'see https://example.com/a/very/long/path/zebra-docs/index.html for details.' };
  assert.ok(snippet(url, 'zebra').includes('zebra'), 'a match inside a long token stays in the slice');
});

test('marks finds every term, case-insensitively, merging overlaps', () => {
  assert.deepEqual(marks('Kubernetes on kube', 'kube'), [[0, 4], [14, 18]]);
  assert.deepEqual(marks('abcdef', 'abc bcd'), [[0, 4]]);
  assert.deepEqual(marks('nothing', 'zzz'), []);
});

test('shortcuts: Cmd/Ctrl+K and a bare slash, nothing else', () => {
  const k = (key, mods = {}) => shortcut({ key, ...mods });
  assert.equal(k('k', { metaKey: true }), 'k');
  assert.equal(k('K', { ctrlKey: true }), 'k');
  assert.equal(k('/'), '/');
  assert.equal(k('k'), '');
  assert.equal(k('/', { ctrlKey: true }), '');
  assert.equal(k('k', { metaKey: true, altKey: true }), '');
  assert.equal(k('k', { metaKey: true, shiftKey: true }), '');
  assert.equal(k('k', { metaKey: true, isComposing: true }), '');
  assert.equal(k('/', { defaultPrevented: true }), '');
});

test('isTyping: fields and editable content, not buttons or the page', () => {
  const el = (sel, extra = {}) => ({ closest: s => (s.split(', ').some(x => x.startsWith(sel)) ? {} : null), ...extra });
  assert.ok(isTyping(el('input')));
  assert.ok(isTyping(el('textarea')));
  assert.ok(isTyping({ isContentEditable: true, closest: () => null }));
  assert.ok(!isTyping({ isContentEditable: false, closest: () => null }));
  assert.ok(!isTyping(null));
});
