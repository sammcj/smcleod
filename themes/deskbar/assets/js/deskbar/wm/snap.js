// D5 snapping maths, kept free of the DOM so it can be unit tested.
// Zones: l, r (halves), max (top edge), tl, tr, bl, br (quarters). Left and right share one split ratio,
// which is what lets two side-by-side windows share a resize divider.

export const GAP = 6;

// desk: { w, h } of the usable desktop; th: tab height, since tabs sit above each window's frame
export function snapRect(zone, split, desk, th, g = GAP) {
  const sx = Math.round(desk.w * split), mid = Math.round(desk.h / 2);
  const col = zone === 'max' ? [g, desk.w - 2 * g]
    : zone.includes('l') ? [g, sx - g - g / 2]
      : [sx + g / 2, desk.w - sx - g - g / 2];
  const quarter = zone.length === 2;
  const row = quarter && zone[0] === 't' ? [th + g, mid - th - g - g / 2]
    : quarter && zone[0] === 'b' ? [mid + g / 2 + th, desk.h - mid - th - g - g / 2]
      : [th + g, desk.h - th - 2 * g];
  return { x: col[0], y: row[0], w: col[1], h: row[1] };
}

// Which zone a drag pointer is over. Side edges near the top or bottom corners give quarters.
export function zoneAt(p, desk, edge = 14, corner = 110) {
  if (p.x < edge) return p.y < corner ? 'tl' : p.y > desk.h - corner ? 'bl' : 'l';
  if (p.x > desk.w - edge) return p.y < corner ? 'tr' : p.y > desk.h - corner ? 'br' : 'r';
  return p.y < 4 ? 'max' : null;
}

// Neither side may shrink below minPx, unless the desk is too narrow for that, in which case halves
export function clampSplit(s, deskW, minPx = 300) {
  const lo = Math.min(0.5, minPx / Math.max(1, deskW));
  return Math.min(1 - lo, Math.max(lo, s));
}

export const sideOf = w => !w.snap || w.snap === 'max' ? null : w.snap.includes('l') ? 'l' : 'r';

// Snapping beside an occupied side keeps the current split; an empty desk snaps to halves
export function splitFor(wins, w, zone, split) {
  const other = zone === 'max' ? null : zone.includes('l') ? 'r' : 'l';
  return other && wins.some(o => o !== w && !o.min && sideOf(o) === other) ? split : 0.5;
}

// Arranging (the a key, and folders opening side by side): n frames over area { x, y, w, h }, tabs above each, in
// the column count whose cells come closest to 4:3. A short last row shares the full width.
export function tileRects(n, area, th, g = GAP) {
  let cols = 1;
  for (let c = 1, best = Infinity; c <= n; c++) {
    const rows = Math.ceil(n / c), off = Math.abs(Math.log(((area.w - g) / c - g) / ((area.h - g) / rows - g - th) / (4 / 3)));
    if (off < best) { best = off; cols = c; }
  }
  const rows = Math.ceil(n / cols), rh = (area.h - g) / rows;
  return Array.from({ length: n }, (_, i) => {
    const r = Math.floor(i / cols), c = i - r * cols, cw = (area.w - g) / (r === rows - 1 ? n - r * cols : cols);
    return { x: Math.round(area.x + g + c * cw), y: Math.round(area.y + r * rh + g + th), w: Math.round(cw - g), h: Math.round(rh - g - th) };
  });
}
