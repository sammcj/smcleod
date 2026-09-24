// Terminal app (lazy/terminal.js): its site tree, path handling, command line parsing and Tab completion
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSite, listDir, resolvePath, entryAt, lookup, tokenise, complete, grep, suggest, COMMANDS,
} from '../assets/js/deskbar/lazy/terminal.js';
import { SAVERS } from '../assets/js/deskbar/lazy/screensaver.js';

const site = parseSite({
  sectionURL: '/posts/',
  taxonomyURLs: { tags: '/tags/', categories: '/categories/' },
  posts: [
    { title: 'Window managers', url: '/2026/07/window-managers/', date: '2026-07-04', tags: ['linux', 'desktop'], categories: ['tech'], description: 'Tiling and stacking' },
    { title: 'Static sites', url: '/2026/05/static-sites/', date: '2026-05-18', tags: ['web'], categories: ['tech'] },
    { title: 'Small JavaScript', url: '/2025/11/small-javascript/', date: '2025-11-02', tags: ['web', 'javascript'] },
    { title: 'Haiku notes', url: '/2024/03/haiku-notes/', date: '2024-03-09', tags: ['desktop'] },
    { title: 'no url' },
    { url: '/no-title/' },
  ],
  pages: [{ title: 'About', url: '/about/' }, { title: 'Contact', url: '/contact/' }],
  taxonomies: {
    tags: [{ name: 'web', url: '/tags/web/', count: 2 }, { name: 'desktop', url: '/tags/desktop/', count: 2 }, { name: 'linux', url: '/tags/linux/', count: 1 }, { name: 'javascript', url: '/tags/javascript/', count: 1 }],
    categories: [{ name: 'tech', url: '/blog/category/tech/', count: 2 }],
  },
});

test('the index parses defensively, newest post first, each with its slug', () => {
  assert.equal(site.posts.length, 4);
  assert.deepEqual(site.posts.map(p => p.slug), ['window-managers', 'static-sites', 'small-javascript', 'haiku-notes']);
  assert.equal(site.categories[0].slug, 'tech', 'term directories are named by their URL slug');
  assert.deepEqual(parseSite(null), { posts: [], pages: [], tags: [], categories: [], urls: { posts: '/posts/', tags: '', categories: '' } });
});

test('the tree lists posts by year, tags, categories and pages', () => {
  assert.deepEqual(listDir(site, []).map(e => e.name), ['posts', 'tags', 'categories', 'pages']);
  assert.deepEqual(listDir(site, ['posts']).map(e => [e.name, e.count]), [['2026', 2], ['2025', 1], ['2024', 1]]);
  assert.deepEqual(listDir(site, ['posts', '2026']).map(e => e.name), ['window-managers', 'static-sites']);
  assert.equal(listDir(site, ['posts', '2026'])[0].url, '/2026/07/window-managers/');
  assert.deepEqual(listDir(site, ['tags', 'desktop']).map(e => e.name), ['window-managers', 'haiku-notes']);
  assert.deepEqual(listDir(site, ['categories', 'tech']).map(e => e.name), ['window-managers', 'static-sites']);
  assert.deepEqual(listDir(site, ['pages']).map(e => e.name), ['about', 'contact']);
  for (const bad of [['nope'], ['posts', '1999'], ['tags', 'nope'], ['posts', '2026', 'static-sites'], ['pages', 'about']]) {
    assert.equal(listDir(site, bad), null, bad.join('/'));
  }
});

test('paths resolve like a shell: relative, .., / and ~', () => {
  assert.deepEqual(resolvePath(['posts'], '2026'), ['posts', '2026']);
  assert.deepEqual(resolvePath(['posts', '2026'], '..'), ['posts']);
  assert.deepEqual(resolvePath(['posts', '2026'], '../../tags/web/'), ['tags', 'web']);
  assert.deepEqual(resolvePath(['posts'], '/pages'), ['pages']);
  assert.deepEqual(resolvePath(['posts'], '~'), []);
  assert.deepEqual(resolvePath(['posts'], '~/tags'), ['tags']);
  assert.deepEqual(resolvePath([], '../..'), []);
  assert.deepEqual(resolvePath(['tags'], './web'), ['tags', 'web']);
  assert.equal(entryAt(site, ['tags', 'web']).url, '/tags/web/');
  assert.equal(entryAt(site, ['posts', '2024', 'haiku-notes']).url, '/2024/03/haiku-notes/');
  assert.equal(entryAt(site, ['posts', '2024', 'nope']), null);
});

test('cat and open find a path, else a slug: exact, then prefix, then part', () => {
  assert.deepEqual(lookup(site, ['posts', '2025'], 'small-javascript').map(e => e.url), ['/2025/11/small-javascript/']);
  assert.deepEqual(lookup(site, [], 'haiku-notes').map(e => e.url), ['/2024/03/haiku-notes/'], 'found from anywhere');
  assert.deepEqual(lookup(site, [], 'static').map(e => e.name), ['static-sites']);
  assert.deepEqual(lookup(site, [], 'about').map(e => e.url), ['/about/'], 'pages too');
  assert.deepEqual(lookup(site, [], 'S').map(e => e.name).sort(), ['small-javascript', 'static-sites'], 'ambiguous prefix lists both');
  assert.deepEqual(lookup(site, [], 'managers').map(e => e.name), ['window-managers']);
  assert.equal(lookup(site, [], 'tags')[0].dir, true, 'a directory by path');
  assert.deepEqual(lookup(site, [], 'nothing-like-it'), []);
  assert.deepEqual(lookup(site, [], 'posts/nothing'), [], 'a path is not also searched by slug');
});

test('command lines split on white space, with quotes and backslashes keeping words together', () => {
  assert.deepEqual(tokenise('  ls   -l  posts '), ['ls', '-l', 'posts']);
  assert.deepEqual(tokenise('grep "local llm" fast'), ['grep', 'local llm', 'fast']);
  assert.deepEqual(tokenise("echo 'it''s' ok"), ['echo', 'its', 'ok']);
  assert.deepEqual(tokenise('echo a\\ b'), ['echo', 'a b']);
  assert.deepEqual(tokenise('echo ""'), ['echo', '']);
  assert.deepEqual(tokenise('echo "unclosed words'), ['echo', 'unclosed words']);
  assert.deepEqual(tokenise(''), []);
});

test('Tab completes a command name, or lists the candidates after their common prefix', () => {
  assert.deepEqual(complete('gr', site, []), { line: 'grep ', options: [] });
  assert.deepEqual(complete('neo', site, []), { line: 'neofetch ', options: [] });
  const c = complete('c', site, []);
  assert.equal(c.line, 'c');
  assert.deepEqual(c.options.sort(), ['cat', 'cd', 'clear']);
  assert.deepEqual(complete('he', site, []).line, 'help ');
  assert.deepEqual(complete('su', site, []), { line: 'su', options: [] }, 'hidden commands are not offered');
  assert.deepEqual(complete('man hi', site, []).line, 'man history ');
  assert.deepEqual(complete('theme d', site, []).line, 'theme dark ');
  assert.deepEqual(complete('echo x', site, []), { line: 'echo x', options: [] }, 'no completion for free text');
});

test('Tab completes paths: directories get a slash, cd offers only directories', () => {
  assert.deepEqual(complete('ls p', site, []), { line: 'ls p', options: ['posts/', 'pages/'] });
  assert.deepEqual(complete('ls po', site, []).line, 'ls posts/');
  assert.deepEqual(complete('ls posts/2', site, []).line, 'ls posts/202');
  assert.deepEqual(complete('ls posts/2', site, []).options, ['2026/', '2025/', '2024/'], 'shown without the directory part');
  assert.deepEqual(complete('cd ../t', site, ['posts']).line, 'cd ../tags/');
  assert.deepEqual(complete('cat /posts/2024/h', site, []).line, 'cat /posts/2024/haiku-notes ');
  assert.deepEqual(complete('cd /posts/2024/', site, []), { line: 'cd /posts/2024/', options: [] }, 'no files for cd');
  assert.deepEqual(complete('cat smal', site, []).line, 'cat small-javascript ', 'a post by name from anywhere');
  assert.deepEqual(complete('open co', site, ['pages']).line, 'open contact ');
  assert.deepEqual(complete('ls nope/', site, []), { line: 'ls nope/', options: [] });
});

test('grep needs every word, ranks title matches first, then newest, ignoring case and accents', () => {
  const entries = [
    { title: 'Notes', url: '/a/', date: '2026-01-01', body: 'about haiku and beos' },
    { title: 'Haiku on the desktop', url: '/b/', date: '2020-01-01', body: 'beos' },
    { title: 'Résumé', url: '/c/', date: '2021-01-01', tags: ['cv'] },
    { title: 'Unrelated', url: '/d/', date: '2026-02-01', body: 'haiku only' },
  ];
  assert.deepEqual(grep(entries, 'haiku BeOS').map(e => e.url), ['/b/', '/a/']);
  assert.deepEqual(grep(entries, 'resume').map(e => e.url), ['/c/']);
  assert.deepEqual(grep(entries, 'cv').map(e => e.url), ['/c/'], 'tags are searched');
  assert.deepEqual(grep(entries, '   '), []);
});

test('a mistyped command suggests the closest one, and only when it is close', () => {
  assert.equal(suggest('gerp'), 'grep');
  assert.equal(suggest('sl'), 'ls');
  assert.equal(suggest('hlep'), 'help');
  assert.equal(suggest('xyzzy'), '');
  assert.equal(suggest('sudo'), '', 'hidden commands are never suggested');
});

test('screensaver takes the name of a saver, and Tab completes it', () => {
  assert.deepEqual(COMMANDS.screensaver[2], SAVERS);
  assert.deepEqual(complete('screensaver sh', site, []).line, 'screensaver sheep ');
});

test('every command has usage and a summary', () => {
  for (const [name, [args, about]] of Object.entries(COMMANDS)) {
    assert.equal(typeof args, 'string', name);
    assert.ok(about.length > 5, name);
  }
});
