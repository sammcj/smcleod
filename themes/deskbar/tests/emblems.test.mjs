import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// thumb-art.html looks emblems up by name and silently falls back to doc, so a typo in a rule shows the wrong art
const yaml = readFileSync(new URL('../data/deskbar/emblems.yaml', import.meta.url), 'utf8');
const art = readFileSync(new URL('../layouts/_partials/deskbar/thumb-art.html', import.meta.url), 'utf8');
const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const names = [...yaml.matchAll(/^(\w+):$/gm)].map(m => m[1]);

test('every default thumbnail rule names an emblem, and doc (the fallback) exists', () => {
  const used = [...art.matchAll(/"emblem" "(\w+)"/g)].map(m => m[1]);
  assert.ok(used.length > 10);
  assert.deepEqual(used.filter(n => !names.includes(n)), []);
  assert.ok(names.includes('doc'));
});

test('every emblem has defs and a body, uses only the documented classes and no ids the card uses', () => {
  const blocks = yaml.split(/^(?=\w+:$)/m).slice(1);
  assert.equal(blocks.length, names.length);
  for (const b of blocks) {
    const name = b.slice(0, b.indexOf(':'));
    assert.match(b, /^ {2}defs: /m, name);
    assert.match(b, /^ {2}body: \|-$/m, name);
    const classes = [...b.matchAll(/class="([^"]+)"/g)].flatMap(m => m[1].split(' '));
    assert.deepEqual(classes.filter(c => !['o', 't', 'o3', 'o5', 'd'].includes(c)), [], name);
    assert.ok(!/id="(bg|sh)"/.test(b), `${name} reuses a card id`);
    // a url(#x) without its gradient renders as no fill, and an unreferenced gradient is dead weight in every page's art
    const ids = [...b.matchAll(/id="(\w+)"/g)].map(m => m[1]);
    const refs = [...b.matchAll(/url\(#(\w+)\)/g)].map(m => m[1]);
    assert.deepEqual(refs.filter(r => !ids.includes(r)), [], `${name} references a missing gradient`);
    assert.deepEqual(ids.filter(i => !refs.includes(i)), [], `${name} has an unused gradient`);
  }
});

test('the README lists every emblem', () => {
  const listed = readme.match(/Emblems: `([^`]+)`/)[1].split(' ');
  assert.deepEqual(listed.toSorted(), names.toSorted());
});
