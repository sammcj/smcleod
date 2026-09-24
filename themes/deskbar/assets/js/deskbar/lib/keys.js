// Arrow keys over a list or grid of items (Tracker, folders, the Photos grid). Left and Right step to the previous and
// next item; Up and Down go to the nearest item in the row above or below, which in a single column is the previous
// or next one. With nothing selected yet, any arrow picks the first. Returns undefined for other keys and at the ends.
export function arrowTo(items, cur, key) {
  const i = items.indexOf(cur), side = { ArrowLeft: -1, ArrowRight: 1 }[key];
  if (!side && key !== 'ArrowUp' && key !== 'ArrowDown') return;
  if (i < 0) return items[0];
  if (side) return items[i + side];
  const r = cur.getBoundingClientRect(), down = key === 'ArrowDown';
  let best, score = Infinity;
  for (const it of items) {
    const b = it.getBoundingClientRect(), gap = down ? b.top - r.bottom : r.top - b.bottom;
    // any nearer row beats the best column match in a further one
    const s = gap < -1 ? Infinity : gap * 1e4 + Math.abs(b.left + b.width / 2 - r.left - r.width / 2);
    if (s < score) { score = s; best = it; }
  }
  return best;
}
