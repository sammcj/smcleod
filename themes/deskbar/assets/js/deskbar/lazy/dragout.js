// D32, loaded on the first drag out of Tracker, or the first Cmd/Ctrl- or Shift-click in it
// (dragout-trigger.js): the ghost that follows the pointer, and Tracker's selection with its keys and toolbar button.
// Posts open through the shell's openPosts (reader.js), each in a window of its own.
import { h, svgBtn, stroke } from '../lib/dom.js';
import { arrowTo } from '../lib/keys.js';

const url = x => x.dataset.post;
const items = root => [...root.querySelectorAll('[data-post]')];
// root -> { urls, anchor, btn }: the posts selected, in the order Tracker lists them
const sels = new WeakMap();
const chosen = root => items(root).filter(x => sels.get(root)?.urls.has(url(x)));
const open = (urls, at) => window.deskbar.openPosts(urls, at);

// Picked up: a chip with the post's picture and title (and how many, for a selection) follows the pointer. Dropped on
// the desk, over a window or not, the posts open there; back on the list it came from, or off the desk, nothing opens.
export function lift(it, root) {
  const many = sels.get(root)?.urls.has(url(it)) ? chosen(root) : [it];
  const name = it.title || it.querySelector('b, a')?.textContent.trim();
  const ghost = document.body.appendChild(h('div', { class: 'dragout', 'aria-hidden': 'true' },
    it.querySelector('img, svg')?.cloneNode(true), h('span', {}, name), many.length > 1 && h('b', {}, many.length)));
  const desk = document.getElementById('desk'), src = root.closest('.win');
  const ok = ev => {
    const t = document.elementFromPoint(ev.clientX, ev.clientY);
    return !!t && desk.contains(t) && !src.contains(t);
  };
  return {
    move(ev) {
      // beside the pointer, and flipped to its left near the right edge
      const x = ev.clientX + 14 + ghost.offsetWidth > innerWidth ? ev.clientX - 14 - ghost.offsetWidth : ev.clientX + 14;
      ghost.style.translate = `${x}px ${ev.clientY + 10}px`;
      ghost.classList.toggle('no', !ok(ev));
    },
    drop(ev) {
      ghost.remove();
      if (ev.type !== 'pointerup' || !ok(ev)) return;
      const r = desk.getBoundingClientRect();
      open(many.map(url), { x: ev.clientX - r.left, y: ev.clientY - r.top });
      clear(root);
    },
  };
}

// Marks the selected posts still listed (Tracker redraws its list for a new place, view or search) and shows the
// toolbar button while there are any
function mark(root) {
  const s = sels.get(root), listed = items(root);
  for (const u of s.urls) if (!listed.some(x => url(x) === u)) s.urls.delete(u);
  for (const x of listed) x.classList.toggle('sel', s.urls.has(url(x)));
  const n = s.urls.size, label = `Open ${n} selected post${n > 1 ? 's' : ''} in new windows`;
  s.btn.hidden = !n;
  s.btn.lastChild.textContent = n;
  s.btn.title = label;
  s.btn.setAttribute('aria-label', label);
}

function clear(root) {
  const s = sels.get(root);
  if (!s) return;
  s.urls.clear();
  s.anchor = null;
  mark(root);
}

export function openSelected(root) {
  const list = chosen(root);
  if (!list.length) return;
  open(list.map(url));
  clear(root);
}

// The first pick sets up the list's selection: its toolbar button, Enter to open, Escape to drop it
function state(root) {
  if (sels.has(root)) return sels.get(root);
  const btn = svgBtn('', stroke('M5.5 2.5h8v8M2.5 5.5h8v8h-8z'), () => openSelected(root), 'tb nav tk-open');
  btn.append(h('span'));
  const s = { urls: new Set(), anchor: null, btn };
  sels.set(root, s);
  root.closest('.view')?.querySelector('.toolbar .segs')?.after(btn);
  root.addEventListener('keydown', e => {
    if (!s.urls.size || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'Enter') openSelected(root);
    else if (e.key === 'Escape') clear(root);
    else return;
    e.preventDefault();
  });
  // a plain click opens its post in the reader instead
  root.addEventListener('click', e => { if (!e.metaKey && !e.ctrlKey && !e.shiftKey) clear(root); });
  new MutationObserver(() => mark(root)).observe(root, { childList: true });
  return s;
}

// how: toggle (Cmd/Ctrl-click), range (Shift-click, from the last post toggled) or an arrow key (Shift+Up/Down, from
// the focused post, which the selection follows)
export function pick(root, it, how) {
  const s = state(root), list = items(root);
  // Shift-click also extends the page's text selection
  getSelection()?.removeAllRanges();
  if (how === 'toggle') {
    s.urls[s.urls.has(url(it)) ? 'delete' : 'add'](url(it));
    s.anchor = url(it);
  } else {
    let to = it;
    if (how !== 'range') {
      to = arrowTo(list, it, how);
      if (!to) return;
      (to.matches('a') ? to : to.querySelector('a[href]')).focus();
    }
    let a = list.findIndex(x => url(x) === s.anchor);
    if (a < 0) { a = list.indexOf(it); s.anchor = url(it); }
    const b = list.indexOf(to);
    s.urls = new Set(list.slice(Math.min(a, b), Math.max(a, b) + 1).map(url));
  }
  mark(root);
}
