// About this desktop (`window: about-desktop`): what built the site and how much the shell weighs, above the
// page's own text (credits). Loaded on first open through lazyApp (loader.js).
import { h } from '../lib/dom.js';

// Gzipped size of a file, as scripts/size-budget.mjs counts it. The files are already in the browser cache.
export async function gzSize(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return (await new Response(res.body.pipeThrough(new CompressionStream('gzip'))).arrayBuffer()).byteLength;
}

// The shell's script and stylesheet, plus Spotlight's pair, which the search button loads on first open
export function shellFiles(doc) {
  const btn = doc.getElementById('searchBtn');
  return [
    doc.querySelector('script[type=module][src*="/js/deskbar."]')?.src,
    doc.querySelector('link[rel=stylesheet][href*="/css/deskbar."]')?.href,
    btn?.dataset.module, btn?.dataset.css,
  ].filter(Boolean);
}

export const kb = bytes => (bytes / 1024).toFixed(1) + 'KB';

// Each on-demand bundle and whether this visit has loaded it yet, as the loader counts (loader.js)
function lazyList() {
  const urls = JSON.parse(document.getElementById('deskbar-lazy')?.textContent || '{}');
  const done = window.deskbar.loaded();
  return Object.keys(urls).map(name => h('li', {}, name, h('small', {}, done.includes(name) ? ' loaded' : ' not loaded')));
}

async function measure(dd) {
  const files = shellFiles(document);
  try {
    const sizes = await Promise.all(files.map(gzSize));
    dd.textContent = `${kb(sizes.reduce((a, b) => a + b, 0))} gzipped, in ${files.length} files`;
  } catch (err) {
    console.error(err);
    dd.textContent = 'unknown';
  }
}

export function mount(v, page, { fresh }) {
  if (!fresh) return;
  const size = h('dd', {}, 'measuring…');
  const facts = h('dl', { class: 'about-facts' },
    h('dt', {}, 'Built with'), h('dd', {}, document.querySelector('meta[name=generator]')?.content || 'unknown'),
    h('dt', {}, 'Shell'), size,
    h('dt', {}, 'On demand'), h('dd', {}, h('ul', {}, lazyList())),
  );
  const body = h('div', { class: 'about-body scroller' }, ...page.content());
  const header = body.querySelector('.rd > header');
  if (header) header.after(facts); else body.prepend(facts);
  v.el.append(body);
  measure(size);
  window.deskbar.mountContent(body, page, v);
}
