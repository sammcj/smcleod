import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchPosts, matches, terms } from '../assets/js/deskbar/search.js';
import { findOffsets } from '../assets/js/deskbar/lib/offsets.js';

const post = (title, extra = {}) => ({ title, url: '/' + title, date: '2024-01-01', tags: [], series: [], description: '', ...extra });
const posts = [
  post('Local MCP servers', { date: '2025-08-18', tags: ['ai', 'mcp'], description: 'Tools for agents' }),
  post('Agentic coding with Claude', { date: '2026-03-05', tags: ['ai', 'claude'], series: ['Agentic'], description: 'Notes on MCP tools and skills' }),
  post('Building an SSD SAN', { date: '2015-02-16', tags: ['storage'], series: ['Storage'], description: 'A budget build' }),
  post('Storage performance', { date: '2015-02-15', tags: ['storage'], description: 'Benchmarks' }),
  post('Résumé tips', { date: '2020-01-01', description: 'Writing a CV' }),
  post('tcmcp internals', { date: '2027-01-01' }),
];
const titles = r => r.map(p => p.title);

test('a title match outranks a tag match, which outranks a description match', () => {
  assert.deepEqual(titles(searchPosts(posts, 'mcp')).slice(0, 2), ['Local MCP servers', 'Agentic coding with Claude']);
  // "agentic" is in one title and one series; the title wins
  assert.equal(searchPosts(posts, 'agentic')[0].title, 'Agentic coding with Claude');
});

test('a match at the start of a word beats one inside a word, even on a newer post', () => {
  const r = titles(searchPosts(posts, 'mcp'));
  assert.ok(r.indexOf('Local MCP servers') < r.indexOf('tcmcp internals'));
});

test('every term must match, in any field', () => {
  assert.deepEqual(titles(searchPosts(posts, 'claude skills')), ['Agentic coding with Claude']);
  assert.deepEqual(searchPosts(posts, 'claude storage'), []);
});

test('equal scores fall back to newest first, and limit caps the results', () => {
  assert.deepEqual(titles(searchPosts(posts, 'storage')), ['Storage performance', 'Building an SSD SAN'],
    'title plus tag outranks tag plus series');
  const same = [post('Old', { date: '2019-05-01', tags: ['go'] }), post('New', { date: '2023-05-01', tags: ['go'] })];
  assert.deepEqual(titles(searchPosts(same, 'go')), ['New', 'Old']);
  assert.equal(searchPosts(posts, 'a', 2).length, 2);
});

test('the whole phrase in a title gets a bonus over scattered terms', () => {
  const r = searchPosts([post('Coding agents', { date: '2026-01-01', description: 'agentic coding' }), post('Agentic coding', { date: '2020-01-01' })], 'agentic coding');
  assert.equal(r[0].title, 'Agentic coding');
});

test('case and accents are ignored; blank queries return nothing', () => {
  assert.deepEqual(titles(searchPosts(posts, 'RESUME')), ['Résumé tips']);
  assert.deepEqual(searchPosts(posts, '   '), []);
  assert.deepEqual(terms('  Two   words '), ['two', 'words']);
});

test('posts missing optional fields still search', () => {
  assert.deepEqual(titles(searchPosts([{ title: 'Bare', date: '' }], 'bare')), ['Bare']);
});

test('matches checks labels for every term', () => {
  assert.ok(matches('LLM vRAM Estimator', 'vram est'));
  assert.ok(!matches('Links', 'cars'));
});

test('findOffsets returns each case-insensitive match without overlaps', () => {
  assert.deepEqual(findOffsets('Tab tab TAB', 'tab'), [0, 4, 8]);
  assert.deepEqual(findOffsets('aaaa', 'aa'), [0, 2]);
  assert.deepEqual(findOffsets('nothing here', ''), []);
  assert.deepEqual(findOffsets('İstanbul', 'i'), [], 'skips text whose lowercase changes length');
});
