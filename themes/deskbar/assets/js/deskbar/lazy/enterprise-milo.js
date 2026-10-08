// Enterprise Portal's Milo workspace (lazy/enterprise.js): a board that loads to 3%, then freeform chaos. Stickies at
// every angle on top of each other and off the edge, a frame nobody used, an arrow to nowhere, anonymous cursors
// flying across it all, two zoom levels (the far one finds years of abandoned workshops), a reset that misses, a free
// plan of one sticky, and an export in a format only Milo opens.
import { h } from '../lib/dom.js';

// [text, left %, top %, turn in degrees, colour, width in px]
export const NOTES = [
  ['Synergy?', 6, 10, -6, 'y', 110],
  ['Parking lot', 63, 5, 4, 'p', 96],
  ['AI strategy (TBC)', 29, 21, 9, 'g', 130],
  ['Align on alignment', 55, 18, -2, 'y', 140],
  ['DO NOT MOVE', 41, 42, 22, 'b', 96],
  ['Rebrand the rebrand', 72, 40, -12, 'b', 120],
  ['Quick win', 11, 57, 3, 'y', 92],
  ['Circle back', 15, 62, -9, 'p', 104],
  ['Boil the ocean', 47, 67, 14, 'g', 112],
  ['Blockchain?', 92, 74, -4, 'y', 104],
];
// [text, left %, top %, turn, font size in px]
const SCRAWLS = [['IDEAS!!!', 18, 1, -4, 30], ['parking lot →', 62, 90, 3, 15], ['(ignore this frame)', 36, 33, -3, 12], ['who wrote this?', 80, 30, 8, 13]];
const CURSORS = ['Capybara', 'Axolotl', 'Quokka', 'Wombat', 'Platypus', 'Numbat'];
// [format, offered on the free plan]
export const FORMATS = [['Milo Board (.milo), opens in Milo', true], ['PDF', false], ['PNG', false], ['CSV', false]];

// Zoom only has the two extremes, and reset lands just off 100%
export const ZOOMS = { out: 0.08, in: 4, reset: 0.97 };

// A random point on the board, a cursor's waypoint in container units
const spot = () => `${Math.round(Math.random() * 85)}cqw ${Math.round(Math.random() * 85)}cqh`;

// Everything past the board's edge is stitched from these, so hundreds of leftovers ship as a few hundred bytes
const VERBS = ['Revisit', 'Park', 'Socialise', 'Unblock', 'Deprioritise', 'Rethink', 'Action', 'Sunset', 'Pilot', 'Reframe', 'Align on', 'Double-click on'];
const THINGS = ['the roadmap', 'synergies', 'the north star', 'learnings', 'OKRs', 'the vibe', 'blockers', 'the backlog', 'quick wins', 'stakeholders', 'the offsite', 'Q4', 'the parking lot'];
const FRAMES = ['Retro', 'Icebreaker', 'Lean coffee', 'Team charter', 'Futurespective', 'Empathy map', 'Workshop (DO NOT EDIT)', 'Brainstorm 2019', 'Untitled frame'];
const INK = ['???', '+1', 'see above', 'TODO', 'dot vote here', 'who owns this?', 'out of scope', 'this!!', 'ask Dave', 'v2', 'parked', 'old, ignore'];

// The rest of the board, built on the first zoom out so loading stays light. A fixed seed gives the same mess every
// visit; items skip the original board so it stays readable at the wrong reset zoom.
function sprawl(n = 360) {
  let s = 7;
  const r = (lo, hi) => lo + (s = s * 16807 % 2147483647) / 2147483647 * (hi - lo);
  const pick = a => a[r(0, a.length) | 0];
  const at = extra => {
    let x, y;
    do { x = r(-340, 880); y = r(-340, 880); } while (x > -60 && x < 105 && y > -60 && y < 105);
    return `left:${x | 0}%; top:${y | 0}%; rotate:${r(-30, 30) | 0}deg; ${extra}`;
  };
  const f = new DocumentFragment();
  for (let i = 0; i < n; i++) {
    const k = i % 16, w = r(100, 420) | 0;
    f.append(
      k === 0 ? h('div', { class: 'f', style: at(`width:${r(15, 50) | 0}%; height:${r(15, 50) | 0}%; font-size:${r(30, 90) | 0}px`) }, 'Copy of '.repeat(r(0, 4) | 0) + pick(FRAMES))
      : k < 3 ? h('div', { class: 'mi-scrawl', style: at(`font-size:${r(30, 120) | 0}px`) }, pick(INK))
      : k === 3 ? h('div', { class: 'a', style: at(`width:${r(10, 60) | 0}%`) })
      : k === 4 ? h('div', { class: 'd', style: at('') })
      : h('div', { class: 'n ' + 'ypgb'[i % 4], style: at(`width:${w}px; font-size:${w / 8 | 0}px`) }, pick(VERBS) + ' ' + pick(THINGS)));
  }
  return h('div', { class: 'mi-sprawl', 'aria-hidden': 'true' }, f);
}

export function render(pane, { after, dialog, btn }) {
  const wait = h('p', { class: 'mi-load', role: 'status' }, 'Loading board… 3%');
  pane.append(wait);
  after(1500, () => {
    wait.remove();
    let added = 0, sprawled;
    const note = ([text, x, y, r, c, w]) => h('li', { class: `mi-note ${c}`, style: `left:${x}%; top:${y}%; rotate:${r}deg; width:${w}px` }, text);
    const notes = h('ul', { class: 'mi-notes', 'aria-label': 'Stickies' }, NOTES.map(note));
    const board = h('div', { class: 'mi-board' },
      h('div', { class: 'mi-frame' }, h('span', {}, 'Impact vs effort (WIP)')),
      SCRAWLS.map(([text, x, y, r, size]) => h('p', { class: 'mi-scrawl', style: `left:${x}%; top:${y}%; rotate:${r}deg; font-size:${size}px` }, text)),
      notes);
    board.insertAdjacentHTML('afterbegin', '<svg class="mi-arrow" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M14 22C30 40 20 70 56 88" fill="none" stroke="#1a1a1a" stroke-width="2" stroke-dasharray="6 4" vector-effect="non-scaling-stroke"/></svg>');
    const zoomOut = h('output', { class: 'mi-zoom' }, '100%');
    const zoom = z => { board.style.transform = `scale(${z})`; zoomOut.textContent = Math.round(z * 100) + '%'; };

    const exportBoard = async () => {
      const formats = h('ul', { class: 'mi-formats' }, FORMATS.map(([f, ok]) => h('li', { class: ok ? '' : 'off' }, f, ok ? '' : ' (Milo Business)')));
      if (await dialog('Export board', formats, ['Export .milo', 'Cancel']) !== 'Export .milo') return;
      await dialog('Exported', ['"Q3 Ideation Jam (copy) (copy).milo" is ready.', 'To open it, use Milo. To share it, invite them to Milo: AUD $19 a seat each month.']);
    };

    pane.append(
      h('div', { class: 'ent-bar' },
        btn('Add sticky', () => {
          if (added++) return dialog('Upgrade to add more', ["You've reached your free plan's limit of 1 sticky.", 'Ask your Milo admin to upgrade. Your Milo admin is: unknown.']);
          notes.append(note(['New idea', 5 + Math.random() * 80, 5 + Math.random() * 80, Math.random() * 40 - 20, 'p', 96]));
        }),
        btn('Tidy up', () => dialog('Tidy up is a Milo Business feature', 'Freeform is how ideas grow.')),
        btn('Zoom out too much', () => { sprawled ||= board.insertBefore(sprawl(), notes); zoom(ZOOMS.out); }), zoomOut,
        btn('Zoom in too much', () => zoom(ZOOMS.in)), btn('Reset zoom to just the wrong amount', () => zoom(ZOOMS.reset)),
        btn('Export', exportBoard),
        h('span', { class: 'mi-people' }, `${CURSORS.length + 23} people on this board`)),
      h('div', { class: 'mi-stage' }, board,
        h('div', { class: 'mi-cursors', 'aria-hidden': 'true' }, CURSORS.map((c, i) =>
          h('span', { class: 'mi-cur', style: `--i:${i}; --a:${spot()}; --b:${spot()}; --c:${spot()}` }, 'Anonymous ' + c)))));
  });
}
