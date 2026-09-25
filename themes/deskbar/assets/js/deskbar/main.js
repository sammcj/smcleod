// Shell entry point. The page is a complete document on its own; this turns it into the desktop:
// the prerendered <main> becomes the first window and internal links load into windows from then on.
//
// Extension points (each documented where it lives):
// - apps/registry.js  defineApp({ kind, key, geometry, create, mount }), one module per app in apps/
// - loader.js         code loaded on first use, outside the 45KB shell. lazyApp({ kind, name = kind, key, geometry })
//                     in apps/index.js, with lazy/<name>.js exporting mount(view, page, opts) and optional
//                     css/deskbar/lazy/<name>.css. loadLazy(name) resolves to such a module for non-window features.
//                     Lazy modules import only lib/ and reach the shell through window.deskbar, which has
//                     loadLazy too, so one lazy feature can start another (the terminal's screensaver).
// - content.js        onMounted(fn({ root, page, view })) after page content and its scripts are in a window
// - wm/windows.js    wm: { S, findView, minimise, place, clampTab, tabH } for lazy features that place windows
// - reader.js         addReaderAddon(fn({ view, page, scroller, win }) => cleanup?, { pages })
// - router.js         onPop(fn(key) => handled?, { first }) on Back/Forward
// - settings.js       settings.get(k), set(k, v), on(fn(k, v)) for visitor settings (theme, palette, dock, ...)
// Site scripts outside the bundle (hooks/body-end.html) get the same functions without load-order worries:
//   (window.deskbar ||= []).push(api => api.onMounted(...))
// Functions queued before the shell starts run before the first page is shown; later pushes run at once.
import { S, on } from './wm/state.js';
import {
  initWindows, relayout, refresh, place, clampTab, focus, focusView, renderTabs, topWin, deskRect, allViews, findView, isPhone, phoneQuery,
  snapTo, unsnap, closeWin, minimise, tabH,
} from './wm/windows.js';
import { initPointer } from './wm/drag.js';
import { initPanel } from './wm/panel.js';
import { takeLayout, decodeLayout } from './wm/layout.js';
import { loadIndex } from './index-data.js';
import { clampSplit } from './wm/snap.js';
import { initSettings, settings } from './settings.js';
import { initTracker, initTrackerRoute, showPosts } from './tracker.js';
import { initReader, showPost, openPosts, addReaderAddon, readingLayout } from './reader.js';
import { initPhoneHome } from './phone-home.js';
import { initMenu } from './menu.js';
import { initFind } from './find.js';
import { initSpotlight } from './spotlight-trigger.js';
import { initContextMenu } from './context-menu-trigger.js';
import { initHome, showHome } from './home.js';
import { onMounted, mountContent } from './content.js';
import { defineApp } from './apps/registry.js';
import './apps/index.js';
import { loadLazy, loaded } from './loader.js';
import { store } from './lib/store.js';
import { plainClick } from './lib/dom.js';
import * as router from './router.js';
function onResize() {
  const d = deskRect();
  for (const w of S.wins) {
    if (w.snap) continue;
    w.x = Math.min(w.x, d.w - 60);
    w.y = Math.min(w.y, d.h - 10);
    place(w);
    clampTab(w);
  }
  // phones ignore the split, and clamping it to a phone's width would lose the 25/75 reading layout for good
  if (!isPhone()) S.split = clampSplit(S.split, d.w);
  relayout();
  refresh();
}

// After a window closes, point the address bar at what is still showing, or the desktop's address when nothing that
// has one is left. An app's route can carry its own state (Photos' ?album=) that the address doesn't, so paths compare.
function afterClose(views) {
  const path = h => router.routeFor(h, location.href)?.path;
  if (!views.some(v => path(v.route()) === path(location.href))) return;
  const top = topWin(), v = top && top.views[top.active], home = document.getElementById('homeBtn');
  if (v?.route()) router.replace(v.route(), v.page?.docTitle);
  else router.replace(home.getAttribute('href'), home.dataset.docTitle);
}

// A shared link's ?layout= (wm/layout.js): open its other windows beside the page the address names, then put
// back their snaps and stacking. Windows the layout doesn't list (the Posts window the desktop opens with) close. A page
// that no longer loads is left out. If the visitor opens something while the pages load, the layout is dropped.
const key = href => router.pageKey(router.routeFor(href, location.href));
async function restoreLayout({ wins, split }) {
  if (!wins.length) return;
  const primary = router.currentPath();
  const opens = await Promise.all(wins.map(w => (key(w.route) === primary ? null : router.loadAside(w.route).catch(() => null))));
  if (router.currentPath() !== primary) return;
  // part of start-up: no animation, and keyboard focus stays where it is
  S.booting = true;
  try {
    opens.forEach((open, i) => open?.({ own: wins[i].own }));
    const keep = new Set([primary, ...wins.map(w => key(w.route))]);
    for (const w of S.wins.slice()) if (!w.views.some(v => keep.has(v.route()) || keep.has(v.url))) closeWin(w);
    if (split) S.split = clampSplit(split, deskRect().w);
    for (const w of wins) {
      const k = key(w.route), v = allViews().find(x => x.route() === k || x.url === k);
      if (!v) continue;
      if (w.snap) snapTo(v.win, w.snap); else unsnap(v.win);
      focus(v.win);
    }
    relayout();
  } finally {
    S.booting = false;
  }
}

// Screen saver (lazy/screensaver.js) after params.deskbar.screensaver.minutes (data-saver) without input, or the
// visitor's own deskbar:saver minutes (0 for never; the Control panel sets it, read afresh on every input). Never
// while a post or page shows in a window on screen, so it can't cover someone reading.
// A link to /screensaver/ (a page for visitors without JS, listed in the menu) starts it instead of opening.
function initSaver() {
  const saver = how => loadLazy('screensaver').then(m => m[how](), () => {});
  document.addEventListener('click', e => {
    if (plainClick(e) && e.target.closest?.('a[href$="/screensaver/"]')?.origin === location.origin) { e.preventDefault(); saver('start'); }
  }, true);
  let t;
  const minutes = () => store.get('saver', +document.documentElement.dataset.saver);
  const arm = () => {
    clearTimeout(t);
    // asked again when the time comes, as the press that turned it off also armed it
    if (minutes() > 0) t = setTimeout(() => minutes() > 0 && !document.querySelector('.win:not([hidden]) .view.reader:not([hidden])') && saver('idle'), minutes() * 6e4);
  };
  for (const e of ['pointermove', 'pointerdown', 'keydown', 'wheel']) addEventListener(e, arm, true);
  arm();
}

function boot() {
  const root = document.documentElement, desk = document.getElementById('desk'), main = document.getElementById('content');
  if (!desk || !main) return;
  root.classList.add('wm');
  // phones scroll the page, and each view keeps its own place (wm/windows.js), so a reload starts at the top
  history.scrollRestoration = 'manual';
  initWindows(desk);
  initPointer(desk);
  initSettings();
  const index = loadIndex(root.dataset.index);
  router.useFrames(index.then(i => i.frames));
  initTracker(index);
  initPhoneHome(index);
  initMenu(index);
  initFind();
  initSpotlight();
  initContextMenu();
  initPanel();
  initHome();
  initReader();
  initTrackerRoute();
  initSaver();
  router.register('reader', showPost);
  router.register('home', (_, { from }) => { if (from) showHome(from); else refresh(); });
  on('closed', afterClose);
  addEventListener('resize', onResize);
  // The window switcher lives in the dock, but phones hide the dock while a window is open, so there it moves to the
  // panel. Home is in both already (home-btn.html).
  const placeChrome = () => {
    const $ = id => document.getElementById(id), wins = $('winsBtn');
    if (isPhone()) $('themeBtn')?.before(wins);
    else $('dock')?.append(wins);
  };
  placeChrome();
  let phoneStart = isPhone();
  phoneQuery().addEventListener('change', () => {
    placeChrome();
    relayout();
    S.wins.forEach(place);
    focus(S.focused || topWin());
    // a post opened on a phone has no layout yet; on the desktop it gets the reading layout (D7)
    const rv = findView('reader');
    if (!isPhone() && rv && !rv.win.snap && !rv.win.min) readingLayout(rv.win);
    // a desktop that started as a phone gets the Posts window it would have opened with, once, so one the visitor
    // closes stays closed
    if (phoneStart && !isPhone()) { phoneStart = false; showPosts(true); }
  });
  // lazy bundles reach the shell through these (loader.js); router and the window functions serve Photos, openPosts
  // and isPhone the drag-out (lazy/dragout.js) and the context menu
  const api = {
    defineApp, addReaderAddon, onMounted, mountContent, settings, onPop: router.onPop, go: router.go, loadLazy, loaded, openPosts,
    router: { push: router.push, replace: router.replace }, focusView, renderTabs, isPhone, push: fn => fn(api),
    wm: { S, findView, minimise, place, clampTab, tabH },
  };
  const queued = Array.isArray(window.deskbar) ? window.deskbar : [];
  window.deskbar = api;
  for (const fn of queued) { try { fn(api); } catch (err) { console.error(err); } }
  // a shared layout is applied once and then dropped, so the address bar only ever names the page
  const { value: layout, rest } = takeLayout(location.search);
  if (layout != null) history.replaceState(history.state, '', location.pathname + rest + location.hash);
  const lay = decodeLayout(layout), page = router.pageFromMain(main, location.href, document.title);
  root.classList.add('wm-ready');
  // the page the address names may be one of the layout's post windows of their own
  router.startRouter(page, { own: lay.wins.some(w => w.own && key(w.route) === page.url) });
  // a window took the content if its kind shows it; drop what is left so heading ids stay unique
  main.replaceChildren();
  // D36: the desktop starts with the Posts window beside the icons, under anything the page opened
  showPosts(true);
  if (!allViews().length) refresh();
  S.booting = false;
  if (layout) restoreLayout(lay).catch(err => console.error(err));
}

try {
  boot();
} catch (err) {
  // leave a readable document rather than a broken desktop, with links working as plain links again
  router.stopRouter();
  document.documentElement.classList.remove('wm', 'wm-ready');
  throw err;
}
