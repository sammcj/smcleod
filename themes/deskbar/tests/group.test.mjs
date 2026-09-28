import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memberRects, joinBox, leaveBox, dropAt, dragSeam, MIN_W } from '../assets/js/deskbar/wm/group.js';
import { GAP } from '../assets/js/deskbar/wm/snap.js';

const desk = { w: 1440, h: 800 }, th = 24;

test('members share the box by their shares, a gap apart, and fill it exactly', () => {
  const box = { x: 6, y: 30, w: 1428, h: 700 };
  const [a, b] = memberRects(box, [25, 75]);
  assert.equal(a.x, box.x);
  assert.equal(b.x - (a.x + a.w), GAP);
  assert.equal(b.x + b.w, box.x + box.w);
  assert.ok(Math.abs(a.w / (a.w + b.w) - 0.25) < 0.01);
  assert.ok([a, b].every(r => r.y === box.y && r.h === box.h));
});

test('joining grows the box toward the side joined', () => {
  const box = { x: 124, y: 40, w: 630, h: 600 };
  assert.deepEqual(joinBox(box, 500, 'r', desk, th), { x: 124, y: 40, w: 1136, h: 600 });
  const l = joinBox(box, 100, 'l', desk, th);
  assert.equal(l.x, 124 - GAP - 100);
  assert.equal(l.w, 736);
});

test('a box pushed off the desk moves back on, and one too wide shrinks to the desk', () => {
  const r = joinBox({ x: 700, y: 40, w: 600, h: 600 }, 600, 'r', desk, th);
  assert.equal(r.x + r.w, desk.w - GAP);
  const l = joinBox({ x: 50, y: 40, w: 600, h: 600 }, 600, 'l', desk, th);
  assert.equal(l.x, GAP);
  const wide = joinBox({ x: 6, y: 40, w: 1428, h: 600 }, 600, 'r', desk, th);
  assert.deepEqual([wide.x, wide.w], [GAP, desk.w - 2 * GAP]);
});

test('a box clear of the desktop icons stays clear of them, shrinking instead', () => {
  const b = joinBox({ x: 124, y: 40, w: 630, h: 600 }, 800, 'r', desk, th, GAP, 118);
  assert.equal(b.x, 118, 'moves left only as far as the icons');
  assert.equal(b.x + b.w, desk.w - GAP);
  const over = joinBox({ x: 50, y: 40, w: 630, h: 600 }, 800, 'r', desk, th, GAP, 118);
  assert.ok(over.x < 118, 'one already over them may move further');
  const l = joinBox({ x: 124, y: 40, w: 630, h: 600 }, 300, 'l', desk, th, GAP, 118);
  assert.equal(l.x, 118, 'joining on the left stops at the icons');
});

test('a joined box stays below the top edge and above the dock', () => {
  const b = joinBox({ x: 100, y: 0, w: 400, h: 900 }, 300, 'r', desk, th);
  assert.equal(b.y, th + GAP);
  assert.equal(b.y + b.h, desk.h - GAP);
});

test('leaving closes the gap: the rest keep their places', () => {
  const box = { x: 10, y: 40, w: 1206, h: 600 }, rects = memberRects(box, [400, 400, 394]);
  assert.deepEqual(leaveBox(box, rects, 0), { ...box, x: rects[1].x, w: box.w - rects[0].w - GAP });
  assert.deepEqual(leaveBox(box, rects, 2), { ...box, w: box.w - rects[2].w - GAP });
});

test('drop zones: edge bands join, the middle of a group member replaces it, elsewhere nothing', () => {
  const r = { x: 100, y: 100, w: 600, h: 400 };
  assert.equal(dropAt({ x: 110, y: 300 }, r, false), 'l');
  assert.equal(dropAt({ x: 690, y: 300 }, r, false), 'r');
  assert.equal(dropAt({ x: 650, y: 300 }, r, false), null, 'bands are 40px at most');
  assert.equal(dropAt({ x: 400, y: 300 }, r, true), 'c');
  assert.equal(dropAt({ x: 400, y: 300 }, r, false), null, 'only group members can be replaced');
  assert.equal(dropAt({ x: 250, y: 150 }, r, true), null, 'off-centre');
  assert.equal(dropAt({ x: 90, y: 300 }, r, true), null, 'outside the frame');
  assert.equal(dropAt({ x: 125, y: 300 }, { ...r, w: 120 }, false), 'l', 'narrow frames get quarter-width bands');
});

test('the seam trades width between neighbours, never below the minimum', () => {
  assert.deepEqual(dragSeam([400, 800], 0, 100), [500, 700]);
  assert.deepEqual(dragSeam([400, 800], 0, -300), [MIN_W, 900]);
  assert.deepEqual(dragSeam([400, 800, 300], 1, 600), [400, 800, 300], 'the right one is already at its minimum');
  assert.deepEqual(dragSeam([200, 200], 0, 50), [200, 200], 'too narrow for the minimum: halves');
});
