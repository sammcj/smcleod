// D8: the post reader's own history of the posts it has shown. Its Back and Forward walk this list, so pages
// opened in other windows (Tracker places, About, Photos) never count. pos is the entry on screen; moving is the
// entry a reader button asked the router for.
export const trail = () => ({ list: [], pos: -1, moving: -1 });

// Records url as shown. A reader button move lands on its target, and browser Back or Forward (pop) onto a
// neighbour moves along the list. Anything else is a new entry, dropping what was ahead of it, or with replace (as the
// browser's history entry was replaced) takes the place of the entry on screen.
export function visit(t, url, pop = false, replace = false) {
  const { list, pos } = t;
  if (t.moving >= 0 && list[t.moving] === url) t.pos = t.moving;
  else if (pop && list[pos - 1] === url) t.pos--;
  else if (pop && list[pos + 1] === url) t.pos++;
  else if (replace && pos >= 0) list[pos] = url;
  else if (list[pos] !== url) { list.splice(pos + 1, Infinity, url); t.pos = list.length - 1; }
  t.moving = -1;
}
