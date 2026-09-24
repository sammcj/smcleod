// D27 (refines D25): related posts as a slim ticker along the bottom of the reader on the desktop, shown as soon as a
// post opens. content/index.js loads this for the first desktop post with related posts. It is a flex row under the scroller, so it shrinks the text area rather than covering it. page.html
// renders the related block at the end of each post, which is what phones and no-JS visitors get: on a phone screen
// a bar would always take space, so there the list waits at the end of the post. With the ticker up that block is
// hidden; dismissing the ticker brings it back. A dismissal holds for that post for the rest of the session; other
// posts still get their ticker.
import { h } from '../lib/dom.js';

const KEY = 'deskbar:tickerDismissed';

const dismissed = () => { try { return JSON.parse(sessionStorage.getItem(KEY)) || []; } catch { return []; } };
function dismiss(url) {
  try { sessionStorage.setItem(KEY, JSON.stringify([...new Set([...dismissed(), url])].slice(-200))); } catch { /* ignored */ }
}

function build(links, onClose) {
  const track = h('div', { class: 'ticker-track' },
    h('ul', {}, links.map(a => h('li', {}, h('a', { href: a.getAttribute('href') }, a.dataset.title || a.textContent.trim())))));
  const bar = h('div', { class: 'ticker', role: 'region', 'aria-label': 'Related posts' },
    h('span', { class: 'ticker-h' }, 'Related'), track,
    h('button', { class: 'ticker-x', type: 'button', title: 'Dismiss', 'aria-label': 'Dismiss related posts', onclick: onClose }, '×'));
  return { bar, track };
}

export function relatedTicker({ view, page, scroller }) {
  const links = [...scroller.querySelectorAll('.rd-related a[href]')];
  if (!links.length || dismissed().includes(page.url)) return;
  view.el.classList.add('ticker-mode');
  const { bar, track } = build(links, () => {
    dismiss(page.url);
    close();
    // the focused button has gone, so keyboard focus moves to the related block that replaces the ticker
    const head = scroller.querySelector('.rd-related-h');
    if (head) { head.tabIndex = -1; head.focus({ preventScroll: true }); }
  });
  view.el.append(bar);
  // a long list drifts sideways so every title is seen; hover or focus pauses it (CSS)
  const over = track.scrollWidth - track.clientWidth;
  if (over > 8) { track.style.setProperty('--dx', -over + 'px'); track.classList.add('roll'); }
  const frame = requestAnimationFrame(() => bar.classList.add('in'));
  function close() {
    cancelAnimationFrame(frame);
    bar.remove();
    view.el.classList.remove('ticker-mode');
  }
  return close;
}
