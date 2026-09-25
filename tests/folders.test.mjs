// Data for the Applications (/links/) and Projects (/projects/) folders. Run: node --test 'tests/*.test.mjs'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const read = f => readFileSync(join(root, f), 'utf8');

test('pinned.jq turns the GraphQL response into folder items', () => {
  const repo = (name, stargazerCount, description, language) =>
    ({ name, url: `https://github.com/u/${name}`, description, stargazerCount, primaryLanguage: language ? { name: language } : null });
  const response = { data: { user: { pinnedItems: { nodes: [
    repo('a', 1836, 'First', 'Go'), repo('b', 1000, null, null), repo('c', 161, 'Third', 'Swift'),
  ] } } } };
  const out = JSON.parse(execFileSync('jq', ['-f', join(root, 'scripts/pinned.jq')], { input: JSON.stringify(response) }));
  assert.deepEqual(out, [
    { name: 'a', url: 'https://github.com/u/a', description: 'First', meta: ['Go'] },
    { name: 'b', url: 'https://github.com/u/b', description: '', meta: [] },
    { name: 'c', url: 'https://github.com/u/c', description: 'Third', meta: ['Swift'] },
  ]);
});

test('the committed pinned.json is a usable fallback', () => {
  const items = JSON.parse(read('data/pinned.json'));
  assert.ok(items.length > 0);
  for (const it of items) {
    assert.match(it.url, /^https:\/\/github\.com\//);
    assert.ok(it.name && typeof it.description === 'string' && Array.isArray(it.meta), it.name);
  }
});

test('every application links out and its icon is a small local file', () => {
  const yaml = read('data/applications.yaml');
  const names = [...yaml.matchAll(/^- name: (.+)$/gm)];
  const urls = [...yaml.matchAll(/^ {2}url: (.+)$/gm)].map(m => m[1]);
  assert.ok(names.length > 0);
  assert.equal(urls.length, names.length, 'one url per item');
  for (const u of urls) assert.match(u, /^https:\/\//);
  for (const [, icon] of yaml.matchAll(/^ {2}icon: (.+)$/gm)) {
    const size = statSync(join(root, 'static', icon)).size;
    assert.ok(size <= 8 * 1024, `${icon} is ${size} bytes`);
  }
});

// YouTube (/youtube/), Podcasts (/podcasts/) and Hardware (/hardware/): card folders whose previews come from feeds
// or site images at build time (the theme's _partials/deskbar/folder/preview.html)
const items = f => read(f).split(/^- /m).slice(1).map(block =>
  Object.fromEntries([...('  ' + block).matchAll(/^ {2}(\w+): (.+)$/gm)].map(m => [m[1], m[2]])));

test('every YouTube card reads a channel or playlist feed by id, with a stored thumbnail for when it fails', () => {
  const list = items('data/youtube.yaml');
  assert.equal(list.length, 18);
  for (const it of list) {
    assert.match(it.url, /^https:\/\/www\.youtube\.com\//, it.name);
    // @handle and /c/ URLs have no feed of their own, so each resolves to its channel id once, by hand
    assert.match(it.feed, /^https:\/\/www\.youtube\.com\/feeds\/videos\.xml\?(channel_id=UC[\w-]{22}|playlist_id=PL[\w-]+)$/, it.name);
    assert.match(it.thumb, /^https:\/\/i\.ytimg\.com\/vi\/[\w-]{11}\/mqdefault\.jpg$/, it.name);
    const pl = it.url.match(/list=([\w-]+)/);
    if (pl) assert.ok(it.feed.endsWith('playlist_id=' + pl[1]), `${it.name} feeds its own playlist`);
    const channel = it.url.match(/\/channel\/(UC[\w-]+)/);
    if (channel) assert.ok(it.feed.endsWith('channel_id=' + channel[1]), `${it.name} feeds its own channel`);
  }
});

test('every podcast card reads the show\'s RSS feed', () => {
  const list = items('data/podcasts.yaml');
  assert.equal(list.length, 6);
  for (const it of list) {
    assert.match(it.url, /^https:\/\//, it.name);
    assert.match(it.feed, /^https:\/\//, it.name);
  }
});

test('every hardware card has a small 4:3 product shot kept in the site', () => {
  const list = items('data/hardware.yaml');
  assert.equal(list.length, 10);
  for (const it of list) {
    assert.ok(it.description && it.category, it.name);
    const file = join(root, 'assets', it.thumb);
    assert.ok(statSync(file).size <= 120 * 1024, `${it.thumb} is small`);
    // JPEG SOF0/SOF2 frame header: height then width, big-endian
    const b = readFileSync(file);
    let i = 2;
    while (i < b.length && !(b[i] === 0xff && (b[i + 1] === 0xc0 || b[i + 1] === 0xc2))) i += 2 + b.readUInt16BE(i + 2);
    assert.deepEqual([b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)], [800, 600], it.thumb);
  }
});

test('every AI blog card has its logo kept in the site, and any feed is https', () => {
  const list = items('data/blogs_ai.yaml');
  assert.equal(list.length, 9);
  for (const it of list) {
    assert.match(it.url, /^https:\/\//, it.name);
    if (it.feed) assert.match(it.feed, /^https:\/\//, it.name);
    assert.ok(statSync(join(root, 'assets', it.thumb)).size <= 80 * 1024, `${it.thumb} is small`);
  }
});
