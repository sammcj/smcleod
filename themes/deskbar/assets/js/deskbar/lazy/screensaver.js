// Screen saver. main.js starts it after a spell without input (params.deskbar.screensaver) unless a reader window is
// open; the Control panel's Test button and the terminal start it on request. It sits over the desktop without
// touching it, so taking it away leaves every window, focus and scroll as it was. The input that wakes it is
// swallowed rather than passed to whatever lies underneath.
// Two savers: leaves tumbling down a dark screen, after Haiku's Leaves saver (here), and sheep wandering the dimmed
// desktop (lazy/sheep.js, loaded when chosen). Each is a scene { size(W, H), step(dt), draw(g) } this module runs.
import { h } from '../lib/dom.js';
import { store } from '../lib/store.js';

let stop = null;

// The visitor picks one in the Control panel's System pane (deskbar:saverKind); sheep when none is stored
export const SAVERS = ['leaves', 'sheep'];
export const SAVER = 'sheep';
export const chosen = () => {
  const k = store.get('saverKind');
  return SAVERS.includes(k) ? k : SAVER;
};

// From the idle watcher: stays away while the visitor is busy somewhere events don't reach (a framed tool) or has a
// menu or dialog open, which a waking tap would dismiss
export function idle() {
  const busy = document.activeElement?.tagName === 'IFRAME' || document.querySelector(':popover-open, dialog[open]');
  if (!busy) start();
}

const TAU = Math.PI * 2;

// One leaf, drawn once to its own canvas and stamped each frame: a pointed oval with a midrib and stalk
function leafSprite(hue, light) {
  const c = document.createElement('canvas'), s = 96;
  c.width = c.height = s;
  const g = c.getContext('2d');
  g.translate(s / 2, s / 2);
  const L = s * 0.42, grad = g.createLinearGradient(-L / 2, -L, L / 2, L);
  grad.addColorStop(0, `hsl(${hue} 70% ${light + 18}%)`);
  grad.addColorStop(1, `hsl(${hue + 8} 75% ${light - 8}%)`);
  g.beginPath();
  g.moveTo(0, -L);
  g.bezierCurveTo(L * 0.62, -L * 0.55, L * 0.55, L * 0.45, 0, L * 0.8);
  g.bezierCurveTo(-L * 0.55, L * 0.45, -L * 0.62, -L * 0.55, 0, -L);
  g.fillStyle = grad;
  g.fill();
  g.strokeStyle = `hsl(${hue} 60% ${light + 30}% / .55)`;
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(0, -L * 0.85);
  g.lineTo(0, L * 1.05);
  for (let i = 1; i < 5; i++) {
    const y = -L * 0.7 + i * L * 0.32;
    g.moveTo(0, y);
    g.lineTo(L * 0.3, y - L * 0.22);
    g.moveTo(0, y);
    g.lineTo(-L * 0.3, y - L * 0.22);
  }
  g.stroke();
  return c;
}

// Haiku greens with the odd autumn leaf
function leaves() {
  const sprites = [[95, 42], [110, 38], [80, 45], [125, 34], [70, 48], [40, 50], [28, 46]].map(([hue, l]) => leafSprite(hue, l));
  let W = 0, H = 0;
  const all = [];
  const leaf = top => {
    const z = 0.35 + Math.random() * 0.65;
    return {
      x: Math.random() * W, y: top ? -60 : Math.random() * H, z, sprite: sprites[Math.floor(Math.random() * (Math.random() < 0.8 ? 5 : 7))],
      a: Math.random() * TAU, spin: (Math.random() - 0.5) * 1.2, flip: Math.random() * TAU, flipRate: 0.6 + Math.random() * 1.4,
      sway: Math.random() * TAU, fall: 26 + Math.random() * 30,
    };
  };
  return {
    size(w, hgt) {
      W = w;
      H = hgt;
      const n = Math.round(Math.min(70, Math.max(14, (W * H) / 26000)));
      while (all.length < n) all.push(leaf(false));
      all.length = n;
      all.sort((p, q) => p.z - q.z);
    },
    step(dt) {
      for (const f of all) {
        f.sway += dt * 0.9;
        f.y += f.fall * (0.4 + f.z) * dt;
        f.x += Math.sin(f.sway) * 22 * f.z * dt;
        f.a += f.spin * dt;
        f.flip += f.flipRate * dt;
        if (f.y > H + 60) Object.assign(f, leaf(true));
      }
    },
    draw(g) {
      for (const f of all) {
        const sz = 34 + f.z * 60;
        g.save();
        g.globalAlpha = 0.35 + f.z * 0.65;
        g.translate(f.x, f.y);
        g.rotate(f.a);
        // turning over as it falls: the leaf narrows to an edge and widens again
        g.scale(Math.max(0.08, Math.abs(Math.cos(f.flip))), 1);
        g.drawImage(f.sprite, -sz / 2, -sz / 2, sz, sz);
        g.restore();
      }
    },
  };
}

// name: leaves or sheep; anything else is the visitor's choice
export function start(name) {
  if (stop) return;
  const kind = SAVERS.includes(name) ? name : chosen();
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = h('canvas');
  const el = h('div', { class: 'saver', 'data-kind': kind, 'aria-hidden': 'true' }, canvas);
  document.body.append(el);
  const g = canvas.getContext('2d');
  let W = 0, H = 0, sc = null, raf = 0, last = 0;
  const paint = () => {
    g.clearRect(0, 0, W, H);
    sc.draw(g);
  };
  function size() {
    const r = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth;
    H = innerHeight;
    canvas.width = W * r;
    canvas.height = H * r;
    g.setTransform(r, 0, 0, r, 0, 0);
    if (!sc) return;
    sc.size(W, H);
    if (still) paint();
  }
  function frame(t) {
    // capped, so nothing jumps after the tab was hidden (animation frames pause there)
    const dt = Math.min(0.05, (t - (last || t)) / 1000);
    last = t;
    sc.step(dt);
    paint();
    raf = requestAnimationFrame(frame);
  }
  // a scene that arrives after a wake-up has begun (sheep still loading) is not started
  const run = s => {
    if (waking || !el.isConnected) return;
    sc = s;
    size();
    if (!still) raf = requestAnimationFrame(frame);
  };
  size();
  requestAnimationFrame(() => el.classList.add('on'));

  // Any key, press, wheel or right-click wakes it. A pointer has to move a little, as browsers send a move when the
  // page under a resting pointer changes, and a move ends it at once. Anything else clears the screen but keeps the
  // overlay swallowing input until it goes quiet: a press until its click lands, a wheel flick or held key until
  // its repeats stop, so none of it scrolls or activates what lies underneath.
  let from = null, gone = null, waking = false;
  const done = () => { if (stop) stop(); };
  function wake(e) {
    if (e.type === 'pointermove') {
      from ||= [e.clientX, e.clientY];
      if (Math.hypot(e.clientX - from[0], e.clientY - from[1]) < 12) return;
    }
    // a key released after a manual start (the terminal's Enter) is not a wake-up
    if (e.type === 'keyup' && !waking) return;
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
    if (e.type === 'pointermove') return stop();
    if (!waking) {
      waking = true;
      el.classList.add('waking');
      cancelAnimationFrame(raf);
      el.addEventListener('click', done);
    }
    clearTimeout(gone);
    gone = setTimeout(done, e.type === 'pointerdown' ? 700 : 250);
  }
  const evs = ['keydown', 'keyup', 'pointerdown', 'pointermove', 'wheel', 'touchstart', 'contextmenu'];
  for (const t of evs) addEventListener(t, wake, { capture: true, passive: false });
  // a press on something unfocusable would otherwise blur whatever had focus
  el.addEventListener('mousedown', e => e.preventDefault());
  addEventListener('resize', size);
  stop = () => {
    for (const t of evs) removeEventListener(t, wake, { capture: true });
    removeEventListener('resize', size);
    cancelAnimationFrame(raf);
    clearTimeout(gone);
    el.remove();
    stop = null;
  };
  // the sheep are a bundle of their own, with a sprite sheet; the desktop shows dimmed while they load, and leaves
  // fall if they can't
  if (kind === 'sheep') {
    window.deskbar.loadLazy('sheep').then(m => m.scene(still)).then(run).catch(err => {
      console.error(err);
      el.dataset.kind = 'leaves';
      run(leaves());
    });
  } else run(leaves());
}
