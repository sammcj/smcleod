// Layout links, the reader's own history, bus unsubscribe and the one phone query
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { encodeLayout, decodeLayout, takeLayout, layoutHref } from '../assets/js/deskbar/wm/layout.js';
import { trail, visit } from '../assets/js/deskbar/lib/trail.js';
import { on, emit } from '../assets/js/deskbar/wm/state.js';
import { PHONE } from '../assets/js/deskbar/wm/windows.js';

test('a layout survives encoding, including query strings and awkward characters', () => {
  const wins = [
    { route: '/posts/', snap: 'l' },
    { route: '/photos/?album=cars&photo=2', snap: 'tr' },
    { route: '/a,b+c/', snap: 'max' },
    { route: '/tags/c%23/', snap: 'bl' },
    { route: '/p/100%25-done/', snap: 'br' },
    { route: '/2026/07/wm/', snap: 'r' },
    { route: '/about/', snap: null },
  ];
  const value = encodeLayout(wins, 0.25);
  assert.match(value, /^s25,l\/posts\/,/);
  assert.ok(!/[&#]/.test(value), 'nothing that would end the parameter');
  assert.deepEqual(decodeLayout(value), { split: 0.25, wins });
});

test('a layout without side snaps carries no split, and routes that are not paths are left out', () => {
  assert.equal(encodeLayout([{ route: '/about/', snap: null }, { route: '', snap: 'l' }], 0.5), '/about/');
  assert.equal(encodeLayout([{ route: '/a/', snap: 'max' }], 0.5), 'm/a/');
});

test('post windows of their own are flagged p, before any snap zone', () => {
  const wins = [{ route: '/a/', snap: null, own: true }, { route: '/b/', snap: 'r', own: true }, { route: '/posts/', snap: 'l' }];
  const value = encodeLayout(wins, 0.5);
  assert.equal(value, 's50,p/a/,pr/b/,l/posts/');
  assert.deepEqual(decodeLayout(value).wins, [{ route: '/a/', snap: null, own: true }, { route: '/b/', snap: 'r', own: true }, { route: '/posts/', snap: 'l' }]);
  assert.deepEqual(decodeLayout('p/x/,pp/y/').wins, [{ route: '/x/', snap: null, own: true }], 'one flag only');
});

test('bad layout input is skipped rather than failing', () => {
  assert.deepEqual(decodeLayout('s99,s5,x/a/,//evil.example/,q,%E0%A4%A,/ok/,/ok/,l/x/%'), {
    split: 0, wins: [{ route: '/ok/', snap: null }, { route: '/x/%', snap: 'l' }],
  });
  assert.deepEqual(decodeLayout(undefined), { split: 0, wins: [] });
  const many = Array.from({ length: 20 }, (_, i) => `/p${i}/`).join(',');
  assert.equal(decodeLayout(many).wins.length, 8);
});

test('takeLayout removes only the layout parameter', () => {
  assert.deepEqual(takeLayout('?album=a&layout=l/x/,r/y/&photo=2'), { value: 'l/x/,r/y/', rest: '?album=a&photo=2' });
  assert.deepEqual(takeLayout('?layout='), { value: '', rest: '' });
  assert.deepEqual(takeLayout(''), { value: null, rest: '' });
  assert.equal(layoutHref('/photos/?album=a', 'm/x/'), '/photos/?album=a&layout=m/x/');
  assert.equal(layoutHref('/x/', ''), '/x/');
});

test('the reader trail: new posts drop what was ahead, its buttons and browser Back move along it', () => {
  const t = trail();
  for (const u of ['/a/', '/b/', '/c/']) visit(t, u);
  assert.deepEqual([t.list, t.pos], [['/a/', '/b/', '/c/'], 2]);
  t.moving = 1;
  visit(t, '/b/');
  assert.equal(t.pos, 1, 'the reader Back button');
  visit(t, '/c/', true);
  assert.equal(t.pos, 2, 'browser Forward');
  visit(t, '/b/', true);
  visit(t, '/d/');
  assert.deepEqual([t.list, t.pos], [['/a/', '/b/', '/d/'], 2]);
  visit(t, '/d/');
  assert.equal(t.list.length, 3, 'the same post again is not a new entry');
  t.moving = 0;
  visit(t, '/elsewhere/');
  assert.deepEqual([t.list.at(-1), t.moving], ['/elsewhere/', -1], 'a move that landed elsewhere is a new entry');
});

test('the reader trail: a replaced entry (Tracker\'s arrow keys) takes the place of the one on screen', () => {
  const t = trail();
  for (const u of ['/a/', '/b/', '/c/']) visit(t, u);
  t.moving = 1;
  visit(t, '/b/');
  visit(t, '/x/', false, true);
  assert.deepEqual([t.list, t.pos], [['/a/', '/x/', '/c/'], 1], 'forward entries stay, as in the browser');
  visit(t, '/y/', false, true);
  assert.deepEqual([t.list, t.pos], [['/a/', '/y/', '/c/'], 1]);
  const empty = trail();
  visit(empty, '/a/', false, true);
  assert.deepEqual([empty.list, empty.pos], [['/a/'], 0], 'nothing to replace yet: a new entry');
});

test('on() returns a function that unsubscribes', () => {
  let n = 0;
  const off = on('f5-test', () => n++);
  emit('f5-test');
  off();
  emit('f5-test');
  assert.equal(n, 1);
});

test('every CSS phone block uses the same query as the script', () => {
  const dir = join(import.meta.dirname, '../assets/css/deskbar');
  // on-demand stylesheets (lazy/) included
  const blocks = readdirSync(dir, { recursive: true }).filter(f => f.endsWith('.css')).flatMap(f => [...readFileSync(join(dir, f), 'utf8').matchAll(/@media ([^{]*\b(?:max|min)-width: 76[78]px[^{]*)\{/g)]
    .map(m => [f, m[1].trim()]));
  assert.ok(blocks.length >= 7, `found ${blocks.length} phone blocks`);
  const inverse = `not ((max-width: 767px) or ((max-height: 500px) and (pointer: coarse)))`;
  for (const [f, q] of blocks) assert.ok(q === PHONE || q === inverse, `${f}: @media ${q}`);
});

test('every icon the README lists has a sprite symbol, and Spotlight shows each of them', () => {
  const read = f => readFileSync(join(import.meta.dirname, '..', f), 'utf8');
  const listed = /^Icons: `([^`]+)`/m.exec(read('README.md'))[1].split(' ');
  const sprite = read('layouts/_partials/deskbar/icons.html');
  for (const n of listed) assert.match(sprite, new RegExp(`<symbol id="i-${n}"`), `i-${n}`);
  const known = /const KNOWN = new Set\(\[([^\]]+)\]/.exec(read('assets/js/deskbar/spotlight.js'))[1];
  for (const n of ['folder', 'apps', 'favourites', 'projects', 'vram', 'mail']) assert.ok(listed.includes(n), `README lists ${n}`);
  for (const n of listed) assert.ok(known.includes(`'${n}'`), `Spotlight knows ${n}`);
});
