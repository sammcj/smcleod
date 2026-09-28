// cowsay (lazy/terminal.js), as Tony Monroe's original draws it: the text filled to lines under 40 columns (its -W 40,
// through Perl's Text::Wrap), a word too long for a line broken across lines, and the default cow.

const COW = String.raw`
        \   ^__^
         \  (oo)\_______
            (__)\       )\/\
                ||----w |
                ||     ||`;

export function fill(text, width = 39) {
  const lines = [];
  let cur = '';
  for (let w of text.split(/\s+/).filter(Boolean)) {
    while (w.length > width) {
      if (cur) { lines.push(cur); cur = ''; }
      lines.push(w.slice(0, width));
      w = w.slice(width);
    }
    if (!cur) cur = w;
    else if (cur.length + 1 + w.length <= width) cur += ' ' + w;
    else { lines.push(cur); cur = w; }
  }
  if (cur || !lines.length) lines.push(cur);
  return lines;
}

// One line sits in < >; more get / \ corners and | sides
export function cowsay(text) {
  const lines = fill(text), n = Math.max(...lines.map(l => l.length)), last = lines.length - 1;
  const ends = i => (!last ? '<>' : !i ? '/\\' : i === last ? '\\/' : '||');
  const body = lines.map((l, i) => `${ends(i)[0]} ${l.padEnd(n)} ${ends(i)[1]}`);
  return [' ' + '_'.repeat(n + 2), ...body, ' ' + '-'.repeat(n + 2)].join('\n') + COW;
}
