// Taxonomy terms that differ only in case or separator share a /tags/<slug>/ page, and Hugo titles it after whichever
// spelling it meets first, so one spelling per term keeps that title stable.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const TAXONOMIES = ['tags', 'categories'];

const unquote = (s) => s.trim().replace(/^(["'])(.*)\1$/, '$2').trim();
const flowItems = (s) => s.replace(/^\s*\[|\]\s*$/g, '').split(',').map(unquote).filter(Boolean);

// Reads the YAML list styles the content uses: `k: [a, b]`, a flow list spread over lines, a `- a` block list, `k: a`
const terms = (md) => {
  const fm = md.match(/^---\n([\s\S]*?\n)---\n/)?.[1];
  const out = Object.fromEntries(TAXONOMIES.map((t) => [t, []]));
  if (!fm) return out;
  const lines = fm.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\w+):\s*(.*)$/);
    if (!m || !TAXONOMIES.includes(m[1])) continue;
    let rest = m[2];
    if (!rest) {
      while (i + 1 < lines.length && /^\s*(#.*)?$/.test(lines[i + 1])) i++;
      if (/^\s*\[/.test(lines[i + 1] ?? '')) rest = lines[++i].trim();
    }
    if (rest.startsWith('[')) {
      while (!rest.includes(']') && i + 1 < lines.length) rest += lines[++i];
      out[m[1]].push(...flowItems(rest));
    } else if (rest) {
      out[m[1]].push(unquote(rest));
    } else {
      for (let b; i + 1 < lines.length && (b = lines[i + 1].match(/^\s*-\s+(.*)$/) ?? lines[i + 1].match(/^\s+#()/)); i++) {
        if (b[1]) out[m[1]].push(unquote(b[1]));
      }
    }
  }
  return out;
};

const key = (t) => t.toLowerCase().replace(/[\s_-]+/g, '-');

test('front matter parser reads each list style', () => {
  const md = `---\ntitle: x\ntags: ["AI", 'llm' ,tech]\ncategories:\n- Software\n  # note\n- "Music"\nkeywords:\n- nope\n---\nbody\ntags: [no]\n`;
  assert.deepEqual(terms(md), { tags: ['AI', 'llm', 'tech'], categories: ['Software', 'Music'] });
  assert.deepEqual(terms(`---\ntags:\n  [\n    'a b',\n    'c',\n  ]\ncategories: Linux\n---\n`), { tags: ['a b', 'c'], categories: ['Linux'] });
});

test('each tag and category has one spelling across content', () => {
  const files = readdirSync(join(root, 'content'), { recursive: true }).filter((f) => f.endsWith('.md'));
  const spellings = {};
  let count = 0;
  for (const f of files) {
    for (const [tax, list] of Object.entries(terms(readFileSync(join(root, 'content', f), 'utf8')))) {
      for (const t of list) {
        count++;
        ((spellings[`${tax}/${key(t)}`] ??= {})[t] ??= []).push(f);
      }
    }
  }
  assert.ok(count > 500, `parsed only ${count} terms`);
  const mixed = Object.entries(spellings).filter(([, s]) => Object.keys(s).length > 1)
    .map(([k, s]) => `${k}: ${Object.entries(s).map(([t, fs]) => `"${t}" (${fs[0]}${fs.length > 1 ? ` +${fs.length - 1}` : ''})`).join(', ')}`);
  assert.deepEqual(mixed, []);
});
