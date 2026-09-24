// Context menu, sharing and Copy as markdown. context-menu-trigger.js decides when the shell's menu replaces the
// browser's and calls openMenu; the reader toolbar calls shareView and copyMarkdown.
// Window items press the window's own tab controls, so they behave exactly as a click on them does (wm/drag.js).
import { h, SHARE, MARKDOWN, copyText } from '../lib/dom.js';

const abs = u => new URL(u, location.href).href;

// 16px outlined glyphs, drawn like the reader toolbar's
const GLYPHS = {
  open: 'M9 2.5h4.5V7M13.5 2.5 7.5 8.5M12 9.5v4H2.5V4h4',
  tab: 'M5.5 2.5h8v8M2.5 5.5h8v8h-8z',
  link: 'M6.5 9.5a3 3 0 0 0 4.2 0l2.3-2.3a3 3 0 0 0-4.2-4.2l-.9.9M9.5 6.5a3 3 0 0 0-4.2 0L3 8.8A3 3 0 0 0 7.2 13l.9-.9',
  share: SHARE,
  md: MARKDOWN,
  min: 'M3 12.5h10',
  max: 'M2.5 2.5h11v11h-11z',
  restore: 'M5 2.5h8.5V11M2.5 5h8.5v8.5H2.5z',
  close: 'M3.5 3.5l9 9M12.5 3.5l-9 9',
  home: 'M2 7.5 8 2.5l6 5M3.5 6.5v7h9v-7',
  search: 'M7 12A5 5 0 1 0 7 2a5 5 0 0 0 0 10zM10.5 10.5 14 14',
  prefs: 'M2 4.5h12M2 11.5h12M5.5 2.5v4M10.5 9.5v4',
};

function glyph(name) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 16 16');
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = `<path d="${GLYPHS[name]}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`;
  return s;
}

// Confirmation for copies, since a copy is otherwise invisible. The region exists before its text changes, so
// screen readers announce it.
let status = null, statusT = 0;
export function note(text) {
  if (!status) {
    status = document.body.appendChild(h('div', { class: 'ctx-note', role: 'status' }));
    // a region filled as it is added is often not announced
    return setTimeout(() => note(text), 50);
  }
  status.textContent = text;
  status.classList.add('on');
  clearTimeout(statusT);
  statusT = setTimeout(() => status.classList.remove('on'), 2400);
}

// Copies text, or a promise of it (lib/dom.js), and says so
const copy = (data, done, failed = () => note("Couldn't copy to the clipboard")) =>
  copyText(data).then(() => note(done), err => { console.error(err); failed(); });

// When the clipboard refuses (an insecure page, or Safari having lost the press), the link is shown to copy by hand
export const copyLink = url => copy(abs(url), 'Link copied', () => prompt('Copy this link', abs(url)));

// The Web Share sheet where there is one, else the link goes on the clipboard
export async function share(title, url) {
  url = abs(url);
  if (navigator.share) {
    try {
      return await navigator.share({ title, url });
    } catch (err) {
      // dismissing the share sheet is not a failure
      if (err.name === 'AbortError') return;
    }
  }
  return copyLink(url);
}

export const shareView = v => share(v.title, v.route());

// The page's own markdown (page.markdown.md), which the theme publishes beside index.html when the site opts in
export function copyMarkdown(v) {
  const src = v.el.querySelector('.rd[data-md]')?.dataset.md;
  if (!src) return;
  const text = fetch(src).then(r => {
    if (!r.ok) throw new Error(`${src}: ${r.status}`);
    return r.text();
  });
  return copy(text, 'Markdown copied', () => note("Couldn't copy the markdown"));
}

// Item lists. false leaves an item out and '-' is a separator.
function linkItems(a) {
  const url = a.href, title = a.title || a.textContent.trim() || url;
  // D32: a post in Tracker opens in a window of its own; one in Tracker's selection opens it all.
  // Phones show one window at a time (D17).
  const post = !window.deskbar.isPhone() && a.closest('[data-post]'), list = post && post.closest('.tk-main'), sel = post && post.matches('.sel');
  const n = sel ? list.querySelectorAll('.sel').length : 1;
  const own = () => (sel ? window.deskbar.loadLazy('dragout').then(m => m.openSelected(list)) : window.deskbar.openPosts([post.dataset.post]));
  return [title, [
    { label: 'Open', icon: 'open', run: () => a.click() },
    post && { label: n > 1 ? 'Open in new windows' : 'Open in new window', icon: 'tab', run: own },
    a.origin === location.origin && !a.target && { label: 'Open in new tab', icon: 'tab', run: () => open(url, '_blank', 'noopener') },
    '-',
    { label: 'Copy link', icon: 'link', run: () => copyLink(url) },
    { label: 'Share…', icon: 'share', run: () => share(title, url) },
  ]];
}

function windowItems(tab) {
  const v = tab._view, w = v.win, url = v.route();
  // min and max sit on the active tab, or on a stack's handle; either way the tab is shown first
  const press = cls => () => {
    w.tabsEl.children[w.views.indexOf(v)]?.querySelector('.tt')?.click();
    w.tabsEl.querySelector('.ctl.' + cls)?.click();
  };
  const maxBtn = w.tabsEl.querySelector('.ctl.max'), maxed = w.snap === 'max';
  return [v.title, [
    url && { label: 'Open in new tab', icon: 'tab', run: () => open(abs(url), '_blank', 'noopener') },
    '-',
    url && { label: 'Copy link', icon: 'link', run: () => copyLink(url) },
    url && { label: 'Share…', icon: 'share', run: () => shareView(v) },
    !!v.el.querySelector('.rd[data-md]') && { label: 'Copy as markdown', icon: 'md', run: () => copyMarkdown(v) },
    '-',
    { label: 'Minimise', icon: 'min', run: press('min') },
    // phones have no maximise (windows are full screen), and hide its control
    !!maxBtn && getComputedStyle(maxBtn).display !== 'none' && { label: maxed ? 'Restore' : 'Maximise', icon: maxed ? 'restore' : 'max', run: press('max') },
    // the tab's node may have been re-rendered since the menu opened
    { label: 'Close', icon: 'close', run: () => w.tabsEl.children[w.views.indexOf(v)]?.querySelector('.ctl.close')?.click() },
  ]];
}

function desktopItems() {
  const $ = s => document.querySelector(s), home = $('#homeBtn'), search = $('#searchBtn'), prefs = $('a[href$="/control-panel/"]');
  return ['Desktop', [
    home && { label: 'Home', icon: 'home', run: () => home.click() },
    search && { label: 'Search…', icon: 'search', run: () => search.click() },
    prefs && { label: 'Control panel…', icon: 'prefs', run: () => window.deskbar.go(prefs.href) },
  ]];
}

export function itemsFor(t) {
  const a = t.closest('a[href]'), win = t.closest('.win');
  if (a) return linkItems(a);
  if (win) return windowItems(t.closest('.tab') || win.querySelector('.tab.on'));
  return desktopItems();
}

// Drops left-out items, and separators at either end or next to another
export function tidy(list) {
  const out = [];
  for (const it of list.filter(Boolean)) if (it !== '-' || (out.length && out.at(-1) !== '-')) out.push(it);
  if (out.at(-1) === '-') out.pop();
  return out;
}

let menu = null, opener = null;
const isOpen = () => menu?.matches(':popover-open');

function close(refocus) {
  if (!isOpen()) return;
  menu.hidePopover();
  if (refocus && opener?.isConnected) opener.focus({ preventScroll: true });
}

function onKey(e) {
  const its = [...menu.querySelectorAll('[role=menuitem]')], i = its.indexOf(document.activeElement), n = its.length;
  const to = { ArrowDown: i + 1, ArrowUp: (i < 0 ? n : i) - 1, Home: 0, End: n - 1 }[e.key];
  if (to != null) {
    e.preventDefault();
    its[(to + n) % n].focus();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    close(true);
  } else if (e.key === 'Tab') close(true);
}

function build() {
  // manual, so opening it from the Whisker menu leaves that menu open; dismissal is handled here
  menu = h('div', { class: 'ctx', popover: 'manual', role: 'menu' });
  menu.addEventListener('keydown', onKey);
  menu.addEventListener('click', e => {
    const b = e.target.closest('[role=menuitem]');
    if (!b) return;
    close(true);
    b._run();
  });
  // like a native menu, the item under the pointer is the one the arrow keys move from
  menu.addEventListener('pointermove', e => {
    const b = e.target.closest('[role=menuitem]');
    if (b && b !== document.activeElement) b.focus({ preventScroll: true });
  });
  menu.addEventListener('focusout', e => { if (e.relatedTarget && !menu.contains(e.relatedTarget)) close(); });
  document.addEventListener('pointerdown', e => { if (!menu.contains(e.target)) close(); }, true);
  addEventListener('blur', () => close());
  addEventListener('resize', () => close());
  document.addEventListener('scroll', () => close(), true);
  document.body.append(menu);
}

// Beside the pointer, so the first item doesn't start out hovered, or for the keyboard just inside the target's top
// left. Flipped to stay on screen.
export function position(at, r, w, h, vw, vh) {
  let x = at?.clientX + 2, y = at?.clientY + 2;
  if (!at?.clientX && !at?.clientY) {
    x = r.left + Math.min(16, r.width / 2);
    y = Math.min(r.bottom, r.top + 32);
  }
  return {
    x: x + w > vw - 4 ? Math.max(4, x - w) : x,
    y: y + h > vh - 4 ? Math.max(4, y - h) : y,
  };
}

function place(at, t) {
  const { x, y } = position(at, t.getBoundingClientRect(), menu.offsetWidth, menu.offsetHeight, innerWidth, innerHeight);
  Object.assign(menu.style, { left: x + 'px', top: y + 'px' });
}

// at: a pointer or mouse event, or null when opened from the keyboard
export function openMenu(t, at) {
  // the trigger claims events on the menu itself, so the browser's menu never opens over it
  if (t.closest('.ctx')) return;
  const [label, list] = itemsFor(t), items = tidy(list);
  if (!items.length) return;
  if (!menu) build();
  // reopening elsewhere keeps the original opener for focus return
  if (!isOpen()) opener = document.activeElement;
  menu.setAttribute('aria-label', label);
  menu.replaceChildren(...items.map(it => {
    if (it === '-') return h('div', { class: 'ctx-sep', role: 'separator' });
    const b = h('button', { class: 'ctx-it', type: 'button', role: 'menuitem', tabindex: '-1' }, glyph(it.icon), h('span', {}, it.label));
    b._run = it.run;
    return b;
  }));
  // a long-press on a tab has started a tab slide (wm/drag.js), which listens on window; the menu ends it
  if (at?.pointerType === 'touch') dispatchEvent(new PointerEvent('pointercancel'));
  if (!isOpen()) menu.showPopover();
  place(at, t);
  menu.querySelector('[role=menuitem]').focus({ preventScroll: true });
}
