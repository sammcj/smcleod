// The phone home screen (D17): a Latest posts widget (the newest three as Tracker's cards, and All posts, which opens
// Tracker) over the desktop icons, on the desk behind every window. The desktop has the Posts window at that spot instead
// (D36), so the CSS shows this only in phone mode.
import { h } from './lib/dom.js';
import { card } from './tracker.js';

export function initPhoneHome(index) {
  const el = document.getElementById('recent');
  if (!el) return;
  index.then(data => {
    if (!data.posts.length) return;
    // a press that wobbles would drag the link instead of opening it (as in Tracker)
    el.replaceChildren(h('h2', {}, 'Latest posts'), h('div', { class: 'recent-list', ondragstart: e => e.preventDefault() },
      data.posts.slice(0, 3).map(card), h('a', { class: 'recent-all', href: data.sectionURL }, `All ${data.posts.length} posts`)));
    el.hidden = false;
  });
}
