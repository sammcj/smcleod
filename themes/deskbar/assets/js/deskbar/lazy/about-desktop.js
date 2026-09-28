// About this desktop (`window: about-desktop`): the page's own text, the ? key's shortcut list, then what built the
// site, how much the shell weighs and which bundles load on demand. Loaded on first open through lazyApp (loader.js).
import { h } from '../lib/dom.js';
import { keyList } from '../lib/shortcut-list.js';

// Gzipped size of a file, as scripts/size-budget.mjs counts it. The files are already in the browser cache.
export async function gzSize(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return (await new Response(res.body.pipeThrough(new CompressionStream('gzip'))).arrayBuffer()).byteLength;
}

// The shell's script and stylesheet
export const shellFiles = doc => [
  doc.querySelector('script[type=module][src*="/js/deskbar."]')?.src,
  doc.querySelector('link[rel=stylesheet][href*="/css/deskbar."]')?.href,
].filter(Boolean);

export const kb = bytes => (bytes / 1024).toFixed(1) + 'KB';

// The on-demand bundles, folded to a count, and whether this visit has loaded each yet, as the loader counts (loader.js)
function lazyList() {
  const names = Object.keys(JSON.parse(document.getElementById('deskbar-lazy')?.textContent || '{}'));
  const done = window.deskbar.loaded();
  return h('details', {}, h('summary', {}, `${names.length} bundles, ${names.filter(n => done.includes(n)).length} loaded so far`),
    h('ul', {}, names.map(name => h('li', {}, name, h('small', {}, done.includes(name) ? ' loaded' : ' not loaded')))));
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
    h('dt', {}, 'On demand'), h('dd', {}, lazyList()),
  );
  const body = h('div', { class: 'about-body scroller' }, ...page.content());
  (body.querySelector('.rd-body') || body).append(
    h('h2', {}, 'Keyboard shortcuts'), h('div', { class: 'about-keys' }, ...keyList('h3')),
    h('h2', {}, 'Under the hood'), facts);
  v.el.append(body);
  measure(size);
  window.deskbar.mountContent(body, page, v);
}
