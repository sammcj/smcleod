import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');

// CI fetches the theme as a module or submodule rather than the sibling checkout go.mod points at locally, so ask Hugo
const themeDir = () => {
  const mounts = execFileSync('hugo', ['config', 'mounts'], { cwd: fileURLToPath(root), encoding: 'utf8' });
  return mounts.match(/"path": "github\.com\/sammcj\/smcleod\/deskbar",[^}]*?"dir": "([^"]+)"/)[1];
};

// the theme falls back to its doc emblem for an unknown name, so a typo here would quietly show the wrong art
test('every thumbRules emblem exists in the theme', () => {
  const rules = read('hugo.yaml').match(/thumbRules:\n((?: {6}- .*\n)+)/)[1];
  const used = [...rules.matchAll(/emblem: (\w+)/g)].map((m) => m[1]);
  const theme = readFileSync(`${themeDir()}/data/deskbar/emblems.yaml`, 'utf8');
  const names = [...theme.matchAll(/^(\w+):$/gm)].map((m) => m[1]);
  assert.ok(used.length > 10);
  assert.deepEqual(used.filter((n) => !names.includes(n)), []);
});

test('every bespoke thumbnail source is rendered into its post and wired up in front matter', () => {
  const sources = readdirSync(new URL('assets/thumbnails-src/', root)).filter((f) => f.endsWith('.svg'));
  assert.ok(sources.length >= 18);
  for (const f of sources) {
    const b = f.replace(/\.svg$/, '');
    const src = read(`assets/thumbnails-src/${f}`);
    assert.match(src, /data-ground="#\w{6} #\w{6}"/, `${f} needs a ground`);
    for (const out of ['thumbnail.png', 'thumbnail-icon.svg']) assert.ok(existsSync(new URL(`content/posts/${b}/${out}`, root)), `${b}/${out}: run make thumbs`);
    const fm = read(`content/posts/${b}/index.md`).split('\n---')[0];
    assert.match(fm, /^thumbnail: thumbnail\.png$/m, b);
    assert.match(fm, /^thumbnailIcon: thumbnail-icon\.svg$/m, b);
    // without it og:image and JSON-LD pick the first bundle image, the SVG icon, which social sites reject
    assert.match(fm, /^images: \["thumbnail\.png"\]$/m, b);
  }
});
