// Start offsets of every case-insensitive match of q in text, for Find in post (lazy/find.js) and Spotlight's
// highlights (site-search.js). Returns [] when lowercasing changes the text's length (a few non-Latin characters),
// since offsets would no longer line up.
export function findOffsets(text, q) {
  const s = text.toLowerCase(), n = q.toLowerCase(), out = [];
  if (!n || s.length !== text.length) return out;
  for (let i = s.indexOf(n); i >= 0; i = s.indexOf(n, i + n.length)) out.push(i);
  return out;
}
