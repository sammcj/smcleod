import { test } from 'node:test';
import assert from 'node:assert/strict';
import { snapRect, zoneAt, clampSplit, splitFor, sideOf, tileRects, GAP } from '../assets/js/deskbar/wm/snap.js';

const desk = { w: 1200, h: 800 }, th = 24;

test('left and right halves meet at the split with one gap between them', () => {
  const l = snapRect('l', 0.5, desk, th), r = snapRect('r', 0.5, desk, th);
  assert.equal(l.x, GAP);
  assert.equal(r.x + r.w, desk.w - GAP);
  assert.equal(r.x - (l.x + l.w), GAP);
  assert.equal(l.y, th + GAP);
  assert.equal(l.h, desk.h - th - 2 * GAP);
});

test('a 25% split gives the reading layout: narrow left, wide right', () => {
  const l = snapRect('l', 0.25, desk, th), r = snapRect('r', 0.25, desk, th);
  assert.ok(Math.abs(l.w + GAP * 1.5 - desk.w * 0.25) < 1);
  assert.ok(r.w > l.w * 2.5);
});

test('maximise fills the desk inside the gap', () => {
  assert.deepEqual(snapRect('max', 0.3, desk, th), { x: GAP, y: th + GAP, w: desk.w - 2 * GAP, h: desk.h - th - 2 * GAP });
});

test('quarters stack top and bottom without overlapping tabs', () => {
  const tl = snapRect('tl', 0.5, desk, th), bl = snapRect('bl', 0.5, desk, th);
  assert.equal(tl.x, bl.x);
  assert.equal(tl.w, bl.w);
  // the bottom window's tab sits above its frame, so the frames are separated by gap + tab height
  assert.equal(bl.y - (tl.y + tl.h), GAP + th);
});

test('zoneAt maps edges, corners and the top edge', () => {
  assert.equal(zoneAt({ x: 5, y: 400 }, desk), 'l');
  assert.equal(zoneAt({ x: 1195, y: 400 }, desk), 'r');
  assert.equal(zoneAt({ x: 5, y: 50 }, desk), 'tl');
  assert.equal(zoneAt({ x: 1195, y: 780 }, desk), 'br');
  assert.equal(zoneAt({ x: 600, y: 2 }, desk), 'max');
  assert.equal(zoneAt({ x: 600, y: 400 }, desk), null);
});

test('clampSplit keeps both sides usable and falls back to halves on narrow desks', () => {
  assert.equal(clampSplit(0.05, 1200), 0.25);
  assert.equal(clampSplit(0.95, 1200), 0.75);
  assert.equal(clampSplit(0.4, 1200), 0.4);
  assert.equal(clampSplit(0.1, 500), 0.5);
});

test('splitFor keeps the split only when the opposite side is occupied', () => {
  const a = { snap: 'l', min: false }, b = { snap: null, min: false };
  assert.equal(splitFor([a, b], b, 'r', 0.3), 0.3);
  assert.equal(splitFor([a, b], b, 'l', 0.3), 0.5);
  assert.equal(splitFor([{ ...a, min: true }, b], b, 'r', 0.3), 0.5);
  assert.equal(splitFor([a, b], b, 'max', 0.3), 0.5);
  assert.equal(sideOf({ snap: 'br' }), 'r');
  assert.equal(sideOf({ snap: 'max' }), null);
});

// Arranging (the a key, and folders opening beside each other)
const area = { x: 100, y: 0, w: 1200, h: 800 };
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y - th < b.y + b.h && b.y - th < a.y + a.h;

test('tiles fill the area without overlapping, tabs included, for any number of windows', () => {
  for (let n = 1; n <= 9; n++) {
    const rs = tileRects(n, area, th);
    assert.equal(rs.length, n);
    for (const r of rs) {
      assert.ok(r.x >= area.x + GAP && r.x + r.w <= area.x + area.w - GAP + 1, `n=${n}: inside left and right`);
      assert.ok(r.y - th >= area.y + GAP && r.y + r.h <= area.y + area.h - GAP + 1, `n=${n}: inside top and bottom, tab included`);
    }
    rs.forEach((a, i) => rs.slice(i + 1).forEach(b => assert.ok(!overlap(a, b), `n=${n}: no two tiles overlap`)));
  }
});

test('tiles favour landscape cells: two side by side, four in a square, and a short last row spans the width', () => {
  const [a, b] = tileRects(2, area, th);
  assert.equal(a.y, b.y);
  assert.ok(b.x > a.x);
  const four = tileRects(4, area, th);
  assert.deepEqual(four.map(r => [r.x, r.y]), [[four[0].x, four[0].y], [four[1].x, four[0].y], [four[0].x, four[2].y], [four[1].x, four[2].y]]);
  const three = tileRects(3, area, th);
  assert.equal(three[2].w, three[0].w * 2 + GAP, 'the third spans both columns');
});
