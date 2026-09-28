import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIndex, filterPosts } from '../assets/js/deskbar/lib/index-data.js';

const raw = {
  version: 1,
  sectionURL: '/posts/',
  posts: [
    { title: 'Older', url: '/2024/01/older/', date: '2024-01-05', tags: ['design'], series: [], description: 'Tabs', cover: '', images: 0, readingTime: 2, words: 300 },
    { title: 'Newest', url: '/2026/07/newest/', date: '2026-07-04', tags: ['web', 'design'], series: ['Deskbar'], description: 'Windows', cover: '/c.jpg', mini: '/deskbar/art/m.svg', images: 3, readingTime: 5, words: 1200 },
    { title: 'No date', url: '/x/', date: 'not a date', tags: 'web' },
    { title: 42, url: '/bad/' },
    { url: '/missing-title/' },
    null,
  ],
  pages: [{ title: 'About', url: '/about/', icon: 'person' }, { title: 'No URL' }],
  taxonomies: { tags: [{ name: 'design', url: '/tags/design/', count: 2 }, { name: 'web' }], series: [{ name: 'Deskbar', url: '/series/deskbar/', count: 1 }] },
};

test('parseIndex keeps valid entries, sorts newest first and fills defaults', () => {
  const d = parseIndex(raw);
  assert.deepEqual(d.posts.map(p => p.title), ['Newest', 'Older', 'No date']);
  const bad = d.posts[2];
  assert.equal(bad.date, '');
  assert.equal(bad.year, '');
  assert.deepEqual(bad.tags, [], 'a string where an array belongs is dropped');
  assert.equal(bad.images, 0);
  assert.equal(d.posts[0].year, '2026');
  assert.equal(d.posts[0].images, 3);
  assert.equal(d.posts[0].mini, '/deskbar/art/m.svg');
  assert.equal(bad.mini, '', 'a missing mini icon is an empty string');
  assert.deepEqual(d.pages, [{ title: 'About', url: '/about/', icon: 'person' }]);
  assert.deepEqual(d.tags.map(t => t.name), ['design']);
  assert.equal(d.series[0].count, 1);
  assert.equal(d.sectionURL, '/posts/');
});

test('parseIndex survives junk input', () => {
  for (const junk of [null, undefined, 'nope', 42, { posts: 'x', taxonomies: { tags: {} } }]) {
    const d = parseIndex(junk);
    assert.deepEqual(d.posts, []);
    assert.deepEqual(d.tags, []);
    assert.equal(d.sectionURL, '/posts/');
  }
});

test('filterPosts handles all, years and taxonomy terms', () => {
  const { posts } = parseIndex(raw);
  assert.equal(filterPosts(posts, 'all').length, 3);
  assert.deepEqual(filterPosts(posts, 'y:2024').map(p => p.title), ['Older']);
  assert.deepEqual(filterPosts(posts, 'tags:design').map(p => p.title), ['Newest', 'Older']);
  assert.deepEqual(filterPosts(posts, 'series:Deskbar').map(p => p.title), ['Newest']);
  assert.deepEqual(filterPosts(posts, 'tags:nothing'), []);
  assert.deepEqual(filterPosts(posts, 'pages'), []);
});

const withCategories = {
  posts: [
    { title: 'Tabs', url: '/2024/03/tabs/', date: '2024-03-09', categories: ['Engineering', 'Retro'] },
    { title: 'Windows', url: '/2026/07/windows/', date: '2026-07-04', categories: ['Engineering', 7] },
    { title: 'Plain', url: '/2025/01/plain/', date: '2025-01-01' },
  ],
  taxonomies: { categories: [{ name: 'Engineering', url: '/blog/category/engineering/', count: 2 }, { name: 'Retro', url: '/blog/category/retro/', count: 1 }] },
  taxonomyURLs: { categories: '/categories/', tags: '/tags/', bad: 3 },
};

test('categories are parsed like tags, and each taxonomy keeps its own list page URL', () => {
  const d = parseIndex(withCategories);
  assert.deepEqual(d.posts.map(p => p.categories), [['Engineering'], [], ['Engineering', 'Retro']]);
  assert.deepEqual(d.categories.map(c => c.url), ['/blog/category/engineering/', '/blog/category/retro/']);
  assert.deepEqual(d.taxURLs, { categories: '/categories/', tags: '/tags/' }, 'term pages need not sit under the list page');
  assert.deepEqual(parseIndex({}).taxURLs, {});
});

test('a category term place lists its posts, newest first', () => {
  const d = parseIndex(withCategories);
  assert.deepEqual(filterPosts(d.posts, 'categories:Engineering').map(p => p.title), ['Windows', 'Tabs']);
  assert.deepEqual(filterPosts(d.posts, 'categories:Retro').map(p => p.title), ['Tabs']);
});

test('frames map standalone tool files to the tool pages that embed them, dropping junk', () => {
  const d = parseIndex({ frames: { '/tiers.html': '/tools/tiers/', '/x.html': 7, '/y.html': '' } });
  assert.deepEqual(d.frames, { '/tiers.html': '/tools/tiers/' });
  assert.deepEqual(parseIndex({ frames: 'nope' }).frames, {});
  assert.deepEqual(parseIndex(null).frames, {});
});
