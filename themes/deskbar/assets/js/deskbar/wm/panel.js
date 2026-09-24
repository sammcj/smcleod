// Top panel: task buttons for every window, the window switcher (D30; it also copies a layout link), dock running
// dots and the clock
import { S, on } from './state.js';
import { h, ico, $, copyText, plainClick } from '../lib/dom.js';
import { focus, focusView, minimise, closeWin, activeView, transition, morph } from './windows.js';
import { encodeLayout, layoutHref } from './layout.js';
import { currentPath } from '../router.js';

function renderTasks() {
  const wins = S.wins.slice().sort((a, b) => a.id - b.id).map(w => {
    const v = activeView(w), extra = w.views.length > 1 ? ` +${w.views.length - 1}` : '';
    return h('button', {
      class: 'task' + (w === S.focused ? ' on' : '') + (w.min ? ' min' : ''), type: 'button', title: v.title, 'data-w': w.id,
      onclick: () => (w === S.focused ? morph([w], () => minimise(w)) : w.min ? morph([w], () => focus(w)) : focus(w)),
    }, ico('i-' + v.icon), h('span', {}, v.title + extra));
  });
  $('#tasks').replaceChildren(...wins);
  // no badge while nothing is open
  $('#winsN').textContent = S.wins.length || '';
}

// Dock items light up while a window opened from their URL is running
function renderDock() {
  for (const a of document.querySelectorAll('#dock .dk')) {
    const path = a.getAttribute('href');
    a.classList.toggle('run', S.wins.some(w => w.views.some(v => v.home === path)));
  }
}

let switcher = null;
const closeSwitcher = () => switcher.hidePopover();

// Double-clicking is a desktop habit. The second click of one on a switcher tab would press whatever lies under the
// closed switcher, raising that window over the one just picked, so presses on the same spot are ignored for a moment.
// Desktop and dock icons use it too (initPanel).
const PRESS = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click', 'dblclick'];
// only: which of those presses to swallow
function swallowRepeat(e, only = () => true) {
  if (!e.detail) return;
  const stop = ev => { if (only(ev) && Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < 8) { ev.stopPropagation(); ev.preventDefault(); } };
  for (const t of PRESS) addEventListener(t, stop, true);
  setTimeout(() => { for (const t of PRESS) removeEventListener(t, stop, true); }, 500);
}

// The address of the page on screen plus ?layout= for every open window (wm/layout.js)
export function layoutLink() {
  const wins = S.wins.filter(w => !w.min).sort((a, b) => a.z - b.z).map(w => ({ route: activeView(w).route(), snap: w.snap, own: activeView(w).key.startsWith('post:') }));
  return location.origin + layoutHref(currentPath(), encodeLayout(wins, S.split));
}

const LINK = 'M6.5 9.5l3-3M7.5 4.5l1-1a2.5 2.5 0 0 1 4 4l-1 1M8.5 11.5l-1 1a2.5 2.5 0 0 1-4-4l1-1', TICK = 'M3 8.5l3 3 7-7';

function copyLayout(e) {
  const b = e.currentTarget;
  copyText(layoutLink()).then(() => {
    b.classList.add('done');
    b.querySelector('path').setAttribute('d', TICK);
    b.lastChild.textContent = 'Link copied';
    setTimeout(() => { b.classList.remove('done'); b.querySelector('path').setAttribute('d', LINK); b.lastChild.textContent = 'Copy layout link'; }, 1600);
  }, () => {});
}

// Hovering or focusing a tab lifts its window above the others until the pointer or focus moves on
const peek = (w, on) => w.el.classList.toggle('peek', on);

// The switcher is a column of the windows' own Haiku tabs rolling out of the Windows button: up from the dock, down
// from the panel on phones. The tab nearest the button comes first in the DOM, so Tab and the arrow keys start there.
function place() {
  const r = $('#winsBtn').getBoundingClientRect(), down = r.top < innerHeight / 2, flush = r.left + 320 > innerWidth;
  switcher.classList.toggle('down', down);
  // the tab icons line up over the button's centre; near the right edge the column hangs flush with the button instead
  Object.assign(switcher.style, {
    top: down ? r.bottom + 6 + 'px' : '', bottom: down ? '' : innerHeight - r.top + 8 + 'px',
    left: flush ? '' : r.left + r.width / 2 - 24 + 'px', right: flush ? Math.max(0, innerWidth - r.right - 10) + 'px' : '',
  });
}

function drawSwitcher(roll) {
  // redrawing replaces the buttons, so keyboard focus goes back to the button at the same place
  const had = [...switcher.querySelectorAll('button')].indexOf(document.activeElement);
  S.wins.forEach(w => peek(w, false));
  // visible windows front to back, then the minimised ones
  const tabs = S.wins.slice().sort((a, b) => a.min - b.min || b.z - a.z).map((w, i) => {
    const { icon, title } = activeView(w), min = w.min, label = title + (min ? ', minimised' : ''), extra = w.views.length > 1 && `+${w.views.length - 1}`;
    return h('div', {
      class: 'sw-tab' + (w === S.focused ? ' on' : '') + (min ? ' min' : ''), style: `--i:${Math.min(i, 10)}`,
      onpointerenter: () => peek(w, true), onpointerleave: () => peek(w, false),
      onfocusin: () => peek(w, true), onfocusout: () => peek(w, false),
    },
    h('button', {
      class: 'sw-open', type: 'button', title: label, 'aria-label': min ? label : null,
      onclick: e => { closeSwitcher(); swallowRepeat(e); if (w.min) morph([w], () => focus(w)); else focus(w); },
    }, ico('i-' + icon), h('span', {}, title), extra && h('small', {}, extra)),
    h('button', { class: 'ctl close sw-close', type: 'button', title: 'Close', 'aria-label': 'Close ' + title, onclick: () => transition(() => closeWin(w)) }, ico('c-x', '')));
  });
  const link = S.wins.length && navigator.clipboard && h('button', {
    class: 'sw-link', type: 'button', title: 'Copy a link that reopens these windows', style: `--i:${Math.min(tabs.length, 11)}`, onclick: copyLayout,
  });
  if (link) link.innerHTML = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="${LINK}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg><span aria-live="polite">Copy layout link</span>`;
  switcher.classList.toggle('roll', !!roll);
  switcher.replaceChildren(...(tabs.length ? tabs : [h('p', { class: 'sw-empty' }, 'No open windows')]), link || '');
  place();
  if (had < 0) return;
  const btns = switcher.querySelectorAll('button');
  btns[Math.min(had, btns.length - 1)]?.focus({ preventScroll: true });
}

// Up and Down step between the tabs in screen order, whichever way the column rolls out. Home and End go to the first
// and last entries in Tab order: the tab nearest the button, and the layout link.
function arrows(e) {
  const btns = [...switcher.querySelectorAll('.sw-open, .sw-link')], n = btns.length;
  const at = btns.indexOf(document.activeElement.closest('.sw-tab')?.firstChild || document.activeElement);
  const step = (e.key === 'ArrowDown') === switcher.classList.contains('down') ? 1 : -1;
  const to = /^Arrow(Up|Down)$/.test(e.key) ? (at < 0 ? 0 : (at + step + n) % n) : { Home: 0, End: n - 1 }[e.key];
  if (to == null) return;
  e.preventDefault();
  btns[to]?.focus();
}

function startClock() {
  const el = $('#clock'), timeZone = el.dataset.tz || undefined;
  const fDate = new Intl.DateTimeFormat('en-AU', { timeZone, weekday: 'short', day: 'numeric', month: 'short' });
  const fTime = new Intl.DateTimeFormat('en-AU', { timeZone, hour: 'numeric', minute: '2-digit' });
  if (timeZone) el.title = timeZone.split('/').pop().replace(/_/g, ' ') + ' time';
  const tick = () => { const n = new Date(); el.replaceChildren(h('span', { class: 'cd' }, fDate.format(n)), h('b', {}, fTime.format(n))); };
  tick();
  setInterval(tick, 10000);
}

export function initPanel() {
  // a native popover: the button toggles it, and Escape or a press outside closes it
  switcher = h('div', { id: 'switcher', popover: 'auto', role: 'group', 'aria-label': 'Open windows', onkeydown: arrows });
  document.body.append(switcher);
  $('#winsBtn').setAttribute('popovertarget', 'switcher');
  // the second click of a double-click on a task would toggle the same window straight back
  $('#tasks').addEventListener('click', e => { if (e.detail > 1) e.stopPropagation(); }, true);
  // and on a desktop or dock icon it lands on the page root mid-transition (which flashes a selection), or opens the
  // icon again. Only the second press of a real double-click (detail 2) is swallowed, so quick single clicks still count.
  for (const el of document.querySelectorAll('#icons, #dock')) el.addEventListener('click', e => { if (e.detail === 1 && e.target.closest('a, button')) swallowRepeat(e, ev => ev.detail > 1); }, true);
  // a dock item shows and hides its window, as a task button does: in front it minimises, minimised it comes back
  // with the item's tab in front. Otherwise (behind others, or a background tab) the router raises it as for any link.
  $('#dock')?.addEventListener('click', e => {
    const path = e.target.closest('.dk')?.getAttribute('href');
    const w = path && plainClick(e) && S.wins.filter(w => w.views.some(v => v.home === path)).sort((a, b) => b.z - a.z)[0];
    const v = w?.views.find(x => x.home === path);
    if (!v || !(w.min || (w === S.focused && activeView(w) === v))) return;
    e.preventDefault();
    morph([w], () => (w.min ? focusView(v) : minimise(w)));
  });
  switcher.addEventListener('beforetoggle', e => { if (e.newState === 'open') drawSwitcher(true); else S.wins.forEach(w => peek(w, false)); });
  on('refresh', () => {
    renderTasks();
    renderDock();
    if (switcher.matches(':popover-open')) drawSwitcher();
  });
  on('tabs', renderTasks);
  startClock();
}
