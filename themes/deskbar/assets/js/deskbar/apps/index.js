// Every app registers itself when imported. Adding an app is one new module and one line here.
// Apps loaded on first open (loader.js) register here instead, with their code in ../lazy/<name>.js.
import { lazyApp } from '../loader.js';
import './page.js';
import './gallery.js';
import './tools.js';

// a window's width: max, or the desktop's less a margin
const fitW = (d, max) => Math.min(d.w - 20, max);

// Applications open large (apps/registry.js); dialogs, panels and the compact Chiptunes player keep their own sizes
lazyApp({ kind: 'photos', size: 'large' });
lazyApp({ kind: 'mail', geometry: (d, th) => ({ w: fitW(d, 620), h: Math.min(d.h - th - 16, 560), x: Math.max(10, (d.w - fitW(d, 620)) / 2), y: th + 30 }) });
lazyApp({ kind: 'about-desktop' });
lazyApp({ kind: 'sketch', size: 'large' });
lazyApp({ kind: 'chiptunes', geometry: () => ({ w: 400, h: 480 }) });
lazyApp({ kind: 'terminal', size: 'large' });
lazyApp({ kind: 'feeds', size: 'large' });
lazyApp({ kind: 'control-panel', geometry: (d, th) => ({ w: fitW(d, 720), h: Math.min(d.h - th - 20, 660), x: Math.max(10, (d.w - fitW(d, 720)) / 2), y: th + 20 }) });
