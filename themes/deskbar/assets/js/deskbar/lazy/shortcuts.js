// The ? key's list of keyboard shortcuts (wm/drag.js), in Spotlight's tab and frame so every look styles it too.
// Shortcuts are extras (D3), so this lists them rather than teaching them. ? again, Escape or a press outside closes it.
import { h } from '../lib/dom.js';

const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+';
const GROUPS = [
  ['Anywhere', [
    [[mod + 'K', '/'], 'Search'],
    [['?'], 'Show this list'],
    [['a'], 'Tile every window, and again to put them back'],
    [['f'], 'Maximise or restore the focused window'],
    [['q', 'w'], "Close the focused window's front tab"],
    [['`', '~'], 'Drop the terminal down from the top, and ` again to put it away'],
    [['Esc'], 'Close a post opened from Tracker, a menu or a dialog'],
    [['Shift+F10'], 'Open the context menu'],
  ]],
  ['Tracker and posts', [
    [['↑', '↓'], 'Move through posts, the reader following'],
    [['Shift+↑', 'Shift+↓'], 'Select several posts'],
    [['Enter'], 'Open the selected posts'],
    [['Space'], 'Page through the open post'],
  ]],
  ['Windows, Photos and folders', [
    [['←', '→'], 'Switch between stacked tabs, or photos'],
    [['Alt+↑', 'Backspace'], 'Up to the parent folder'],
  ]],
];

let dlg;

function build() {
  const close = h('button', { class: 'sk-close', type: 'button', 'aria-label': 'Close (Esc)' }, 'Esc');
  dlg = h('dialog', { class: 'shortcuts', 'aria-labelledby': 'sk-title' },
    h('div', { class: 'sp-tab', id: 'sk-title' }, 'Keyboard shortcuts'),
    h('div', { class: 'sp-frame sk-frame' }, close,
      ...GROUPS.map(([title, rows]) => h('section', {},
        h('h2', {}, title),
        h('dl', {}, ...rows.flatMap(([keys, what]) => [
          h('dt', {}, ...keys.flatMap((k, i) => [i ? ' ' : '', h('kbd', {}, k)])), h('dd', {}, what),
        ]))))));
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
