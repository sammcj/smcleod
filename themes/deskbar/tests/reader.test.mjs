import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasTeX } from '../assets/js/deskbar/content/math.js';
import { nextWidth, WIDTHS } from '../assets/js/deskbar/settings.js';


test('hasTeX finds the site delimiters and ignores lone dollars', () => {
  assert.ok(hasTeX('inline \\(x^2\\) maths'));
  assert.ok(hasTeX('display \\[ a = b \\]'));
  assert.ok(hasTeX('display $$a = b$$'));
  assert.ok(!hasTeX('costs $5 and $10 a month'));
  assert.ok(!hasTeX('an unclosed \\( bracket'));
  assert.ok(!hasTeX(''));
});

test('reader width cycles narrow, normal, wide and recovers from bad values', () => {
  assert.deepEqual(WIDTHS, ['narrow', 'normal', 'wide']);
  assert.equal(nextWidth('narrow'), 'normal');
  assert.equal(nextWidth('normal'), 'wide');
  assert.equal(nextWidth('wide'), 'narrow');
  assert.equal(nextWidth('bogus'), 'narrow');
});
