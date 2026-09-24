import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIndex, filterPosts } from '../assets/js/deskbar/index-data.js';

const raw = {
  posts: [
    { title: 'Tabs', url: '/2024/03/tabs/', date: '2024-03-09', categories: ['Engineering', 'Retro'] },
    { title: 'Windows', url: '/2026/07/windows/', date: '2026-07-04', categories: ['Engineering', 7] },
    { title: 'Plain', url: '/2025/01/plain/', date: '2025-01-01' },
  ],
  taxonomies: { categories: [{ name: 'Engineering', url: '/blog/category/engineering/', count: 2 }, { name: 'Retro', url: '/blog/category/retro/', count: 1 }] },
  taxonomyURLs: { categories: '/categories/', tags: '/tags/', bad: 3 },
};

test('categories are parsed like tags, and each taxonomy keeps its own list page URL', () => {
  const d = parseIndex(raw);
  assert.deepEqual(d.posts.map(p => p.categories), [['Engineering'], [], ['Engineering', 'Retro']]);
  assert.deepEqual(d.categories.map(c => c.url), ['/blog/category/engineering/', '/blog/category/retro/']);
  assert.deepEqual(d.taxURLs, { categories: '/categories/', tags: '/tags/' }, 'term pages need not sit under the list page');
  assert.deepEqual(parseIndex({}).taxURLs, {});
});

test('a category term place lists its posts, newest first', () => {
  const d = parseIndex(raw);
  assert.deepEqual(filterPosts(d.posts, 'categories:Engineering').map(p => p.title), ['Windows', 'Tabs']);
  assert.deepEqual(filterPosts(d.posts, 'categories:Retro').map(p => p.title), ['Tabs']);
});

test('frames map standalone tool files to the tool pages that embed them, dropping junk', () => {
  const d = parseIndex({ frames: { '/tiers.html': '/tools/tiers/', '/x.html': 7, '/y.html': '' } });
  assert.deepEqual(d.frames, { '/tiers.html': '/tools/tiers/' });
  assert.deepEqual(parseIndex({ frames: 'nope' }).frames, {});
  assert.deepEqual(parseIndex(null).frames, {});
});
