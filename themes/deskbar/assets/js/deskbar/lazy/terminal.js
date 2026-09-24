// Terminal (`window: terminal`): a small shell over the site. ls, cd and pwd walk posts by year, tag and category;
// cat and open show a post in the reader; grep searches the full-text site index. Loaded on first open through
// lazyApp (loader.js). Site data only ever reaches the page as text nodes.
// The parsing, path and completion helpers are DOM free so they are unit tested in Node.
import { h } from '../lib/dom.js';
import { store } from '../lib/store.js';

const str = v => (typeof v === 'string' ? v : '');
const strs = v => (Array.isArray(v) ? v.filter(x => typeof x === 'string') : []);
const list = v => (Array.isArray(v) ? v : []);
const slugOf = url => url.replace(/[?#].*$/, '').replace(/\/+$/, '').split('/').pop() || '';
// Case and accent insensitive, as Spotlight matches
export const norm = s => str(s).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');

// The shell's post index (home.deskbar.json). Parsing drops anything unusable, as a site can override the template.
export function parseSite(raw) {
  const ok = x => str(x?.url) && str(x?.title ?? x?.name);
  const posts = list(raw?.posts).filter(ok).map(p => ({
    title: p.title, url: p.url, slug: slugOf(p.url), date: /^\d{4}-\d\d-\d\d$/.test(p.date) ? p.date : '',
    tags: strs(p.tags), categories: strs(p.categories), description: str(p.description),
  })).sort((a, b) => b.date.localeCompare(a.date));
  const pages = list(raw?.pages).filter(ok).map(p => ({ title: p.title, url: p.url, slug: slugOf(p.url) }));
  const terms = name => list(raw?.taxonomies?.[name]).filter(ok)
    .map(t => ({ name: t.name, url: t.url, slug: slugOf(t.url), count: Number(t.count) || 0 }));
  const tax = raw?.taxonomyURLs || {};
  return {
    posts, pages, tags: terms('tags'), categories: terms('categories'),
    urls: { posts: str(raw?.sectionURL) || '/posts/', tags: str(tax.tags), categories: str(tax.categories) },
  };
}

const fileOf = p => ({ name: p.slug, url: p.url, title: p.title, date: p.date || '' });

// The entries of the directory at parts ([] is the root), or null when there is no such directory.
// An entry is { name, dir?, url?, title?, date?, count? }.
export function listDir(site, parts) {
  const [top, sub, ...more] = parts;
  if (more.length) return null;
  if (!top) {
    return ['posts', 'tags', 'categories', 'pages'].filter(k => site[k].length)
      .map(k => ({ name: k, dir: true, url: site.urls[k] || '', count: site[k].length }));
  }
  if (top === 'posts') {
    const years = {};
    for (const p of site.posts) if (p.date) (years[p.date.slice(0, 4)] ||= []).push(p);
    if (!sub) return Object.keys(years).sort().reverse().map(y => ({ name: y, dir: true, count: years[y].length }));
    return years[sub]?.map(fileOf) || null;
  }
  if (top === 'tags' || top === 'categories') {
    const t = site[top];
    if (!sub) return t.map(x => ({ name: x.slug, dir: true, url: x.url, title: x.name, count: x.count }));
    const term = t.find(x => x.slug === sub);
    return term ? site.posts.filter(p => p[top].includes(term.name)).map(fileOf) : null;
  }
  if (top === 'pages' && !sub) return site.pages.map(fileOf);
  return null;
}

// cwd and the result are arrays of path segments. "/" and "~" are the root.
export function resolvePath(cwd, arg = '') {
  const parts = /^[/~]/.test(arg) ? [] : cwd.slice();
  for (const s of arg.replace(/^~/, '').split('/')) {
    if (s === '..') parts.pop();
    else if (s && s !== '.') parts.push(s);
  }
  return parts;
}

export const showPath = parts => '/' + parts.join('/');

// The entry a path names: a directory or a file in one
export function entryAt(site, parts) {
  if (!parts.length) return { name: '/', dir: true, url: '/' };
  return listDir(site, parts.slice(0, -1))?.find(e => e.name === parts.at(-1)) || null;
}

// What a cat or open argument names: a path, else posts and pages by slug (exact, then prefix, then part)
export function lookup(site, cwd, arg) {
  const e = entryAt(site, resolvePath(cwd, arg));
  if (e) return [e];
  if (arg.includes('/')) return [];
  const a = norm(arg), all = [...site.posts, ...site.pages];
  for (const test of [s => s === a, s => s.startsWith(a), s => s.includes(a)]) {
    const hits = all.filter(p => test(norm(p.slug)));
    if (hits.length) return hits.map(fileOf);
  }
  return [];
}

// Words split on white space. Quotes and backslashes keep spaces within a word, as in a shell.
export function tokenise(line) {
  const words = [];
  let cur = null, quote = '';
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === quote) quote = '';
      else cur += c;
    } else if (c === '"' || c === "'") {
      quote = c;
      cur ??= '';
    } else if (c === '\\' && i + 1 < line.length) cur = (cur ?? '') + line[++i];
    else if (/\s/.test(c)) {
      if (cur !== null) words.push(cur);
      cur = null;
    } else cur = (cur ?? '') + c;
  }
  if (cur !== null) words.push(cur);
  return words;
}

// Posts and pages holding every word of the query, title matches first, then newest.
// entries: the site index (home.deskbarsearch.json) or, without one, the post index.
export function grep(entries, query) {
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return entries.map(e => {
    const title = norm(e.title), text = [title, norm(e.description), norm(strs(e.tags).join(' ')), norm(e.body)].join(' ');
    return words.every(w => text.includes(w)) && [e, words.filter(w => title.includes(w)).length];
  }).filter(Boolean).sort((a, b) => b[1] - a[1] || str(b[0].date).localeCompare(str(a[0].date))).map(x => x[0]);
}

// Commands: [arguments, summary, what Tab completes (cmd, dir, path, file or a list of words)].
// Hidden ones are easter eggs, left out of help and completion.
export const COMMANDS = {
  help: ['[command]', 'list commands, or explain one', 'cmd'],
  ls: ['[-l] [path]', 'list a directory: posts by year, tags, categories, pages', 'path'],
  cd: ['[path]', 'change directory (.., / and ~ work)', 'dir'],
  pwd: ['', 'print the current directory'],
  cat: ['<post>', 'show a post\'s summary and open it in the reader', 'file'],
  open: ['<post|path>', 'open a post, page or folder in its window', 'file'],
  grep: ['<words>', 'search the full text of every post and page'],
  search: ['<words>', 'the same as grep'],
  tags: ['[count]', 'the most used tags'],
  whoami: ['', 'who runs this site'],
  date: ['', 'the date and time where the site lives'],
  theme: ['[light|dark]', 'switch the desktop between light and dark', ['light', 'dark']],
  fortune: ['', 'a quote, picked at random'],
  neofetch: ['', 'facts about this machine'],
  screensaver: ['[leaves|sheep]', 'start the screen saver: the one named, or your choice in the Control panel', ['leaves', 'sheep']],
  history: ['[-c]', 'list, or clear (-c), the commands you have typed'],
  echo: ['[text]', 'print text'],
  man: ['<command>', 'the manual for a command', 'cmd'],
  clear: ['', 'clear the screen (Ctrl+L)'],
  exit: ['', 'close the terminal'],
  uname: ['[-a]', 'the operating system', null, true],
  sudo: ['<command>', 'run a command as root', null, true],
};
const visible = Object.keys(COMMANDS).filter(n => !COMMANDS[n][3]);

// Tab completion of the word at the end of line. Returns { line, options }: the line completed as far as every
// candidate agrees, and the candidates to show when there is more than one.
export function complete(line, site, cwd) {
  const word = /\S*$/.exec(line)[0], before = line.slice(0, line.length - word.length), [cmd] = tokenise(before);
  const kind = cmd ? COMMANDS[cmd]?.[2] : 'cmd';
  let cands = [], dir = '';
  if (kind === 'cmd') cands = visible.map(n => n + ' ');
  else if (Array.isArray(kind)) cands = kind.map(w => w + ' ');
  else if (kind) {
    dir = word.slice(0, word.lastIndexOf('/') + 1);
    cands = (listDir(site, resolvePath(cwd, dir)) || []).filter(e => kind !== 'dir' || e.dir)
      .map(e => dir + e.name + (e.dir ? '/' : ' '));
    // a post by name from anywhere, as cat and open find it
    if (kind === 'file' && !dir && word) cands.push(...[...site.posts, ...site.pages].map(p => p.slug + ' '));
  }
  const hits = [...new Set(cands.filter(c => c.startsWith(word)))];
  if (!hits.length) return { line, options: [] };
  if (hits.length === 1) return { line: before + hits[0], options: [] };
  let n = 0;
  while (hits.every(x => x[n] && x[n] === hits[0][n])) n++;
  return { line: before + hits[0].slice(0, n), options: hits.map(x => x.slice(dir.length).trimEnd()) };
}

// Closest command to a mistyped one, for "did you mean"
export function suggest(name) {
  // edits apart, with a swapped pair of letters (gerp) counting as one
  const dist = (a, b) => {
    const d = [...Array(a.length + 1)].map((_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] !== b[j - 1]));
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
    return d[a.length][b.length];
  };
  const [best] = visible.map(n => [n, dist(name, n)]).sort((a, b) => a[1] - b[1]);
  return best && best[1] <= Math.max(1, Math.floor(name.length / 3)) ? best[0] : '';
}

// Error messages from BeOS's NetPositive browser, for fortune on a site without a quotes page
const HAIKU = [
  'The web site you seek\ncannot be located but\nendless others exist.',
  'Chaos reigns within.\nReflect, repent, and retry.\nOrder shall return.',
  'Stay the patient course.\nOf little worth is your ire.\nThe network is down.',
];

const LEAF = String.raw`
        ,.--.
      ,'  .' \
     /  .'    |
    |  /     /
    | /    .'
     /__.-'
    /`.slice(1);

// ---- the terminal itself (browser only) ----

// A failed load is forgotten, so the next command tries again and this one reports the error
const getJSON = url => (url ? fetch(url).then(r => (r.ok ? r.json() : Promise.reject(new Error(`${url}: ${r.status}`)))) : Promise.resolve({}));
let siteP = null, searchP = null;
const loadSite = () => (siteP ||= getJSON(document.documentElement.dataset.index).then(parseSite)
  .catch(err => { siteP = null; throw err; }));
async function loadSearch() {
  searchP ||= getJSON(document.getElementById('searchBtn')?.dataset.index).then(raw => list(raw?.entries)
    .filter(e => str(e?.title) && str(e?.url))
    .map(e => ({ title: e.title, url: e.url, kind: str(e.kind), date: str(e.date), description: str(e.description), tags: strs(e.tags), body: str(e.body) })))
    .catch(err => { searchP = null; throw err; });
  const entries = await searchP;
  return entries.length ? entries : (await loadSite()).posts.map(p => ({ ...p, kind: 'post' }));
}

async function fetchDoc(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return new DOMParser().parseFromString(await res.text(), 'text/html');
}
const pageNamed = (site, re) => site.pages.find(p => re.test(p.url));

const HOST = globalThis.location?.hostname || 'localhost';
const HIST = 'termHistory', CHIPS = ['help', 'ls', 'ls posts', 'tags', 'whoami', 'fortune', 'neofetch', 'date', 'clear'];

function create(v) {
  const out = h('div', { class: 'term-out', role: 'log', 'aria-label': 'Terminal output' });
  const ps = h('span', { class: 'term-ps' });
  const input = h('input', {
    class: 'term-in', 'aria-label': 'Command', autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off',
    spellcheck: 'false', enterkeyhint: 'go',
  });
  const scr = h('div', { class: 'term' }, out, h('label', { class: 'term-line' }, ps, input));
  const chips = h('div', { class: 'term-chips' }, CHIPS.map(c => h('button', { class: 'term-chip', type: 'button', 'data-cmd': c }, c)));
  v.el.append(scr, chips);

  const T = { cwd: [], hist: strs(store.get(HIST, [])).slice(-100), hi: 0, draft: '', job: 0 };
  T.hi = T.hist.length;
  const coarse = () => matchMedia('(pointer: coarse)').matches;
  const bottom = () => { scr.scrollTop = scr.scrollHeight; };
  const span = (cls, text) => h('span', { class: cls }, text);
  const prompt = () => [span('c-g', 'guest@' + HOST), ':', span('c-b', T.cwd.length ? '~' + showPath(T.cwd) : '~'), '$ '];
  // Output links and commands are for pointers; the keyboard types them instead, so Shift+Tab from the prompt
  // leaves the terminal rather than walking back through every line of output
  const btn = (cmd, label = cmd, cls = '') => h('button', { class: 'tl ' + cls, type: 'button', tabindex: '-1', 'data-cmd': cmd }, label);
  const link = (e, label = e.name, cls = '') => h('a', { class: 'tl ' + cls, tabindex: '-1', href: e.url, title: e.title || null }, label);
  const drawPrompt = () => ps.replaceChildren(...prompt());
  drawPrompt();

  const print = (...kids) => { out.append(h('div', { class: 'ln' }, ...kids)); bottom(); };
  // words of text wrapped in <mark>, case-insensitively
  const marked = (text, words) => {
    if (!words.length) return text;
    const re = new RegExp(`(${words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'ig');
    return text.split(re).map((s, i) => (i % 2 ? h('mark', {}, s) : s));
  };
  // a dim first column (date, count or kind) with the rest hanging beside it when it wraps
  const row = (first, ...rest) => h('span', { class: 't-row' }, span('c-d', first || ''), h('span', {}, ...rest));
  const entryLink = e => (e.url ? link(e, e.name + (e.dir ? '/' : ''), e.dir ? 'c-b' : '') : span('c-b', e.name + '/'));
  const go = url => window.deskbar?.go(url);

  // Each command gets say(), which prints only while the command is still current, so Ctrl+C silences a slow one.
  // say.live() tells a command whether to go on with a side effect (cd, opening a window) after awaiting.
  const run = {
    help(say, [name]) {
      if (name) return run.man(say, [name]);
      say(span('c-d', 'Commands. Tab completes names and paths; up and down walk your history.'));
      for (const n of visible) say(span('c-y cmdn', `${n} ${COMMANDS[n][0]}`.trim()), ' ', COMMANDS[n][1]);
    },
    man(say, [name]) {
      const c = COMMANDS[name];
      if (!name) return say('What manual page do you want? Try ', btn('man ls'), '.');
      if (!c) return say(`No manual entry for ${name}`);
      say(span('c-y', 'NAME'), `\n    ${name} - ${c[1]}\n`, span('c-y', 'SYNOPSIS'), `\n    ${name} ${c[0]}`);
    },
    pwd: say => say(showPath(T.cwd)),
    async ls(say, args) {
      const long = args.includes('-l'), arg = args.find(a => !a.startsWith('-')) || '';
      const site = await loadSite(), parts = resolvePath(T.cwd, arg), entries = listDir(site, parts);
      if (!entries) {
        const e = entryAt(site, parts);
        return e ? say(entryLink(e)) : say(span('c-r', `ls: cannot access '${arg}': No such file or directory`));
      }
      if (!entries.length) return say(span('c-d', 'empty'));
      const cmdFor = e => `ls ${showPath([...parts, e.name])}`;
      const item = e => (e.dir ? btn(cmdFor(e), e.name + '/', 'c-b') : link(e));
      if (!long) return say(h('span', { class: 'cols' }, entries.map(item)));
      for (const e of entries) say(row(e.dir ? String(e.count ?? '') : e.date, item(e), e.title && e.title !== e.name ? span('c-d', '  ' + e.title) : ''));
    },
    async cd(say, [arg = '~']) {
      const site = await loadSite(), parts = resolvePath(T.cwd, arg);
      if (!say.live()) return;
      if (listDir(site, parts)) { T.cwd = parts; return drawPrompt(); }
      say(span('c-r', entryAt(site, parts) ? `cd: not a directory: ${arg}` : `cd: no such directory: ${arg}`));
    },
    async cat(say, [arg], open = false) {
      const name = open ? 'open' : 'cat';
      if (!arg) return say(`usage: ${name} ${COMMANDS[name][0]}  (try `, btn('ls posts'), ')');
      const site = await loadSite(), hits = lookup(site, T.cwd, arg);
      if (hits.length > 1) {
        say(`${name}: '${arg}' matches ${hits.length} posts and pages:`);
        return hits.slice(0, 20).forEach(e => say('  ', btn(`${name} ${e.name}`, e.name), span('c-d', '  ' + (e.title || ''))));
      }
      const [e] = hits;
      if (!e) return say(span('c-r', `${name}: ${arg}: No such file or directory.`), ' Try ', btn(`grep ${arg}`), '.');
      if (e.dir && !open) return say(`cat: ${arg}: Is a directory. Try `, btn(`ls ${arg}`), ' or ', btn(`open ${arg}`), '.');
      if (!e.url) return say(`open: ${arg} has no window of its own. Try `, btn(`ls ${arg}`), '.');
      if (!open) {
        const p = site.posts.find(x => x.url === e.url);
        if (p?.description) say(span('c-y', p.title), '\n', p.description);
      }
      if (!say.live()) return;
      say(span('c-d', 'Opening '), link(e, e.title || e.name, 'c-c'));
      go(e.url);
    },
    open: (say, args) => run.cat(say, args, true),
    async grep(say, args) {
      const q = args.join(' ');
      if (!q) return say('usage: grep <words>  (for example ', btn('grep llm'), ')');
      const hits = grep(await loadSearch(), q), words = norm(q).split(/\s+/).filter(Boolean);
      say(span('c-d', `${hits.length} ${hits.length === 1 ? 'match' : 'matches'} for '${q}'`));
      for (const e of hits.slice(0, 20)) {
        // the text around the first word, cut at spaces, as grep shows the matching line
        const body = e.body || e.description, at = body.toLowerCase().indexOf(words[0]);
        let snip = '';
        if (at >= 0) {
          const from = at > 40 ? Math.min(at, body.indexOf(' ', at - 40) + 1) : 0, to = body.indexOf(' ', at + 60);
          snip = (from ? '...' : '') + body.slice(from, to < 0 ? undefined : to).replace(/\s+/g, ' ').trim() + (to < 0 ? '' : '...');
        }
        say(row(e.date || e.kind || 'page', link({ url: e.url, title: e.title }, marked(e.title, words)), snip && ['\n', marked(snip, words)]));
      }
      if (hits.length > 20) say(span('c-d', `...and ${hits.length - 20} more. Narrow it with another word.`));
    },
    search: (say, args) => run.grep(say, args),
    async tags(say, [n = '20']) {
      const site = await loadSite();
      const top = site.tags.slice().sort((a, b) => b.count - a.count).slice(0, Math.max(1, +n || 20));
      if (!top.length) return say(span('c-d', 'No tags on this site.'));
      say(h('span', { class: 'cols' }, top.map(t => btn(`ls /tags/${t.slug}`, `${t.name} (${t.count})`, 'c-b'))));
    },
    async whoami(say) {
      const about = pageNamed(await loadSite(), /^\/about\/?$/);
      let text = '';
      if (about) {
        try {
          const doc = await fetchDoc(about.url);
          text = [...doc.querySelectorAll('main p')].filter(p => !p.closest('blockquote, nav, header'))
            .map(p => p.textContent.replace(/\s+/g, ' ').trim()).find(t => t.length > 40) || '';
        } catch (err) { console.error(err); }
      }
      text ||= document.querySelector('meta[name=description]')?.content || '';
      say('guest');
      if (text) say(span('c-d', text));
      if (about) say(span('c-d', 'More: '), link({ url: about.url, title: about.title }, about.title));
    },
    date(say) {
      const timeZone = document.getElementById('clock')?.dataset.tz || undefined;
      say(new Date().toLocaleString('en-AU', { timeZone, dateStyle: 'full', timeStyle: 'long' }));
    },
    theme(say, [t]) {
      if (t !== 'light' && t !== 'dark') {
        const now = window.deskbar.settings.shown();
        return say(`The theme is ${now}. Switch with `, btn(`theme ${now === 'dark' ? 'light' : 'dark'}`), '.');
      }
      // through the shell's settings, so the Control panel and anything else listening hears of it
      window.deskbar?.settings?.set('theme', t);
      say(`Theme set to ${t}.`);
    },
    async fortune(say) {
      const page = pageNamed(await loadSite(), /\/quotes?\/?$/);
      let quotes = [];
      if (page) {
        try {
          quotes = [...(await fetchDoc(page.url)).querySelectorAll('main blockquote')].map(q => {
            let by = q.nextElementSibling;
            while (by?.tagName === 'BLOCKQUOTE') by = by.nextElementSibling;
            const who = by?.textContent.trim() || '';
            return [q.textContent.trim(), /^[-–—]/.test(who) && who.length < 120 ? who : ''];
          }).filter(([q]) => q);
        } catch (err) { console.error(err); }
      }
      const [q, who] = quotes.length ? quotes[Math.floor(Math.random() * quotes.length)] : [HAIKU[Math.floor(Math.random() * HAIKU.length)], '- NetPositive'];
      say(q);
      if (who) say(span('c-d', '    ' + who));
    },
    async neofetch(say) {
      const site = await loadSite(), dates = site.posts.map(p => p.date).filter(Boolean);
      const first = dates.at(-1), years = first ? Math.floor((Date.now() - new Date(first)) / 3.15576e10) : 0;
      const tags = site.tags.slice().sort((a, b) => b.count - a.count).slice(0, 4).map(t => t.name).join(', ');
      const facts = [
        ['OS', 'Haiku (well, a browser pretending)'], ['Host', location.host || HOST],
        ['Kernel', document.querySelector('meta[name=generator]')?.content || 'unknown'],
        ['Uptime', first ? `${years} years (first post ${first})` : 'unknown'],
        ['Posts', dates.length ? `${site.posts.length} (${first.slice(0, 4)} to ${dates[0].slice(0, 4)})` : String(site.posts.length)],
        ['Tags', tags || 'none'], ['Shell', 'deskbar'],
        ['Resolution', `${innerWidth}x${innerHeight}`], ['Theme', window.deskbar.settings.shown()],
      ];
      say(h('span', { class: 'nf' }, h('span', { class: 'c-g nf-art', 'aria-hidden': 'true' }, LEAF), h('span', {},
        span('c-g', 'guest@' + HOST), '\n', '-'.repeat(8 + HOST.length), '\n',
        facts.map(([k, val]) => [span('c-y', k), ': ', val, '\n']), '\n',
        h('span', { class: 'sw', 'aria-hidden': 'true' }, [...Array(8)].map(() => h('i'))))));
    },
    screensaver(say, [name]) {
      const load = window.deskbar?.loadLazy, names = COMMANDS.screensaver[2];
      if (!load) return say(span('c-r', 'screensaver: not available on this site'));
      if (name && !names.includes(name)) return say(span('c-r', `screensaver: no saver called ${name}; try ${names.join(' or ')}`));
      say(span('c-d', 'Move the mouse, tap or press a key to come back.'));
      load('screensaver').then(m => m.start(name)).catch(err => { console.error(err); say(span('c-r', "screensaver: didn't load")); });
    },
    history(say, [flag]) {
      if (flag === '-c') { T.hist = []; T.hi = 0; return store.set(HIST, []); }
      T.hist.forEach((c, i) => say(span('c-d', String(i + 1).padStart(4) + '  '), btn(c, c)));
    },
    echo: (say, args) => say(args.join(' ')),
    clear: () => out.replaceChildren(),
    exit() {
      [...(v.win?.tabsEl?.children || [])].find(t => t._view === v)?.querySelector('.ctl.close')?.click();
    },
    uname: (say, [flag]) => say(flag === '-a'
      ? `Haiku ${HOST} 1 hrev58765 Mar  1 2025 06:00:00 x86_64 x86_64 Haiku`
      : 'Haiku'),
    sudo: say => say('guest is not in the sudoers file. This incident will be reported.'),
  };

  async function exec(line) {
    const job = ++T.job, say = (...k) => { if (job === T.job) print(...k); };
    say.live = () => job === T.job;
    print(...prompt(), line);
    const words = tokenise(line);
    if (!words.length) return;
    if (line.trim() !== T.hist.at(-1)) {
      T.hist.push(line.trim());
      T.hist = T.hist.slice(-100);
      store.set(HIST, T.hist);
    }
    T.hi = T.hist.length;
    T.draft = '';
    const [name, ...args] = words, fn = Object.hasOwn(run, name) && run[name];
    if (!fn) {
      const near = suggest(name);
      return say(span('c-r', `${name}: command not found.`), near ? [' Did you mean ', btn(near), '?'] : '', ' Try ', btn('help'), '.');
    }
    try {
      await fn(say, args);
    } catch (err) {
      console.error(err);
      say(span('c-r', `${name}: ${err.message}`));
    }
  }

  const complete1 = async () => {
    const typed = input.value, r = complete(typed, await loadSite(), T.cwd);
    // typing carried on while the index loaded
    if (input.value !== typed) return;
    if (r.options.length) {
      print(...prompt(), input.value);
      print(h('span', { class: 'cols' }, r.options.slice(0, 60).map(o => span(o.endsWith('/') ? 'c-b' : '', o))),
        r.options.length > 60 ? span('c-d', ` ...and ${r.options.length - 60} more`) : '');
    }
    input.value = r.line;
  };

  input.addEventListener('keydown', e => {
    const k = e.key, ctrl = e.ctrlKey && !e.metaKey && !e.altKey;
    if (k === 'Enter' && !e.isComposing) {
      const line = input.value;
      input.value = '';
      exec(line);
    } else if (k === 'ArrowUp' || k === 'ArrowDown') {
      e.preventDefault();
      if (T.hi === T.hist.length) T.draft = input.value;
      T.hi = Math.max(0, Math.min(T.hist.length, T.hi + (k === 'ArrowUp' ? -1 : 1)));
      input.value = T.hi < T.hist.length ? T.hist[T.hi] : T.draft;
    } else if (k === 'Tab' && !e.shiftKey && input.value.trim()) {
      // an empty line lets Tab move focus on, so keyboard users are never trapped here
      e.preventDefault();
      complete1().catch(err => console.error(err));
    } else if (ctrl && k.toLowerCase() === 'c' && !getSelection().toString()) {
      e.preventDefault();
      print(...prompt(), input.value, span('c-d', '^C'));
      input.value = '';
      T.job++;
    } else if (ctrl && k.toLowerCase() === 'l') {
      e.preventDefault();
      out.replaceChildren();
    }
  });

  v.el.addEventListener('click', e => {
    const b = e.target.closest('button[data-cmd]');
    if (b) {
      exec(b.dataset.cmd);
      if (!coarse()) input.focus({ preventScroll: true });
    } else if (!e.target.closest('a, input') && !coarse() && !getSelection().toString()) input.focus({ preventScroll: true });
  });
  // On touch, tapping output or a command keeps the on-screen keyboard where it is instead of dropping it
  v.el.addEventListener('mousedown', e => {
    if (coarse() && document.activeElement === input && !e.target.closest('a, input')) e.preventDefault();
  });

  // warmed now so the first command and Tab answer at once; a failure is tried again then
  loadSite().catch(() => {});
  print(span('c-d', `deskbar terminal on ${HOST}. Type a command, or tap one below. `), btn('help'), span('c-d', ' lists them all.'));
  return { input, bottom };
}

const terms = new WeakMap();

export function mount(v, page, { fresh }) {
  if (fresh) terms.set(v, create(v));
  const t = terms.get(v);
  if (!matchMedia('(pointer: coarse)').matches) t.input.focus({ preventScroll: true });
  t.bottom();
}
