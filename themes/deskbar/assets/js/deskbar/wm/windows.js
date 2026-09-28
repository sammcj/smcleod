// Window lifecycle: create, tabs, focus and z-order, minimise, close, snap and restore.
// A window holds one or more views (stacked tabs). A view is { key, title, icon, el, route() } plus an optional
// teardown(), which runs when the view closes.
import { S, emit } from './state.js';
import { h, ico, stroke, LINK } from '../lib/dom.js';
import { snapRect, sideOf, splitFor, tileRects, overlaps, GAP } from './snap.js';
import { memberRects, joinBox, leaveBox, MIN_W } from './group.js';

let desk = null, viewIds = 0, phoneMq = null;
export function initWindows(el) {
  desk = el;
  addEventListener('scroll', () => { if (shown) places.set(shown, scrollY); }, { passive: true });
}
export const deskEl = () => desk;

// D17 phone mode: narrow screens, and phones turned sideways (short and touch driven), where a desktop layout of
// several windows has no room. The CSS phone blocks repeat this query; tests/f5-shell.test.mjs keeps them in step.
export const PHONE = '(max-width: 767px), (max-height: 500px) and (pointer: coarse)';
export const phoneQuery = () => (phoneMq ||= matchMedia(PHONE));
export const isPhone = () => phoneQuery().matches;

// View Transitions for windows opening, closing and swapping content. The update runs a frame later, so callers
// must not rely on the DOM change having happened. Start-up and reduced motion update at once, without animation.
// Returns the transition, or null when there is none.
export function transition(update) {
  if (S.booting || !document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) { update(); return null; }
  const vt = document.startViewTransition(update);
  // a newer transition skips this one, which is expected rather than an error
  vt.ready.catch(() => {});
  vt.finished.catch(() => {});
  vt.updateCallbackDone.catch(err => console.error(err));
  return vt;
}

// Minimise, restore and maximise as a transition of the window's own snapshot: it zooms into or out of its panel task
// (data-w), or its frame morphs from the old size to the new (the default group animation, timed in windows.css).
// Phones only update.
export function morph(wins, update) {
  if (isPhone()) return update();
  const task = w => document.querySelector(`#tasks [data-w="${w.id}"]`)?.getBoundingClientRect();
  const box = w => !w.el.hidden && w.el.getBoundingClientRect();
  // read before the update, while the boxes are still on screen
  const was = wins.map(w => [box(w), task(w)]);
  for (const w of wins) w.el.style.viewTransitionName = 'w-' + w.id;
  const vt = transition(update), clear = () => { for (const w of wins) w.el.style.viewTransitionName = ''; };
  if (!vt) return clear();
  vt.finished.then(clear, clear);
  vt.ready.then(() => wins.forEach((w, i) => {
    const [from, t0] = was[i], to = box(w), t = task(w) || t0;
    if (!from === !to || !t) return;
    const r = from || to;
    const away = { opacity: 0, transform: `translate(${t.x + t.width / 2 - r.x - r.width / 2}px, ${t.y + t.height / 2 - r.y - r.height / 2}px) scale(.1)` };
    // it stays solid for most of the way, so the frame reads as moving rather than dissolving
    const still = { opacity: 1, transform: 'none' }, solid = { opacity: 0.9, offset: from ? 0.6 : 0.4 };
    document.documentElement.animate(from ? [still, solid, away] : [away, solid, still], {
      duration: 180, easing: from ? 'cubic-bezier(.5, 0, .9, .6)' : 'cubic-bezier(.1, .4, .5, 1)', pseudoElement: `::view-transition-${from ? 'old' : 'new'}(w-${w.id})`,
    });
  }), () => {});
}

export const tabH = () => parseInt(getComputedStyle(document.documentElement).getPropertyValue('--tab-h'), 10) || 24;

// Right edge of the desktop icons, whose column wraps on short desks, so windows can open clear of them; 0 when
// they are hidden (phones)
export function iconsRight() {
  const r = [...document.querySelectorAll('#icons .dicon')].map(e => e.getBoundingClientRect()).filter(b => b.width);
  return r.length ? Math.max(...r.map(b => b.right)) - desk.getBoundingClientRect().left : 0;
}

// x for a window of width w that would start over the icons: just right of them when it fits there, else unchanged
export function clearOfIcons(x, w, d = deskRect()) {
  const edge = iconsRight(), left = edge ? edge + 12 : 10;
  return x < left && left + w <= d.w - 10 ? left : x;
}

// The Posts window's home spot (D36): where Recent posts used to open, just right of the icons. At most 630x830,
// which leaves the desktop in view on a large screen and reaches the dock on a smaller one
export function postsHome() {
  const d = deskRect(), y = 16 + tabH(), x = (iconsRight() || 102) + 22;
  return { x, y, w: Math.min(630, d.w - x - 8), h: Math.min(830, d.h - y - 8) };
}

// The floating dock covers the bottom of the desk, so windows stop above it
export function deskRect() {
  const dock = document.getElementById('dock');
  return { w: desk.clientWidth, h: desk.clientHeight - (dock ? dock.offsetHeight + 16 : 0) };
}

export const allViews = () => S.wins.flatMap(w => w.views);
export const findView = key => allViews().find(v => v.key === key);
export const activeView = w => w.views[w.active];
export const topWin = () => S.wins.filter(w => !w.min).sort((a, b) => b.z - a.z)[0] || null;

export function createWindow(view, geo = {}) {
  const d = deskRect(), th = tabH();
  const w = Math.min(geo.w || 680, d.w - 20), hh = Math.min(geo.h || 460, d.h - th - 12);
  const off = (S.wins.length % 5) * 28;
  const win = {
    id: S.nextId++, w, h: hh, z: 0, tabX: 0, views: [], active: 0, min: false, snap: null, prev: null, unmax: null,
    x: Math.round(geo.x ?? Math.max(10, (d.w - w) / 2 - 40 + off)), y: Math.round(geo.y ?? th + 16 + off),
  };
  win.tabsEl = h('div', { class: 'tabs' });
  win.viewsEl = h('div', { class: 'views' });
  // a named section is a region landmark; the role description tells screen readers it is a window
  win.el = h('section', { class: 'win', 'aria-roledescription': 'window' }, win.tabsEl, h('div', { class: 'frame' }, win.viewsEl, h('div', { class: 'grip', title: 'Resize' })));
  desk.append(win.el);
  S.wins.push(win);
  addView(win, view);
  place(win);
  focus(win);
  // keyboard focus follows a window the visitor opened, but not the ones the page restores at load
  if (!S.booting) win.tabsEl.querySelector('.tab.on .tt')?.focus({ preventScroll: true });
  return win;
}

export function addView(win, v) {
  v.win = win;
  v.el.dataset.key = v.key;
  win.views.push(v);
  win.viewsEl.append(v.el);
  win.active = win.views.length - 1;
  renderTabs(win);
}

export function place(w) {
  Object.assign(w.el.style, { left: w.x + 'px', top: w.y + 'px', width: w.w + 'px', height: w.h + 'px', zIndex: w.z });
}

// D4: explicit, labelled controls rather than Haiku's unlabelled squares
function ctl(cls, icon, label) {
  return h('button', { class: 'ctl ' + cls, type: 'button', 'aria-label': label }, ico(icon, ''));
}

// The title is a button so keyboard users can reach every window; stacked windows get tablist semantics.
// A lone tab carries the window's controls. In a stack each tab keeps only its close, and a grey handle after the tabs
// holds minimise and maximise: dragging the handle moves the stack, dragging a tab tears it off (wm/drag.js).
export function renderTabs(win) {
  const multi = win.views.length > 1, maxed = win.snap === 'max';
  const minMax = () => [ctl('min', 'c-min', 'Minimise'), ctl('max', maxed ? 'c-restore' : 'c-max', maxed ? 'Restore' : 'Maximise')];
  win.tabsEl.className = 'tabs' + (multi ? ' multi' : '');
  if (multi) win.tabsEl.setAttribute('role', 'tablist'); else win.tabsEl.removeAttribute('role');
  // re-rendering replaces the buttons, so keep keyboard focus on the same tab
  const had = [...win.tabsEl.children].findIndex(t => t.contains(document.activeElement));
  win.tabsEl.replaceChildren(...win.views.map((v, i) => {
    const on = i === win.active;
    v.el.id ||= 'view-' + (++viewIds);
    const t = h('div', { class: 'tab' + (on ? ' on' : ''), title: v.title },
      h('button', {
        class: 'tt', type: 'button', role: multi ? 'tab' : null, 'aria-selected': multi ? String(on) : null,
        'aria-controls': multi ? v.el.id : null, tabindex: multi && !on ? '-1' : null,
      }, v.title),
      ...(on && !multi ? minMax() : []),
      ctl('close', 'c-x', 'Close ' + v.title));
    t._view = v;
    if (multi) v.el.setAttribute('role', 'tabpanel'); else v.el.removeAttribute('role');
    return t;
  }), ...(multi ? [h('div', { class: 'th' }, ...minMax())] : []));
  if (had >= 0) win.tabsEl.children[Math.min(had, win.views.length - 1)]?.querySelector('.tt').focus({ preventScroll: true });
  win.views.forEach((v, i) => { v.el.hidden = i !== win.active; });
  win.el.setAttribute('aria-label', activeView(win)?.title || '');
  clampTab(win);
  if (win.el.isConnected) emit('tabs', win);
}

// Haiku tabs can slide along the top edge; keep a single tab within the frame width
export function clampTab(win) {
  const t = win.tabsEl.firstChild;
  if (!t || win.views.length > 1) return;
  // a group member's tab row stops short of the clips on its seams (windows.css)
  win.tabX = Math.max(0, Math.min(win.tabX, (win.tabsEl.clientWidth || win.w) - (t.offsetWidth || 0)));
  t.style.left = win.tabX + 'px';
}

// Focusing any window means the visitor has moved on, so a pending Home snapshot is discarded (D24). The rest of its
// group on screen comes up with it, just under it.
export function focus(win) {
  if (win) {
    S.home = null;
    win.min = false;
    for (const w of [...(win.group?.wins.filter(m => m !== win && !m.min) || []), win]) {
      w.z = ++S.z;
      w.el.style.zIndex = w.z;
    }
  }
  S.focused = win || null;
  refresh();
}

export function focusView(v) {
  const w = v.win;
  w.active = w.views.indexOf(v);
  renderTabs(w);
  focus(w);
}

// Phones scroll the page itself (windows.css), so each view, and the home screen, keeps its own place in it as the
// visitor moves between them
const places = new WeakMap(), HOME = {};
let shown = null;
// a view showing a new page starts at its top
export const forgetPlace = v => places.delete(v);

export function refresh() {
  const phone = isPhone();
  for (const w of S.wins) {
    // D17: phones show one full-screen window at a time
    w.el.hidden = w.min || (phone && w !== S.focused);
    w.el.classList.toggle('active', w === S.focused);
  }
  const top = phone ? S.wins.find(w => !w.el.hidden) : null, now = !phone ? null : top ? top.views[top.active] : HOME;
  if (now !== shown) {
    shown = now;
    if (now) scrollTo(0, places.get(now) || 0);
  }
  // phones hide the dock behind a full-screen window (see chrome.css)
  document.documentElement.classList.toggle('has-win', S.wins.some(w => !w.el.hidden));
  // a member back from minimised or maximised takes its slot again, and its seams come back
  for (const g of groups()) layoutGroup(g);
  drawDivider();
  shade();
  emit('refresh');
}

// Windows the front window, or its group, covers fade a little (windows.css), so the one in front stands out. Worked
// out from the window objects, not the DOM. Left as it is mid-drag, since every drag ends in a refresh or relayout.
function shade() {
  if (document.body.classList.contains('dragging')) return;
  const top = !isPhone() && topWin(), tops = top ? top.group?.wins || [top] : [], th = tabH();
  for (const w of S.wins) w.el.classList.toggle('under', !tops.includes(w) && !w.min && tops.some(t => overlaps(w, t, th)));
}

// Hiding or removing the window that holds keyboard focus would drop focus to <body>. Hand it to the window
// that comes to the front instead, or to the menu button when none is left.
function passFocus(w, hide) {
  const had = w.el.contains(document.activeElement);
  hide();
  if (had) (topWin()?.tabsEl.querySelector('.tab.on .tt') || document.getElementById('menuBtn'))?.focus({ preventScroll: true });
}

// A group member minimises on its own: the others keep their places (laidOut) and it comes back to its slot
export function minimise(w) {
  passFocus(w, () => {
    w.min = true;
    if (S.focused === w) S.focused = null;
    focus(topWin());
  });
}

export function closeView(v) {
  const w = v.win;
  if (w.views.length === 1) return closeWin(w);
  w.views.splice(w.views.indexOf(v), 1);
  v.teardown?.();
  v.el.remove();
  w.active = Math.min(w.active, w.views.length - 1);
  renderTabs(w);
  refresh();
  emit('closed', [v]);
}

export function closeWin(w) {
  leaveGroup(w);
  passFocus(w, () => {
    for (const v of w.views) v.teardown?.();
    w.el.remove();
    S.wins.splice(S.wins.indexOf(w), 1);
    focus(S.focused === w ? topWin() : S.focused);
  });
  emit('closed', w.views);
}

// A group member maximises on its own and keeps its slot to come back to; snapped anywhere else, it leaves the group
export function snapTo(w, zone) {
  if (zone !== 'max') leaveGroup(w);
  if (!w.snap) w.prev = { x: w.x, y: w.y, w: w.w, h: w.h };
  if (zone !== 'max') w.unmax = null;
  w.snap = zone;
  Object.assign(w, snapRect(zone, S.split, deskRect(), tabH()));
  place(w);
  renderTabs(w);
}

// Dragging or restoring a snapped window returns it to the size it had before snapping (D5)
export function unsnap(w) {
  if (!w.snap) return;
  w.snap = null;
  w.unmax = null;
  if (w.prev) Object.assign(w, w.prev);
  w.prev = null;
  place(w);
  renderTabs(w);
  if (w.group) layoutGroup(w.group);
}

// Maximising a half-snapped window remembers the half, so restore goes back to it rather than to free size
export function toggleMax(w) {
  if (isPhone()) return;
  if (w.snap === 'max') {
    const back = w.unmax;
    if (back) snapTo(w, back); else unsnap(w);
  } else {
    w.unmax = w.snap;
    snapTo(w, 'max');
  }
  focus(w);
}

// Tiles wins over area, by default the desk right of the icons (tileRects), in opening order. fill: each takes its
// whole tile, as the a key does; otherwise a window keeps its own width where that fits, centred along its tile's top,
// as folders do, and the windows in a row take the tallest one's height, so they line up. A group (D40) in wins takes
// its whole tile. animate: false inside a transition the caller already runs (router.js), which a second one would cut short.
export function arrange(wins, { fill = false, animate = true, area } = {}) {
  if (isPhone() || !wins.length) return;
  const d = deskRect(), edge = iconsRight(), x = edge ? edge + GAP : 0;
  const rects = tileRects(wins.length, area || { x, y: 0, w: d.w - x, h: d.h }, tabH());
  const hs = wins.map((w, i) => (fill ? rects[i].h : Math.min(w.h, rects[i].h)));
  const rowH = r => Math.max(...hs.filter((_, j) => rects[j].y === r.y));
  const update = () => {
    wins.forEach((w, i) => {
      const r = rects[i], ww = fill ? r.w : Math.min(w.w, r.w);
      if (w.wins) { Object.assign(w, r, { fill: false }); return layoutGroup(w); }
      Object.assign(w, { x: r.x + Math.round((r.w - ww) / 2), y: r.y, w: ww, h: rowH(r), snap: null, prev: null, unmax: null });
      renderTabs(w);
      place(w);
      clampTab(w);
    });
    drawDivider();
    shade();
  };
  return animate ? morph(wins.flatMap(u => u.wins || [u]), update) : update();
}

// Windows an app opens side by side (defineApp `tile`), leaving out any the visitor has moved, resized or snapped
// (wm/drag.js). An open Posts window anchors the desk: with 400px or more to its right they tile there instead, a
// lone one included, so opening either one clears the other.
export function retile(opts) {
  const pw = findView('tracker')?.win, d = deskRect(), x = pw && !pw.min && !pw.snap && !pw.group && pw.x + pw.w + GAP;
  const area = x && d.w - x >= 400 ? { x, y: 0, w: d.w - x, h: d.h } : undefined;
  for (const kind of new Set(allViews().map(v => v.tile).filter(Boolean))) {
    const ws = S.wins.filter(w => w !== pw && !w.min && !w.snap && !w.placed && w.views.every(v => v.tile === kind));
    if (ws.length > 1 || (area && ws.length)) arrange(ws, { ...opts, area });
  }
}

// The a key (wm/drag.js): tiles every open window, each filling its tile (a group sharing one), and the next press
// puts them back as they were. If windows opened, closed or minimised in between, it tiles afresh instead.
let arranged = null;
const PLACE = ['x', 'y', 'w', 'h', 'snap', 'prev', 'unmax', 'tabX', 'placed', 'share', 'fill'];
export function toggleArrange() {
  const open = S.wins.filter(w => !w.min), units = [...new Set(open.map(w => w.group || w))], was = arranged;
  if (isPhone() || !open.length) return;
  arranged = null;
  if (was?.length === units.length && was.every(([u]) => units.includes(u))) {
    return morph(open, () => {
      for (const [u, geo] of was) {
        Object.assign(u, geo);
        if (u.wins) { layoutGroup(u); continue; }
        renderTabs(u); place(u); clampTab(u);
      }
      relayout();
    });
  }
  arranged = units.map(u => [u, Object.fromEntries(PLACE.filter(k => k in u).map(k => [k, u[k]]))]);
  // arranged at the visitor's word, so these count as placed by hand (no more folder tiling)
  for (const w of open) w.placed = true;
  arrange(units, { fill: true });
}

export function relayout() {
  if (isPhone()) return;
  const d = deskRect(), th = tabH();
  for (const w of S.wins) {
    if (!w.snap) continue;
    Object.assign(w, snapRect(w.snap, S.split, d, th));
    place(w);
    clampTab(w);
  }
  for (const g of groups()) layoutGroup(g);
  drawDivider();
  shade();
}

// D40 window groups (wm/group.js). A member keeps the place it had before it joined (solo) when it was a window of
// its own then, and goes back there once the group is down to it: closing a post puts the Posts window back (D36).
const groups = () => [...new Set(S.wins.map(w => w.group).filter(Boolean))];
const SOLO = ['x', 'y', 'w', 'h', 'snap', 'prev', 'unmax'];
const free = { snap: null, prev: null, unmax: null };
// A group lays out while all of it is on screen: not on a phone (D17), and no member minimised or maximised, which
// leaves the others where they are and keeps its slot to come back to
export const laidOut = g => !isPhone() && g.wins.every(w => !w.min && !w.snap && S.wins.includes(w));

export function layoutGroup(g) {
  if (laidOut(g)) {
    if (g.fill) Object.assign(g, snapRect('max', 0.5, deskRect(), tabH()));
    memberRects(g, g.wins.map(w => w.share)).forEach((r, i) => {
      const w = g.wins[i];
      Object.assign(w, r);
      place(w);
    });
  }
  drawSeams(g);
}

// Each member after the first carries the seam on its left (windows.css): it resizes its neighbours, and its clip
// unjoins them or, dragged, moves the group (wm/drag.js)
function drawSeams(g) {
  const on = laidOut(g) && g.wins.length > 1;
  g.wins.forEach((w, i) => {
    w.el.classList.toggle('gl', on && i > 0);
    w.el.classList.toggle('gr', on && i < g.wins.length - 1);
    if (on && i && !w.seam) {
      const clip = h('button', { class: 'th clip', type: 'button', 'aria-label': 'Unjoin windows' });
      clip.innerHTML = `<svg viewBox="0 0 16 16" aria-hidden="true">${stroke(LINK, 1.6)}</svg>`;
      w.el.append(w.seam = h('div', { class: 'seam' }, clip));
    }
    clampTab(w);
  });
}

function ungroup(w) {
  w.group = w.solo = null;
  w.el.classList.remove('gl', 'gr');
}

// Where a group would go if w joined t's side ('l' or 'r'): its box, members and their shares. A fill group keeps
// the desk and makes room; any other grows, clear of the desktop icons if it was, and w takes what width is left when
// the desk runs out, the rest shrinking only once w is down to its minimum.
export function joinPlan(t, w, side) {
  const edge = iconsRight(), g = t.group;
  const box = g?.fill ? g : joinBox(g || t, w.w, side, deskRect(), tabH(), GAP, edge && edge + GAP);
  const wins = (g?.wins || [t]).filter(m => m !== w);
  // shares are only ratios (pairUp sets fractions), so in pixels here to weigh against w's width
  const sum = g ? g.wins.reduce((n, m) => n + m.share, 0) : 1, room = g ? g.w - GAP * (g.wins.length - 1) : 0;
  const shares = wins.map(m => (g ? (m.share * room) / sum : m.w));
  const i = wins.indexOf(t) + (side === 'r' ? 1 : 0), rest = box.w - GAP * wins.length - shares.reduce((n, s) => n + s, 0);
  wins.splice(i, 0, w);
  shares.splice(i, 0, g?.fill || rest < MIN_W ? w.w : Math.min(w.w, rest));
  return { box, wins, shares, at: i };
}

// w joins t's side, making t a group first. Joined by hand, so neither tiles with the folders any more (retile).
export function joinGroup(t, w, side) {
  leaveGroup(w);
  const { box, wins, shares } = joinPlan(t, w, side);
  let g = t.group;
  if (!g) {
    g = { wins: [], fill: t.snap === 'max' };
    t.solo = Object.fromEntries(SOLO.map(k => [k, t[k]]));
  }
  Object.assign(g, g.fill ? {} : box, { wins });
  wins.forEach((m, i) => Object.assign(m, free, { group: g, share: shares[i], placed: true }));
  w.solo = null;
  layoutGroup(g);
  focus(w);
}

// w takes t's place in its group, and t goes where w was (from)
export function swapInto(t, w, from) {
  const g = t.group;
  leaveGroup(w);
  g.wins[g.wins.indexOf(t)] = w;
  Object.assign(w, free, { group: g, share: t.share, solo: null, placed: true });
  ungroup(t);
  Object.assign(t, from);
  renderTabs(t);
  place(t);
  clampTab(t);
  layoutGroup(g);
  focus(w);
}

// Takes w out of its group. The others close up; one left on its own goes back to its solo place, if it has one.
export function leaveGroup(w) {
  const g = w.group;
  if (!g) return;
  const rects = memberRects(g, g.wins.map(m => m.share)), i = g.wins.indexOf(w);
  g.wins.splice(i, 1);
  ungroup(w);
  if (g.wins.length > 1) {
    if (!g.fill) Object.assign(g, leaveBox(g, rects, i));
    return layoutGroup(g);
  }
  const [last] = g.wins, solo = last.solo;
  ungroup(last);
  if (solo) Object.assign(last, solo);
  renderTabs(last);
  place(last);
  clampTab(last);
  relayout();
}

// The clip after member i: splits the group there. Both sides stay where they are, as groups of their own or windows.
export function unjoin(g, i) {
  for (const wins of [g.wins.slice(0, i), g.wins.slice(i)]) {
    if (wins.length === 1) { ungroup(wins[0]); continue; }
    const a = wins[0], z = wins.at(-1), ng = { wins, x: a.x, y: a.y, w: z.x + z.w - a.x, h: a.h, fill: false };
    for (const w of wins) Object.assign(w, { group: ng, share: w.w });
    drawSeams(ng);
  }
  refresh();
}

export function moveGroup(g, x, y) {
  Object.assign(g, { x, y, fill: false });
  layoutGroup(g);
}

// The reading layout (D7): a and b side by side across the desk, a taking split of it. The pair stays as the visitor
// left it when it is already grouped this way.
export function pairUp(a, b, split) {
  const g = a.group;
  if (g && g.wins.length === 2 && g.wins[0] === a && g.wins[1] === b) {
    // Home (D24) may have minimised or moved either
    for (const w of g.wins) { unsnap(w); w.min = false; }
    g.fill = true;
    return layoutGroup(g);
  }
  leaveGroup(a);
  leaveGroup(b);
  const ng = { wins: [a, b], fill: true };
  a.solo = Object.fromEntries(SOLO.map(k => [k, a[k]]));
  Object.assign(a, free, { group: ng, share: split, min: false });
  Object.assign(b, free, { group: ng, share: 1 - split, min: false });
  layoutGroup(ng);
}

export function drawDivider() {
  const dv = document.getElementById('divider');
  if (!dv) return;
  const vis = S.wins.filter(w => !w.min);
  dv.hidden = isPhone() || !vis.some(w => sideOf(w) === 'l') || !vis.some(w => sideOf(w) === 'r');
  if (dv.hidden) return;
  const d = deskRect();
  // Sits just above the snapped pair, so a floating window raised over them also covers the handle.
  // Ties with the top snapped window go to the later DOM node, so the handle is kept last.
  const z = Math.max(...vis.filter(sideOf).map(w => w.z));
  if (dv.nextElementSibling) dv.parentNode.append(dv);
  Object.assign(dv.style, { left: Math.round(d.w * S.split) - 7 + 'px', height: d.h + 'px', zIndex: z });
}

// Where a dragged window w would land: snapped to zone, or at the frame r it would join a group at (kind 'join') or
// take over in one ('swap'), each with its own mark (chrome.css)
export function preview(zone, w, r, kind) {
  const pv = document.getElementById('snapPreview');
  pv.hidden = !zone && !r;
  pv.className = kind || '';
  if (pv.hidden) return;
  const th = tabH();
  r ||= snapRect(zone, splitFor(S.wins, w, zone, S.split), deskRect(), th);
  Object.assign(pv.style, { left: r.x + 'px', top: r.y - th + 'px', width: r.w + 'px', height: r.h + th + 'px' });
}
