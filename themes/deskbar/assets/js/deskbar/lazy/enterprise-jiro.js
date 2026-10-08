// Enterprise Portal's Jiro workspace (lazy/enterprise.js): a sprint board with two kinds of Blocked (one of them waiting
// on Change Management) and two of Done, tickets whose fields load one at a time, a Done no ticket can reach, and a
// Create form whose required fields never end. Cards drag, but never land.
import { h } from '../lib/dom.js';

export const CM = 'Blocked (waiting on Change Management)';
export const COLUMNS = ['To do', 'In progress', 'Blocked', CM, 'In review', 'Done', 'Done done'];

// [key, summary, column, story points, type, assignee initials]
export const TICKETS = [
  ['ENT-1', 'Set up Jiro', 'In progress', 1, 'task', 'FE'],
  ['ENT-399', 'Make the build faster', CM, 40, 'story', 'DA'],
  ['ENT-48213', 'Fix bug', 'In progress', 13, 'bug', 'KV'],
  ['ENT-48214', 'Investigate why ENT-48213 is taking so long', 'To do', 8, 'task', 'PR'],
  ['ENT-48215', 'Add 4 more required fields to the ticket template', 'Done', 2, 'story', 'DA'],
  ['ENT-48216', 'Spike: spike on the spike', 'In review', 21, 'story', 'SM'],
  ['ENT-48217', 'Write a ticket for writing tickets', 'Blocked', 3, 'task', 'PR'],
  ['ENT-48218', 'Change the font on the login page', CM, 1, 'story', 'KV'],
  ['ENT-48219', 'Rename the Blocked column to Paused', 'Blocked', 5, 'task', 'DA'],
].map(([key, title, col, pts, type, who]) => ({ key, title, col, pts, type, who }));

// The ticket fields that load one at a time, and the Create form's required fields: [label, choices or null for text]
const FIELDS = ['Epic', 'Fix version', 'Root cause category', 'Component', 'Sub-component', 'Team', 'Team (new)', 'Squad', 'Tribe', 'Chapter', 'Guild', 'CAB approval ID', 'Security sign-off', 'Time logged (15 minute increments)'];
export const REQUIRED = [
  ['Summary', null],
  ['Issue type', ['Story', 'Bug', 'Task', 'Spike', 'Epic', 'Saga', 'Initiative', 'Strategic pillar']],
  ['Story points', ['1', '2', '3', '5', '8', '13', '21', '?']],
  ['Business value (in synergies)', null],
  ['Change request number (CHG-)', null],
  ['CAB approval date (a Tuesday)', null],
  ['Risk rating justification', null],
  ['Cost centre', null],
  ['Affected environment', ['Dev', 'Test', 'UAT', 'Pre-prod', 'Pre-pre-prod', 'Prod (do not select)']],
  ['Data classification', ['Public', 'Internal', 'Confidential', 'Secret', 'Unclassified (classified)']],
  ['Executive sponsor', null],
  ['Squad, tribe, chapter and guild', null],
  ['Reason this is not a duplicate', null],
];
// Dragging a card to another column needs the Create form's fields and then some
export const DRAG_FIELDS = [...REQUIRED,
  ['Drag reason', null],
  ['Justification for this justification', null],
  ['Pre-drag risk assessment', ['Low', 'Medium', 'High', 'Career-limiting']],
  ['Column change impact statement', null],
  ['Source column owner sign-off', null],
  ['Destination column consent', null],
  ['Distance dragged (in pixels)', null],
  ['Drag speed (cards per second)', null],
  ['Mouse or trackpad asset tag', null],
  ['Has this card been dragged before?', ['Yes', 'No', 'Not since the restructure']],
  ['Previous drag reference (DRG-)', null],
  ['Stakeholders notified of the drag', null],
  ['Rollback plan (if dropped)', null],
  ['Benefits realisation date', null],
  ['Alignment with the 5 year strategy', null],
  ['OKR this drag contributes to', null],
  ['Agile coach approval', null],
  ['Scrum master initials', null],
  ['Product owner initials (not the scrum master)', null],
  ['Accessibility impact of the move', null],
  ['Carbon footprint of the move', null],
  ['Legal review reference', null],
  ['Privacy impact assessment number', null],
  ['Was a meeting held about this drag?', ['Yes', 'Yes, two', 'Pending a meeting about the meeting']],
  ['Lessons learned (in advance)', null],
  ['Drag and Drop Policy (v14, 212 pages)', ['I have read it', 'I have skimmed it', 'I scrolled to the bottom']],
];
const PAGES = {
  Backlog: '4,812 issues. A grooming session has been booked for every Friday afternoon, forever.',
  Timeline: 'Timelines are a Jiro Premium feature.',
  Reports: 'Your velocity is 0 points. This report was generated in 41 seconds.',
  'Project settings': 'Only the project admin can change settings. The project admin is: Former Employee.',
};

// Moving a ticket from one column to another: { col } on success, else { error }
export function transition(from, to) {
  if (from === CM) return { error: 'Change request CHG-0091823 has not been approved. The Change Advisory Board meets on the second Tuesday of months with an R in them.' };
  if (to === 'Done') return { error: 'Transition failed. Required: Root cause category, Fix version, CAB approval ID, Time logged (in 15 minute increments).' };
  if (to === 'Done done') return { error: 'Not a valid transition. A ticket must be Done before it is Done done, and nothing is Done.' };
  return { col: to };
}

// A form of required fields: [inputs, form]
const fill = (fields, cls) => {
  const inputs = fields.map(([label, choices]) => (choices
    ? h('select', { 'aria-label': label }, h('option', { value: '' }, 'Select…'), choices.map(c => h('option', {}, c)))
    : h('input', { 'aria-label': label })));
  return [inputs, h('div', { class: cls }, fields.map(([label], i) => h('label', {}, h('span', {}, label, h('span', { class: 'ji-star', 'aria-hidden': 'true' }, ' *')), inputs[i])))];
};
const unfilled = inputs => inputs.filter(i => !i.value.trim()).length;

export function render(pane, { every, on, dialog, btn }) {
  const tickets = TICKETS.map(t => ({ ...t }));
  const cols = Object.fromEntries(COLUMNS.map(c => [c, h('ul', { class: 'ji-cards' })]));
  const counts = Object.fromEntries(COLUMNS.map(c => [c, h('span', { class: 'ji-count' })]));
  const side = h('aside', { class: 'ji-side', 'aria-label': 'Ticket', hidden: true });
  let shown = null;

  const draw = () => {
    for (const [c, ul] of Object.entries(cols)) {
      const here = tickets.filter(t => t.col === c);
      counts[c].textContent = here.length;
      ul.replaceChildren(...here.map(t => h('li', { draggable: 'true' }, h('button', { type: 'button', class: 'ji-card', 'data-key': t.key, onclick: () => open(t) },
        h('span', {}, t.title),
        h('span', { class: 'ji-foot' },
          h('i', { class: `ji-type ${t.type}`, title: t.type }), h('span', { class: 'ent-sr' }, t.type + ', '), h('small', {}, t.key),
          h('i', { class: 'ji-pts' }, h('span', { class: 'ent-sr' }, 'Story points: '), t.pts),
          h('i', { class: 'ji-who', 'aria-hidden': 'true' }, t.who))))));
    }
  };

  function open(t) {
    side.hidden = false;
    const fields = h('dl', { class: 'ji-fields' });
    const moves = h('div', { class: 'ji-moves', role: 'group', 'aria-label': 'Move to' }, COLUMNS.filter(c => c !== t.col).map(c =>
      btn(c, () => {
        const r = transition(t.col, c);
        if (r.error) return dialog('Transition failed', r.error);
        t.col = r.col;
        draw();
        open(t);
        side.querySelector('h3').focus();
      })));
    side.replaceChildren(
      h('p', { class: 'ji-key' }, t.key),
      h('h3', { tabindex: -1 }, t.title),
      h('p', {}, `Status: ${t.col}. Story points: ${t.pts} (Fibonacci, so not days, except when they are).`),
      h('p', { class: 'ji-label' }, 'Move to'), moves, fields);
    shown = fields;
  }
  // the open ticket's fields arrive one at a time, as the real thing's do
  every(250, () => {
    const n = shown?.children.length / 2;
    if (n < FIELDS.length) shown.append(h('dt', {}, FIELDS[n], h('span', { class: 'ji-star', 'aria-hidden': 'true' }, ' *')), h('dd', {}, 'None'));
  });

  // Create: every field is required, and filling them all in still doesn't get you anywhere
  const create = async () => {
    const [inputs, form] = fill(REQUIRED, 'ji-form');
    if (await dialog('Create issue', ['Fields marked * are required. All fields are marked *.', form], ['Create', 'Cancel']) !== 'Create') return;
    const empty = unfilled(inputs);
    await (empty
      ? dialog(`${empty} required ${empty > 1 ? 'fields are' : 'field is'} empty`, 'Your draft was not saved.')
      : dialog('Issue created', 'ENT-48220 was created in a project you do not have access to.'));
  };

  // Drag and drop: a card dropped on another column brings up the move paperwork, and stays where it was either way
  const board = h('div', { class: 'ji-board' }, COLUMNS.map(c => h('section', { class: 'ji-col', 'aria-label': c }, h('h3', {}, c, ' ', counts[c]), cols[c])));
  let dragged = null;
  const over = col => { for (const s of board.children) s.classList.toggle('ji-over', s === col); };
  const drag = async (t, to) => {
    const [inputs, form] = fill(DRAG_FIELDS, 'ji-form ji-drag');
    if (await dialog('Move issue', [`Moving ${t.key} from ${t.col} to ${to} requires the following ${DRAG_FIELDS.length} fields.`, form], ['Submit move request', 'Cancel']) !== 'Submit move request') return;
    const empty = unfilled(inputs);
    await (empty
      ? dialog(`${empty} of ${DRAG_FIELDS.length} required fields are empty`, `${t.key} has been returned to ${t.col}. Your answers were not saved, as dragging is not a save event.`)
      : dialog('Move request raised', `CHG-0091824 was raised to move ${t.key} to ${to}. The Change Advisory Board will review it on the second Tuesday of a month with an R in it. ${t.key} stays in ${t.col} until then.`));
  };
  // the li drags rather than its button, as Firefox won't start a drag on a button
  on(board, 'dragstart', e => {
    dragged = tickets.find(t => t.key === e.target.querySelector?.('.ji-card')?.dataset.key) || null;
    if (dragged) e.dataTransfer.setData('text/plain', dragged.key);
  });
  on(board, 'dragover', e => {
    const col = e.target.closest?.('.ji-col');
    if (!dragged || !col) return;
    e.preventDefault();
    over(col);
  });
  on(board, 'dragleave', e => { if (!board.contains(e.relatedTarget)) over(null); });
  on(board, 'dragend', () => { dragged = null; over(null); });
  on(board, 'drop', e => {
    e.preventDefault();
    const t = dragged, to = e.target.closest?.('.ji-col')?.getAttribute('aria-label');
    dragged = null;
    over(null);
    if (t && to && to !== t.col) drag(t, to);
  });

  const nav = h('nav', { class: 'ji-nav', 'aria-label': 'Project' },
    h('p', { class: 'ji-proj' }, h('i', { 'aria-hidden': 'true' }), h('span', {}, h('b', {}, 'Enterprise Platform'), h('small', {}, 'Software project'))),
    h('ul', {}, h('li', {}, h('b', { 'aria-current': 'page' }, 'Board')),
      Object.entries(PAGES).map(([name, text]) => h('li', {}, btn(name, () => dialog(name, text), 'ji-link')))));

  pane.append(h('div', { class: 'ji' }, nav,
    h('div', { class: 'ji-main' },
      h('p', { class: 'ji-crumbs' }, 'Projects / Enterprise Platform'),
      h('div', { class: 'ji-top' },
        h('h2', {}, 'ENT Sprint 214'),
        h('span', { class: 'ji-left' }, '3 days left (for the past 6 weeks)'),
        btn('Complete sprint', () => dialog('Complete sprint', '9 issues are incomplete. They will move to Sprint 215, as they did to Sprint 214.')),
        btn('Create', create, 'ent-btn pri')),
      h('div', { class: 'ji-wrap' },
        board, side))));
  draw();
}
