// Photos (D15) and its lightbox, loaded on first use: by the Photos window (lazyApp in apps/index.js), or by a press on
// a photo in a page (apps/gallery.js calls zoom).
// Photos shows albums in a sidebar (a menu in narrow windows), a thumbnail grid and the lightbox. Albums come from the
// manifest the photos layout publishes; its URL is on the page's [data-albums]. The window's state is its URL
// (?album=<id>&photo=<n>), so choosing an album or opening a photo adds history without fetching the page again, and
// Back and Forward are answered here through onPop.
import { h, ico, svgBtn, stroke, plainClick, find, toTop } from '../lib/dom.js';
import { parseAlbums, findAlbum, photosState, photosHref, step, swipe, isImageHref } from '../lib/albums.js';
import { arrowTo } from '../lib/keys.js';

// ---- lightbox: covers the view it is appended to, so it stays inside its window. Prev/next buttons, swipe, arrow
// keys and Escape; a tap on the backdrop closes.

const arrow = (label, d, cls, onclick) => svgBtn(label, stroke(d), onclick, 'lb-nav ' + cls);

// onShow(i) runs whenever a photo is shown, onClose() when the viewer closes. returnTo(i) names the element to
// focus on close (the thumbnail of the last photo shown); without one, focus goes back to where it was.
export function makeLightbox({ onShow, onClose, returnTo } = {}) {
  let items = [], i = -1, title = '', opener = null, sx = null, sy = 0;
  const img = h('img', { alt: '', decoding: 'async' });
  const cap = h('p', { class: 'lb-cap' }), num = h('span', { class: 'lb-n' });
  const prev = arrow('Previous photo', 'M10 3L5 8l5 5', 'lb-prev', () => go(-1));
  const next = arrow('Next photo', 'M6 3l5 5-5 5', 'lb-next', () => go(1));
  const el = h('div', { class: 'lightbox', hidden: true, role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Photo viewer', tabindex: '-1' },
    img, prev, next,
    h('div', { class: 'lb-bar' }, num, cap,
      h('button', { class: 'lb-close', type: 'button', title: 'Close viewer', 'aria-label': 'Close viewer', onclick: () => close() }, ico('c-x', ''))));

  function show(n) {
    i = n;
    const it = items[n];
    img.src = it.src;
    img.alt = it.caption || title;
    cap.textContent = it.caption || title;
    num.textContent = `${n + 1} / ${items.length}`;
    prev.hidden = next.hidden = items.length < 2;
    el.hidden = false;
    // fetch the neighbours now so stepping shows them at once
    if (items.length > 1) for (const d of [-1, 1]) new Image().src = items[step(n, d, items.length)].src;
    onShow?.(n);
  }
  const go = d => { if (!el.hidden && items.length) show(step(i, d, items.length)); };

  function close() {
    if (el.hidden) return;
    const back = returnTo?.(i) || opener;
    el.hidden = true;
    i = -1;
    img.removeAttribute('src');
    if (back?.isConnected) back.focus({ preventScroll: true });
    opener = null;
    onClose?.();
  }

  // Tab cycles through the viewer's own buttons while it is open, so keyboard focus can't slip behind it
  function trapTab(e) {
    const stops = [...el.querySelectorAll('button')].filter(b => !b.hidden);
    const at = stops.indexOf(document.activeElement);
    const to = e.shiftKey ? (at <= 0 ? stops.length - 1 : at - 1) : (at < 0 || at === stops.length - 1 ? 0 : at + 1);
    stops[to]?.focus();
  }

  el.addEventListener('keydown', e => {
    if (e.key === 'Tab') {
      e.preventDefault();
      return trapTab(e);
    }
    const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (d) go(d);
    else if (e.key === 'Escape') close();
    else return;
    e.preventDefault();
    e.stopPropagation();
  });
  el.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    sx = e.clientX;
    sy = e.clientY;
  });
  el.addEventListener('pointerup', e => {
    if (sx == null) return;
    const dx = e.clientX - sx, dy = e.clientY - sy, d = swipe(dx, dy);
    sx = null;
    if (d) go(d);
    else if (e.target === el && Math.abs(dx) < 8 && Math.abs(dy) < 8) close();
  });
  el.addEventListener('pointercancel', () => { sx = null; });

  return {
    el,
    close,
    get index() { return i; },
    // list: [{ src, caption }], n: the photo to start on, label: caption for photos without one
    open(list, n = 0, label = '') {
      if (!list.length) return;
      if (el.hidden) opener = document.activeElement;
      items = list;
      title = label;
      show(Math.max(0, Math.min(n, list.length - 1)));
      el.focus({ preventScroll: true });
    },
  };
}

// ---- photos in pages (apps/gallery.js marks them img.zoom)

// A linked thumbnail shows its link target at full size
function itemFor(img) {
  const a = img.closest('a[href]');
  const cap = img.closest('figure')?.querySelector('figcaption')?.textContent.trim();
  return { src: a && isImageHref(a.getAttribute('href')) ? a.href : img.currentSrc || img.src, caption: cap || img.alt || img.title || '' };
}

// Opens img, and steps through the other photos in root, over view's window. The shell closes view.zoomBox when new
// content arrives in the window.
export function zoom(view, root, img) {
  // the window moved on to another page while this bundle loaded
  if (!img.isConnected) return;
  let lb = view.zoomBox;
  if (!lb) {
    lb = view.zoomBox = makeLightbox({ returnTo: i => lb.shown[i]?.closest('a[href]') });
    view.el.append(lb.el);
  }
  lb.shown = [...root.querySelectorAll('img.zoom')];
  lb.open(lb.shown.map(itemFor), lb.shown.indexOf(img), view.title);
}

// ---- the Photos window

const shell = () => window.deskbar;
const currentPath = () => location.pathname + location.search;

const manifests = new Map();
function loadAlbums(url) {
  if (!manifests.has(url)) {
    manifests.set(url, fetch(url).then(r => (r.ok ? r.json() : [])).catch(() => []).then(parseAlbums));
  }
  return manifests.get(url);
}

function manifestURL(page) {
  if (page.albumsURL === undefined) {
    page.albumsURL = find(page.content(), '[data-albums]')?.dataset.albums || '';
  }
  return page.albumsURL;
}

// Fills the app's empty view (loader.js makes it) with the album list, grid and lightbox, and gives it show and apply
function build(v) {
  Object.assign(v, { path: '', src: '', albums: [], album: undefined });
  const { push, replace } = shell().router;
  let photo = 0, pushed = false, quiet = false;
  const side = h('nav', { class: 'albums', 'aria-label': 'Albums' });
  const sel = h('select', { class: 'album-sel', 'aria-label': 'Album' });
  const head = h('b', {}), count = h('small', {});
  const grid = h('div', { class: 'ph-grid' }), main = h('div', { class: 'ph-main scroller' }, grid);
  // opening a photo pushes history so Back closes it; moving between photos replaces that entry
  const lb = makeLightbox({
    onShow: n => {
      if (quiet) return;
      const href = photosHref(v.path, v.album.id, n + 1);
      if (photo) replace(href, v.page.docTitle); else { push(href, v.page.docTitle); pushed = true; }
      photo = n + 1;
    },
    onClose: () => {
      if (quiet) return;
      const here = currentPath(), ours = pushed && here === v.route();
      photo = 0;
      pushed = false;
      if (ours) history.back();
      // only an address Photos still owns is rewritten; another window may have taken the address bar since
      else if (new URL(here, location.href).pathname === v.path) replace(v.route());
    },
    returnTo: i => grid.querySelector(`a.ph[data-i="${i}"]`),
  });
  v.el.append(
    h('div', { class: 'toolbar' }, sel, head, count),
    h('div', { class: 'ph-body' }, side, main), lb.el);
  v.route = () => photosHref(v.path, v.album?.id, photo);

  function renderSide() {
    const link = a => h('a', { class: 'al', href: photosHref(v.path, a.id), 'data-album': a.id },
      h('img', { src: a.items[0].thumb, alt: '', loading: 'lazy', decoding: 'async' }), h('span', {}, a.title), h('small', {}, a.items.length));
    const listed = v.albums.filter(a => !a.auto), posts = v.albums.filter(a => a.auto);
    side.replaceChildren(...[
      listed.length ? h('h2', {}, 'Albums') : [], listed.map(link),
      posts.length ? h('h2', {}, 'From posts') : [], posts.map(link)].flat());
    sel.replaceChildren(...v.albums.map(a => h('option', { value: a.id }, a.title)));
  }

  function renderAlbum(a) {
    v.album = a;
    head.textContent = a ? a.title : 'Photos';
    count.textContent = a ? `${a.items.length} photo${a.items.length === 1 ? '' : 's'}` : '';
    grid.replaceChildren(...(a
      ? a.items.map((it, i) => h('a', { class: 'ph', href: it.src, 'data-i': i, title: it.caption || `${a.title}, photo ${i + 1}` },
        h('img', { src: it.thumb, alt: it.caption, loading: 'lazy', decoding: 'async' })))
      : [h('p', { class: 'ph-empty' }, v.albums.length ? 'There is no album at this address.' : 'No albums yet.')]));
    toTop(main);
    for (const x of side.querySelectorAll('.al')) {
      const on = x.dataset.album === a?.id;
      x.classList.toggle('on', on);
      if (on) x.setAttribute('aria-current', 'true'); else x.removeAttribute('aria-current');
    }
    sel.value = a?.id || '';
  }

  // Shows whatever an address names. No album chosen shows the first; an unknown one says so.
  v.apply = href => {
    const st = photosState(href, location.href);
    const a = st.album ? findAlbum(v.albums, st.album) : v.albums[0] || null;
    if (a !== v.album) renderAlbum(a);
    // opening the window again resets the title to the page's, so it is set on every visit
    v.title = a ? 'Photos: ' + a.title : 'Photos';
    if (v.win) shell().renderTabs(v.win);
    quiet = true;
    if (a && st.photo && st.photo <= a.items.length) {
      photo = st.photo;
      lb.open(a.items, st.photo - 1, a.title);
    } else {
      photo = 0;
      lb.close();
    }
    quiet = false;
    pushed = false;
  };

  // the address changes without a page load, so the title comes along (another window may have set it)
  const go = href => {
    push(href, v.page.docTitle);
    v.apply(href);
  };
  sel.addEventListener('change', () => go(photosHref(v.path, sel.value)));
  // the arrows move through the thumbnails, and Enter opens the focused one, as it is a link
  grid.addEventListener('keydown', e => {
    const to = arrowTo([...grid.querySelectorAll('a.ph')], e.target.closest('a.ph'), e.key);
    if (!to) return;
    e.preventDefault();
    to.focus();
  });
  // a press that wobbles would drag the thumbnail instead of opening it
  grid.addEventListener('dragstart', e => e.preventDefault());
  v.el.addEventListener('click', e => {
    if (!plainClick(e)) return;
    const al = e.target.closest('a.al'), ph = e.target.closest('a.ph');
    if (al) {
      e.preventDefault();
      go(al.getAttribute('href'));
    } else if (ph && v.album) {
      e.preventDefault();
      lb.open(v.album.items, Number(ph.dataset.i), v.album.title);
    }
  });

  v.ready = Promise.resolve();
  v.show = async page => {
    v.path = new URL(page.url, location.href).pathname;
    const url = manifestURL(page);
    if (url !== v.src) {
      v.src = url;
      v.ready = (url ? loadAlbums(url) : Promise.resolve([])).then(list => {
        v.albums = list;
        v.album = undefined;
        renderSide();
      });
    }
    await v.ready;
    // another address may have been opened while the manifest loaded
    if (v.page === page) v.apply(page.url);
  };
}

// The open Photos view, for Back and Forward; one per desktop (its key is 'photos')
let photos = null;

export function mount(v, page, { fresh }) {
  if (fresh) build(v);
  photos = v;
  v.show(page);
}

// Back and Forward between Photos addresses: redraw the open window instead of reloading its page
shell().onPop(key => {
  const v = photos;
  if (!v?.el.isConnected || !v.path || new URL(key, location.href).pathname !== v.path) return false;
  shell().focusView(v);
  if (v.page.docTitle) document.title = v.page.docTitle;
  v.ready.then(() => v.apply(key));
  return true;
});
