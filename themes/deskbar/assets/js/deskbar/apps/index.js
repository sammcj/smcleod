// Every app registers itself when imported. Adding an app is one new module and one line here.
// Apps loaded on first open (loader.js) register here instead, with their code in ../lazy/<name>.js.
import { lazyApp } from '../loader.js';
import { allViews, findView, postsHome, iconsRight } from '../wm/windows.js';
import './page.js';
import './gallery.js';
import './tools.js';

// a window's width: max, or the desktop's less a margin
const fitW = (d, max) => Math.min(d.w - 20, max);

// Applications open large (apps/registry.js); dialogs, panels and the compact Chiptunes player keep their own sizes
// Folders tile beside each other, one window per folder. A folder opened from inside a folder window, or returned to
// by Back or Forward, shows in that window instead: the router keeps the key of the window a link was pressed in with
// the history entry (into), which wins even when another window shows that folder. A window keeps the key of the
// first folder it showed, so entries that name it find it. Opened from outside a folder, one already on screen is raised.
lazyApp({
  kind: 'folder',
  tile: true,
  key: page => {
    const into = findView(history.state?.into);
    const v = into?.tile === 'folder' ? into : allViews().find(x => x.tile === 'folder' && x.url === page.url);
    return v ? v.key : 'folder:' + page.url;
  },
  geometry: (d, th) => ({ w: fitW(d, 600), h: Math.min(d.h - th - 16, 420), x: Math.max(10, (d.w - fitW(d, 600)) / 2), y: th + 50 }),
});
lazyApp({ kind: 'photos', size: 'large' });
lazyApp({ kind: 'mail', geometry: (d, th) => ({ w: fitW(d, 620), h: Math.min(d.h - th - 16, 560), x: Math.max(10, (d.w - fitW(d, 620)) / 2), y: th + 30 }) });
// About this desktop reads like a page but carries more, so it opens as tall as the Posts window's home spot. Beside an
// open Posts window, top edges level: on its right when at least 400px is left there, else on its left (clear of the
// icons), else against the far side of the desk from Posts, covering as little of it as it can. Centred without Posts.
lazyApp({ kind: 'about-desktop', geometry: d => {
  const p = postsHome(), pw = findView('tracker')?.win, w = fitW(d, 820);
  if (!pw || pw.min) return { w, h: p.h, x: Math.max(10, (d.w - w) / 2), y: p.y };
  const y = pw.y, h = Math.min(p.h, d.h - y - 8), edge = (iconsRight() || -2) + 12;
  const right = d.w - (pw.x + pw.w + 12) - 10, left = pw.x - 12 - edge;
  if (right >= 400) return { w: Math.min(w, right), h, x: pw.x + pw.w + 12, y };
  if (left >= 400) return { w: Math.min(w, left), h, x: pw.x - 12 - Math.min(w, left), y };
  return { w, h, x: pw.x + pw.w / 2 < d.w / 2 ? Math.max(10, d.w - w - 10) : edge, y };
} });
lazyApp({ kind: 'sketch', size: 'large' });
lazyApp({ kind: 'enterprise', size: 'large' });
lazyApp({ kind: 'chiptunes', geometry: () => ({ w: 400, h: 480 }) });
lazyApp({ kind: 'terminal', size: 'large' });
// Feeds: a feed's own address (?feed=, lazy/feeds.js) is a tab of its own in the Feeds window
lazyApp({ kind: 'feeds', size: 'large', stack: true, key: page => { const f = new URL(page.url, location.href).searchParams.get('feed'); return f ? 'feeds:' + f : 'feeds'; } });
// the Control panel is as tall as the Posts window at its home spot, top edges level, and wide enough for rows of cards
lazyApp({ kind: 'control-panel', geometry: d => { const p = postsHome(), w = fitW(d, 900); return { w, h: p.h, x: Math.max(10, (d.w - w) / 2), y: p.y }; } });
