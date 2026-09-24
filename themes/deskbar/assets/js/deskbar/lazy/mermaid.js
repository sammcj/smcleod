// Mermaid diagrams, loaded when mounted content has a <pre class="mermaid"> (content/mermaid.js; the codeblock
// render hook emits them). The source text stays readable without JS. Diagrams re-render when the colour
// scheme changes, so each keeps its source in a data attribute once rendered.
// Mermaid is self-hosted from the theme's static/vendor/ (`make vendor-mermaid`). Same-origin needs no SRI, and its
// ESM build fetches only the chunks a diagram type uses: about 0.7MB gzipped for a flowchart, against 1.6MB for the
// single-file build that SRI on a CDN would need, since the ESM chunks carry no hashes.
// A site can move it by setting window.deskbarCDN = { mermaid: { src } } before the shell loads; tests use this to
// serve stubs.
import { isDark, onSchemeChange } from '../lib/scheme.js';

export const MERMAID = 'vendor/mermaid-12.0.0/mermaid.esm.min.mjs';

// The path is relative to this bundle (js/deskbar-lazy/mermaid.*.js) rather than the page, so a site served from
// a sub-path still finds it
function loadMermaid() {
  const src = globalThis.deskbarCDN?.mermaid?.src || new URL('../../' + MERMAID, import.meta.url).href;
  return import(src).then(m => m.default);
}

let lib = null, seq = 0;
const live = new Set();

// Mermaid redraws every pre.mermaid itself on the window load event unless told not to. On a page with many images
// that event comes after the import, while this module waits for fonts, and would empty the diagrams under it.
const load = () => (lib ||= loadMermaid().then(m => {
  m.initialize({ startOnLoad: false });
  return m;
}, err => { lib = null; throw err; }));

// Mermaid sizes each label box from a measurement of its text. Measured in a fallback font, labels clip once the
// web font arrives, so drawing waits for the font (regular and bold, as node and cluster labels use both).
function fontsReady(family) {
  const f = document.fonts;
  if (!f) return;
  return Promise.all([f.load(`16px ${family}`), f.load(`bold 16px ${family}`)]).catch(() => {}).then(() => f.ready);
}

async function draw(pre, mermaid) {
  const src = pre.dataset.src ??= pre.textContent.trim();
  try {
    const { svg, bindFunctions } = await mermaid.render('mmd-' + ++seq, src);
    pre.innerHTML = svg;
    bindFunctions?.(pre);
    pre.classList.add('drawn');
  } catch (err) {
    // leave the source showing rather than Mermaid's error graphic
    pre.textContent = src;
    console.error('mermaid', err);
  }
}

async function drawAll(pres) {
  const mermaid = await load();
  // an explicit font: Mermaid measures labels off-page, so 'inherit' would size them for the wrong font
  const fontFamily = getComputedStyle(document.documentElement).getPropertyValue('--ui').trim() || 'sans-serif';
  await fontsReady(fontFamily);
  mermaid.initialize({ startOnLoad: false, theme: isDark() ? 'dark' : 'default', fontFamily, securityLevel: 'strict' });
  for (const pre of pres) if (pre.isConnected) await draw(pre, mermaid);
}

let watching = false;
export function mermaidDiagrams({ root }) {
  const pres = [...root.querySelectorAll('pre.mermaid')];
  if (!pres.length) return;
  pres.forEach(p => live.add(p));
  if (!watching) {
    watching = true;
    onSchemeChange(() => {
      for (const p of live) if (!p.isConnected) live.delete(p);
      if (live.size) drawAll([...live]);
    });
  }
  return drawAll(pres).catch(err => console.error('mermaid failed to load', err));
}
