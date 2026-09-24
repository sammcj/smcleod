// Content rendering in windows: code copy buttons, Mermaid, MathJax and the related posts ticker.
// Renderers run through onMounted so routed and cached content gets them too; the heavy libraries load
// from a CDN only when a page needs them.
import { onMounted } from '../content.js';
import { copyButtons } from './code.js';
import { mermaidDiagrams } from './mermaid.js';
import { typesetMaths } from './math.js';
import { isPhone } from '../wm/windows.js';
import { loadLazy } from '../loader.js';

export function initContent({ addReaderAddon }) {
  onMounted(copyButtons);
  onMounted(mermaidDiagrams);
  onMounted(typesetMaths);
  // D27 on the desktop only (lazy/ticker.js); a post closed before the ticker loads never gets one
  addReaderAddon(ctx => {
    if (isPhone() || !ctx.scroller.querySelector('.rd-related a[href]')) return;
    let gone = false, close;
    loadLazy('ticker').then(m => { if (!gone) close = m.relatedTicker(ctx); }, err => console.error(err));
    return () => { gone = true; close?.(); };
  });
}
