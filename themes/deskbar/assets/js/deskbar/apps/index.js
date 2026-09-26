// Every app registers itself when imported. Adding an app is one new module and one line here.
// Apps loaded on first open (loader.js) register here instead, with their code in ../lazy/<name>.js.
import { lazyApp } from '../loader.js';
import { allViews, findView, postsHome } from '../wm/windows.js';
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
lazyApp({ kind: 'about-desktop' });
lazyApp({ kind: 'sketch', size: 'large' });
lazyApp({ kind: 'chiptunes', geometry: () => ({ w: 400, h: 480 }) });
lazyApp({ kind: 'terminal', size: 'large' });
lazyApp({ kind: 'feeds', size: 'large' });
// the Control panel is as tall as the Posts window at its home spot, top edges level, and wide enough for rows of cards
lazyApp({ kind: 'control-panel', geometry: d => { const p = postsHome(), w = fitW(d, 900); return { w, h: p.h, x: Math.max(10, (d.w - w) / 2), y: p.y }; } });
