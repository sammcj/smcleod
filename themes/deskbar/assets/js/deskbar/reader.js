// Reader windows. Posts share one reader with back/forward (D8) and open in the reading layout (D7):
// Tracker snapped to the left quarter, the reader in the right three quarters, and Escape puts Tracker back (D36).
// Posts dragged out of Tracker get post windows of their own (openPosts, D32). Other pages use makeReader through the
// page app (apps/page.js), one window each.
import { S, emit, on as onWm, geoOf } from './wm/state.js';
import { h, svgBtn, stroke, SHARE, MARKDOWN, copyText, OWN_KEYS, toTop, scrollerOf } from './lib/dom.js';
import { trail, visit } from './lib/trail.js';
import { clampSplit } from './wm/snap.js';
import {
  createWindow, findView, allViews, focusView, focus, renderTabs, snapTo, relayout, deskRect, tabH, isPhone, transition,
  closeView, place, clampTab, morph, forgetPlace,
} from './wm/windows.js';
import { ensureTracker } from './tracker.js';
import { textSize, get, set, on, nextWidth } from './settings.js';
import { mountContent } from './content.js';
import { loadLazy } from './loader.js';
import { initContent } from './content/index.js';
import * as router from './router.js';

// Reader width and text size are the same settings the Control panel's Posts pane changes (settings.js)
const widthLabel = w => `Reader width: ${w}`;
on((k, w) => {
  if (k === 'readerWidth') for (const b of document.querySelectorAll('.tb.width')) { b.title = widthLabel(w); b.setAttribute('aria-label', widthLabel(w)); }
});

const widthBtn = () => svgBtn(widthLabel(get('readerWidth')), stroke('M1.5 3v10M14.5 3v10M4 8h8M6 6 4 8l2 2M10 6l2 2-2 2', 1.6), () => set('readerWidth', nextWidth(get('readerWidth'))), 'tb nav width');

// Extension point: addReaderAddon(fn, { pages }) calls fn({ view, page, scroller, win }) each time a reader
// shows a page, once its window is placed. fn may return a cleanup function; it runs before the next page is
// shown and when the view closes. The post reader runs every addon, page windows only those with pages: true.
const addons = [];
export const addReaderAddon = (fn, { pages = false } = {}) => { addons.push({ fn, pages }); };

const safely = (fn, ...args) => { try { return fn(...args); } catch (err) { console.error(err); } };


// Heading text without the "#" link the render hook appends
const headingLabel = x => [...x.childNodes].filter(n => !n.classList?.contains('hlink')).map(n => n.textContent).join('').trim();

function contents(art, onPick) {
  const heads = [...art.querySelectorAll('.rd-body h2[id], .rd-body h3[id]')];
  if (heads.length < 3) return '';
  return h('select', { 'aria-label': 'Contents', title: 'Contents', onchange: e => { onPick(e.target.value); e.target.value = ''; } },
    h('option', { value: '' }, 'Contents'),
    heads.map(x => h('option', { value: x.id }, (x.tagName === 'H3' ? ' ' : '') + headingLabel(x))));
}

export function makeReader(key, icon, withNav) {
  const art = h('div', { class: 'rd-host' }), scroll = h('div', { class: 'rd-scroll scroller' }, art);
  const tocSlot = h('span', { class: 'toc' });
  const v = { key, icon, title: '', url: '', home: '', page: null };
  v.route = () => v.url;
  v.scrollTo = id => {
    const t = id && art.querySelector('#' + CSS.escape(id));
    if (t) t.scrollIntoView({ block: 'start' });
  };
  const t = v.trail = trail();
  const step = d => {
    const to = t.pos + d;
    if (to < 0 || to >= t.list.length) return;
    t.moving = to;
    router.go(t.list[to], null, { into: key });
  };
  const back = withNav && svgBtn('Back', stroke('M10 3L5 8l5 5'), () => step(-1));
  const fwd = withNav && svgBtn('Forward', stroke('M6 3l5 5-5 5'), () => step(1));
  // Share and Copy as markdown run in the context menu's bundle. It loads as the pointer or focus reaches the toolbar,
  // so a press runs within its user activation, which Safari needs for sharing and the clipboard.
  // Warmed once, so an offline visitor's pointer over the toolbar doesn't retry on every move.
  let warmed;
  const menu = () => loadLazy('context-menu'), warm = () => { warmed ||= menu().catch(() => {}); };
  const act = (label, svg, fn) => svgBtn(label, svg, () => menu().then(m => m[fn](v), console.error));
  const mdBtn = act('Copy as markdown', stroke(MARKDOWN), 'copyMarkdown');
  v.visit = (url, pop, replace) => {
    visit(t, url, pop, replace);
    if (!back) return;
    back.disabled = t.pos <= 0;
    fwd.disabled = t.pos >= t.list.length - 1;
  };
  v.el = h('div', { class: 'view reader' },
    h('div', { class: 'toolbar', onpointerover: warm, onfocusin: warm }, back, fwd,
      h('button', { class: 'tb', type: 'button', title: 'Smaller text', 'aria-label': 'Smaller text', onclick: () => textSize(-1) }, 'A-'),
      h('button', { class: 'tb', type: 'button', title: 'Larger text', 'aria-label': 'Larger text', onclick: () => textSize(1) }, 'A+'),
      widthBtn(),
      tocSlot, act('Share', stroke(SHARE), 'shareView'), mdBtn),
    scroll);
  // D12: the "#" beside a heading copies its link; the router then scrolls and updates the address bar.
  // Touch screens have no hover, so tapping a heading reveals its link instead.
  art.addEventListener('click', e => {
    const hl = e.target.closest('a.hlink');
    if (!hl) {
      const head = e.target.closest('.rd-body :is(h2, h3, h4)[id]');
      for (const x of art.querySelectorAll('.show-link')) if (x !== head) x.classList.remove('show-link');
      head?.classList.toggle('show-link');
      return;
    }
    if (!navigator.clipboard) return;
    copyText(new URL(hl.getAttribute('href'), location.href).href)
      .then(() => { hl.classList.add('copied'); setTimeout(() => hl.classList.remove('copied'), 1400); }, () => {});
  });
  const cleanups = [];
  v.teardown = () => { for (const fn of cleanups.splice(0)) safely(fn); };
  // callers place the window first, so addons always get a real win and scroller
  v.set = page => {
    v.teardown();
    art.replaceChildren(...page.content());
    toTop(scroll);
    // a phone's reader may be hidden behind the home screen as the next post loads into it
    forgetPlace(v);
    Object.assign(v, { page, title: page.title, url: page.url });
    tocSlot.replaceChildren(contents(art, id => router.go(v.url + '#' + id)));
    mdBtn.hidden = !art.querySelector('[data-md]');
    if (v.win) renderTabs(v.win);
    for (const a of addons) {
      if (!withNav && !a.pages) continue;
      const done = safely(a.fn, { view: v, page, scroller: scroll, win: v.win });
      if (typeof done === 'function') cleanups.push(done);
    }
    mountContent(art, page, v);
    // after a content swap, keyboard and screen reader users start at the new page's heading
    const head = !S.booting && art.querySelector('h1');
    if (head) { head.tabIndex = -1; head.focus({ preventScroll: true }); }
  };
  return v;
}

function readerGeo() {
  const d = deskRect(), w = Math.min(d.w - 40, 1060);
  return { w, h: d.h - tabH() - 16, x: (d.w - w) / 2, y: tabH() + 8 };
}

export function readingLayout(rw) {
  if (isPhone()) return;
  const tv = ensureTracker({ focus: false });
  const tw = tv.win;
  if (tw !== rw) {
    if (tw.views[tw.active] !== tv) { tw.active = tw.views.indexOf(tv); renderTabs(tw); }
    tw.min = false;
    S.split = clampSplit(0.25, deskRect().w);
    snapTo(tw, 'l');
  }
  snapTo(rw, tw === rw ? 'max' : 'r');
  relayout();
  focus(rw);
}

// Posts dragged out of Tracker (dragout-trigger.js), or a Tracker selection, open in windows of their
// own: sized like a page window, cascading from at (a desk point, or centred), and left out of the reading layout
// (D7). Each has its own trail, keeping its links and Back and Forward (showPost's into). A post already in one is
// brought forward. The last is on top and becomes the address.
let posts = 0;
const size = () => { const d = deskRect(); return { w: Math.min(d.w - 20, 680), h: Math.min(680, d.h - 60) }; };
export async function openPosts(urls, at) {
  const opens = (await Promise.all(urls.map(u => router.loadAside(u).catch(() => null)))).filter(Boolean);
  const d = deskRect(), th = tabH(), { w, h } = size(), s = 28 * (opens.length - 1);
  const fit = (n, lo, hi) => Math.round(Math.max(lo, Math.min(n, hi)));
  // the pointer rests on the new tab, as when a tab is torn off (wm/drag.js)
  const x = fit(at ? at.x - 40 : (d.w - w - s) / 2, 0, d.w - w - s), y = fit(at ? at.y + th / 2 : (d.h - h - s) / 2, th, d.h - h - s);
  transition(() => {
    let v;
    opens.forEach((open, i) => { v = open({ into: 'post:' + ++posts, own: true, geo: { w, h, x: x + 28 * i, y: y + 28 * i } }); });
    if (v) router.push(v.url, v.page.docTitle, v.key);
  });
}

// keep: keyboard focus stays where it was (Tracker's arrow keys), so the window it is in stays the focused one;
// replace: the browser replaced its history entry, so the reader's own history does too;
// into: the post window of its own that a link or history entry names; own: a post window of its own in any case,
// one already showing the post or else a new one at geo (openPosts, a shared layout); from, was: the address and title
// being left (router.js)
export function showPost(page, { hash, pop, keep, replace, into, own, geo, from, was }) {
  const wasHome = !!S.home, had = keep && document.activeElement;
  const mine = x => x.key.startsWith('post:') && (x.key === into || (own && x.url === page.url));
  const solo = own || (into?.startsWith('post:') && allViews().some(mine));
  let v = solo ? allViews().find(mine) : findView('reader');
  if (!v) {
    // the reading layout is about to take a Posts window that is on screen, so Escape can put it back (D36)
    const tv = !solo && !isPhone() && findView('tracker');
    // hist, at: the history entry this post was pushed as, so Escape can step back over it (router.backTo)
    const back = tv && !tv.win.min ? { win: tv.win, geo: geoOf(tv.win), split: S.split, route: tv.route(), path: from, title: was, hist: !pop && !replace && history.length, at: router.currentPath() } : null;
    v = makeReader(solo ? into || 'post:' + ++posts : 'reader', 'doc', true);
    v.back = back;
    const win = createWindow(v, solo ? geo || size() : readerGeo());
    if (!solo) readingLayout(win);
    v.set(page);
  } else {
    if (v.url !== page.url) v.set(page);
    // coming back from Home with a post: bring Tracker back beside the reader (phones show one window, D17)
    if (wasHome && !solo && !isPhone()) readingLayout(v.win); else focusView(v);
  }
  v.visit(page.url, pop, replace);
  if (!solo) emit('reading', v.url);
  v.scrollTo(hash);
  // focusing it again raises its window (the desk's focusin), after the reader came forward
  if (had?.isConnected) had.focus({ preventScroll: true });
  return v;
}

// Space and Shift+Space page through the focused reader, as in a browser, while keyboard focus is outside its text:
// on its tab, left in Tracker by a click, or nowhere. Fields, buttons and dialogs keep their Space.
function pageKeys(e) {
  if (e.key !== ' ' || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
  const w = S.focused, sc = w?.views[w.active].el.querySelector('.rd-scroll'), t = e.target;
  if (!sc || t.closest(OWN_KEYS + ', button:not(.tt)')) return;
  e.preventDefault();
  // a phone's page leaves room for its sticky panel, tab and toolbar
  const by = scrollerOf(sc);
  by.scrollBy({ top: (e.shiftKey ? -1 : 1) * (by.clientHeight - (by === sc ? 60 : 160)), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
}

// D36: Escape in the reader, or in the Posts window beside it, closes the post and puts the Posts window back where
// and how big it was before the reading layout took it, with the address it was opened from. A post opened any
// other way, or in a window of its own (D32), leaves Escape alone. So does an open menu, dialog or lightbox, Home
// (D24), a Tracker closed or moved to another window since, and another tab of a stack either of them is in.
function escKeys(e) {
  const v = findView('reader'), back = v?.back, tv = findView('tracker'), w = S.focused;
  if (e.key !== 'Escape' || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || !back || isPhone() || S.home) return;
  if (tv?.win !== back.win || v.win.min || !w || ![v, tv].includes(w.views[w.active])) return;
  if (e.target.closest?.(OWN_KEYS) || document.querySelector(':popover-open, dialog[open]')) return;
  e.preventDefault();
  // the post's own entry is on top, nothing pushed since: step back over it (closing the post renames it first)
  const tw = back.win, step = back.hist === history.length && router.currentPath() === back.at;
  morph([tw], () => {
    closeView(v);
    Object.assign(tw, back.geo, { min: false, active: Math.min(back.geo.active, tw.views.length - 1) });
    S.split = back.split;
    renderTabs(tw);
    place(tw);
    clampTab(tw);
    relayout();
    focus(tw);
    tw.tabsEl.querySelector('.tab.on .tt')?.focus({ preventScroll: true });
    // a Tracker moved on to another place keeps the address closing the reader gave it (main.js afterClose)
    if (!back.path || tv.route() !== back.route) return;
    if (step) { router.replace(back.at); router.backTo(back.path, back.title); }
    else router.replace(back.path, back.title);
  });
}

export function initReader() {
  initContent({ addReaderAddon });
  document.addEventListener('keydown', pageKeys);
  document.addEventListener('keydown', escKeys);
  // Tracker marks the post the shared reader shows, so that goes when the reader does
  onWm('closed', views => { if (views.some(x => x.key === 'reader')) emit('reading', ''); });
}
