// Sheep screen saver, after the 1990s eSheep desktop pet, drawn with gSheep Purple's sprites (static/vendor/esheep/,
// see its NOTICE.txt). A sheep drops onto the desktop and wanders the tops of the windows on screen, the dock and the
// bottom edge. It walks off edges, hops up onto window tabs, turns at walls, sleeps, grazes, and now and then another
// sheep turns up. lazy/screensaver.js runs it over the dimmed desktop and ends it on any input. surfaces(), flock()
// and frame() are DOM free, so they are unit tested in Node.

// The sheet: 40px cells, 8 to a row, holding these of the pet's frames (its own numbers, from animations.xml). Each
// faces left, with its feet on the cell's bottom row.
export const SHEET = 'vendor/esheep/gsheep-purple.png';
export const CELL = 40;
export const FRAMES = [3, 2, 192, 6, 7, 8, 9, 10, 78, 79, 80, 0, 1, 58, 59, 60, 61, 23, 24, 133, 46, 48, 47, 49, 13, 12];

// What each state on a ledge shows: the pet's frames at s seconds each, repeating from frame `loop` (0 when unset).
// Sequences and timings follow the pet's own walk, standblink, sleep1a, eat, rotate1a and fall hard animations.
export const ANIMS = {
  walk: { f: [2, 3, 192, 3], s: 0.2 },
  idle: { f: [3, 3, 3, 3, 3, 6, 7, 8, 7, 6], s: 0.15 },
  sleep: { f: [3, 78, 79, 80, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1], s: 0.3, loop: 4 },
  eat: { f: [6, 58, 59, 59, 60, 61, 60, 61, 6, 6], s: 0.3, loop: 1 },
  // turning round: it faces the way it came until halfway
  turn: { f: [9, 10, 10, 9], s: 0.15 },
  // from its back as it fell to side on
  land: { f: [49, 13, 12], s: 0.15 },
  // a long drop: dazed, sits up, turns back round
  crash: { f: [48, 48, 47, 47, 49, 13, 12], s: 0.15 },
};
const TIME = k => ANIMS[k].f.length * ANIMS[k].s;

const G = 1500, HOP = 48, CRASH = 700;

// The pet's frame for a sheep now: in the air it leaps (up, then down) or falls, back first and then arms up once
// it drops fast
export function frame(s) {
  if (!s.on) return s.state === 'jump' ? (s.vy < 0 ? 23 : 24) : s.vy > CRASH ? 46 : 133;
  const { f, s: sec, loop = 0 } = ANIMS[s.state] || ANIMS.idle, i = Math.floor(s.a / sec);
  return f[i < f.length ? i : loop + ((i - loop) % (f.length - loop))];
}

// Ledges a sheep can stand on: the top edge of each box (in paint order, bottom first), less the stretches a box
// painted later covers, and the bottom of the screen. An end is a wall where something covers it or the screen
// cuts it, rather than a drop.
export function surfaces(boxes, W, H) {
  const out = [];
  boxes.forEach((b, i) => {
    const y = b.y;
    if (y <= 0 || y >= H) return;
    let runs = [[Math.max(0, b.x), Math.min(W, b.x + b.w), b.x < 0, b.x + b.w > W]];
    for (const c of boxes.slice(i + 1)) {
      // a box whose bottom touches the edge covers it too: a window's tab sits on its frame's top
      if (!(c.y < y && y <= c.y + c.h)) continue;
      const l = c.x, r = c.x + c.w;
      runs = runs.flatMap(([x1, x2, w1, w2]) => {
        if (r <= x1 || l >= x2) return [[x1, x2, w1, w2]];
        return [...(l > x1 ? [[x1, l, w1, true]] : []), ...(r < x2 ? [[r, x2, true, w2]] : [])];
      });
    }
    for (const [x1, x2, wall1, wall2] of runs) if (x2 - x1 >= 8) out.push({ x1, x2, y, wall1, wall2 });
  });
  out.push({ x1: 0, x2: W, y: H, wall1: true, wall2: true });
  return out;
}

// The flock: each sheep has x (its middle), y (its feet), a state, a (seconds in that state, for its frames) and
// the ledge it is on (null in the air). still poses a few at once for reduced motion; first is where the first sheep
// drops (random without). scale is the sprites' (walking speed follows it, as the pet steps 2px a frame).
export function flock({ W, H, segs, rand = Math.random, still = false, first, scale = 2 }) {
  const f = { sheep: [], max: Math.max(2, Math.min(6, Math.round(W / 260))), segs, W, H };
  const speed = 10 * scale;
  let wait = 3 + rand() * 5;
  const sheep = (x, y = 0) => ({ x, y, vx: 0, vy: 0, dir: rand() < 0.5 ? -1 : 1, state: 'fall', t: 0, a: 0, on: null });
  const turn = s => Object.assign(s, { state: 'turn', t: TIME('turn'), dir: -s.dir, a: 0 });

  // what a sheep on a ledge does next
  function act(s) {
    const r = rand();
    s.a = 0;
    if (r < 0.1) Object.assign(s, { state: 'sleep', t: 6 + rand() * 8 });
    else if (r < 0.26) Object.assign(s, { state: 'eat', t: 3 + rand() * 4 });
    else if (r < 0.36) Object.assign(s, { state: 'idle', t: 1.5 + rand() * 2 });
    else if (r < 0.42) turn(s);
    else if (r < 0.48) leap(s, -420);
    else Object.assign(s, { state: 'walk', t: 3 + rand() * 9 });
  }
  function leap(s, vy) {
    Object.assign(s, { state: 'jump', on: null, vy, vx: s.dir * speed * 2, a: 0 });
  }
  // a fall ends in a landing, a long one in a crash; a leap goes straight on to what's next
  function land(s, seg) {
    const fell = s.state === 'fall', hard = s.vy > CRASH;
    Object.assign(s, { y: seg.y, on: seg, vy: 0, vx: 0, a: 0 });
    if (!fell) return act(s);
    const k = hard ? 'crash' : 'land';
    Object.assign(s, { state: k, t: TIME(k) });
  }
  function walk(s, dt) {
    const seg = s.on;
    s.x += s.dir * speed * dt;
    if (s.x >= seg.x1 && s.x <= seg.x2) return;
    const left = s.x < seg.x1, edge = left ? seg.x1 : seg.x2, wall = left ? seg.wall1 : seg.wall2, ahead = edge + s.dir * 4;
    // a ledge a little higher just ahead (a window's tab) is hopped onto, not walked into
    const up = wall && f.segs.find(o => o.y < seg.y && o.y >= seg.y - HOP && ahead >= o.x1 && ahead <= o.x2);
    s.x = edge;
    if (up) return leap(s, -Math.sqrt(2 * G * (seg.y - up.y + 12)));
    if (wall || rand() < 0.25) turn(s);
    else Object.assign(s, { state: 'fall', on: null, vx: s.dir * speed, vy: 0, a: 0 });
  }
  function fly(s, dt) {
    const py = s.y;
    s.vy += G * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    if (s.x < 0 || s.x > f.W) {
      s.x = Math.min(f.W, Math.max(0, s.x));
      s.vx = -s.vx;
      s.dir = -s.dir;
    }
    if (s.vy <= 0) return;
    let seg = null;
    for (const o of f.segs) if (o.y >= py && o.y <= s.y && s.x >= o.x1 && s.x <= o.x2 && (!seg || o.y < seg.y)) seg = o;
    if (seg) land(s, seg);
    else if (s.y > f.H) land(s, f.segs.at(-1));
  }

  f.step = dt => {
    for (const s of f.sheep) {
      s.a += dt;
      if (!s.on) fly(s, dt);
      else if (s.state === 'walk') walk(s, dt);
      if (s.on && (s.t -= dt) <= 0) act(s);
    }
    if ((wait -= dt) <= 0) {
      wait = 6 + rand() * 10;
      if (f.sheep.length < f.max) f.sheep.push(sheep(20 + rand() * (f.W - 40)));
    }
  };

  // New ledges (a resize): a sheep whose ledge went falls from where it stood
  f.resize = (w, h, segs) => {
    Object.assign(f, { W: w, H: h, segs });
    for (const s of f.sheep) {
      s.x = Math.min(w, Math.max(0, s.x));
      if (!s.on) continue;
      s.on = segs.find(o => o.y === s.y && s.x >= o.x1 && s.x <= o.x2) || null;
      if (!s.on) Object.assign(s, { state: 'fall', vx: 0, vy: 0 });
    }
  };

  if (still) {
    // posed a few seconds in, so a sleeper is already lying down
    const spots = segs.filter(o => o.x2 - o.x1 >= 60), poses = ['walk', 'sleep', 'eat', 'idle'];
    for (let i = 0; i < Math.min(f.max, 4); i++) {
      const o = spots[i % spots.length];
      f.sheep.push({ ...sheep(o.x1 + 24 + rand() * (o.x2 - o.x1 - 48), o.y), on: o, state: poses[i], t: Infinity, a: 3 + rand() });
    }
  } else f.sheep.push(sheep(first ?? 20 + rand() * (W - 40)));
  return f;
}

// The boxes on screen a sheep can stand on, in paint order: the phone home screen, each window (frame, then tabs) by
// stacking order, then the dock
function boxes() {
  const $ = s => document.querySelector(s), shown = e => e?.checkVisibility?.({ visibilityProperty: true }) ?? !!e;
  const wins = [...document.querySelectorAll('.win:not([hidden])')].sort((a, b) => (+getComputedStyle(a).zIndex || 0) - (+getComputedStyle(b).zIndex || 0));
  return [$('#desk > #recent h2'), $('#desk > #recent .recent-list'), ...wins.flatMap(w => [w.querySelector('.frame'), ...w.querySelectorAll('.tab, .th')]), $('#dock')]
    .filter(shown).map(e => e.getBoundingClientRect()).filter(r => r.width && r.height).map(r => ({ x: r.left, y: r.top, w: r.width, h: r.height }));
}

// The ledges on screen now
export const ledges = () => surfaces(boxes(), innerWidth, innerHeight);

// The saver's scene { size(W, H), step(dt), draw(g) }, as lazy/screensaver.js runs it, once the sheet has loaded
export async function scene(still) {
  const img = new Image();
  img.src = new URL('../../' + SHEET, import.meta.url).href;
  await img.decode();
  let f = null, S = 2;
  return {
    size(W, H) {
      // whole multiples of the pet's pixels, so they stay crisp
      S = W < 600 ? 1 : 2;
      const segs = ledges();
      if (f && !still) f.resize(W, H, segs);
      else f = flock({ W, H, segs, still, scale: S });
    },
    step: dt => f.step(dt),
    draw(g) {
      g.imageSmoothingEnabled = false;
      const w = CELL * S;
      for (const s of [...f.sheep].sort((a, b) => a.y - b.y)) {
        const i = FRAMES.indexOf(frame(s)), face = s.state === 'turn' && s.a < TIME('turn') / 2 ? -s.dir : s.dir;
        g.save();
        g.translate(Math.round(s.x), Math.round(s.y));
        if (face > 0) g.scale(-1, 1);
        g.drawImage(img, (i % 8) * CELL, (i >> 3) * CELL, CELL, CELL, -w / 2, -w, w, w);
        g.restore();
      }
    },
  };
}
