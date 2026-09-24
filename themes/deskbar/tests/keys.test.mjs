// Arrow-key moves over lists and grids (lib/keys.js), with items as boxes rather than DOM elements
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arrowTo } from '../assets/js/deskbar/lib/keys.js';

const box = (name, left, top, width = 100, height = 80) =>
  ({ name, getBoundingClientRect: () => ({ left, top, width, height, right: left + width, bottom: top + height }) });
const go = (items, from, ...keys) => keys.reduce((cur, k) => arrowTo(items, cur, k) || cur, from).name;

test('a grid: Left and Right step in order, Up and Down keep to the column', () => {
  // three across, then a short last row
  const g = [box('a', 0, 0), box('b', 110, 0), box('c', 220, 0), box('d', 0, 90), box('e', 110, 90)];
  assert.equal(go(g, g[0], 'ArrowRight', 'ArrowRight', 'ArrowRight'), 'd', 'Right runs on to the next row');
  assert.equal(go(g, g[1], 'ArrowDown'), 'e');
  assert.equal(go(g, g[4], 'ArrowUp'), 'b');
  assert.equal(go(g, g[2], 'ArrowDown'), 'e', 'the nearest in a shorter row below');
  assert.equal(arrowTo(g, g[3], 'ArrowDown'), undefined, 'nothing below the last row');
  assert.equal(arrowTo(g, g[0], 'ArrowLeft'), undefined, 'nothing before the first');
});

test('a single column: Up and Down are previous and next; a further row never beats a nearer one', () => {
  const col = [box('a', 0, 0, 300, 30), box('b', 0, 30, 300, 30), box('c', 40, 60, 100, 30)];
  assert.equal(go(col, col[0], 'ArrowDown'), 'b');
  assert.equal(go(col, col[0], 'ArrowDown', 'ArrowDown'), 'c');
  assert.equal(go(col, col[2], 'ArrowUp'), 'b');
});

test('nothing selected picks the first; other keys do nothing', () => {
  const g = [box('a', 0, 0), box('b', 110, 0)];
  for (const k of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) assert.equal(arrowTo(g, null, k).name, 'a');
  assert.equal(arrowTo(g, g[0], 'Enter'), undefined);
  assert.equal(arrowTo([], null, 'ArrowDown'), undefined);
});
