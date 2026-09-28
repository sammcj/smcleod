// Feeds (`window: feeds`): a feed reader over the items layouts/feeds.html renders at build time from the site's
// OPML list (_partials/deskbar/feeds.html). Three panes, after NetNewsWire: feeds with unread counts, items newest
// first, and a preview with the summary, the item's picture and a link to the article. Container queries fold it to
// two panes, then one, as the window narrows. Feed text only ever goes in as text nodes. Feed icons are the site's
// own copies; item pictures load from their sites, lazily and without a referrer, and drop out if they fail. Read
// state is kept in localStorage. A feed's own address (?feed=) opens it in a tab of the Feeds window, from its context
// menu, Cmd/Ctrl-click or middle-click.
import { h, find, toTop } from '../lib/dom.js';
import { store } from '../lib/store.js';
import { arrowTo } from '../lib/keys.js';
import { plural } from '../lib/format.js';

const WEB = /^https?:\/\//i, IMG = /^https:\/\//i, KEEP = 800;

// Items and feeds from the page: <ol class="fd-items"><li data-feed data-date data-image><a href>title</a>...
// <p class="fd-sum">, and <ul class="fd-feeds"><li data-name data-icon>. icons maps a feed's name to its icon.
export function readFeeds(nodes) {
  const list = find(nodes, '.fd-items');
  const items = [...(list?.children || [])].map(li => {
    const a = li.querySelector('a[href]');
    return {
      feed: li.dataset.feed || '', title: a?.textContent.trim() || '', link: a?.getAttribute('href') || '',
      date: new Date(li.dataset.date), summary: li.querySelector('.fd-sum')?.textContent.trim() || '',
      image: IMG.test(li.dataset.image) ? li.dataset.image : '',
    };
  }).filter(it => it.title && WEB.test(it.link) && !isNaN(it.date));
  const named = [...(find(nodes, '.fd-feeds')?.children || [])].filter(li => li.dataset.name);
  const feeds = named.map(li => li.dataset.name);
  const icons = Object.fromEntries(named.filter(li => li.dataset.icon).map(li => [li.dataset.name, li.dataset.icon]));
  // a feed missing from the list still gets a place in the sidebar
  for (const it of items) if (!feeds.includes(it.feed)) feeds.push(it.feed);
  return { items, feeds, icons, updated: new Date(list?.dataset.updated) };
}

// A picture from another site: loaded only as it nears the screen, sent no referrer, and gone if it fails
const picture = (src, cls) => h('img', { class: cls, src, alt: '', loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer', onerror: e => e.target.remove() });

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

// A feed's own address, which opens it in a tab of its own (apps/index.js keys Feeds views by it), and back
export const feedHref = (url, name) => `${url.split('?')[0]}?feed=${encodeURIComponent(name)}`;
export const feedOf = url => new URL(url, 'http://x').searchParams.get('feed') || '';

// The letter that stands in for a feed with no icon
export const initial = name => name.match(/[\p{L}\p{N}]/u)?.[0].toUpperCase() || '#';

export function mount(v, page, { fresh }) {
  // a feed's own tab shows its feed again whenever its address opens; apps/registry.js has just given the view the
  // page's title and address, so the tab is renamed too
  const own = feedOf(page.url);
  if (!fresh) return v.pick?.(own);
  let { items, feeds, icons, updated } = readFeeds(page.content());
  const read = new Set(store.get('feeds-read', []));
  const rows = new Map();
  // the sidebar is redrawn on every selection, so it keeps its icons rather than reloading them each time
  const sideIcons = new Map();
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
        ({ items, feeds, icons, updated } = readFeeds([doc.body]));
        sideIcons.clear();
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
        'aria-current': name === feed ? 'true' : null, 'data-href': name ? feedHref(page.url, name) : null,
        // as a link would open in a new browser tab, Cmd/Ctrl-click and middle-click open the feed in a tab of the OS
        onclick: e => (name && (e.metaKey || e.ctrlKey) ? newTab(name) : choose(name)),
        onauxclick: e => { if (name && e.button === 1) newTab(name); },
      }, name && (sideIcons.get(name) || sideIcons.set(name, icon(name)).get(name)), h('span', {}, label(name)), h('small', {}, unread(name) || ''));
    }));
    sel.replaceChildren(...names.map(name => h('option', { value: name, selected: name === feed }, `${label(name)} (${unread(name)})`)));
    const n = unread(feed), a = ago(updated);
    allRead.disabled = !n;
    status.textContent = `${plural(shown().length, 'item')}, ${n} unread` + (isNaN(updated) ? '' : `. Fetched ${/^\d+[mhd]$/.test(a) ? a + ' ago' : 'on ' + a}`);
  }

  // A feed's icon, or its initial in a box of the same size (a feed with no artwork whose site had no icon either)
  const icon = name => (icons[name] ? h('img', { class: 'fd-ico', src: icons[name], alt: '' }) : h('i', { class: 'fd-ico fd-mono', 'data-initial': initial(name) }));
  const newTab = name => window.deskbar.go(feedHref(page.url, name));

  // data-href and data-link are for the context menu (lazy/context-menu.js)
  function row(it) {
    const b = h('button', {
      type: 'button', class: read.has(it.link) ? 'fd-row' : 'fd-row unread', tabindex: '-1', 'data-href': feedHref(page.url, it.feed), 'data-link': it.link,
      onclick: () => { select(it); show(true); },
    },
      h('span', { class: 'fd-t' }, it.title),
      it.summary && h('span', { class: 'fd-s' }, it.summary),
      h('span', { class: 'fd-m' }, h('span', {}, icon(it.feed), it.feed), h('time', { datetime: it.date.toISOString(), title: full(it.date) }, ago(it.date))),
      it.image && picture(it.image, 'fd-th'));
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
      h('header', {}, h('p', { class: 'fd-src' }, icon(cur.feed), cur.feed), h('h2', { tabindex: '-1' }, cur.title),
        h('p', { class: 'fd-when' }, h('time', { datetime: cur.date.toISOString() }, full(cur.date)))),
      cur.image && picture(cur.image, 'fd-img'),
      h('p', { class: cur.summary ? 'fd-sum' : 'fd-sum fd-none' }, cur.summary || 'This feed gives no summary for the item.'),
      h('a', { class: 'tb fd-open', href: cur.link, target: '_blank', rel: 'noopener' }, 'Open article'));
  }

  // A feed's items; the rows are rebuilt only here, so selecting keeps focus and scroll. A feed's own tab is named
  // for the feed it shows, or the page's title for every feed. The visitor's pick in it moves its address too, and the
  // address bar when that names the tab, so its links and a layout link give what it shows. Opening its address (keep)
  // leaves the address as opened, even for a feed the build no longer has, which then shows every feed.
  function choose(name, keep) {
    if (own) {
      v.title = name || page.title;
      window.deskbar.renderTabs(v.win);
      const was = v.url, url = name ? feedHref(page.url, name) : page.url.split('?')[0];
      if (!keep && url !== was) {
        v.url = url;
        if (location.pathname + location.search === was) window.deskbar.router.replace(url);
      }
    }
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

  if (own) v.pick = name => choose(feeds.includes(name) ? name : '', true);
  choose(feeds.includes(own) ? own : '', true);
  v.el.dataset.loaded = '';
}
