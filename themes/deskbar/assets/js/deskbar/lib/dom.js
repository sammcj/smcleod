// Tiny element builder so views read like markup without pulling in a framework (D18)
export function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat(2)) if (k != null && k !== false) e.append(k.nodeType ? k : String(k));
  return e;
}

const SVG = 'http://www.w3.org/2000/svg';

// Icons live in the page's SVG sprite, so each one is a two-node <svg><use>
export function ico(id, cls = 'ico') {
  const s = document.createElementNS(SVG, 'svg');
  s.setAttribute('class', cls);
  s.setAttribute('aria-hidden', 'true');
  const u = document.createElementNS(SVG, 'use');
  u.setAttribute('href', '#' + id);
  s.append(u);
  return s;
}

export const $ = (s, r = document) => r.querySelector(s);

// Keys that fields, dialogs and menus keep for themselves, so desktop shortcuts leave them alone
export const OWN_KEYS = 'input, textarea, select, [contenteditable], dialog, [role=dialog], [popover]';

// An outlined 16px glyph for svgBtn
export const stroke = (d, width = 1.8) =>
  `<path d="${d}" fill="none" stroke="currentColor" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;

// A labelled icon button whose glyph is inline SVG markup rather than a sprite icon
export function svgBtn(label, svg, onclick, cls = 'tb nav') {
  const b = h('button', { class: cls, type: 'button', title: label, 'aria-label': label, onclick });
  b.innerHTML = `<svg viewBox="0 0 16 16" aria-hidden="true">${svg}</svg>`;
  return b;
}

// A plain primary click, which the shell may handle; modified clicks keep the browser's own behaviour (new tab)
export const plainClick = e => !e.defaultPrevented && e.button === 0 && !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey);

// The first element among a page's content nodes (or inside them) matching sel
export const find = (nodes, sel) => nodes.map(n => (n.matches?.(sel) ? n : n.querySelector?.(sel))).find(Boolean);

// 16px outlined glyphs drawn in more than one bundle
export const SHARE = 'M8 2v8M5 5l3-3 3 3M6 7H3v7h10V7h-3', MARKDOWN = 'M2 11V5l3 3 3-3v6m4-6v6m-2-2 2 2 2-2';

// Copies text, or a promise of it. Safari only allows a clipboard write straight from the press, so pending text goes
// in a ClipboardItem, which it resolves later; browsers without ClipboardItem, or refusing it, get writeText.
export function copyText(data) {
  const text = Promise.resolve(data), c = navigator.clipboard;
  try {
    return globalThis.ClipboardItem
      ? c.write([new ClipboardItem({ 'text/plain': text.then(t => new Blob([t], { type: 'text/plain' })) })]).catch(() => text.then(t => c.writeText(t)))
      : text.then(t => c.writeText(t));
  } catch (err) {
    return Promise.reject(err);
  }
}

// Phones scroll the page rather than a view's pane (windows.css), leaving the pane overflow: visible, so this is the
// element that actually scrolls el's content
export const scrollerOf = el => (getComputedStyle(el).overflowY === 'visible' ? document.scrollingElement : el);
// Back to the top of el's content, which on a phone is the page's, unless el is out of sight in a hidden view
export function toTop(el) {
  const s = scrollerOf(el);
  if (s === el || el.checkVisibility()) s.scrollTop = 0;
}
