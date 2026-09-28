// Spotlight search overlay (D28), loaded with its stylesheet on first open by spotlight-trigger.js (loadLazy).
// A native modal <dialog> makes the page behind it inert. The field is a combobox over a grouped listbox using
// aria-activedescendant, so focus stays in the field while the arrow keys move the selection.
import { h, ico, plainClick } from '../lib/dom.js';
import { fmtDate, plural, excerpt } from '../lib/format.js';
import { parseSiteIndex, searchSite, snippet, marks } from '../lib/site-search.js';

const ICONS = { post: 'doc', page: 'doc', tool: 'tools', photo: 'photos', tag: 'folder', series: 'folder' };

let ui = null, entries = null, loading = null, from = null;

function loadIndex(url) {
  loading ||= fetch(url)
    .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(raw => { entries = parseSiteIndex(raw); })
    .catch(err => { loading = null; throw err; });
  return loading;
}

// Text with each query term wrapped in <mark>
function hl(text, q) {
  const out = [];
  let at = 0;
  for (const [s, e] of marks(text, q)) { out.push(text.slice(at, s), h('mark', {}, text.slice(s, e))); at = e; }
  out.push(text.slice(at));
  return out;
}

function meta(e) {
  if (e.kind === 'post') return fmtDate(e.date);
  if (e.kind === 'photo') return e.count ? plural(e.count, 'photo') : '';
  if (e.kind === 'tag') return 'Tag, ' + plural(e.count, 'post');
  if (e.kind === 'series') return 'Series, ' + plural(e.count, 'post');
  return '';
}

function build() {
  const input = h('input', {
    type: 'text', class: 'sp-q', role: 'combobox', 'aria-expanded': 'false', 'aria-controls': 'sp-list',
    'aria-autocomplete': 'list', 'aria-label': 'Search the site', placeholder: 'Search posts, pages, tools and photos',
    autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', enterkeyhint: 'go',
  });
  const list = h('div', { class: 'sp-list', id: 'sp-list', role: 'listbox', 'aria-label': 'Results' });
  const status = h('p', { class: 'sp-status', role: 'status' });
  const closeBtn = h('button', { class: 'sp-close', type: 'button', 'aria-label': 'Close search' },
    h('span', { class: 'sp-esc' }, 'Esc'), h('span', { class: 'sp-cancel' }, 'Cancel'));
  const lens = h('span', { class: 'sp-lens', 'aria-hidden': 'true' });
  lens.innerHTML = '<svg viewBox="0 0 18 18"><circle cx="7.5" cy="7.5" r="5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m11.3 11.3 4.6 4.6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  const dlg = h('dialog', { class: 'spotlight', 'aria-label': 'Search', 'aria-modal': 'true' },
    h('div', { class: 'sp-tab', 'aria-hidden': 'true' }, 'Search'),
    h('div', { class: 'sp-frame' },
      h('div', { class: 'sp-field' }, lens, input, closeBtn),
      list, status,
      h('p', { class: 'sp-keys', 'aria-hidden': 'true' },
        h('kbd', {}, '↑'), h('kbd', {}, '↓'), ' select', h('kbd', {}, 'Enter'), ' open', h('kbd', {}, 'Esc'), ' close')));

  let options = [], active = -1;

  function setActive(i, scroll = true) {
    if (active >= 0 && options[active]) { options[active].classList.remove('on'); options[active].setAttribute('aria-selected', 'false'); }
    active = i;
    const o = options[i];
    if (!o) { input.removeAttribute('aria-activedescendant'); return; }
    o.classList.add('on');
    o.setAttribute('aria-selected', 'true');
    input.setAttribute('aria-activedescendant', o.id);
    if (scroll) o.scrollIntoView({ block: 'nearest' });
  }

  function option(e, q) {
    const sub = snippet(e, q) || excerpt(e.body, 140);
    // the entry's own icon when the icon sprite has it, else its kind's
    const icon = e.icon && document.getElementById('i-' + e.icon) ? e.icon : ICONS[e.kind];
    const o = h('a', { class: 'sp-opt', role: 'option', id: 'sp-o-' + options.length, href: e.url, tabindex: '-1', 'aria-selected': 'false' },
      e.thumb ? h('img', { class: 'sp-thumb', src: e.thumb, alt: '', decoding: 'async' }) : ico('i-' + icon, 'ico sp-ico'),
      h('span', { class: 'sp-t' }, h('b', {}, hl(e.title, q)), sub && h('small', {}, hl(sub, q))),
      meta(e) && h('span', { class: 'sp-meta' }, meta(e)));
    options.push(o);
    return o;
  }

  function render() {
    const q = input.value.trim();
    options = [];
    active = -1;
    let groups = [];
    if (!entries) status.textContent = 'Loading the search index...';
    else if (!q) status.textContent = `Search ${entries.length} posts, pages, tools, photo albums and tags.`;
    else {
      groups = searchSite(entries, q);
      if (!groups.length) status.textContent = `No results for "${q}".`;
    }
    list.replaceChildren(...groups.map(g => h('div', { class: 'sp-group', role: 'group', 'aria-label': g.label },
      h('div', { class: 'sp-gh', 'aria-hidden': 'true' }, g.label), g.items.map(e => option(e, q)))));
    // screen readers still hear the count; on screen the list shows it, so has-results hides the status
    if (options.length) status.textContent = plural(options.length, 'result') + '.';
    dlg.classList.toggle('has-results', options.length > 0);
    input.setAttribute('aria-expanded', String(options.length > 0));
    setActive(options.length ? 0 : -1);
  }

  function openOption(o) {
    const url = o.getAttribute('href');
    close();
    window.deskbar.go(url);
  }

  input.addEventListener('input', render);
  dlg.addEventListener('keydown', e => {
    // keys that confirm an IME composition belong to the field
    if (e.isComposing) return;
    const n = options.length;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (n) setActive(((active + (e.key === 'ArrowDown' ? 1 : -1)) % n + n) % n);
    } else if (e.key === 'Enter' && e.target === input) {
      e.preventDefault();
      if (options[active]) openOption(options[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Tab') {
      // only the field and the close button take focus, so Tab moves between the two
      e.preventDefault();
      (document.activeElement === input ? closeBtn : input).focus();
    } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      input.select();
    }
  });
  // the pointer selects without scrolling the list under it
  list.addEventListener('pointermove', e => {
    const o = e.target.closest('.sp-opt');
    if (o && options.indexOf(o) !== active) setActive(options.indexOf(o), false);
  });
  list.addEventListener('click', e => {
    const o = e.target.closest('.sp-opt');
    // modified clicks open a browser tab as links normally do
    if (!o || !plainClick(e)) return;
    e.preventDefault();
    openOption(o);
  });
  closeBtn.addEventListener('click', close);
  // a click on the dialog itself, rather than anything in it, is on the backdrop
  dlg.addEventListener('click', e => { if (e.target === dlg) close(); });
  dlg.addEventListener('cancel', e => { e.preventDefault(); close(); });
  document.body.append(dlg);
  return { dlg, input, render, status };
}

function close() {
  if (!ui?.dlg.open) return;
  ui.dlg.close();
  const back = from;
  from = null;
  if (back?.isConnected && back !== document.body) back.focus({ preventScroll: true });
}

// opts: { index, from }: the site index URL, and the element to give focus back to on close
export function openSpotlight(opts) {
  ui ||= build();
  if (ui.dlg.open) { ui.input.select(); return; }
  from = opts.from;
  ui.dlg.showModal();
  ui.input.focus();
  ui.input.select();
  ui.render();
  if (!entries) {
    loadIndex(opts.index).then(ui.render, () => { ui.status.textContent = 'Search is unavailable right now. Please try again later.'; });
  }
}
