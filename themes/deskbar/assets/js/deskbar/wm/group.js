// D40 window groups: windows joined side by side, which move, raise and minimise together and share a seam that
// resizes them. The maths, kept free of the DOM so it can be unit tested; wm/windows.js does the rest.
// A group is { wins, x, y, w, h, fill }: its members left to right and the box their frames fill between them (tabs
// sit above it). Each member keeps its share of the width in w.share, in pixels at the time it was last set, so only
// the ratios matter. A fill group covers the desk as a maximised window does, and keeps doing so as the desk resizes.
import { GAP } from './snap.js';

export const MIN_W = 300;

// Frames left to right across box, one per share, a gap apart; the last takes the rounding
export function memberRects(box, shares, g = GAP) {
  const room = box.w - g * (shares.length - 1), sum = shares.reduce((a, b) => a + b, 0) || 1;
  let x = box.x;
  return shares.map((s, i) => {
    const w = i === shares.length - 1 ? box.x + box.w - x : Math.round((room * s) / sum);
    const r = { x, y: box.y, w, h: box.h };
    x += w + g;
    return r;
  });
}

// The box once a window jw wide joins box's side ('l' or 'r'): it grows that way, then moves back onto the desk and,
// if still too wide, shrinks to fit. Its height stays, bar what the desk cuts off. left: the desk's usable left edge
// (clear of the desktop icons), kept to when the box was already clear of them.
export function joinBox(box, jw, side, desk, th, g = GAP, left = 0) {
  const lo = box.x >= left ? Math.max(left, g) : g;
  const w = Math.min(box.w + g + jw, desk.w - g - lo);
  const x = Math.min(Math.max(side === 'l' ? box.x - g - jw : box.x, lo), desk.w - g - w);
  const y = Math.max(box.y, th + g);
  return { x, y, w, h: Math.max(180, Math.min(box.h, desk.h - y - g)) };
}

// The box once the member at i (of rects, left to right) leaves: the others keep their places and sizes, the ones right
// of it closing up
export function leaveBox(box, rects, i, g = GAP) {
  const w = box.w - rects[i].w - g;
  return { ...box, x: i === 0 ? rects[1].x : box.x, w };
}

// Where a window dragged with the pointer at p would go on a window whose frame is r: join its left or right side
// ('l', 'r') from a band along that edge, or take its place ('c') from the middle, which only group members offer, or
// nowhere (null)
export function dropAt(p, r, grouped) {
  if (p.x < r.x || p.x > r.x + r.w || p.y < r.y || p.y > r.y + r.h) return null;
  const band = Math.min(40, r.w / 4);
  if (p.x < r.x + band) return 'l';
  if (p.x > r.x + r.w - band) return 'r';
  return grouped && Math.abs(p.x - r.x - r.w / 2) < r.w / 6 && Math.abs(p.y - r.y - r.h / 2) < r.h / 6 ? 'c' : null;
}

// Moving the seam after member i by dx: the members either side trade width, neither going under min unless both are
// too narrow for that, in which case they halve
export function dragSeam(widths, i, dx, min = MIN_W) {
  const a = widths[i], b = widths[i + 1], lo = Math.min(min, (a + b) / 2);
  const na = Math.round(Math.min(Math.max(a + dx, lo), a + b - lo));
  const out = widths.slice();
  out[i] = na;
  out[i + 1] = a + b - na;
  return out;
}
