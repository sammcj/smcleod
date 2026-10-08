// Enterprise Portal's PowerPointless workspace (lazy/enterprise.js): slide 1 of 87, an agenda about the agenda, a
// stock handshake, a title that shrinks as you type it, and a transition the template picks for you. Nothing lines up
// and every line is in a different font, Align and Make fonts consistent make it worse, and the slide gets what
// space the ribbon and the speaker notes leave it, so the architecture diagram is 5px text.
import { h } from '../lib/dom.js';

export const TOTAL = 87;
// [title, body lines]; a 'photo:' line is a stock photo placeholder, a 'tiny:' line is the whole architecture in 5px
// text, and an empty title is the one to type
export const SLIDES = [
  ['Q3 Alignment', ['Aligning on alignment']],
  ['Agenda', ['Agenda', 'Recap of the agenda', 'Alignment', 'Next steps', 'Any other business']],
  ['Our values', ['Synergy', 'Agility', 'Synergy']],
  ['Partnership', ['photo:Two hands shaking in front of a sunset']],
  ['Target architecture (can everyone see this?)', ['tiny:The web tier calls the API gateway, which calls the service mesh, which calls the legacy ESB, which calls the mainframe, which calls the web tier. Each arrow is a microservice. Each microservice has its own Effluence page, last edited in 2019. The database is shared. The shared database is also a queue. The queue is also a cache. Ask Darren for the full-size version, which is a screenshot of this slide.'.repeat(3)]],
  ['Strategic priorities', ['Everything is high impact, low effort']],
  ['', []],
  ["Let's take this offline", []],
  ['Questions?', ['(Please hold them until the end of the next meeting)']],
];
const TRANSITIONS = ['spin', 'dissolve', 'bounce'];

// A typed title's font size in px: shrinks with every letter, down to 6
export const titleSize = len => Math.max(6, 40 - len);

// [font, fallback]: every font that has ever been pasted into the template
export const FONTS = [['Calibri', 'sans-serif'], ['Arial', 'sans-serif'], ['Times New Roman', 'serif'], ['Comic Sans MS', 'cursive'], ['Calibri Light', 'sans-serif'], ['Georgia', 'serif'], ['Aptos', 'sans-serif']];
// The font for line n of slide i after `round` attempts at consistency. Neighbouring lines never match.
export const fontOf = (i, n, round) => FONTS[(i * 3 + n + round * 2) % FONTS.length];
// How far off line n sits, in px, after `round` presses of Align: up to 4 either way
export const offsetOf = (i, n, round) => ((n * 37 + i * 11 + round * 13) % 9) - 4;

const ALIGNED = ['Snapped to an invisible text box', 'Aligned to the slide, not the selection', 'Centred, give or take 3 px', 'Distributed horizontally, vertically and emotionally'];
const FONTED = ['Pasted text kept its source formatting', 'Changed to Calibri (Body), which is Aptos now', 'Replace fonts is greyed out', 'Applied the slide master from 2014'];

export function render(pane, { after, dialog, btn }) {
  let at = 0, turn = 0, aligns = 0, fonts = 0;
  const slide = h('div', { class: 'pp-slide' });
  const count = h('span', { class: 'pp-count' });
  const said = h('span', { class: 'pp-said', role: 'status' });
  const used = h('span', { class: 'pp-font' });
  const thumbs = h('ol', { class: 'pp-thumbs', 'aria-label': 'Slides' });

  // every line in its own font and a few px out of line
  const dress = () => {
    const lines = slide.querySelectorAll('li');
    lines.forEach((li, n) => {
      const [f, g] = fontOf(at, n, fonts);
      li.style.fontFamily = `"${f}", ${g}`;
      if (!li.className) li.style.fontSize = 12 + ((n * 7 + at + fonts) % 5) + 'px';
      li.style.translate = offsetOf(at, n, aligns) + 'px 0';
    });
    const n = new Set([...lines].map(li => li.style.fontFamily)).size;
    used.textContent = `Font: Calibri (Body)${n ? ` +${n} more` : ''}`;
  };

  const show = i => {
    at = i;
    const [title, lines] = SLIDES[i];
    let head;
    if (title) head = h('h2', {}, title);
    else {
      head = h('input', { class: 'pp-title', placeholder: 'Click to add title', 'aria-label': 'Slide title' });
      head.addEventListener('input', () => { head.style.fontSize = titleSize(head.value.length) + 'px'; });
    }
    const line = l => (l.startsWith('photo:') ? h('li', { class: 'pp-photo' }, 'Stock photo: ' + l.slice(6))
      : l.startsWith('tiny:') ? h('li', { class: 'pp-tiny' }, l.slice(5)) : h('li', {}, l));
    slide.replaceChildren(head, h('ul', {}, lines.map(line)));
    dress();
    slide.dataset.t = TRANSITIONS[turn++ % TRANSITIONS.length];
    // restart the animation on every change
    slide.classList.remove('pp-go');
    void slide.offsetWidth;
    slide.classList.add('pp-go');
    count.textContent = `Slide ${i + 1} of ${TOTAL}`;
    thumbs.querySelectorAll('button').forEach((b, n) => b.setAttribute('aria-current', n === i));
  };

  thumbs.append(...SLIDES.map(([t], i) => h('li', {}, h('button', { type: 'button', onclick: () => show(i) }, h('span', {}, i + 1), t || 'Click to add title'))),
    h('li', { class: 'pp-more' }, `…and ${TOTAL - SLIDES.length} more in the appendix`));

  // Align shows its smart guides, at the wrong places, and moves everything somewhere else slightly wrong
  const align = btn('Align centre', () => {
    aligns++;
    dress();
    said.textContent = ALIGNED[(aligns - 1) % ALIGNED.length];
    slide.classList.add('pp-guides');
    after(1200, () => slide.classList.remove('pp-guides'));
  });
  const consistent = btn('Make fonts consistent', () => {
    fonts++;
    dress();
    said.textContent = FONTED[(fonts - 1) % FONTED.length];
  });

  // The ribbon: tabs over a band of tools, taking the space the slide needed
  const RIBBON = ['File', 'Home', 'Insert', 'Draw', 'Design', 'Transitions', 'Animations', 'Slide Show', 'Record', 'Review', 'View', 'Help', 'CopePilot'];
  const ribbon = h('div', { class: 'pp-ribbon', 'aria-hidden': 'true' }, RIBBON.map(t => h('span', {}, t)));

  pane.append(
    ribbon,
    h('div', { class: 'ent-bar' },
      btn('Previous', () => show(Math.max(0, at - 1))),
      btn('Next', () => (at < SLIDES.length - 1 ? show(at + 1) : dialog('The rest is in the appendix', `Slides ${SLIDES.length + 1} to ${TOTAL} are in "Q3 Alignment FINAL v7 (2).pptx". Ask Darren for it.`))),
      count, align, consistent, used,
      btn('Design ideas', () => dialog('Design ideas', 'Have you tried adding more text?')),
      h('span', { class: 'pp-locked' }, 'Transition: random (locked by template)')),
    h('div', { class: 'pp-wrap' }, thumbs,
      h('div', { class: 'pp-work' },
        h('div', { class: 'pp-stage' }, slide),
        h('p', { class: 'pp-zoom' }, said, h('span', {}, 'Zoom: 31% (fit to window)')),
        h('div', { class: 'pp-notes', tabindex: 0, role: 'region', 'aria-label': 'Speaker notes' }, h('b', {}, 'Speaker notes'),
          h('p', {}, "The actual content of this presentation. Nobody will see it, because it didn't fit on the slides."),
          h('p', {}, 'Slide 5: "As you can all clearly see…"')))));
  show(0);
}
