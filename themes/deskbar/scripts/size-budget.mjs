// Fails when the built shell (theme JS + CSS, gzipped) exceeds the DEV_PLAN budget of 45KB, or any on-demand bundle
// (loader.js: its JS plus CSS) exceeds 12KB.
// Measures the bundles the home page links, since fingerprinted builds from earlier runs linger in the output dir.
// The shell includes the Spotlight code and stylesheet the search button loads on first open (data-module, data-css).
// On-demand bundles are the ones listed in <script id="deskbar-lazy">.
// Usage: node scripts/size-budget.mjs <public dir>
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET = 45 * 1024, LAZY_BUDGET = 12 * 1024;
const root = process.argv[2];
if (!root) {
  console.error('usage: size-budget.mjs <public dir>');
  process.exit(2);
}

const html = readFileSync(join(root, 'index.html'), 'utf8');
const files = [...new Set([...html.matchAll(/(?:src|href|data-module|data-css)="?\/?((?:js|css)\/deskbar[./-][^"\s>]+\.(?:js|css))/g)].map(m => m[1]))];
const want = /data-module=/.test(html) ? 4 : 2;
if (files.length < want) {
  console.error(`expected ${want} deskbar JS and CSS bundles linked from ${root}/index.html, found ${files.length}`);
  process.exit(1);
}

const kb = n => (n / 1024).toFixed(1).padStart(6) + 'KB';
function size(f) {
  const raw = readFileSync(join(root, f)), gz = gzipSync(raw, { level: 9 }).length;
  console.log(`${kb(gz)} gz  ${kb(raw.length)} raw  ${f}`);
  return gz;
}

let failed = false;
console.log('shell:');
const total = files.reduce((sum, f) => sum + size(f), 0);
console.log(`${kb(total)} gz total, budget ${BUDGET / 1024}KB`);
if (total > BUDGET) {
  console.error('shell size budget exceeded');
  failed = true;
}

const map = html.match(/<script[^>]*id="?deskbar-lazy"?[^>]*>([^<]*)<\/script>/);
for (const [name, u] of Object.entries(map ? JSON.parse(map[1]) : {})) {
  console.log(`on demand, ${name}:`);
  const gz = [u.js, u.css].filter(Boolean).reduce((sum, f) => sum + size(f.replace(/^\//, '')), 0);
  console.log(`${kb(gz)} gz total, budget ${LAZY_BUDGET / 1024}KB`);
  if (gz > LAZY_BUDGET) {
    console.error(`${name} size budget exceeded`);
    failed = true;
  }
}
if (failed) process.exit(1);
