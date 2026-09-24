// Context menu trigger: right-click, long-press on touch (iOS fires no contextmenu event), and the Menu key or
// Shift+F10. Only the choice of whose menu to show lives in the shell; the menu is lazy/context-menu.js.
import { loadLazy } from './loader.js';

// The shell's menu replaces the browser's everywhere on the desktop, the page itself (focus on <body>) included.
// Post and page text (.rd) keeps the browser's, links included: its copy and link items
// (new tab, copy address, save) are what readers expect there. So do form fields and dialogs, the Photos lightbox
// among them (Save image).
// Selected text (the terminal's, say) keeps the browser's menu too, for its Copy.
export const ownsMenu = t => t?.closest?.('.wm body') && !t.closest('.rd,input,textarea,[contenteditable],dialog,[role=dialog]') && !selected(t);

// t lies in the selection: the selection touches it, and t is no wider than the selection's own container
function selected(t) {
  const s = globalThis.getSelection?.();
  if (!s?.rangeCount || s.isCollapsed) return false;
  const a = s.getRangeAt(0).commonAncestorContainer;
  return (a.nodeType === 1 ? a : a.parentNode).contains(t) && s.containsNode(t, true);
}

export function initContextMenu() {
  let timer = 0, x = 0, y = 0, eat = false;
  const stop = () => clearTimeout(timer);
  // at: the event with the pointer position, or null from the keyboard (lazy/context-menu.js places it by the target)
  const show = (e, t, at) => {
    stop();
    if (!ownsMenu(t)) return;
    e.preventDefault();
    loadLazy('context-menu').then(m => m.openMenu(t, at), console.error);
  };
  document.addEventListener('contextmenu', e => show(e, e.target, e));
  document.addEventListener('keydown', e => {
    if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) show(e, document.activeElement, null);
  });
  document.addEventListener('pointerdown', e => {
    stop();
    eat = false;
    // a press something has claimed (a Sketch stroke) is not a long-press
    if (e.pointerType !== 'touch' || e.defaultPrevented || !ownsMenu(e.target)) return;
    x = e.clientX;
    y = e.clientY;
    timer = setTimeout(() => { eat = true; show(e, e.target, e); }, 550);
  });
  addEventListener('pointermove', e => { if (Math.hypot(e.clientX - x, e.clientY - y) > 10) stop(); });
  addEventListener('pointerup', stop);
  addEventListener('pointercancel', stop);
  // the finger lifting after a long-press would otherwise click (open) the link it rests on. Keyboard clicks
  // (detail 0) pass, in case no such click came.
  document.addEventListener('click', e => { if (eat && e.detail) { eat = false; e.preventDefault(); e.stopPropagation(); } }, true);
}
