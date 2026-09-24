import { test } from 'node:test';
import assert from 'node:assert/strict';
import { routeFor, resolveRef, pageKey, framePath } from '../assets/js/deskbar/router.js';

const here = 'https://example.org/2026/07/a-post/';

test('internal page links route with path, query and hash', () => {
  assert.deepEqual(routeFor('/2026/05/other/?x=1#h', here), { path: '/2026/05/other/', search: '?x=1', hash: '#h', href: '/2026/05/other/?x=1#h' });
  assert.equal(routeFor('../../05/other/', here).path, '/2026/05/other/');
  assert.equal(routeFor('https://example.org/about/', here).path, '/about/');
});

test('external, non-http and file links are left to the browser', () => {
  assert.equal(routeFor('https://github.com/sammcj', here), null);
  assert.equal(routeFor('http://example.org/about/', here), null, 'different scheme is a different origin');
  assert.equal(routeFor('mailto:someone@example.org', here), null);
  assert.equal(routeFor('/index.xml', here), null);
  assert.equal(routeFor('/files/talk.pdf', here), null);
  assert.equal(routeFor('cover.jpg', here), null);
  assert.equal(routeFor('http://[bad', here), null);
});

test('a hash-only link resolves to the current page', () => {
  const r = routeFor('#section', here);
  assert.equal(pageKey(r), '/2026/07/a-post/');
  assert.equal(r.hash, '#section');
});

test('resolveRef makes same-origin references absolute and leaves others alone', () => {
  assert.equal(resolveRef('image.png', here), '/2026/07/a-post/image.png');
  assert.equal(resolveRef('#h2', here), '/2026/07/a-post/#h2');
  assert.equal(resolveRef('/about/', here), '/about/');
  assert.equal(resolveRef('https://cdn.example.com/x.js', here), 'https://cdn.example.com/x.js');
  assert.equal(resolveRef('//cdn.example.com/x.js', here), '//cdn.example.com/x.js');
  assert.equal(resolveRef('data:image/png;base64,AAA', here), 'data:image/png;base64,AAA');
  assert.equal(resolveRef('', here), '');
});

test('same-origin HTML files route, so standalone tools open in a window', () => {
  assert.equal(routeFor('/tiers.html', here).path, '/tiers.html');
  assert.equal(routeFor('/ai-consumption/index.htm', here).path, '/ai-consumption/index.htm');
  assert.equal(routeFor('https://other.example/tiers.html', here), null);
  assert.equal(framePath('/ai-consumption/index.html'), '/ai-consumption/');
  assert.equal(framePath('/tiers.html'), '/tiers.html');
});
