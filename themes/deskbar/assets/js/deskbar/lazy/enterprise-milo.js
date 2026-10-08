// Enterprise Portal's Milo workspace (lazy/enterprise.js): a board that loads to 3%, then freeform chaos. Stickies at
// every angle on top of each other and off the edge, a frame nobody used, an arrow to nowhere, anonymous cursors
// flying across it all, two zoom levels (the far one finds years of abandoned workshops), a reset that misses, a free
// plan of one sticky, an export in a format only Milo opens, comments on each sticky saying what it should have been, frames
// of work that belonged in other tools, and a Convert to… that gets nothing out.
import { h } from '../lib/dom.js';

// [text, left %, top %, turn in degrees, colour, width in px, what it should have been, the emoji stuck on it (the
// voting picker's closest match to a thumb is a turkey)]
export const NOTES = [
  ['Synergy?', 6, 10, -6, 'y', 110, 'an email'],
  ['Parking lot', 63, 5, 4, 'p', 96, 'a Jiro ticket'],
  ['AI Strategy (The CEO said we have to be AI native now)', 37, 4, 9, 'g', 150, 'an Effluence page'],
  ['Align on alignment', 55, 18, -2, 'y', 140, 'a calendar invite'],
  ['DO NOT MOVE', 41, 42, 22, 'b', 96, 'a locked PDF'],
  ['Rebrand the rebrand', 72, 40, -12, 'b', 120, 'a Jiro ticket'],
  ['Quick win', 11, 57, 3, 'y', 92, 'a Jiro ticket'],
  ['Circle back', 15, 62, -9, 'p', 104, 'an email'],
  ['Boil the ocean', 47, 67, 14, 'g', 112, 'nothing at all'],
  ['Blockchain?', 92, 74, -4, 'y', 104, 'nothing at all'],
  ['Vote 👍 / 👎', 27, 79, 7, 'b', 110, 'a poll', '🦃 14'],
];
// [text, left %, top %, turn, font size in px]
const SCRAWLS = [['IDEAS!!!', 18, 1, -4, 30], ['parking lot →', 62, 90, 3, 15], ['(ignore this frame)', 36, 33, -3, 12], ['who wrote this?', 80, 30, 8, 13]];
const CURSORS = ['Capybara', 'Axolotl', 'Quokka', 'Wombat', 'Platypus', 'Numbat'];
// [format, offered on the free plan]
export const FORMATS = [['Milo Board (.milo), opens in Milo', true], ['PDF', false], ['PNG', false], ['CSV', false]];

// Zoom only has the two extremes, and reset lands just off 100%
export const ZOOMS = { out: 0.08, in: 4, reset: 0.97 };

// Frames past the board's edge, each a job for another tool (or none) done in stickies: [title, left %, top %, what it
// should have been, items]. An item is [kind, text, left %, top %, turn, colour or width]: n a sticky, s a scrawl, a an
// arrow to nowhere (width %), img a screenshot, bg a chart drawn behind it all (the text names it).
const README = ['# Setup', '1. Clone the repo', '2. Ask Dave for access', '3. Wait', '4. ???', '## Running it', 'See step 3', '## Troubleshooting', 'Ask Dave', 'Dave has left'];
export const ELSEWHERE = [
  ['Sprint board (please use this one)', 115, 5, 'a Jiro board', [
    ['s', 'To do', 6, 3, -3], ['s', 'Doing', 40, 7, 2], ['s', 'DONE', 75, 1, -6],
    ['n', 'Fix login', 4, 20, 3, 'y'], ['n', 'Fix login (again)', 10, 44, -5, 'y'], ['n', 'Update this board', 2, 68, 8, 'p'],
    ['n', 'Fix login (for real)', 38, 24, -2, 'g'], ['n', 'Move the cards on Milo', 45, 50, 6, 'b'],
    ['n', 'Make the board', 73, 22, -8, 'g'],
  ]],
  ['Architecture v3 FINAL (2)', 5, 115, 'an Excalidraw diagram', [
    ['n', 'Web', 5, 15, 0, 'b'], ['n', 'API', 40, 32, 4, 'b'], ['n', 'DB?', 76, 10, -3, 'b'], ['n', 'Cache (Dave)', 60, 64, 7, 'b'],
    ['a', '', 22, 26, 25, 22], ['a', '', 58, 38, -50, 20], ['a', '', 34, 74, 170, 24], ['s', '→ ???', 84, 48, 0],
  ]],
  ['README', 115, 115, 'a README.md', README.map((t, i) => ['n', t, 6 + (i % 3) * 4, 3 + i * 9.4, (i % 3) - 1, 'y'])],
  ['Jiro board (screenshot, March)', 225, 5, 'a link to the Jiro board', [['img', 'Screenshot 2025-03-14 at 9.41.02 am.png']]],
  ['Hype cycle', 225, 115, 'a vibe', [
    ['bg', 'hype'], ['s', 'Peak of inflated expectations', 18, 2, -2], ['s', 'Trough of disillusionment', 40, 86, 3],
    ['n', 'Our AI strategy', 3, 62, -6, 'g'], ['n', 'AI agents', 22, 12, 4, 'y'], ['n', 'Blockchain', 44, 66, -9, 'p'],
    ['n', 'Microservices', 64, 44, 5, 'b'], ['n', 'The metaverse', 48, 80, 12, 'p'],
  ]],
  ['Magic quadrant', 5, 225, 'a paid analyst report', [
    ['bg', 'quad'], ['s', 'Challengers', 4, 2, 0], ['s', 'Leaders', 56, 2, 0], ['s', 'Niche players', 4, 88, 0], ['s', 'Visionaries', 56, 88, 0],
    ['n', 'Milo (placed by Milo)', 70, 10, -4, 'y'], ['n', 'MS Buddies', 62, 26, 6, 'b'], ['n', 'Markdown', 8, 66, 3, 'g'],
    ['n', 'Excalidraw', 22, 58, -7, 'g'], ['n', 'Us', 78, 62, 9, 'p'],
  ]],
  ['Technology radar', 115, 225, 'a list', [
    ['bg', 'radar'], ['s', 'Adopt', 47, 44, 0], ['s', 'Trial', 47, 28, 0], ['s', 'Assess', 46, 14, 0], ['s', 'Hold', 47, 1, 0],
    ['n', 'Milo', 40, 52, 3, 'y'], ['n', 'Spreadsheets', 54, 58, -5, 'y'], ['n', 'AI', 30, 34, 6, 'g'], ['n', 'AI (again)', 66, 20, -3, 'g'],
    ['n', 'Writing things down', 12, 16, 8, 'b'], ['n', 'Thinking', 76, 4, -8, 'p'],
  ]],
];

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
    let added = 0, sprawled, picked = null;
    // a comment, upright whatever the sticky's turn, from whichever cursor got there first
    const comment = (what, turn = 0) => {
      const who = CURSORS[what.length % CURSORS.length];
      return h('div', { class: 'mi-comment', style: `rotate:${-turn}deg` }, h('span', { class: 'mi-pin', 'aria-hidden': 'true' }, who[0]),
        h('p', {}, h('b', {}, 'Anonymous ' + who), h('small', {}, '2 years ago'), h('span', {}, `Should have been ${what}.`)));
    };
    // a sticky picked gets a comment on where it belonged, and is what Convert to… works on
    const note = sticky => {
      const [text, x, y, r, c, w, what, emoji] = sticky;
      const li = h('li', { class: `mi-note ${c}`, style: `left:${x}%; top:${y}%; rotate:${r}deg; width:${w}px` }, emoji && h('span', { class: 'mi-emoji' }, emoji));
      li.append(h('button', { type: 'button', 'aria-pressed': 'false', onclick: e => {
        for (const b of notes.querySelectorAll('[aria-pressed=true]')) b.setAttribute('aria-pressed', 'false');
        e.currentTarget.setAttribute('aria-pressed', 'true');
        picked = sticky;
        if (!li.querySelector('.mi-comment')) li.append(comment(what, r));
      } }, text));
      return li;
    };
    const notes = h('ul', { class: 'mi-notes', 'aria-label': 'Stickies' }, NOTES.map(note));
    const item = ([kind, text, x, y, r, extra]) => {
      const at = `left:${x}%; top:${y}%; rotate:${r}deg`;
      return kind === 'n' ? h('div', { class: `mi-fn ${extra}`, style: at }, text)
        : kind === 's' ? h('p', { class: 'mi-scrawl', style: at }, text)
        : kind === 'a' ? h('div', { class: 'mi-line', style: `${at}; width:${extra}%`, 'aria-hidden': 'true' })
        : kind === 'bg' ? h('div', { class: `mi-bg ${text}`, 'aria-hidden': 'true' })
        : h('figure', { class: 'mi-shot' }, h('div', { 'aria-hidden': 'true' }), h('figcaption', {}, text));
    };
    const elsewhere = ELSEWHERE.map(([title, x, y, what, items]) => h('section', { class: 'mi-else', style: `left:${x}%; top:${y}%`, 'aria-label': title },
      h('h3', {}, title), items.map(item), comment(what)));
    const board = h('div', { class: 'mi-board' },
      h('div', { class: 'mi-frame' }, h('span', {}, 'Impact vs effort (WIP)')),
      SCRAWLS.map(([text, x, y, r, size]) => h('p', { class: 'mi-scrawl', style: `left:${x}%; top:${y}%; rotate:${r}deg; font-size:${size}px` }, text)),
      notes, elsewhere);
    board.insertAdjacentHTML('afterbegin', '<svg class="mi-arrow" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M14 22C30 40 20 70 56 88" fill="none" stroke="#1a1a1a" stroke-width="2" stroke-dasharray="6 4" vector-effect="non-scaling-stroke"/></svg>');
    const zoomOut = h('output', { class: 'mi-zoom' }, '100%');
    let z = 1, pan = [0, 0];
    const view = () => { board.style.transform = `scale(${z}) translate(${-pan[0]}%, ${-pan[1]}%)`; zoomOut.textContent = Math.round(z * 100) + '%'; };
    const zoom = to => { z = to; view(); };

    // Frames: a jump to each frame, landing a little off it
    const frames = async () => {
      const a = await dialog('Frames', `${ELSEWHERE.length + 1} frames on this board, ${ELSEWHERE.length} of them past the edge.`, [...ELSEWHERE.map(f => f[0]), 'Impact vs effort (WIP)']);
      if (!a) return;
      const f = ELSEWHERE.find(e => e[0] === a);
      pan = f ? [f[1] - 3, f[2] - 2] : [0, 0];
      zoom(ZOOMS.reset);
    };

    // Convert to…: each way out of Milo fails differently
    const convert = async () => {
      if (!picked) return dialog('Nothing selected', 'Pick a sticky first.');
      const [text, x, y, r, c] = picked;
      const a = await dialog(`Convert "${text}"`, 'Where should this sticky go?', ['Convert to Jiro issue', 'Export as Markdown', 'Open in diagram tool', 'Cancel']);
      if (a === 'Convert to Jiro issue') await dialog('Converted', ['ENT-48231 was created in a project you do not have access to.', 'The sticky was kept, just in case.']);
      if (a === 'Export as Markdown') await dialog('Exported as Markdown', h('pre', { class: 'mi-md', tabindex: 0 },
        `<div style="position:absolute;left:${x * 43 - 3412}px;top:${y * 11}px;rotate:${r}deg" class="sticky sticky--${c}">\n  <div><div><p><span>${text}</span></p></div></div>\n</div>\n<!-- …and 3,998 more lines -->`));
      if (a === 'Open in diagram tool') await dialog('Upgrade to Milo Business', 'Opening stickies in other tools is a Milo Business feature. So is closing them.');
    };

    const exportBoard = async () => {
      const formats = h('ul', { class: 'mi-formats' }, FORMATS.map(([f, ok]) => h('li', { class: ok ? '' : 'off' }, f, ok ? '' : ' (Milo Business)')));
      if (await dialog('Export board', formats, ['Export .milo', 'Cancel']) !== 'Export .milo') return;
      await dialog('Exported', ['"Q3 Ideation Jam (copy) (copy).milo" is ready.', 'To open it, use Milo. To share it, invite them to Milo: AUD $19 a seat each month.']);
    };

    pane.append(
      h('div', { class: 'ent-bar' },
        btn('Add sticky', () => {
          if (added++) return dialog('Upgrade to add more', ["You've reached your free plan's limit of 1 sticky.", 'Ask your Milo admin to upgrade. Your Milo admin is: unknown.']);
          notes.append(note(['New idea', 5 + Math.random() * 80, 5 + Math.random() * 80, Math.random() * 40 - 20, 'p', 96, 'a thought, kept to yourself']));
        }),
        btn('Tidy up', () => dialog('Tidy up is a Milo Business feature', 'Freeform is how ideas grow.')),
        btn('Zoom out too much', () => { sprawled ||= board.insertBefore(sprawl(), notes); zoom(ZOOMS.out); }), zoomOut,
        btn('Zoom in too much', () => zoom(ZOOMS.in)), btn('Reset zoom to just the wrong amount', () => { pan = [0, 0]; zoom(ZOOMS.reset); }),
        btn('Frames', frames), btn('Convert to…', convert), btn('Export', exportBoard),
        h('span', { class: 'mi-people' }, `${CURSORS.length + 23} people on this board`)),
      h('div', { class: 'mi-stage' }, board,
        h('div', { class: 'mi-cursors', 'aria-hidden': 'true' }, CURSORS.map((c, i) =>
          h('span', { class: 'mi-cur', style: `--i:${i}; --a:${spot()}; --b:${spot()}; --c:${spot()}` }, 'Anonymous ' + c)))));
  });
}
