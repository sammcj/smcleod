// Whisker-style menu. panel.html prerenders it as a native popover, so it opens and light-dismisses without
// JS. This adds the category rail (wide screens show one group at a time; phones scroll every group) and
// search over posts and menu entries, with the full ranked list one tap away in Tracker.
import { h, ico, $ } from './lib/dom.js';
import { fmtDate } from './lib/format.js';
import { searchPosts, matches } from './search.js';
import { ensureTracker } from './tracker.js';

export function initMenu(index) {
  const menu = $('#menu'), q = $('#mnQ'), btn = $('#menuBtn');
  if (!menu?.showPopover || !q) return;
  const res = menu.querySelector('.mn-res'), rail = menu.querySelector('.mn-cats');
  const cats = [...rail.children], secs = [...menu.querySelectorAll('.mn-sec')];
  const pick = i => {
    cats.forEach(b => b.classList.toggle('on', b.dataset.cat === i));
    secs.forEach(s => s.classList.toggle('off', s.dataset.cat !== i));
  };
  pick(cats[0]?.dataset.cat);
  const catOf = e => e.target.closest?.('button[data-cat]');
  rail.addEventListener('click', e => { const b = catOf(e); if (b) pick(b.dataset.cat); });
  // Whisker switches category as the mouse passes over it; touch has no hover, so a tap does it
  rail.addEventListener('pointerover', e => { const b = catOf(e); if (b && e.pointerType === 'mouse') pick(b.dataset.cat); });

  let posts = [];
  index.then(d => { posts = d?.posts || []; });
  // an entry can appear in several groups; results list each link once
  const entries = [...new Map([...menu.querySelectorAll('.mn-sec a.mn-it')].map(a => [a.getAttribute('href'), a])).values()];
  const heading = t => h('h3', {}, t);

  function draw() {
    const s = q.value.trim();
    menu.classList.toggle('searching', !!s);
    res.hidden = !s;
    if (!s) return res.replaceChildren();
    // Writing lists the latest posts too; those belong under Posts, not twice
    const isPost = new Set(posts.map(p => p.url));
    const hits = entries.filter(a => !isPost.has(a.getAttribute('href')) && matches(a.textContent, s)).slice(0, 6).map(a => a.cloneNode(true));
    const found = searchPosts(posts, s);
    res.replaceChildren(
      hits.length ? heading('Apps and pages') : '', hits.length ? h('div', { class: 'mn-items' }, hits) : '',
      heading(found.length ? 'Posts' : `No posts match "${s}"`),
      h('div', { class: 'mn-items mn-posts' }, found.slice(0, 8).map(p =>
        h('a', { class: 'mn-it', href: p.url, title: p.title }, ico('i-doc'), h('span', { class: 'lbl' }, p.title), h('small', {}, fmtDate(p.date))))),
      found.length ? h('button', {
        class: 'tb mn-more', type: 'button',
        onclick: () => { menu.hidePopover(); ensureTracker({ q: s }); },
      }, found.length > 8 ? `All ${found.length} results in Tracker` : 'Show in Tracker') : '');
  }

  q.addEventListener('input', draw);
  // typing is the one keyboard use the site expects (Constraints), so Enter opens the top result
  q.addEventListener('keydown', e => { if (e.key === 'Enter') res.querySelector('a[href]')?.click(); });
  // links route through the shell (router.js listens on document); the menu just needs to get out of the way
  menu.addEventListener('click', e => { if (e.target.closest('a[href]')) menu.hidePopover(); });
  menu.addEventListener('toggle', e => {
    const open = e.newState === 'open';
    btn.classList.toggle('open', open);
    if (open && matchMedia('(pointer: fine)').matches) q.focus();
    if (!open && q.value) { q.value = ''; draw(); }
  });
}
