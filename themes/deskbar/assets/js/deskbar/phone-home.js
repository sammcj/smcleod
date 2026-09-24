// The phone home screen (D17): every post as Tracker shows them (newest five as cards, the rest by year), on the desk
// behind every window. The desktop has the Posts window at that spot instead (D36), so the CSS shows this only in phone mode.
import { h } from './lib/dom.js';
import { postList } from './tracker.js';

export function initPhoneHome(index) {
  const el = document.getElementById('recent');
  if (!el) return;
  index.then(data => {
    if (!data.posts.length) return;
    // a press that wobbles would drag the link instead of opening it (as in Tracker)
    el.replaceChildren(h('h2', {}, 'Recent posts'), h('div', { class: 'recent-list', ondragstart: e => e.preventDefault() },
      postList(data.posts)));
    el.hidden = false;
  });
}
