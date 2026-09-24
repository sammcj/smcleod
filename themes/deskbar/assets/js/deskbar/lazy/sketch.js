// Sketch (`window: sketch`): a small drawing app. The drawing is a list of operations (strokes, shapes, clears)
// replayed onto a canvas of fixed logical size, which CSS scales to fit the window. Resizing loses nothing, and
// undo and redo are moves between two lists. The last drawing is kept in localStorage as a PNG.
import { h, svgBtn, stroke } from '../lib/dom.js';
import { store } from '../lib/store.js';

export const W = 1200, H = 900;
const PAPER = '#ffffff', KEY = 'sketch';

// Undo history: done operations, and the ones undone since, which a new operation discards
export function history(limit = 200) {
  const done = [], undone = [];
  return {
    done,
    // returns an operation pushed out past the limit, for the caller to keep in its base image
    push(op) { done.push(op); undone.length = 0; return done.length > limit ? done.shift() : undefined; },
    undo() { const op = done.pop(); if (op) undone.push(op); return op; },
    redo() { const op = undone.pop(); if (op) done.push(op); return op; },
    get canUndo() { return done.length > 0; },
    get canRedo() { return undone.length > 0; },
  };
}

// One operation onto a 2D context. pen: pts [x, y, width]; line/rect/ellipse: a, b corners; clear.
export function drawOp(g, op) {
  g.lineCap = g.lineJoin = 'round';
  g.strokeStyle = g.fillStyle = op.color;
  if (op.t === 'clear') {
    g.fillStyle = PAPER;
    g.fillRect(0, 0, W, H);
  } else if (op.t === 'pen') {
    for (let i = 0; i < op.pts.length; i++) segment(g, op.pts[i - 1] || op.pts[i], op.pts[i]);
  } else {
    const [x0, y0] = op.a, [x1, y1] = op.b;
    g.lineWidth = op.size;
    g.beginPath();
    if (op.t === 'line') { g.moveTo(x0, y0); g.lineTo(x1, y1); }
    else if (op.t === 'rect') g.rect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
    else g.ellipse((x0 + x1) / 2, (y0 + y1) / 2, Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, 0, 0, Math.PI * 2);
    if (op.fill && op.t !== 'line') g.fill(); else g.stroke();
  }
}

// Each segment gets its own width, which is how pen pressure shows. A lone point draws a dot.
function segment(g, p, q) {
  g.lineWidth = (p[2] + q[2]) / 2;
  g.beginPath();
  g.moveTo(p[0], p[1]);
  g.lineTo(q[0] + (p === q ? 0.01 : 0), q[1]);
  g.stroke();
}

const COLOURS = [
  ['Black', '#1f1f1f'], ['Grey', '#7a7a7a'], ['White', '#ffffff'], ['Red', '#d7263d'], ['Orange', '#f28c28'],
  ['Yellow', '#ffcb00'], ['Green', '#2e9d5b'], ['Blue', '#3467b8'], ['Purple', '#7b4bb7'], ['Brown', '#8a5a2b'],
];

const TOOLS = {
  pen: ['Pen', stroke('M3 13l1-3.5L11 2.5l2.5 2.5L6.5 12zM9.5 4l2.5 2.5')],
  eraser: ['Eraser', stroke('M6 13.5h7.5M2.5 10.5l6-6.5 4.5 4.5-5 5.5H5z M5.5 7l4.5 4.5')],
  line: ['Line', stroke('M3 13L13 3', 2)],
  rect: ['Rectangle', stroke('M2.5 4h11v8h-11z')],
  ellipse: ['Ellipse', '<ellipse cx="8" cy="8" rx="6" ry="4.5" fill="none" stroke="currentColor" stroke-width="1.8"/>'],
};

export function mount(v, page, { fresh }) {
  if (!fresh) return;
  const hist = history();
  let tool = 'pen', color = COLOURS[0][1], size = 6, fill = false, base = null, cur = null, saveTimer = 0;

  const canvas = h('canvas', { class: 'sk-canvas', width: W, height: H, role: 'img', 'aria-label': 'Drawing' });
  const over = h('canvas', { class: 'sk-canvas sk-over', width: W, height: H, 'aria-hidden': 'true' });
  const g = canvas.getContext('2d'), og = over.getContext('2d');

  const pressed = (b, on) => b.setAttribute('aria-pressed', on);
  const toolBtns = Object.entries(TOOLS).map(([k, [label, svg]]) => {
    const b = svgBtn(label, svg, () => { tool = k; toolBtns.forEach(x => pressed(x, x === b)); }, 'seg');
    pressed(b, k === tool);
    return b;
  });
  const fillBtn = svgBtn('Fill shapes', '<rect x="2.5" y="4" width="11" height="8" fill="currentColor" opacity=".55" stroke="currentColor" stroke-width="1.6"/>', () => { fill = !fill; pressed(fillBtn, fill); }, 'seg');
  pressed(fillBtn, false);
  const custom = h('input', { type: 'color', class: 'sk-custom', value: '#3467b8', 'aria-label': 'Custom colour', title: 'Custom colour' });
  const swatches = COLOURS.map(([name, c]) => {
    const b = h('button', { type: 'button', class: 'sk-sw', title: name, 'aria-label': name, style: `--c:${c}`, onclick: () => pick(c, b) });
    return b;
  });
  const pick = (c, b) => { color = c; [...swatches, custom].forEach(x => x.classList.toggle('on', x === b)); swatches.forEach(x => pressed(x, x === b)); };
  custom.addEventListener('input', () => pick(custom.value, custom));
  pick(color, swatches[0]);
  const sizeIn = h('input', { type: 'range', class: 'sk-size', min: 1, max: 48, value: size, 'aria-label': 'Brush size', title: 'Brush size' });
  const sizeOut = h('output', { class: 'sk-sizev' }, size);
  sizeIn.addEventListener('input', () => { size = +sizeIn.value; sizeOut.textContent = size; });
  const undoBtn = svgBtn('Undo', stroke('M5.5 3L2.5 6l3 3M2.5 6h7a4 4 0 0 1 0 8H7'), () => { if (hist.undo()) redraw(); });
  const redoBtn = svgBtn('Redo', stroke('M10.5 3l3 3-3 3M13.5 6h-7a4 4 0 0 0 0 8H9'), () => { if (hist.redo()) redraw(); });
  const tb = (label, fn) => h('button', { type: 'button', class: 'tb', onclick: fn }, label);

  v.el.append(
    h('div', { class: 'toolbar sk-bar' },
      h('div', { class: 'segs', role: 'group', 'aria-label': 'Tools' }, toolBtns),
      h('div', { class: 'segs' }, fillBtn),
      h('label', { class: 'sk-sizebox' }, sizeIn, sizeOut),
      h('div', { class: 'sk-pal', role: 'group', 'aria-label': 'Colours' }, swatches, custom),
      h('div', { class: 'sk-acts' }, undoBtn, redoBtn,
        tb('Clear', () => { commit({ t: 'clear' }); redraw(); }),
        tb('Save PNG', save))),
    h('div', { class: 'sk-stage' }, canvas, over));

  // What undo can't reach: the saved drawing, and operations the history has let go of
  const baseCtx = () => {
    if (!base) {
      base = h('canvas', { width: W, height: H });
      drawOp(base.getContext('2d'), { t: 'clear' });
    }
    return base.getContext('2d');
  };

  const buttons = () => {
    undoBtn.disabled = !hist.canUndo;
    redoBtn.disabled = !hist.canRedo;
  };

  function paint() {
    drawOp(g, { t: 'clear' });
    if (base) g.drawImage(base, 0, 0);
    for (const op of hist.done) drawOp(g, op);
    buttons();
  }

  const persist = () => {
    saveTimer = 0;
    const url = hist.canUndo || base ? canvas.toDataURL('image/png') : null;
    store.set(KEY, url);
    // over the storage quota the write fails; an older drawing coming back on reload would be worse than none
    if (url && store.get(KEY) !== url) store.set(KEY, null);
  };

  function redraw() {
    paint();
    sync();
  }

  function sync() {
    buttons();
    // the saved copy trails the last change a little, so a run of quick strokes encodes one PNG
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 400);
  }

  function commit(op) {
    const old = hist.push(op);
    if (old) drawOp(baseCtx(), old);
    sync();
  }

  // Pointer position in canvas units, whatever size CSS shows the canvas at
  const at = e => {
    const r = canvas.getBoundingClientRect();
    return [((e.clientX - r.left) * W) / r.width, ((e.clientY - r.top) * H) / r.height];
  };
  // Pens report pressure; a mouse always says 0.5 and many touch screens 0 or 1, so those draw at full size
  const width = e => (tool === 'eraser' ? size * 2 : e.pointerType === 'pen' ? size * (0.25 + 1.5 * (e.pressure || 0.5)) : size);

  over.addEventListener('pointerdown', e => {
    if (cur || e.button > 0) return;
    e.preventDefault();
    over.setPointerCapture(e.pointerId);
    const p = at(e);
    if (tool === 'pen' || tool === 'eraser') {
      cur = { id: e.pointerId, op: { t: 'pen', color: tool === 'eraser' ? PAPER : color, pts: [[...p, width(e)]] } };
      drawOp(g, cur.op);
    } else {
      cur = { id: e.pointerId, op: { t: tool, color, size, fill, a: p, b: p } };
    }
  });
  over.addEventListener('pointermove', e => {
    if (cur?.id !== e.pointerId) return;
    const op = cur.op;
    if (op.t === 'pen') {
      // untrusted events and some browsers give an empty list
      const list = e.getCoalescedEvents?.();
      for (const c of list?.length ? list : [e]) {
        const q = [...at(c), width(c)];
        segment(g, op.pts.at(-1), q);
        op.pts.push(q);
      }
    } else {
      op.b = at(e);
      og.clearRect(0, 0, W, H);
      drawOp(og, op);
    }
  });
  const end = e => {
    if (cur?.id !== e.pointerId) return;
    const { op } = cur;
    cur = null;
    og.clearRect(0, 0, W, H);
    if (op.t !== 'pen') {
      // a gesture that ends any other way (the browser took the touch) leaves no half-drawn shape
      if (e.type !== 'pointerup') return;
      drawOp(g, op);
    }
    commit(op);
  };
  // losing capture without a pointerup would otherwise leave cur set and block every later stroke
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) over.addEventListener(type, end);

  function save() {
    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob), d = new Date(), pad = n => String(n).padStart(2, '0');
      h('a', { href: url, download: `sketch-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.png` }).click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
  }

  v.teardown = () => {
    if (!saveTimer) return;
    clearTimeout(saveTimer);
    persist();
  };

  paint();
  const saved = store.get(KEY);
  if (saved) {
    const img = new Image();
    img.onload = () => { baseCtx().drawImage(img, 0, 0, W, H); paint(); };
    img.src = saved;
  }
}
