// The site's starting look (params.deskbar.appearance) should be one of the theme's presets, so the Control panel shows
// it as selected on a first visit. Run: node --test 'tests/*.test.mjs'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { PRESETS, KEYS } from '../themes/deskbar/assets/js/deskbar/lib/appearance.js';

const root = join(import.meta.dirname, '..');

test('the site default look matches a preset', () => {
  // on a fresh checkout Hugo prints "hugo: downloading modules" ahead of the JSON
  const out = execFileSync(process.env.HUGO_BIN || 'hugo', ['config', '--format', 'json'], { cwd: root, encoding: 'utf8' });
  const config = JSON.parse(out.slice(out.indexOf('{')));
  const site = config.params.deskbar.appearance;
  // Keys the site leaves out take the theme defaults, which are the first preset (Deskbar Classic)
  const look = Object.fromEntries(KEYS.map(k => [k, site[k] ?? PRESETS[0][k]]));
  const match = PRESETS.find(p => KEYS.every(k => p[k] === look[k]));
  assert.ok(match, `no preset matches ${JSON.stringify(look)}`);
});
