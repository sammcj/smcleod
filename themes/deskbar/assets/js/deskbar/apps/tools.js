// Tools (D14) and folders.
// - `window: tool` opens a page in its own large window. An embedded tool (layouts/tool.html, an iframe.tool-frame)
//   shows only the frame, as does a standalone HTML file linked directly; any other page shows its content full
//   width. Tools always stay in a window (maximise for more room), never in a new tab.
// - `window: folder` (layouts/folder.html) shows a page's icon grid, like a Tracker icon view of a few items.
import { defineApp } from './registry.js';
import { h, find } from '../lib/dom.js';
import { mountContent } from '../content.js';
import { arrowTo } from '../lib/keys.js';

// Content nodes in a scrolling body, with their scripts and onMounted hooks run
export function fill(v, page, nodes, cls) {
  const body = h('div', { class: cls + ' scroller' }, ...nodes);
  v.el.append(body);
  mountContent(body, page, v);
}

defineApp({
  kind: 'tool',
  key: page => 'tool:' + page.url,
  size: 'large',
  mount: (v, page, { fresh }) => {
    if (!fresh) return;
    // page.frame: a standalone HTML file the router opened directly, with no tool page around it
    const nodes = page.content(), frame = page.frame
      ? h('iframe', { class: 'tool-frame', src: page.frame, title: page.title })
      : find(nodes, 'iframe.tool-frame');
    if (!frame) return fill(v, page, nodes, 'tool-body');
    frame.removeAttribute('loading');
    v.el.classList.add('framed');
    v.el.append(frame);
  },
});

defineApp({
  kind: 'folder',
  tile: true,
  key: page => 'folder:' + page.url,
  geometry: (d, th) => ({ w: Math.min(d.w - 20, 600), h: Math.min(d.h - th - 16, 420), x: Math.max(10, (d.w - Math.min(d.w - 20, 600)) / 2), y: th + 50 }),
  mount: (v, page, { fresh }) => {
    if (!fresh) return;
    fill(v, page, page.content(), 'folder-body');
    // the arrows move between the icons, across the category groups; Enter opens one, as each is a link
    v.el.addEventListener('keydown', e => {
      const icon = e.target.closest('.folder > li')?.firstElementChild;
      if (!icon) return;
      const to = arrowTo([...v.el.querySelectorAll('.folder > li > a:first-child')], icon, e.key);
      if (!to) return;
      e.preventDefault();
      to.focus();
    });
  },
});
