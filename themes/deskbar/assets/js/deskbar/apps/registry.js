// Window apps. Extension point: an app is a module in this folder that calls defineApp() and is imported once
// from apps/index.js; nothing else needs editing. A page opens in an app when its <main> carries that kind,
// which a page sets with `window: <kind>` in front matter (see _partials/deskbar/window.html).
//
// defineApp({
//   kind: 'photos',                            // the data-window value this app handles
//   key: page => 'photos',                     // optional; one window per key, default one per app
//   geometry: (desk, tabH, page) => ({ w, h, x, y }), // optional default size and position of a new window;
//                                              // a page's windowWidth/windowHeight front matter overrides it
//   size: 'large',                             // optional, instead of geometry: an application's default size
//   tile: true,                                // optional; its new windows tile beside the others of the app
//   create: (key, page) => view,               // optional; default view is <div class="view app app-<kind>">
//   mount: (view, page, { hash, from, fresh }) => {}, // show page in view.el; fresh: the window is new
// })
//
// view.page, view.url and view.title follow the latest page before mount runs. To show the page's own
// content call mountContent(root, page, view) from ../content.js after inserting page.content(), so its
// scripts and onMounted hooks run. view.teardown(), if set, runs when the view closes.
//
// D12 anchors work the same in every window: a deep link's #hash, and an in-page link to a heading, scroll the
// view showing that page to the element with that id. A view can set scrollTo(id) to do this its own way.
import { h } from '../lib/dom.js';
import { createWindow, findView, focusView, renderTabs, deskRect, tabH, allViews, activeView, iconsRight, clearOfIcons, arrange } from '../wm/windows.js';
import { S } from '../wm/state.js';
import * as router from '../router.js';

export function scrollToAnchor(v, id) {
  if (!id) return;
  if (v.scrollTo) return v.scrollTo(id);
  v.el.querySelector('#' + CSS.escape(id))?.scrollIntoView({ block: 'start' });
}

// A same-page link (the address only gained a #hash): the view showing that page scrolls, the focused one first.
// Tracker names its place by route() alone, so a link to the address it shows raises it too (the Posts icon, D36).
router.register('hash', r => {
  const key = router.pageKey(r), shows = v => v?.url === key || v?.route?.() === key;
  const v = [S.focused && activeView(S.focused)].find(shows) || allViews().find(shows);
  if (!v) return;
  focusView(v);
  scrollToAnchor(v, router.safeDecode(r.hash.slice(1)));
});

// size: 'large', for applications: about 80% of the desk, starting right of the desktop icon column so the icons
// stay in reach, and centred in the room left. Phones show every window full screen whatever its size (D17).
function large(d, th) {
  const edge = iconsRight(), left = edge ? edge + 12 : 10;
  const room = d.w - left - 10, w = Math.min(room, Math.round(d.w * 0.8)), h = Math.round((d.h - th) * 0.9);
  return { w, h, x: left + (room - w) / 2, y: th + (d.h - th - h) / 2 };
}

// Front matter windowWidth and windowHeight replace the app's default size for that page, re-centred on the desk.
// A window that would cover the desktop icons starts just right of them instead, when it fits there.
function geometry(app, page) {
  const d = deskRect(), th = tabH(), g = (app.size === 'large' ? large : app.geometry)?.(d, th, page) || {};
  if (page.width || page.height) {
    g.w = Math.min(d.w - 20, page.width || g.w || 680);
    g.h = Math.min(d.h - th - 16, page.height || g.h || 460);
    Object.assign(g, { x: Math.max(10, (d.w - g.w) / 2), y: Math.max(th + 10, (d.h - g.h) / 2) });
  }
  if (g.w && g.x != null) g.x = clearOfIcons(g.x, g.w, d);
  return g;
}

function open(app, page, opts) {
  const key = app.key ? app.key(page) : app.kind;
  let v = findView(key);
  const fresh = !v;
  if (fresh) {
    // home is the address a dock item links to, which lights its running dot (panel.js); deep links add a query
    v = app.create ? app.create(key, page) : { el: h('div', { class: `view app app-${app.kind}` }), home: page.url.split('?')[0] };
    Object.assign(v, { key, icon: v.icon || page.icon || 'doc' });
    v.route ||= () => v.url;
  }
  Object.assign(v, { page, url: page.url, title: page.title });
  if (fresh) {
    createWindow(v, geometry(app, page));
    // side by side rather than piled up, leaving out any the visitor has moved, resized or snapped (wm/drag.js)
    if (app.tile) {
      v.tile = app.kind;
      const ws = S.wins.filter(w => !w.min && !w.snap && !w.placed && w.views.every(x => x.tile === app.kind));
      if (ws.length > 1) arrange(ws, { animate: false });
    }
  } else focusView(v);
  app.mount(v, page, { ...opts, fresh });
  renderTabs(v.win);
  scrollToAnchor(v, opts.hash);
}

export function defineApp(app) {
  router.register(app.kind, (page, opts) => open(app, page, opts));
}
