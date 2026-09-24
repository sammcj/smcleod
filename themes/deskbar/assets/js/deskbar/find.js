// Find in post: a reader toolbar button, whose find bar (lazy/find.js) loads on the first press. The bar paints
// matches with the CSS Custom Highlight API; browsers without it get no button and keep their own find.
import { svgBtn, stroke } from './lib/dom.js';
import { addReaderAddon } from './reader.js';
import { loadLazy } from './loader.js';

const bars = new WeakMap();
// the module once loaded, so a press opens the bar within its user activation (iOS raises the keyboard only then)
let mod = null, warmed = null;
const get = () => loadLazy('find').then(m => (mod = m));

export function initFind() {
  if (typeof Highlight !== 'function' || !globalThis.CSS?.highlights) return;
  addReaderAddon(({ view, scroller }) => {
    const tools = view.el.querySelector('.toolbar');
    if (!tools) return;
    let s = bars.get(view);
    if (!s) {
      bars.set(view, s = { bar: null });
      const run = m => { s.bar ||= m.makeBar(view, scroller, btn); s.bar.toggle(); };
      const btn = svgBtn('Find in page', stroke('M7 12A5 5 0 1 0 7 2a5 5 0 0 0 0 10zM10.6 10.6L14 14'), () => (mod ? run(mod) : get().then(run, console.error)), 'tb nav fd-btn');
      btn.setAttribute('aria-expanded', 'false');
      btn.addEventListener('pointerover', () => { warmed ||= get().catch(() => {}); });
      tools.append(btn);
    }
    s.bar?.refresh();
    return () => s.bar?.clear();
  }, { pages: true });
}
