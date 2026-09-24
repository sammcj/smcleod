// Folder windows (`window: folder`, layouts/folder.html): an icon grid under a toolbar with Back and Up. A folder
// opened from inside one shows in the same window (apps/index.js picks it), so browsing a folder of folders moves
// through them in place. The window's trail of the folders it has shown (lib/trail.js) serves Back; Up goes to the
// folder the page names in data-up. Loaded on first open through lazyApp (loader.js).
import { h, svgBtn, stroke, toTop, OWN_KEYS } from '../lib/dom.js';
import { arrowTo } from '../lib/keys.js';
import { trail, visit } from '../lib/trail.js';

// into: this window shows the folder, and its history entry keeps the key so Back and Forward return here
const go = (v, url) => url && window.deskbar.go(url, null, { into: v.key });

function build(v) {
  const t = v.trail = trail();
  const back = svgBtn('Back', stroke('M10 3L5 8l5 5'), () => {
    if (t.pos < 1) return;
    t.moving = t.pos - 1;
    go(v, t.list[t.moving]);
  });
  const up = svgBtn('Parent folder', stroke('M8 13V3M4 7l4-4 4 4'), () => go(v, v.up));
  v.nav = { back, up };
  v.el.prepend(h('div', { class: 'toolbar' }, back, up));
  v.el.addEventListener('keydown', e => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.shiftKey || e.target.closest(OWN_KEYS)) return;
    // Alt+Up, or Backspace, goes up a level, as in a file manager
    if (e.altKey ? e.key === 'ArrowUp' : e.key === 'Backspace') {
      if (!v.up) return;
      e.preventDefault();
      return go(v, v.up);
    }
    // the arrows move between the icons, across the category groups; Enter opens one, as each is a link
    const icon = !e.altKey && e.target.closest('.folder > li')?.firstElementChild;
    if (!icon) return;
    const to = arrowTo([...v.el.querySelectorAll('.folder > li > a:first-child')], icon, e.key);
    if (!to) return;
    e.preventDefault();
    to.focus();
  });
}

export function mount(v, page, { fresh, pop, replace }) {
  if (fresh) build(v);
  else if (v.shown === page.url) return;
  const old = v.el.querySelector('.folder-body'), lost = old?.contains(document.activeElement);
  const pressed = [v.nav.back, v.nav.up].find(b => b === document.activeElement);
  const body = h('div', { class: 'folder-body scroller' }, ...page.content());
  if (!old) v.el.append(body);
  else {
    old.replaceWith(body);
    toTop(body);
  }
  // the dock lights, and raises, the window showing its folder (wm/panel.js)
  Object.assign(v, { shown: page.url, home: page.url, icon: page.icon, up: body.querySelector('.folder-doc')?.dataset.up });
  visit(v.trail, page.url, pop, replace);
  v.nav.back.disabled = v.trail.pos < 1;
  v.nav.up.disabled = !v.up;
  window.deskbar.renderTabs(v.win);
  window.deskbar.mountContent(body, page, v);
  // keyboard focus was on an icon of the folder just left, or on Back or Up now disabled, so it moves to the first icon
  if (lost || pressed?.disabled) body.querySelector('a')?.focus({ preventScroll: true });
}
