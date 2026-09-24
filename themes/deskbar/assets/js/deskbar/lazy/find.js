// Find in post, loaded on the first press of the reader toolbar button that find.js puts in the shell: a find bar that
// highlights every match and steps through them. Matches are painted with the CSS Custom Highlight API, so the
// article's DOM is never rewritten and page scripts, diagrams and maths keep their nodes.
// A match split across elements ("foo <em>bar</em>") is not found; that trade keeps the walk to one text node.
import { h, svgBtn as btn, stroke, scrollerOf } from '../lib/dom.js';
import { findOffsets } from '../lib/offsets.js';

const SKIP = 'script, style, noscript, svg, .hlink, .copy';
const MIN = 2;
let owner = null; // highlights are global, so only the bar that painted them clears them

const svgBtn = (label, d, onclick, cls) => btn(label, stroke(d), onclick, cls);

function rangesIn(root, q) {
  const out = [], walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n; (n = walk.nextNode());) {
    if (n.parentElement?.closest(SKIP)) continue;
    for (const i of findOffsets(n.data, q)) {
      const r = new Range();
      r.setStart(n, i);
      r.setEnd(n, i + q.length);
      out.push(r);
    }
  }
  // text inside collapsed or hidden elements has no boxes to scroll to
  return out.filter(r => r.getClientRects().length);
}

// The bar for one reader view, opened and closed by the shell's toggle button. Returns { toggle, refresh, clear }.
export function makeBar(view, scroller, toggle) {
  const input = h('input', { type: 'search', placeholder: 'Find in page', 'aria-label': 'Find in page', autocomplete: 'off' });
  const count = h('small', { class: 'fd-n', 'aria-live': 'polite' });
  let ranges = [], cur = -1;
  const self = {};

  function paint() {
    owner = self;
    const all = new Highlight(), one = new Highlight();
    ranges.forEach(r => all.add(r));
    if (cur >= 0) one.add(ranges[cur]);
    CSS.highlights.set('deskbar-find', all);
    CSS.highlights.set('deskbar-find-cur', one);
    count.textContent = input.value.trim().length < MIN ? '' : ranges.length ? `${cur + 1} of ${ranges.length}` : 'No matches';
    if (cur < 0) return;
    // on a phone the page scrolls (scrollerOf), so the screen is the frame
    const by = scrollerOf(scroller), box = ranges[cur].getBoundingClientRect();
    const sb = by === scroller ? scroller.getBoundingClientRect() : { top: 0, bottom: innerHeight, height: innerHeight };
    if (box.top < sb.top + 30 || box.bottom > sb.bottom - 30) by.scrollTop += box.top - sb.top - sb.height / 3;
  }

  // a new search starts at the first match on screen, so it does not yank the reader back to the top
  function run() {
    const q = input.value.trim();
    ranges = q.length < MIN ? [] : rangesIn(scroller, q);
    const top = Math.max(0, scroller.getBoundingClientRect().top);
    cur = ranges.length ? Math.max(0, ranges.findIndex(r => r.getBoundingClientRect().top >= top)) : -1;
    paint();
  }

  const step = d => {
    if (!ranges.length) return;
    cur = (cur + d + ranges.length) % ranges.length;
    paint();
  };

  self.clear = () => {
    ranges = [];
    cur = -1;
    count.textContent = '';
    if (owner !== self) return;
    CSS.highlights.delete('deskbar-find');
    CSS.highlights.delete('deskbar-find-cur');
    owner = null;
  };

  const bar = h('div', { class: 'findbar', hidden: true }, input, count,
    svgBtn('Previous match', 'M3 10l5-5 5 5', () => step(-1)),
    svgBtn('Next match', 'M3 6l5 5 5-5', () => step(1)),
    svgBtn('Close find', 'M4 4l8 8M12 4l-8 8', () => close()));
  self.toggle = () => (bar.hidden ? open() : close());

  function open() {
    bar.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    input.focus();
    input.select();
    if (input.value) run();
  }
  function close() {
    bar.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    self.clear();
  }

  input.addEventListener('input', run);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); step(e.shiftKey ? -1 : 1); }
    if (e.key === 'Escape') { e.preventDefault(); close(); toggle.focus(); }
  });
  view.el.querySelector('.toolbar').after(bar);
  // a new page in the same reader keeps an open search running over the new text
  self.refresh = () => { if (!bar.hidden && input.value) run(); };
  return self;
}
