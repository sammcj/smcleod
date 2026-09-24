// The self-hosted Mermaid that lazy/mermaid.js points at must be vendored under static/ (make vendor-mermaid V=<version>)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { MERMAID } from '../assets/js/deskbar/lazy/mermaid.js';

test('lazy/mermaid.js points at a vendored Mermaid whose imported chunks are all present', () => {
  const entry = join(import.meta.dirname, '../static', MERMAID);
  assert.ok(existsSync(entry), `${entry} is missing`);
  const dir = dirname(entry);
  const imports = file => [...readFileSync(file, 'utf8').matchAll(/["']\.{1,2}\/([\w./-]+\.mjs)["']/g)].map(m => m[1]);
  assert.ok(imports(entry).length > 1, 'the entry imports its chunks');
  for (const c of imports(entry)) assert.ok(existsSync(join(dir, c)), c);
  // chunks import each other by sibling path, including the diagram types loaded on demand
  const chunks = join(dir, 'chunks/mermaid.esm.min');
  for (const f of readdirSync(chunks)) {
    for (const c of imports(join(chunks, f))) assert.ok(existsSync(join(chunks, c)), `${f} imports ${c}`);
  }
});
