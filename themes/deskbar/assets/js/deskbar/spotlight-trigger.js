// Spotlight search (D28): the panel button, any Search launcher and the optional shortcuts, Cmd/Ctrl+K and "/".
// This is all that sits in the shell bundle. The overlay and its stylesheet (lazy/spotlight.js) load on first open,
// and the site index named on the button (_partials/deskbar/spotlight.html) straight after.
// The shortcuts are an extra (D3), so they never fire while someone is typing into a field.
import { loadLazy } from './loader.js';

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
  if (!btn) return;
  function open(from) {
    btn.setAttribute('aria-busy', 'true');
    loadLazy('spotlight').then(m => m.openSpotlight({ index: btn.dataset.index, from }))
      .catch(err => console.error(err))
      .finally(() => btn.removeAttribute('aria-busy'));
  }
  // launchers with { action: search } (launcher-link.html) share the panel button's index
  for (const b of document.querySelectorAll('#searchBtn, [data-action="search"]')) b.addEventListener('click', () => open(b));
  document.addEventListener('keydown', e => {
    if (!shortcut(e) || isTyping(e.target) || document.querySelector('dialog.spotlight[open]')) return;
    e.preventDefault();
    open(document.activeElement);
  });
}
