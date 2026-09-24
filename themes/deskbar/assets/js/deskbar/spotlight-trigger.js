// Spotlight search (D28): the panel button and the optional shortcuts, Cmd/Ctrl+K and "/". This is all that
// sits in the shell bundle. The overlay (spotlight.js), its stylesheet and the site index are separate files
// named on the button (_partials/deskbar/spotlight.html) and loaded on first open.
// The shortcuts are an extra (D3), so they never fire while someone is typing into a field.
import * as router from './router.js';

export const isTyping = el => !!el && (el.isContentEditable || !!el.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])'));

// Which shortcut, if any, a keydown is: 'k' for Cmd/Ctrl+K, '/' for a bare slash
export function shortcut(e) {
  if (e.defaultPrevented || e.isComposing || e.altKey) return '';
  const mod = e.metaKey || e.ctrlKey;
  if (mod && !e.shiftKey && e.key?.toLowerCase() === 'k') return 'k';
  if (!mod && e.key === '/') return '/';
  return '';
}

export function initSpotlight() {
  const btn = document.getElementById('searchBtn');
  if (!btn?.dataset.module) return;
  if (/Mac|iPhone|iPad/.test(navigator.platform)) btn.title = 'Search (⌘K or /)';
  let mod = null;
  function open(from) {
    mod ||= import(btn.dataset.module);
    btn.setAttribute('aria-busy', 'true');
    mod.then(m => m.openSpotlight({ index: btn.dataset.index, css: btn.dataset.css, go: router.go, from }))
      .catch(err => { mod = null; console.error(err); })
      .finally(() => btn.removeAttribute('aria-busy'));
  }
  btn.addEventListener('click', () => open(btn));
  document.addEventListener('keydown', e => {
    if (!shortcut(e) || isTyping(e.target) || document.querySelector('dialog.spotlight[open]')) return;
    e.preventDefault();
    open(document.activeElement);
  });
}
