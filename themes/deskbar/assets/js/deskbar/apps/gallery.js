// Photos inside pages. Photos in a post that shows at least MIN_PHOTOS of them, and any image in a [data-gallery]
// block or an a.lightgallery link, open in the Photos lightbox over their window. A post with an album (D26: listed
// in data/albums.yaml, or opted in with the gallery shortcode or `photos: true`; page.html marks it with
// data-album) also gets a "View photos" chip that opens the album in Photos. Both need the site to have a Photos
// page. Without JS the images stay plain images and links.
// Only the marking and the press live in the shell; the lightbox loads with Photos (lazy/photos.js) on first use.
import { onMounted } from '../content.js';
import { addReaderAddon } from '../reader.js';
import { loadLazy } from '../loader.js';
import { h, plainClick } from '../lib/dom.js';
import { MIN_PHOTOS, isPhotoSrc, isImageHref, photosHref } from '../lib/albums.js';

// The Photos page's address, which baseof.html publishes on <html>; empty when the site has none
const photosURL = () => document.documentElement.dataset.photos || '';

const photosIn = root => [...root.querySelectorAll('.rd-body img')].filter(i => isPhotoSrc(i.getAttribute('src')));

function galleryImages(root) {
  const all = photosIn(root);
  return all.length >= MIN_PHOTOS ? all : all.filter(i => i.closest('[data-gallery], a.lightgallery'));
}

const bound = new WeakSet();

onMounted(({ root, view }) => {
  if (!photosURL()) return;
  // new content in the window: a viewer left open belongs to the page before
  view.zoomBox?.close();
  for (const img of galleryImages(root)) img.classList.add('zoom');
  // reader windows reuse their root for every page, so it is listened to once
  if (bound.has(root)) return;
  bound.add(root);
  root.addEventListener('click', e => {
    const img = e.target.closest?.('img.zoom');
    if (!img || !plainClick(e)) return;
    const a = img.closest('a[href]');
    // an image linking somewhere other than a picture keeps its link
    if (a && !isImageHref(a.getAttribute('href'))) return;
    e.preventDefault();
    loadLazy('photos').then(m => m.zoom(view, root, img), console.error);
  });
});

addReaderAddon(({ view }) => {
  const head = view.el.querySelector('.rd > header'), album = head?.parentElement.dataset.album;
  const n = photosIn(view.el).length, url = photosURL();
  if (!album || !n || !url) return;
  const chips = head.querySelector('.chips') || head.appendChild(h('p', { class: 'chips' }));
  chips.append(h('a', { class: 'chip photos-chip', href: photosHref(url, album), title: 'Open this post\'s photos in Photos' },
    `View photos (${n})`));
});
