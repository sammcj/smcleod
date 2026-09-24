// Sketch (lazy/sketch.js): undo history, and replaying operations onto a canvas
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { history, drawOp, W, H } from '../assets/js/deskbar/lazy/sketch.js';

test('undo and redo move operations between the two lists', () => {
  const hist = history();
  assert.equal(hist.canUndo, false);
  assert.equal(hist.undo(), undefined, 'nothing to undo');
  hist.push('a');
  hist.push('b');
  assert.equal(hist.undo(), 'b');
  assert.deepEqual(hist.done, ['a']);
  assert.equal(hist.canRedo, true);
  assert.equal(hist.redo(), 'b');
  assert.deepEqual(hist.done, ['a', 'b']);
  assert.equal(hist.redo(), undefined, 'nothing to redo');
  hist.undo();
  hist.undo();
  assert.deepEqual(hist.done, []);
  assert.equal(hist.canUndo, false);
  assert.equal(hist.redo(), 'a');
});

test('a new operation after an undo discards what was undone', () => {
  const hist = history();
  hist.push('a');
  hist.push('b');
  hist.undo();
  hist.push('c');
  assert.equal(hist.canRedo, false);
  assert.deepEqual(hist.done, ['a', 'c']);
});

test('history keeps only the most recent operations', () => {
  const hist = history(3);
  assert.deepEqual(['a', 'b', 'c', 'd'].map(op => hist.push(op)), [undefined, undefined, undefined, 'a'], 'the one pushed out is handed back');
  assert.deepEqual(hist.done, ['b', 'c', 'd']);
});

// A 2D context that records what was drawn
function fakeCanvas() {
  const calls = [];
  const g = {};
  for (const m of ['beginPath', 'moveTo', 'lineTo', 'stroke', 'fill', 'rect', 'ellipse', 'fillRect']) g[m] = (...a) => calls.push([m, ...a]);
  return new Proxy(g, {
    set(t, k, v) { calls.push(['set', k, v]); t[k] = v; return true; },
    get: (t, k) => (k === 'calls' ? calls : t[k]),
  });
}

test('a pen stroke draws a segment per point at that point\'s width, starting with a dot', () => {
  const g = fakeCanvas();
  drawOp(g, { t: 'pen', color: '#d7263d', pts: [[10, 10, 2], [20, 10, 4], [30, 10, 8]] });
  const widths = g.calls.filter(c => c[0] === 'set' && c[1] === 'lineWidth').map(c => c[2]);
  assert.deepEqual(widths, [2, 3, 6], 'each segment averages its two ends');
  assert.equal(g.calls.filter(c => c[0] === 'stroke').length, 3);
  assert.equal(g.strokeStyle, '#d7263d');
  const moves = g.calls.filter(c => c[0] === 'lineTo').map(c => c.slice(1));
  assert.ok(moves[0][0] > 10 && moves[0][0] < 10.1, 'the first point draws a dot');
});

test('shapes stroke or fill, and clear paints the paper', () => {
  let g = fakeCanvas();
  drawOp(g, { t: 'rect', color: '#000', size: 4, fill: false, a: [50, 60], b: [10, 20] });
  assert.deepEqual(g.calls.find(c => c[0] === 'rect'), ['rect', 10, 20, 40, 40], 'dragging up and left still makes a rectangle');
  assert.ok(g.calls.some(c => c[0] === 'stroke') && !g.calls.some(c => c[0] === 'fill'));

  g = fakeCanvas();
  drawOp(g, { t: 'ellipse', color: '#000', size: 4, fill: true, a: [0, 0], b: [100, 50] });
  assert.deepEqual(g.calls.find(c => c[0] === 'ellipse').slice(1, 5), [50, 25, 50, 25]);
  assert.ok(g.calls.some(c => c[0] === 'fill'));

  g = fakeCanvas();
  drawOp(g, { t: 'line', color: '#000', size: 4, fill: true, a: [0, 0], b: [10, 10] });
  assert.ok(g.calls.some(c => c[0] === 'stroke') && !g.calls.some(c => c[0] === 'fill'), 'a line ignores fill');

  g = fakeCanvas();
  drawOp(g, { t: 'clear' });
  assert.deepEqual(g.calls.find(c => c[0] === 'fillRect'), ['fillRect', 0, 0, W, H]);
  assert.equal(g.fillStyle, '#ffffff');
});
