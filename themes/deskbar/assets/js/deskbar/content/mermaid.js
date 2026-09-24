// Mermaid diagrams: the renderer (lazy/mermaid.js) loads only when mounted content has a <pre class="mermaid">
import { loadLazy } from '../loader.js';

export const mermaidDiagrams = ({ root }) => root.querySelector('pre.mermaid')
  && loadLazy('mermaid').then(m => m.mermaidDiagrams({ root }), err => console.error('mermaid failed to load', err));
