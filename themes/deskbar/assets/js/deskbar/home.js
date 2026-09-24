// D24: the Home button works like XFCE's Show desktop. The first press snapshots the layout, minimises everything and
// shows the Posts window at its home spot (D36); the second press (or browser Back) puts it back exactly. Opening
// anything in between discards the snapshot (windows.focus clears S.home) and the hidden windows stay minimised in the panel.
import { S, on, geoOf } from './wm/state.js';
import { refresh, place, renderTabs, clampTab, topWin, morph, findView, closeView } from './wm/windows.js';
import { plainClick } from './lib/dom.js';
import { showPosts } from './tracker.js';
import * as router from './router.js';

// Pure layout logic below works on plain window objects so it can be unit tested

// posts: the Posts window as it was before Home moved it, which the caller puts back after a restore
export function snapshotLayout(state, path, scrollsOf = () => [], posts) {
  const vis = state.wins.filter(w => !w.min);
  if (!vis.length) return null;
  return {
    path, posts, focused: state.focused, split: state.split,
    wins: vis.map(win => ({ win, geo: geoOf(win), scrolls: scrollsOf(win) })),
  };
}

export function enterHome(state, path, scrollsOf, posts) {
  const snap = snapshotLayout(state, path, scrollsOf, posts);
  if (snap) state.home = snap;
  for (const w of state.wins) w.min = true;
  state.focused = null;
  return snap;
}

// Windows closed while home are skipped; the rest get their geometry, stacking and focus back
export function restoreLayout(state) {
  const s = state.home;
  if (!s) return null;
  state.home = null;
  state.split = s.split;
  for (const { win, geo } of s.wins) {
    if (!state.wins.includes(win)) continue;
    Object.assign(win, geo, { min: false, active: Math.min(geo.active, win.views.length - 1) });
  }
  state.focused = state.wins.includes(s.focused) && !s.focused.min ? s.focused : null;
  return s;
}

// DOM side

// Hidden windows lose their scroll offsets, so record every scrolled container
const scrollsOf = w => [...w.el.querySelectorAll('.scroller')].filter(e => e.scrollTop).map(e => [e, e.scrollTop]);

// The Posts window's geometry and whether it was minimised, or null when it was closed
function postsWas() {
  const w = findView('tracker')?.win;
  return w ? { win: w, geo: geoOf(w), min: w.min } : null;
}

// from: the path being left, which Back or a second Home press returns to
export function showHome(from) {
  enterHome(S, from || router.currentPath(), scrollsOf, postsWas());
  showPosts();
  refresh();
}

export function restoreHome() {
  const s = restoreLayout(S);
  if (!s) return false;
  for (const { win } of s.wins) {
    if (!S.wins.includes(win)) continue;
    renderTabs(win);
    place(win);
    clampTab(win);
  }
  // a Posts window Home opened closes again, and one that was minimised goes back to the panel as it was
  const p = s.posts, pv = findView('tracker');
  if (!p) {
    if (pv) closeView(pv);
  } else if (p.min && S.wins.includes(p.win)) {
    Object.assign(p.win, p.geo, { min: true });
    renderTabs(p.win);
    place(p.win);
  }
  S.focused ||= topWin();
  refresh();
  // offsets only stick once the windows are displayed again
  for (const r of s.wins) for (const [el, top] of r.scrolls) el.scrollTop = top;
  return true;
}

let homePath = '/', homeTitle = '';

// The title of what is on top once the layout is back
const topTitle = () => { const w = topWin(); return w?.views[w.active]?.page?.docTitle; };

// Windows zoom into their panel tasks and back out again (morph), as they do when minimised one at a time
function goHome() {
  if (S.home) {
    const p = S.home.path;
    return morph(S.home.wins.map(r => r.win).filter(w => S.wins.includes(w)), () => {
      restoreHome();
      if (p !== router.currentPath()) router.push(p, topTitle());
    });
  }
  const here = router.currentPath(), pw = findView('tracker')?.win;
  // already the desktop: nothing on screen but the Posts window
  if (here === homePath && pw && !pw.min && S.wins.every(w => w.min || w === pw)) return;
  morph(S.wins.filter(w => !w.min), () => {
    showHome(here);
    if (here !== homePath) router.push(homePath, homeTitle);
  });
}

export function initHome() {
  // the panel's and the dock's (home-btn.html)
  const btns = [...document.querySelectorAll('.home-btn')];
  homePath = btns[0].getAttribute('href') || '/';
  homeTitle = btns[0].dataset.docTitle || '';
  for (const btn of btns) {
    // a toggle (aria-pressed) must be a button to assistive tech; it stays a link so it works without JS
    btn.setAttribute('role', 'button');
    btn.addEventListener('keydown', e => { if (e.key === ' ') { e.preventDefault(); btn.click(); } });
    btn.addEventListener('click', e => {
      if (!plainClick(e)) return;
      e.preventDefault();
      goHome();
    });
  }
  // Back from Home returns to the snapshot rather than re-routing the old URL
  router.onPop(key => {
    if (!S.home || S.home.path !== key || !restoreHome()) return false;
    const t = topTitle();
    if (t) document.title = t;
    return true;
  }, { first: true });
  on('refresh', () => {
    const label = S.home ? 'Restore windows' : 'Home';
    for (const btn of btns) {
      btn.classList.toggle('on', !!S.home);
      btn.setAttribute('aria-pressed', String(!!S.home));
      btn.title = label;
    }
  });
}
