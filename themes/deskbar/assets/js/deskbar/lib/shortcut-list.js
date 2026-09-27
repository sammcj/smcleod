// Every keyboard shortcut (wm/drag.js and the apps), as headed definition lists: the ? key's dialog (lazy/shortcuts.js)
// and About this desktop (lazy/about-desktop.js) both show them.
import { h } from './dom.js';

const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+';
const GROUPS = [
  ['Anywhere', [
    [[mod + 'K', '/'], 'Search'],
    [['?'], 'List these shortcuts'],
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

// tag: the heading each group's title gets
export const keyList = (tag = 'h2') => GROUPS.map(([title, rows]) => h('section', {},
  h(tag, {}, title),
  h('dl', {}, ...rows.flatMap(([keys, what]) => [
    h('dt', {}, ...keys.flatMap((k, i) => [i ? ' ' : '', h('kbd', {}, k)])), h('dd', {}, what),
  ]))));
