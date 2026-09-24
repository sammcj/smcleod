// The sheep screen saver (lazy/sheep.js): its sprites, the ledges it finds on the desktop, and the flock's behaviour.
// Also the saver choice the host (lazy/screensaver.js) reads.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SHEET, CELL, FRAMES, ANIMS, frame, surfaces, flock } from '../assets/js/deskbar/lazy/sheep.js';
import { SAVERS, chosen } from '../assets/js/deskbar/lazy/screensaver.js';

const mem = new Map();
globalThis.localStorage = {
  getItem: k => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: k => mem.delete(k),
};
beforeEach(() => mem.clear());

// A seeded generator, so a run is the same every time
const seeded = (s = 1) => () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;

test('the saver choice: sheep unless leaves is stored, which is kept', () => {
  assert.deepEqual(SAVERS, ['leaves', 'sheep']);
  assert.equal(chosen(), 'sheep');
  mem.set('deskbar:saverKind', '"leaves"');
  assert.equal(chosen(), 'leaves');
  mem.set('deskbar:saverKind', '"sheep"');
  assert.equal(chosen(), 'sheep');
  for (const bad of ['"goats"', '7', '{', 'null']) {
    mem.set('deskbar:saverKind', bad);
    assert.equal(chosen(), 'sheep', bad);
  }
});

test('the sprite sheet holds every frame the animations use, in the order its notice lists', () => {
  const png = readFileSync(new URL('../static/' + SHEET, import.meta.url));
  assert.equal(png.toString('latin1', 1, 4), 'PNG');
  assert.equal(png.readUInt32BE(16), 8 * CELL, 'eight cells to a row');
  assert.equal(png.readUInt32BE(20), Math.ceil(FRAMES.length / 8) * CELL);
  assert.ok(png.length < 12 * 1024, `small: ${png.length} bytes`);
  assert.equal(new Set(FRAMES).size, FRAMES.length);
  for (const [k, a] of Object.entries(ANIMS)) for (const n of a.f) assert.ok(FRAMES.includes(n), `${k}: ${n}`);
  for (const n of [23, 24, 46, 133]) assert.ok(FRAMES.includes(n), n);
  const notice = readFileSync(new URL('../static/vendor/esheep/NOTICE.txt', import.meta.url), 'utf8');
  assert.match(notice, /GPL-3\.0/);
  assert.match(notice, /Oliver/);
  const order = notice.match(/order[^:]*:\n\s*([\d /]+)\n/)[1].split(/[\s/]+/).filter(Boolean).map(Number);
  assert.deepEqual(order, FRAMES);
});

test('frames follow the pet: walking steps, sleeping lies down and stays down, falling fast throws its arms up', () => {
  const seq = (state, secs, on = {}) => secs.map(a => frame({ state, a, on }));
  assert.deepEqual(seq('walk', [0.1, 0.3, 0.5, 0.7, 0.9]), [2, 3, 192, 3, 2]);
  assert.deepEqual(seq('sleep', [0.15, 0.45, 0.75, 1.05]), [3, 78, 79, 80], 'lies down');
  assert.deepEqual(seq('sleep', [1.35, 2.85, 4.35, 5.85]), [0, 1, 0, 1], 'then breathes, never getting up');
  assert.equal(frame({ state: 'eat', a: 0.45, on: {} }), 58);
  assert.notEqual(frame({ state: 'eat', a: 30, on: {} }), 6, 'grazing goes on');
  assert.equal(frame({ state: 'fall', vy: 100, on: null }), 133);
  assert.equal(frame({ state: 'fall', vy: 900, on: null }), 46);
  assert.equal(frame({ state: 'jump', vy: -100, on: null }), 23);
  assert.equal(frame({ state: 'jump', vy: 100, on: null }), 24);
});

test('ledges: the top edge of each box, cut where a later box covers it, plus the floor', () => {
  const W = 1000, H = 800;
  const back = { x: 100, y: 200, w: 400, h: 300 }, front = { x: 300, y: 100, w: 400, h: 300 }, dock = { x: 400, y: 740, w: 200, h: 50 };
  const segs = surfaces([back, front, dock], W, H);
  const at = y => segs.filter(s => s.y === y).map(s => [s.x1, s.x2, s.wall1, s.wall2]);
  // the back window's top is covered from x 300 by the front one: it ends there in a wall
  assert.deepEqual(at(200), [[100, 300, false, true]]);
  assert.deepEqual(at(100), [[300, 700, false, false]]);
  assert.deepEqual(at(740), [[400, 600, false, false]], 'the dock');
  assert.deepEqual(at(800), [[0, 1000, true, true]], 'the floor, walled by the screen edges');

  // a box off the side of the screen is cut to it, and walled there; one wholly covered leaves nothing
  const off = surfaces([{ x: -50, y: 300, w: 200, h: 100 }, { x: 600, y: 300, w: 100, h: 50 }, { x: 550, y: 250, w: 300, h: 200 }], W, H);
  assert.deepEqual(off.filter(s => s.y === 300).map(s => [s.x1, s.x2, s.wall1, s.wall2]), [[0, 150, true, false]]);
  // a tab sitting on its frame's top edge cuts the frame's ledge, as its bottom touches it
  const tabbed = surfaces([{ x: 100, y: 200, w: 400, h: 300 }, { x: 100, y: 176, w: 150, h: 24 }], W, H);
  assert.deepEqual(tabbed.filter(s => s.y === 200).map(s => [s.x1, s.x2]), [[250, 500]]);
  assert.deepEqual(tabbed.filter(s => s.y === 176).map(s => [s.x1, s.x2]), [[100, 250]]);
});

// Steps until the sheep is standing on something (after any bounce)
function settle(f, s) {
  for (let i = 0; i < 300 && !s.on; i++) f.step(1 / 30);
  assert.ok(s.on, 'landed');
}

// Every sheep standing or walking is on a ledge, and none has left the screen
function check(f, W, H) {
  for (const s of f.sheep) {
    assert.ok(s.x >= 0 && s.x <= W, `x ${s.x}`);
    assert.ok(s.y <= H + 0.001, `y ${s.y}`);
    if (s.on) assert.ok(s.x >= s.on.x1 - 0.001 && s.x <= s.on.x2 + 0.001 && s.y === s.on.y, `on its ledge (${s.state})`);
  }
}

test('a sheep dropped over a window lands on it, then wanders without leaving the screen', () => {
  const W = 800, H = 600;
  const segs = surfaces([{ x: 200, y: 300, w: 300, h: 200 }], W, H);
  const f = flock({ W, H, segs, rand: seeded(3), first: 350 });
  assert.equal(f.sheep.length, 1);
  assert.equal(f.sheep[0].state, 'fall');
  settle(f, f.sheep[0]);
  assert.equal(f.sheep[0].y, 300, 'on the window top');
  const seen = new Set();
  for (let i = 0; i < 30 * 240; i++) {
    f.step(1 / 30);
    for (const s of f.sheep) seen.add(s.state);
    check(f, W, H);
  }
  for (const st of ['walk', 'fall', 'sleep', 'eat']) assert.ok(seen.has(st), `it can ${st}`);
  assert.ok(f.sheep.length > 1, 'more sheep turned up');
  assert.ok(f.sheep.length <= f.max, 'but not too many');
  assert.ok(f.sheep.some(s => s.y === H), 'some reached the floor');
});

test('a sheep walking off an open edge falls to the ledge below; at a wall it turns or hops up', () => {
  const W = 800, H = 600;
  const segs = surfaces([{ x: 100, y: 520, w: 200, h: 60 }], W, H);
  const f = flock({ W, H, segs, rand: () => 0.99, first: 290 });
  const s = f.sheep[0];
  settle(f, s);
  // walking right, it passes the edge at 300 and drops to the floor
  Object.assign(s, { x: 290, y: 520, on: segs[0], dir: 1, state: 'walk', t: 99 });
  f.step(1);
  assert.equal(s.on, null, 'over the edge');
  settle(f, s);
  assert.equal(s.y, H, 'fell to the floor');
  assert.equal(s.state, 'land', 'and lands from 80px, turning round from its back');

  // walking into a wall it turns round, facing back the way it came for the first half
  Object.assign(s, { x: 10, on: f.segs.at(-1), dir: -1, state: 'walk', t: 99 });
  while (s.state === 'walk') f.step(1 / 30);
  assert.equal(s.state, 'turn');
  assert.equal(s.dir, 1);
  assert.equal(s.x, 0);

  // a long drop is a crash
  const c = flock({ W, H, segs: surfaces([], W, H), rand: () => 0.99, first: 400 });
  settle(c, c.sheep[0]);
  assert.equal(c.sheep[0].state, 'crash');

  // a tab 24px above its frame's ledge: a sheep walking into it hops up onto it
  const tab = surfaces([{ x: 100, y: 400, w: 400, h: 100 }, { x: 300, y: 376, w: 150, h: 24 }], W, H);
  const g = flock({ W, H, segs: tab, rand: () => 0.99, first: 200 });
  settle(g, g.sheep[0]);
  Object.assign(g.sheep[0], { x: 200, y: 400, on: tab.find(o => o.y === 400), dir: 1, state: 'walk', t: 99 });
  for (let i = 0; i < 300 && g.sheep[0].on?.y !== 376; i++) g.step(1 / 30);
  assert.equal(g.sheep[0].y, 376, 'up on the tab');
});

test('ledges that change (a resize) leave nobody standing on air', () => {
  const W = 800, H = 600;
  const f = flock({ W, H, segs: surfaces([{ x: 200, y: 300, w: 300, h: 200 }], W, H), rand: seeded(5), first: 300 });
  settle(f, f.sheep[0]);
  assert.equal(f.sheep[0].y, 300);
  f.resize(W, H, surfaces([], W, H));
  assert.equal(f.sheep[0].state, 'fall');
  settle(f, f.sheep[0]);
  assert.equal(f.sheep[0].y, H);
  check(f, W, H);
});

test('a still flock (reduced motion) is posed on the ledges at once, and stays put', () => {
  const W = 1200, H = 800;
  const segs = surfaces([{ x: 100, y: 200, w: 500, h: 300 }, { x: 500, y: 740, w: 200, h: 50 }], W, H);
  const f = flock({ W, H, segs, rand: seeded(7), still: true });
  assert.ok(f.sheep.length >= 3);
  assert.ok(f.sheep.every(s => s.on && s.state !== 'fall'));
  assert.ok(new Set(f.sheep.map(s => s.state)).size >= 3, 'in different poses');
  check(f, W, H);
});
