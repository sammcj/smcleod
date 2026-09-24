// Feeds (`window: feeds`): a feed reader over the items layouts/feeds.html renders at build time from the site's
// OPML list (_partials/deskbar/feeds.html). Three panes, after NetNewsWire: feeds with unread counts, items newest
// first, and a preview with the summary and a link to the article. Container queries fold it to two panes, then
// one, as the window narrows. Feed text only ever goes in as text nodes. Read state is kept in localStorage.
import { h, find, toTop } from '../lib/dom.js';
import { store } from '../lib/store.js';
import { arrowTo } from '../lib/keys.js';
import { plural } from '../lib/format.js';

const WEB = /^https?:\/\//i, KEEP = 800;

// Items and feeds from the page: <ol class="fd-items"><li data-feed data-date><a href>title</a>...<p class="fd-sum">
export function readFeeds(nodes) {
  const list = find(nodes, '.fd-items');
  const items = [...(list?.children || [])].map(li => {
    const a = li.querySelector('a[href]');
    return {
      feed: li.dataset.feed || '', title: a?.textContent.trim() || '', link: a?.getAttribute('href') || '',
      date: new Date(li.dataset.date), summary: li.querySelector('.fd-sum')?.textContent.trim() || '',
    };
  }).filter(it => it.title && WEB.test(it.link) && !isNaN(it.date));
  const feeds = [...(find(nodes, '.fd-feeds')?.children || [])].map(li => li.dataset.name).filter(Boolean);
  // a feed missing from the list still gets a place in the sidebar
  for (const it of items) if (!feeds.includes(it.feed)) feeds.push(it.feed);
  return { items, feeds, updated: new Date(list?.dataset.updated) };
}

// Short age for the item list: minutes, hours and days for a week, then the date
export function ago(d, now = Date.now()) {
  const s = Math.max(0, (now - d) / 1000);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  const year = new Date(now).getFullYear() !== d.getFullYear() ? 'numeric' : undefined;
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year });
}

const full = d => d.toLocaleString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

export function mount(v, page, { fresh }) {
  if (!fresh) return;
  let { items, feeds, updated } = readFeeds(page.content());
  const read = new Set(store.get('feeds-read', []));
  const rows = new Map();
  let feed = '', cur = null;

  const save = () => store.set('feeds-read', [...read].slice(-KEEP));
  const shown = () => items.filter(it => !feed || it.feed === feed);
  const unread = name => items.filter(it => (!name || it.feed === name) && !read.has(it.link)).length;

  const side = h('nav', { class: 'fd-side', 'aria-label': 'Feeds' });
  const sel = h('select', { class: 'fd-sel', 'aria-label': 'Feed', onchange: () => choose(sel.value) });
  const list = h('div', { class: 'fd-list', role: 'list', 'aria-label': 'Items' });
  const pane = h('article', { class: 'fd-pane', 'aria-label': 'Preview' });
  const status = h('div', { class: 'status', role: 'status' });
  const allRead = h('button', {
    class: 'tb', type: 'button',
    onclick: () => { shown().forEach(it => read.add(it.link)); save(); rows.forEach(b => b.classList.remove('unread')); counts(); },
  }, 'Mark all as read');
  // Browsers can't read other sites' feeds, so Refresh reloads this page for whatever the latest build fetched
  // (the site rebuilds on a schedule), keeping the feed on screen when it is still there
  const refresh = h('button', {
    class: 'tb', type: 'button',
    onclick: async () => {
      refresh.disabled = true;
      status.textContent = 'Refreshing…';
      try {
        const res = await fetch(page.url, { cache: 'no-cache' });
        if (!res.ok) throw new Error(res.status);
        const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
        ({ items, feeds, updated } = readFeeds([doc.body]));
        choose(feeds.includes(feed) ? feed : '');
      } catch {
        status.textContent = "Couldn't refresh. Try again in a moment.";
      }
      refresh.disabled = false;
    },
  }, 'Refresh');
  const body = h('div', { class: 'fd', 'data-show': 'list' }, side, list, pane);
  v.el.append(h('div', { class: 'toolbar' }, sel, h('span', { class: 'grow' }), refresh, allRead), body, status);

  // The sidebar, the narrow window's select, the button and the status bar all show unread counts
  function counts() {
    const names = ['', ...feeds], label = name => name || 'All items';
    side.replaceChildren(...names.map(name => {
      const off = name && !items.some(it => it.feed === name);
      return h('button', {
        type: 'button', class: off ? 'fd-feed off' : 'fd-feed', title: off ? 'Not fetched in the latest build' : null,
        'aria-current': name === feed ? 'true' : null, onclick: () => choose(name),
      }, h('span', {}, label(name)), h('small', {}, unread(name) || ''));
    }));
    sel.replaceChildren(...names.map(name => h('option', { value: name, selected: name === feed }, `${label(name)} (${unread(name)})`)));
    const n = unread(feed), a = ago(updated);
    allRead.disabled = !n;
    status.textContent = `${plural(shown().length, 'item')}, ${n} unread` + (isNaN(updated) ? '' : `. Fetched ${/^\d+[mhd]$/.test(a) ? a + ' ago' : 'on ' + a}`);
  }

  function row(it) {
    const b = h('button', { type: 'button', class: read.has(it.link) ? 'fd-row' : 'fd-row unread', tabindex: '-1', onclick: () => { select(it); show(true); } },
      h('span', { class: 'fd-t' }, it.title),
      it.summary && h('span', { class: 'fd-s' }, it.summary),
      h('span', { class: 'fd-m' }, h('span', {}, it.feed), h('time', { datetime: it.date.toISOString(), title: full(it.date) }, ago(it.date))));
    rows.set(it, b);
    return h('div', { role: 'listitem' }, b);
  }

  function preview() {
    if (!cur) {
      pane.replaceChildren(h('p', { class: 'fd-empty' }, items.length ? 'Select an item to read its summary.' : 'No items yet. Feeds are fetched when the site is built.'));
      return;
    }
    const back = h('button', { type: 'button', class: 'tb fd-back', onclick: () => { show(false); rows.get(cur)?.focus(); } }, 'Items');
    pane.replaceChildren(back,
      h('header', {}, h('p', { class: 'fd-src' }, cur.feed), h('h2', { tabindex: '-1' }, cur.title),
        h('p', { class: 'fd-when' }, h('time', { datetime: cur.date.toISOString() }, full(cur.date)))),
      h('p', { class: cur.summary ? 'fd-sum' : 'fd-sum fd-none' }, cur.summary || 'This feed gives no summary for the item.'),
      h('a', { class: 'tb fd-open', href: cur.link, target: '_blank', rel: 'noopener' }, 'Open article'));
  }

  // A feed's items; the rows are rebuilt only here, so selecting keeps focus and scroll
  function choose(name) {
    feed = name;
    cur = null;
    rows.clear();
    const now = shown();
    list.replaceChildren(...(now.length ? now.map(row) : [h('p', { class: 'fd-empty' }, 'Nothing from this feed in the latest build.')]));
    toTop(list);
    rows.get(now[0])?.setAttribute('tabindex', '0');
    show(false);
    preview();
    counts();
  }

  // Selecting marks the item read. The selected row is the list's one tab stop.
  function select(it) {
    const was = rows.get(cur), b = rows.get(it);
    was?.removeAttribute('aria-current');
    rows.forEach(r => r.setAttribute('tabindex', '-1'));
    b.setAttribute('aria-current', 'true');
    b.setAttribute('tabindex', '0');
    b.classList.remove('unread');
    cur = it;
    if (!read.has(it.link)) { read.add(it.link); save(); }
    preview();
    counts();
  }

  // One pane at a time in a narrow window: the item or the list. Focus follows when the list has gone.
  function show(item) {
    body.dataset.show = item ? 'item' : 'list';
    if (item && !list.offsetParent) pane.querySelector('h2')?.focus();
  }

  list.addEventListener('keydown', e => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const all = [...rows.values()];
    const to = { Home: all[0], End: all.at(-1) }[e.key] || arrowTo(all, e.target.closest('.fd-row'), e.key);
    if (!to) return;
    e.preventDefault();
    select(shown()[all.indexOf(to)]);
    to.focus();
    to.scrollIntoView({ block: 'nearest' });
  });

  choose('');
  v.el.dataset.loaded = '';
}
