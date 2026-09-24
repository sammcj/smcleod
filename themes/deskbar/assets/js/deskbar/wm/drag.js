// Pointer handling for windows: move by a lone tab, a stack's handle or the frame, resize by grip, snap on release,
// slide tabs, stack windows by dropping a tab or handle on another window's tabs, tear tabs off a stack, and drag the
// shared divider. Pointer events cover touch too. Also the window keys: q, w, f, a, ? and `.
import { OWN_KEYS } from '../lib/dom.js';
import { loadLazy } from '../loader.js';
import { S } from './state.js';
import { zoneAt, splitFor, clampSplit } from './snap.js';
import {
  createWindow, renderTabs, clampTab, focus, refresh, place, snapTo, unsnap, toggleMax, relayout,
  drawDivider, preview, deskRect, deskEl, tabH, isPhone, closeView, minimise, focusView, transition, morph, toggleArrange,
} from './windows.js';

function pt(e) {
  const r = deskEl().getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

// Listeners sit on window so touch keeps tracking when the element under the finger re-renders.
// When the pressed element is re-rendered away, Chromium re-hit-tests the press point and can start a
// native drag of whatever link is there now (a desktop icon), cancelling the pointer stream; noDrag stops that.
const noDrag = ev => ev.preventDefault();
export function drag(e, onMove, onEnd) {
  const sx = e.clientX, sy = e.clientY;
  let moved = false;
  addEventListener('dragstart', noDrag, true);
  const mv = ev => {
    const dx = ev.clientX - sx, dy = ev.clientY - sy;
    if (!moved && Math.hypot(dx, dy) < 5) return;
    if (!moved) document.body.classList.add('dragging');
    moved = true;
    onMove(dx, dy, ev);
  };
  const up = ev => {
    removeEventListener('pointermove', mv);
    removeEventListener('pointerup', up);
    removeEventListener('pointercancel', up);
    removeEventListener('dragstart', noDrag, true);
    document.body.classList.remove('dragging');
    onEnd?.(moved, ev);
  };
  addEventListener('pointermove', mv);
  addEventListener('pointerup', up);
  addEventListener('pointercancel', up);
}

let lastTap = { t: 0, w: null };

// v: the view whose tab was pressed, or null for a stack's handle
function onTabDown(e, win, v) {
  const idx = win.views.indexOf(v);
  if (v && idx !== win.active) { win.active = idx; renderTabs(win); }
  focus(win);
  if (isPhone() || e.button > 0) return;
  const multi = win.views.length > 1, th = tabH(), otx = win.tabX;
  // a tab in a stack tears off into its own window; a lone tab or a stack's handle moves the window
  let mode = multi && v ? 'detach' : !multi && e.shiftKey ? 'slide' : 'move';
  let dw = win, target = null, zone = null;
  const p0 = pt(e);
  let gx = p0.x - win.x, gy = p0.y - win.y;
  // Haiku slides tabs with shift-drag; press-and-hold gives touch and pen users the same thing. A mouse keeps
  // shift, since holding still before a drag is normal with a mouse and must not turn a move into a slide.
  const hold = mode === 'move' && !multi && e.pointerType !== 'mouse' ? setTimeout(() => { mode = 'slide'; win.tabsEl.firstChild?.classList.add('sliding'); }, 380) : 0;
  const mark = el => { target?.classList.remove('drop'); target = el || null; target?.classList.add('drop'); };
  drag(e, (dx, dy, ev) => {
    clearTimeout(hold);
    if (mode === 'slide') { win.tabX = otx + dx; clampTab(win); return; }
    const p = pt(ev);
    if (mode === 'detach') { dw = detachView(v, p); gx = 40; gy = -th / 2; mode = 'move'; }
    if (dw.snap) { const f = gx / dw.w; unsnap(dw); gx = Math.round(f * dw.w); drawDivider(); }
    const d = deskRect();
    dw.x = Math.round(Math.min(Math.max(p.x - gx, 60 - dw.w), d.w - 60));
    dw.y = Math.round(Math.min(Math.max(p.y - gy, th), d.h - 10));
    place(dw);
    dw.el.classList.add('ghost');
    zone = zoneAt(p, d);
    preview(zone, dw);
    const t = zone ? null : document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.tab, .th');
    mark(t && !dw.el.contains(t) ? t : null);
  }, moved => {
    clearTimeout(hold);
    win.tabsEl.firstChild?.classList.remove('sliding');
    dw.el.classList.remove('ghost');
    preview(null);
    if (!moved) {
      // D4: double-click (or double-tap) on a tab toggles maximise
      const now = Date.now();
      if (now - lastTap.t < 350 && lastTap.w === win) { lastTap.w = null; morph([win], () => toggleMax(win)); return; }
      lastTap = { t: now, w: win };
      return;
    }
    // moved by hand, so no longer tiled with the folders that open after it (arrange)
    dw.placed = true;
    const tgt = target;
    mark(null);
    if (zone) {
      if (zone !== 'max') S.split = splitFor(S.wins, dw, zone, S.split);
      snapTo(dw, zone);
      relayout();
      refresh();
      return;
    }
    if (tgt) { stackInto(dw, S.wins.find(w => w.el.contains(tgt))); return; }
    refresh();
  });
}

function detachView(v, p) {
  const src = v.win;
  src.views.splice(src.views.indexOf(v), 1);
  src.active = Math.min(src.active, src.views.length - 1);
  renderTabs(src);
  const g = src.prev || src;
  return createWindow(v, { w: g.w, h: g.h, x: p.x - 40, y: p.y + tabH() / 2 });
}

function stackInto(src, dst) {
  for (const v of src.views) { v.win = dst; dst.views.push(v); dst.viewsEl.append(v.el); }
  dst.active = dst.views.length - 1;
  // a free-floating stack takes the larger of the two sizes, so a post dropped on the compact Posts window isn't squeezed into it
  if (!dst.snap) {
    const d = deskRect();
    dst.w = Math.min(Math.max(dst.w, src.w), d.w - dst.x);
    dst.h = Math.min(Math.max(dst.h, src.h), d.h - dst.y);
    place(dst);
  }
  src.el.remove();
  S.wins.splice(S.wins.indexOf(src), 1);
  renderTabs(dst);
  focus(dst);
}

function onGrip(e, w) {
  const ow = w.w, oh = w.h;
  // the size readout Haiku and XFCE show while resizing; screen readers skip it, the size is visual feedback only
  let size;
  drag(e, (dx, dy) => {
    if (w.snap) { w.snap = w.prev = w.unmax = null; renderTabs(w); }
    w.w = Math.max(300, ow + dx);
    w.h = Math.max(180, oh + dy);
    place(w);
    clampTab(w);
    if (!size) { size = document.createElement('div'); size.className = 'sizer'; size.setAttribute('aria-hidden', 'true'); e.target.before(size); }
    size.textContent = `${Math.round(w.w)} × ${Math.round(w.h)}`;
  }, () => { size?.remove(); w.placed = true; refresh(); });
}

function onFrameDrag(e, w) {
  const th = tabH();
  let ox = w.x, oy = w.y;
  drag(e, (dx, dy) => {
    if (w.snap) { unsnap(w); ox = w.x; oy = w.y; }
    w.x = ox + dx;
    w.y = Math.max(th, oy + dy);
    place(w);
  }, moved => { if (moved) w.placed = true; refresh(); });
}

function onDivider(e) {
  drag(e, (dx, dy, ev) => { S.split = clampSplit(pt(ev).x / deskRect().w, deskRect().w); relayout(); });
}

export function initPointer(desk) {
  desk.addEventListener('pointerdown', e => {
    if (e.target.id === 'divider') return onDivider(e);
    const win = S.wins.find(w => w.el.contains(e.target));
    if (!win) return;
    if (e.target.closest('.ctl')) return;
    const tab = e.target.closest('.tab, .th');
    if (tab) return onTabDown(e, win, tab._view);
    if (S.focused !== win) focus(win);
    if (isPhone()) return;
    if (e.target.classList.contains('grip')) onGrip(e, win);
    else if (e.target.classList.contains('frame')) onFrameDrag(e, win);
  });
  desk.addEventListener('click', e => {
    // Enter or Space on a tab title; pointer presses were already handled on pointerdown
    const tt = e.target.closest('.tab .tt');
    if (tt && e.detail === 0) return focusView(tt.closest('.tab')._view);
    const b = e.target.closest('.tabs .ctl');
    if (!b) return;
    const w = S.wins.find(w => w.el.contains(b));
    if (b.classList.contains('close')) transition(() => closeView(b.closest('.tab')._view));
    else if (b.classList.contains('min')) morph([w], () => minimise(w));
    else morph([w], () => toggleMax(w));
  });
  // Tabbing into a window raises it, as a click does, so the focused control is never behind another window
  desk.addEventListener('focusin', e => {
    const win = S.wins.find(w => w.el.contains(e.target));
    if (win && S.focused !== win) focus(win);
  });
  // arrow keys move between stacked tabs, as in any tablist
  desk.addEventListener('keydown', e => {
    const tt = e.target.closest?.('.tabs.multi .tt');
    if (!tt || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    e.preventDefault();
    const v = tt.closest('.tab')._view, w = v.win, n = w.views.length;
    focusView(w.views[(w.views.indexOf(v) + (e.key === 'ArrowRight' ? 1 : n - 1)) % n]);
    w.tabsEl.querySelector('.tab.on .tt').focus();
  });
  // q or w closes the focused window's front tab, as its close button does, f maximises or restores it, a tiles
  // every open window or puts them back, ? lists the shortcuts (lazy/shortcuts.js), and ` or ~ drops the terminal
  // down (lazy/quake.js); not while a field, dialog or menu has the keys, bar ` in the terminal's own line, which
  // puts it away
  document.addEventListener('keydown', e => {
    const k = e.key;
    if (!'qwaf?`~'.includes(k) || k.length !== 1 || e.repeat || e.isComposing || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    const own = k === '`' && e.target.closest?.('.term');
    if (!own && (e.target.closest?.(OWN_KEYS) || document.querySelector(':popover-open, dialog[open]'))) return;
    const w = S.focused;
    e.preventDefault();
    if (k === '`' || k === '~') return loadLazy('quake').then(m => m.quake(), console.error);
    if (k === '?') return loadLazy('shortcuts').then(m => m.showShortcuts(), console.error);
    if (k === 'a') return toggleArrange();
    if (!w || w.min) return;
    if (k === 'f') { if (!isPhone()) morph([w], () => toggleMax(w)); return; }
    transition(() => closeView(w.views[w.active]));
  });
}
