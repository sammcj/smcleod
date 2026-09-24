// Photos data and URLs, kept free of DOM access so they are unit tested in Node.
// The manifest comes from _partials/deskbar/apps/albums.html; a site can override that template, so parsing is
// defensive and drops anything unusable rather than failing.

// Posts showing at least this many photos open them in the lightbox. Albums and the "View photos" action are
// opt-in instead (D26), since posts with several images are more often screenshots and diagrams than photos.
export const MIN_PHOTOS = 3;

const str = v => (typeof v === 'string' ? v : '');
const dim = v => (Number.isFinite(v) && v > 0 ? v : 0);

export function parseAlbums(raw) {
  const ids = new Set();
  return (Array.isArray(raw) ? raw : []).map(a => ({
    id: str(a?.id), title: str(a?.title) || str(a?.id), post: str(a?.post), slug: str(a?.slug), auto: a?.auto === true,
    items: (Array.isArray(a?.items) ? a.items : []).filter(x => str(x?.src)).map(x => ({
      src: x.src, thumb: str(x.thumb) || x.src, caption: str(x.caption), w: dim(x.w), h: dim(x.h),
    })),
  })).filter(a => a.id && a.items.length && !ids.has(a.id) && ids.add(a.id));
}

// Albums are addressed by id; a post's slug also finds the album made from that post
export const findAlbum = (albums, q) => (q && (albums.find(a => a.id === q) || albums.find(a => a.slug === q))) || null;

// The Photos window's state lives in its URL (D12): ?album=<id>&photo=<n>, n counting from 1, 0 for none
export function photosState(href, base = 'http://x/') {
  const q = new URL(href, base).searchParams, n = Number(q.get('photo'));
  return { album: q.get('album') || '', photo: Number.isInteger(n) && n > 0 ? n : 0 };
}

export function photosHref(path, album, photo = 0) {
  const q = new URLSearchParams();
  if (album) q.set('album', album);
  if (photo > 0) q.set('photo', String(photo));
  const s = q.toString();
  return path + (s ? '?' + s : '');
}

// Lightbox stepping wraps round at both ends; -1 when there is nothing to show
export const step = (i, d, n) => (n > 0 ? (((i + d) % n) + n) % n : -1);

// A swipe is a mostly sideways move of more than 50px: 1 moves to the next photo, -1 the previous, 0 is no swipe
export const swipe = (dx, dy) => (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : -1) : 0);

// SVGs and data: URIs are icons and diagrams rather than photos (same rule as post-images.html)
export const isPhotoSrc = src => !!src && !/^data:|\.svg([?#]|$)/i.test(src.trim());

// A link straight to an image file, as a gallery thumbnail pointing at its full size would be
export const isImageHref = href => !!href && /\.(jpe?g|png|gif|webp|avif)([?#].*)?$/i.test(href.trim());
