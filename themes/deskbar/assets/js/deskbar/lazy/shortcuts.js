// The ? key's list of keyboard shortcuts (wm/drag.js), in Spotlight's tab and frame so every look styles it too.
// Shortcuts are extras (D3), so this lists them rather than teaching them. ? again, Escape or a press outside closes it.
import { h } from '../lib/dom.js';
import { keyList } from '../lib/shortcut-list.js';

let dlg;

function build() {
  const close = h('button', { class: 'sk-close', type: 'button', 'aria-label': 'Close (Esc)' }, 'Esc');
  dlg = h('dialog', { class: 'shortcuts', 'aria-labelledby': 'sk-title' },
    h('div', { class: 'sp-tab', id: 'sk-title' }, 'Keyboard shortcuts'),
    h('div', { class: 'sp-frame sk-frame' }, close, ...keyList()));
  close.addEventListener('click', () => dlg.close());
  // a press on the backdrop lands on the dialog itself, outside its frame
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('keydown', e => { if (e.key === '?') { e.preventDefault(); dlg.close(); } });
  document.body.append(dlg);
}

export function showShortcuts() {
  if (!dlg) build();
  if (!dlg.open) dlg.showModal();
}
