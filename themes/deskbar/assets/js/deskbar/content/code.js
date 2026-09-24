// A copy button on every code block. Chroma wraps highlighted code in .highlight; with line numbers in a
// table there are two <pre>s (numbers, then code), so the text comes from the last <code> in the block.
import { h } from '../lib/dom.js';

const blocks = root => [
  ...root.querySelectorAll('.highlight'),
  ...[...root.querySelectorAll('pre')].filter(p => !p.closest('.highlight') && !p.classList.contains('mermaid')),
];

export function codeText(block) {
  const codes = block.querySelectorAll('code');
  return (codes[codes.length - 1] || block).innerText.replace(/\n$/, '');
}

function flash(btn, text) {
  btn.textContent = text;
  clearTimeout(btn.t);
  btn.t = setTimeout(() => { btn.textContent = 'Copy'; }, 1400);
}

export function copyButtons({ root }) {
  if (!navigator.clipboard) return;
  for (const block of blocks(root)) {
    if (block.querySelector(':scope > .copy')) continue;
    block.classList.add('has-copy');
    const btn = h('button', {
      class: 'copy', type: 'button', 'aria-label': 'Copy code',
      onclick: () => navigator.clipboard.writeText(codeText(block))
        .then(() => flash(btn, 'Copied'), () => flash(btn, 'Copy blocked')),
    }, 'Copy');
    block.append(btn);
  }
}
