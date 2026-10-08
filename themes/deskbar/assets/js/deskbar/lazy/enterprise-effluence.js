// Enterprise Portal's Effluence workspace (lazy/enterprise.js): the onboarding page twelve levels down, laid out in a
// column narrower than a phone in the middle of a wide screen, stacked with every macro and lozenge there is, last
// edited by someone who left. Search finds everything else, Edit loses your changes and Export makes a 0 byte file.
import { h } from '../lib/dom.js';

export const TREE = ['Engineering', 'Engineering (Old)', 'Platform', 'Platform 2.0', 'Teams', 'Team Rocket', 'Archive', '2019', 'Q3', 'Onboarding', 'Onboarding (OLD)', 'Onboarding (OLD) (DO NOT USE) v2 FINAL'];

// [lozenge text, colour]
const LOZENGES = [['DRAFT', 'grey'], ['DEPRECATED', 'red'], ['IN PROGRESS', 'blue'], ['APPROVED (2017)', 'green']];
// [panel kind, text]
const PANELS = [
  ['info', 'This page is the single source of truth.'],
  ['warn', 'This page is out of date. See the other single source of truth.'],
  ['note', 'Please do not edit this page. (Edited 214 times.)'],
  ['error', 'Unable to render Jira issues macro: execution error.'],
];
const STEPS = ['Request access to the wiki (link broken).', 'Ask Darren.', 'Install the VPN from the page linked in step 1.', 'TODO: write this section.'];
const TABLE = ['Step', 'Owner', 'Status', 'RACI', 'Last reviewed', 'Next review', 'Notes', 'Notes (2)'];
const COMMENTS = [['Kev', '+1'], ['Priya', '+1'], ['Sam', 'Is this still current? (2021)'], ['Former Employee', '+1'], ['Priya', 'Bump (2024)']];
// [format, what you get]
export const FORMATS = [
  ['Word (.doc)', 'an HTML file named .doc'],
  ['PDF', 'queued, position 4,812'],
  ['Effluence Storage Format (.efx)', 'opens in Effluence 6.2 only'],
];

// Search results for q: never the page you wanted
export const search = q => [
  'Meeting notes 2017-03-02 (untitled)',
  'Copy of Copy of Template',
  `"${q}" in a page you don't have access to`,
  'Search policy (draft)',
];

export function render(pane, { dialog, btn }) {
  const denied = () => dialog("You don't have access", 'Request access from the page owner, a deactivated user.');
  // each level nests in the one before
  let tree = null;
  for (let i = TREE.length - 1; i >= 0; i--) {
    const last = i === TREE.length - 1;
    tree = h('ul', {}, h('li', {}, last ? h('b', { 'aria-current': 'page' }, TREE[i]) : h('button', { type: 'button', onclick: denied }, TREE[i]), tree));
  }

  const results = h('div', { class: 'ef-results', 'aria-live': 'polite' });
  const q = h('input', { type: 'search', placeholder: 'Search Effluence', 'aria-label': 'Search Effluence' });
  const find = h('form', { class: 'ef-search', role: 'search', onsubmit: e => {
    e.preventDefault();
    const text = q.value.trim();
    if (!text) return;
    results.replaceChildren(h('p', {}, '0 exact matches. Showing 4,812 results by relevance (random).'), h('ul', {}, search(text).map(r => h('li', {}, r))));
  } }, q, h('button', { type: 'submit', class: 'ent-btn pri' }, 'Search'));

  const edit = btn('Edit', async () => {
    const a = await dialog('3 people are editing this page', 'Your changes may conflict with theirs.', ['Edit anyway', 'Cancel']);
    if (a === 'Edit anyway') await dialog('Your changes were lost', 'Someone else published first. Their change: removed a space.');
  });
  const exportPage = btn('Export', async () => {
    const list = h('ul', { class: 'ef-formats' }, FORMATS.map(([f, note]) => h('li', {}, h('b', {}, f), `: ${note}`)));
    const a = await dialog('Export page', list, ['Export .efx', 'Export to Word', 'Cancel']);
    if (a === 'Export .efx') await dialog('Export complete', [`"${TREE.at(-1)}.efx" downloaded (0 bytes).`, 'Macros, images, tables and text were not exported.']);
    if (a === 'Export to Word') await dialog('Opened in Word', 'Your page is now 312 pages of raw HTML. The table is on page 211.');
  });
  const wide = btn('Full width', () => dialog('Full width is an Effluence Premium feature', 'Fixed width keeps lines readable. All 40 characters of them.'));

  // Expand macros, each holding another, three deep, then the content
  const expand = depth => {
    const inner = h('div', { class: 'ef-inner', hidden: true }, depth > 1 ? expand(depth - 1) : h('p', {}, 'TBC'));
    const b = btn('Click here to expand…', () => { inner.hidden = !inner.hidden; b.setAttribute('aria-expanded', !inner.hidden); }, 'ef-expand');
    b.setAttribute('aria-expanded', 'false');
    return h('div', {}, b, inner);
  };

  pane.append(
    h('header', { class: 'ef-head' }, h('b', {}, 'Effluence'), find),
    results,
    h('div', { class: 'ef-wrap' },
      h('nav', { class: 'ef-tree', 'aria-label': 'Page tree' }, tree),
      h('div', { class: 'ef-scroll' },
        h('article', { class: 'ef-page' },
          h('p', { class: 'ef-crumbs' }, 'Engineering / … / Onboarding / Onboarding (OLD)'),
          h('div', { class: 'ef-title' }, h('h2', {}, TREE.at(-1))),
          h('div', { class: 'ef-acts' }, edit, wide, exportPage),
          h('p', { class: 'ef-meta' }, 'Created by Former Employee, last updated by Effluence Bot on 14 March 2019. 3 min read. 1,204 views (all you).'),
          h('p', { class: 'ef-lozenges' }, LOZENGES.map(([t, c]) => h('span', { class: `ef-loz ${c}` }, t))),
          PANELS.map(([k, t]) => h('p', { class: `ef-panel ${k}` }, t)),
          h('h3', {}, 'Table of contents'), h('p', { class: 'ef-empty' }, 'No headings found.'),
          h('h3', {}, 'Getting started'),
          h('p', {}, h('span', { class: 'ef-red' }, 'IMPORTANT!!! '), 'Read ', h('mark', {}, 'all of this'), ' before ', h('span', { class: 'ef-big' }, 'starting'), '.'),
          h('ol', {}, STEPS.map(s => h('li', {}, s))),
          h('div', { class: 'ef-table', tabindex: 0, role: 'region', 'aria-label': 'Onboarding steps table' },
            h('table', {}, h('thead', {}, h('tr', {}, TABLE.map(c => h('th', {}, c)))),
              h('tbody', {}, STEPS.map((_, i) => h('tr', {}, h('td', {}, i + 1), h('td', {}, '@Former Employee'), h('td', {}, 'TBC'), h('td', {}, 'R'), h('td', {}, '2019'), h('td', {}, 'Overdue'), h('td', {}, 'See notes (2)'), h('td', {}, 'See notes')))))),
          h('h3', {}, 'More detail'), expand(3),
          h('h3', {}, 'Child pages'), h('p', { class: 'ef-empty' }, 'No child pages. (There are 14.)'),
          h('p', { class: 'ef-likes' }, 'Be the first to like this'),
          h('h3', {}, 'Comments'), h('ul', { class: 'ef-comments' }, COMMENTS.map(([who, c]) => h('li', {}, h('b', {}, who), ' ', c)))))));
}
