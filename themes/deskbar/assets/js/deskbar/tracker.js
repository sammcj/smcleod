// Tracker, the post browser and the desktop's Posts window. D10 hybrid view (newest five as cards, older posts as rows
// by year), a sortable list view and an icon view. Places: all posts, years, tags, series, the taxonomy lists, and the
// menu's groups (Pages, Tools, Photos). Built from the shared post index; search results show as ranked compact rows.
// The desktop opens it compact beside the icons on first load and on Home (D36, showPosts).
import { S, on } from './wm/state.js';
import { h, ico, svgBtn, plainClick, toTop } from './lib/dom.js';
import { store } from './lib/store.js';
import { fmtDate, shortDate, plural, thumb, mini } from './lib/format.js';
import { filterPosts } from './index-data.js';
import { searchPosts } from './search.js';
import { createWindow, findView, focusView, renderTabs, place, refresh, deskRect, tabH, isPhone, clearOfIcons, postsHome } from './wm/windows.js';
import { arrowTo } from './lib/keys.js';
import { dragOut } from './dragout-trigger.js';
import * as router from './router.js';

let index = Promise.resolve(null);
export const initTracker = p => { index = p; };

// D3/D4: one click or tap opens, as on any web page. Cards, rows and icons are links the router already
// handles; list view rows open from anywhere on the row, not just the name. Cmd/Ctrl- and Shift-clicks select
// posts instead, to open in windows of their own (dragout-trigger.js); a middle click still opens a browser tab.
function rowOpens(root) {
  root.addEventListener('click', e => {
    if (!plainClick(e) || e.target.closest('a[href], button, input, select, th')) return;
    e.target.closest('tr')?.querySelector('a[href]')?.click();
  });
}

const VIEWS = {
  hybrid: ['Latest and list', '<rect x="1.5" y="1.5" width="13" height="5" rx=".6" fill="currentColor"/><path d="M1.5 9.5h13M1.5 12.5h13" stroke="currentColor" stroke-width="1.4"/>'],
  list: ['List', '<path d="M1.5 3.5h13M1.5 8h13M1.5 12.5h13" stroke="currentColor" stroke-width="1.6"/>'],
  icons: ['Icons', '<rect x="2" y="2" width="5" height="5" rx=".5" fill="currentColor"/><rect x="9" y="2" width="5" height="5" rx=".5" fill="currentColor"/><rect x="2" y="9" width="5" height="5" rx=".5" fill="currentColor"/><rect x="9" y="9" width="5" height="5" rx=".5" fill="currentColor"/>'],
};

// Everything Tracker lists is an item: { title, url, date, sub, icon, words, post? }
const postItem = p => ({ title: p.title, url: p.url, date: p.date, sub: shortDate(p.date), icon: 'doc', words: p.words, post: p });
const linkItem = x => ({ title: x.title, url: x.url, date: '', sub: x.sub || '', icon: x.icon || 'doc', words: 0 });

export function card(p) {
  return h('a', { class: 'pc', href: p.url, title: p.title, 'data-url': p.url, 'data-post': p.url },
    h('span', { class: 'pc-t' }, p.title), thumb(p),
    h('span', { class: 'pc-m' },
      h('span', { class: 'pc-row' }, h('small', {}, fmtDate(p.date)), p.tags.slice(0, 3).map(t => h('span', { class: 'tg' }, t))),
      p.description ? h('span', { class: 'pc-d' }, p.description) : null));
}

function row(it) {
  const mark = it.post ? mini(it.post) : ico('i-' + it.icon);
  return h('a', { class: 'row', href: it.url, title: it.title, 'data-url': it.url, 'data-post': it.post && it.url },
    mark, h('span', { class: 'row-t' }, it.title), h('small', { class: 'row-d' }, it.sub));
}

function icon(it) {
  const pic = it.post ? thumb(it.post, 'gi-img') : h('span', { class: 'gi-ico' }, ico('i-' + it.icon));
  return h('a', { class: 'gi', href: it.url, title: it.title, 'data-url': it.url, 'data-post': it.post && it.url }, pic, h('span', { class: 'gi-t' }, it.title));
}

const section = (label, n, body) => h('section', {},
  h('h3', { class: 'pv-year' }, label, n != null ? h('small', {}, plural(n, 'item')) : null), body);

// Undated items (pages, terms, search results) sit under one heading instead of years
function hybrid(items, showLatest, label) {
  const latest = showLatest ? items.slice(0, 5) : [];
  const groups = new Map();
  for (const it of items.slice(latest.length)) {
    const y = label || it.date.slice(0, 4) || 'Undated';
    if (!groups.has(y)) groups.set(y, []);
    groups.get(y).push(it);
  }
  return h('div', { class: 'pv' },
    latest.length ? section('Latest', null, h('div', { class: 'pv-grid' }, latest.map(it => card(it.post)))) : null,
    [...groups].map(([y, its]) => section(y, its.length, h('div', { class: 'rows' }, its.map(row)))));
}

// the phone home screen's list (phone-home.js), as Tracker shows all posts
export const postList = posts => hybrid(posts.map(postItem), true);

// Sortable headers hold a button so keyboard users can sort too; aria-sort names the sorted column
function table(items, st, onSort) {
  const th = (k, label, cls) => {
    const on = st.sort === k;
    return h('th', { class: cls + (on ? ' sorted' : ''), 'data-sort': k, 'aria-sort': on ? (st.dir < 0 ? 'descending' : 'ascending') : null },
      h('button', { type: 'button', class: 'sort', onclick: () => onSort(k) }, label, on ? h('span', { 'aria-hidden': 'true' }, st.dir < 0 ? ' ▾' : ' ▴') : null));
  };
  return h('table', { class: 'list' },
    h('thead', {}, h('tr', {}, th('title', 'Name', 'c-name-h'), th('date', 'Date', 'c-date'), h('th', { class: 'c-tags' }, 'Tags'), th('words', 'Words', 'c-words'))),
    h('tbody', {}, items.map(it => h('tr', { 'data-url': it.url, 'data-post': it.post && it.url },
      h('td', { class: 'c-name' }, ico('i-' + it.icon), h('a', { href: it.url }, it.title), it.date ? h('small', { class: 'sub-date' }, fmtDate(it.date)) : null),
      h('td', { class: 'c-date' }, fmtDate(it.date)),
      h('td', { class: 'c-tags' }, it.post ? it.post.tags.slice(0, 4).join(', ') : it.sub),
      h('td', { class: 'c-words' }, it.words ? it.words.toLocaleString('en-AU') : '')))));
}

const titleOf = place => {
  const [kind, rest] = place.includes(':') ? [place.slice(0, place.indexOf(':')), place.slice(place.indexOf(':') + 1)] : [place, ''];
  if (kind === 'all') return '~/posts';
  if (kind === 'y') return '~/posts/' + rest;
  if (kind === 'tax' || kind === 'grp') return '~/' + rest.toLowerCase();
  return '~/' + kind + (rest ? '/' + rest : '');
};

// Menu groups other than the built-in Writing one (panel.html). A group with its own app links there;
// one without lists its entries in Tracker, so a site that has not built /tools/ yet still gets a Tools place.
const iconOf = a => a?.querySelector('use')?.getAttribute('href').replace('#i-', '') || 'doc';
function menuGroups() {
  return [...document.querySelectorAll('#menu .mn-sec:not([data-builtin])')].map(s => {
    const app = s.querySelector('a.mn-app');
    return {
      name: s.dataset.group, app: app?.getAttribute('href') || '', icon: iconOf(app),
      items: [...s.querySelectorAll('a.mn-it:not(.mn-app)')].map(a => ({ title: a.textContent.trim(), url: a.getAttribute('href'), icon: iconOf(a) })),
    };
  });
}

function makeTracker() {
  const st = { place: 'all', q: '', mode: store.get('trackerView', 'hybrid'), sort: 'date', dir: -1, url: '', data: null, open: '' };
  if (!VIEWS[st.mode]) st.mode = 'hybrid';
  const nav = h('nav', { class: 'places', 'aria-label': 'Places' }), sel = h('select', { class: 'place-sel', 'aria-label': 'Place' });
  const q = h('input', { type: 'search', placeholder: 'Search all posts', 'aria-label': 'Search all posts' });
  const segs = Object.entries(VIEWS).map(([m, [label, svg]]) => {
    const b = svgBtn(label + ' view', svg, null, 'seg');
    b.dataset.m = m;
    return b;
  });
  const main = h('div', { class: 'tk-main scroller' }), status = h('div', { class: 'status' }, 'Loading posts');
  const el = h('div', { class: 'view tracker' },
    h('div', { class: 'toolbar' }, h('div', { class: 'segs' }, segs), q),
    h('div', { class: 'tk-body' }, nav, h('div', { class: 'tk-right' }, sel, main)), status);
  const v = { key: 'tracker', icon: 'folder', title: '~/posts', home: '', el, route: () => st.url || v.home };
  // place key -> { url, list }: url routes (D12), list is what a local place shows
  const places = new Map();

  function buildPlaces(data) {
    const years = new Map();
    for (const p of data.posts) if (p.year) years.set(p.year, (years.get(p.year) || 0) + 1);
    // taxonomy counts include pages outside the post sections, so count what Tracker will actually list
    const terms = (tax, list) => list.map(t => [`${tax}:${t.name}`, t.name, filterPosts(data.posts, `${tax}:${t.name}`).length, t.url])
      .filter(x => x[2] > 0).sort((a, b) => b[2] - a[2]);
    // the index names each taxonomy's list page; term permalinks can live elsewhere (/blog/category/x/ vs
    // /categories/), so the parent of a term URL is only a fallback for indexes that predate taxonomyURLs
    const taxPlace = (tax, label, list) => {
      if (!list.length) return [];
      places.set('tax:' + tax, { list: () => list.map(([, name, n, url]) => linkItem({ title: name, url, icon: 'folder', sub: plural(n, 'post') })) });
      return [['tax:' + tax, label, list.length, data.taxURLs[tax] || list[0][3].replace(/[^/]+\/?$/, '')]];
    };
    const tags = terms('tags', data.tags), series = terms('series', data.series), cats = terms('categories', data.categories);
    const more = menuGroups().map(g => {
      if (!g.app) places.set('grp:' + g.name, { list: () => g.items.map(linkItem) });
      return [g.app ? 'app:' + g.name : 'grp:' + g.name, g.name, g.app ? null : g.items.length, g.app, g.icon];
    });
    // sites without a menu config still get every page outside the post sections
    if (!more.length && data.pages.length) {
      places.set('pages', { list: () => data.pages.map(linkItem) });
      more.push(['pages', 'Pages', data.pages.length]);
    }
    const groups = [
      ['Posts', [['all', 'All posts', data.posts.length, data.sectionURL], ...[...years].map(([y, n]) => ['y:' + y, y, n])]],
      ['Tags', [...tags.slice(0, 16), ...taxPlace('tags', 'All tags', tags)]],
      ['Series', [...series, ...taxPlace('series', 'All series', series)]],
      ['Categories', [...cats.slice(0, 16), ...taxPlace('categories', 'All categories', cats)]],
      ['Apps and pages', more],
    ].filter(([, items]) => items.length);
    for (const [g, items] of groups) {
      nav.append(h('h2', {}, g));
      sel.append(h('optgroup', { label: g }, items.map(([k, l, n]) => h('option', { value: k }, n == null ? l : `${l} (${n})`))));
      // apps show their icon rather than a count, since they open a window of their own
      for (const [k, l, n, url, icon] of items) {
        places.set(k, { ...places.get(k), url });
        nav.append(h('button', { type: 'button', 'data-k': k }, h('span', {}, l), n == null ? ico('i-' + icon) : h('small', {}, n)));
      }
    }
  }

  function items() {
    const { data, place } = st;
    if (st.q.trim()) {
      const found = searchPosts(data.posts, st.q).map(postItem);
      return st.sort === 'rank' ? found : sortBy(found);
    }
    const local = places.get(place)?.list;
    if (local) return st.sort === 'date' ? local() : sortBy(local());
    return sortBy(filterPosts(data.posts, place).map(postItem));
  }

  const sortBy = list => {
    const f = st.sort;
    return list.sort((a, b) => st.dir * (f === 'title' ? a.title.localeCompare(b.title) : f === 'words' ? a.words - b.words : a.date.localeCompare(b.date)));
  };

  function markOpen() {
    main.querySelectorAll('.open').forEach(x => x.classList.remove('open'));
    const hit = st.open && main.querySelector(`[data-url="${CSS.escape(st.open)}"]`);
    if (hit) { hit.classList.add('open'); hit.scrollIntoView?.({ block: 'nearest' }); }
  }

  function render() {
    if (!st.data) return;
    const list = items(), searching = !!st.q.trim();
    nav.querySelectorAll('button').forEach(b => b.classList.toggle('on', !searching && b.dataset.k === st.place));
    // places reached by URL (a tag outside the top 16) still need an entry in the narrow-window picker
    if (![...sel.options].some(o => o.value === st.place)) sel.append(h('option', { value: st.place }, titleOf(st.place)));
    sel.value = st.place;
    segs.forEach(b => b.classList.toggle('on', b.dataset.m === st.mode));
    const onSort = k => {
      st.dir = st.sort === k ? -st.dir : k === 'title' ? 1 : -1;
      st.sort = k;
      render();
      // the table is rebuilt, so keyboard focus goes back to the header just used
      main.querySelector(`th[data-sort="${k}"] button`)?.focus();
    };
    const label = searching ? 'Results' : list.length && !list[0].post ? titleOf(st.place).slice(2).replace(/^./, c => c.toUpperCase()) : '';
    main.replaceChildren(st.mode === 'list' ? table(list, st, onSort)
      : st.mode === 'icons' ? h('div', { class: 'grid' }, list.map(icon))
        : hybrid(list, st.place === 'all' && !searching && st.sort === 'date' && st.dir < 0, label));
    if (!list.length) main.append(h('p', { class: 'empty' }, searching ? `No posts match "${st.q.trim()}"` : 'Nothing here yet'));
    toTop(main);
    markOpen();
    status.textContent = plural(list.length, 'item') + (searching ? ` matching "${st.q.trim()}"` : '');
    v.title = searching ? 'Find: ' + st.q.trim() : titleOf(st.place);
    if (v.win) renderTabs(v.win);
  }

  // places with a real page (sections, terms, apps) go through the router so the URL tracks them (D12)
  function choose(k) {
    const url = places.get(k)?.url;
    // an app opens its own window, so the picker goes back to what Tracker still shows
    if (k.startsWith('app:')) { sel.value = st.place; router.go(url); }
    else if (url) router.go(url, { kind: 'tracker', place: k, title: titleOf(k), docTitle: st.data.docTitles[url] || '' });
    else v.go(k);
  }

  // results keep their ranking until the visitor sorts a list view column
  function setQuery(s) {
    if (s.trim() && !st.q.trim()) st.sort = 'rank';
    if (!s.trim() && st.sort === 'rank') { st.sort = 'date'; st.dir = -1; }
    st.q = s;
    if (q.value !== s) q.value = s;
  }
  v.search = s => { setQuery(s); render(); };
  v.go = (k, url) => {
    st.place = k;
    setQuery('');
    st.url = url || places.get(k)?.url || st.url;
    render();
  };
  nav.addEventListener('click', e => { const b = e.target.closest('button'); if (b) choose(b.dataset.k); });
  sel.onchange = () => choose(sel.value);
  q.oninput = () => v.search(q.value);
  segs.forEach(b => { b.onclick = () => { st.mode = b.dataset.m; store.set('trackerView', st.mode); render(); }; });
  rowOpens(main);
  // a press that wobbles a few pixels would start the browser's drag of the link or its thumbnail, eating the click
  main.addEventListener('dragstart', e => e.preventDefault());
  dragOut(main, true);
  // The arrows move the selection. A post under it opens in the reader, as in a mail client's preview pane: keyboard
  // focus stays here, and a run of presses is one history entry (the first adds it, the rest replace it).
  let timer = 0;
  main.addEventListener('keydown', e => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.target.closest('input, select, button')) return;
    const to = arrowTo([...main.querySelectorAll('[data-url]')], e.target.closest('[data-url]') || main.querySelector('.open'), e.key);
    if (!to) return;
    e.preventDefault();
    (to.matches('a') ? to : to.querySelector('a[href]')).focus();
    const url = to.dataset.url;
    clearTimeout(timer);
    if (isPhone() || url === st.open || !st.data.posts.some(p => p.url === url)) return;
    timer = setTimeout(() => {
      router.go(url, null, { keep: true, replace: st.shown === st.open });
      st.shown = url;
    }, 150);
  });
  v.teardown = on('reading', url => { st.open = url; markOpen(); });
  index.then(data => {
    if (!data) return;
    st.data = data;
    v.home = data.sectionURL;
    buildPlaces(data);
    render();
    // the dock's Posts item lights once the window knows its address (wm/panel.js)
    if (v.win) refresh();
  });
  return v;
}

export function ensureTracker({ place, url, q, focus = true } = {}) {
  let v = findView('tracker');
  if (!v) {
    v = makeTracker();
    const d = deskRect();
    const w = Math.min(1170, d.w - 140);
    createWindow(v, { w, h: Math.min(696, d.h - tabH() - 36), x: clearOfIcons(118, w, d), y: tabH() + 20 });
  } else if (focus) {
    focusView(v);
  }
  if (place) v.go(place, url);
  if (q != null) v.search(q);
  return v;
}

// First load (beneath) opens it at its home spot under any window the page opened, which keeps the focus. Home (D24)
// brings it to the front there. Neither animates or takes keyboard focus, and a pending Home snapshot stays (focus()
// would drop it). Phones have their own home screen (phone-home.js).
export function showPosts(beneath) {
  let v = findView('tracker');
  if (isPhone() || (beneath && v)) return;
  const { focused, booting, home } = S, geo = postsHome();
  S.booting = true;
  if (!v) createWindow(v = makeTracker(), geo);
  const w = v.win;
  if (!beneath) {
    Object.assign(w, geo, { snap: null, prev: null, unmax: null, tabX: 0, min: false, active: w.views.indexOf(v), z: ++S.z });
    S.focused = w;
  } else if (focused) {
    w.z = 1;
    S.focused = focused;
  }
  renderTabs(w);
  place(w);
  Object.assign(S, { booting, home });
  refresh();
}

export function initTrackerRoute() {
  router.register('tracker', page => { ensureTracker({ place: page.place || 'all', url: page.url }); });
}
