// MathJax, loaded from a CDN only for content that needs it: pages with front matter `math: true`
// (page.html marks the article with data-math) or prose containing TeX delimiters. Delimiters match the
// site's earlier setup: \( \) inline, \[ \] and $$ $$ display. A lone $ is never maths, so prices are safe.
import { loadScript } from './cdn.js';

const DELIMS = /\$\$[\s\S]+?\$\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\]/;
export const hasTeX = text => DELIMS.test(text);

// Text outside code, where delimiters are literal
function proseText(root) {
  const skip = 'pre, code, script, style, textarea';
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: n => (n.parentElement?.closest(skip) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  let s = '';
  while (walk.nextNode()) s += walk.currentNode.data;
  return s;
}

let ready = null;
function load() {
  window.MathJax ||= {
    tex: { inlineMath: [['\\(', '\\)']], displayMath: [['\\[', '\\]'], ['$$', '$$']] },
    startup: { typeset: false },
    loader: { load: ['ui/safe'] },
  };
  return (ready ||= loadScript('mathjax').then(() => window.MathJax.startup.promise, err => { ready = null; throw err; }));
}

export function typesetMaths({ root }) {
  if (!root.querySelector('[data-math]') && !hasTeX(proseText(root))) return;
  return load()
    .then(() => root.isConnected && window.MathJax.typesetPromise([root]))
    .catch(err => console.error(err));
}
