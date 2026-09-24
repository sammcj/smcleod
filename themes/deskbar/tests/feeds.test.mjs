// Feeds app (lazy/feeds.js): the item list's short ages. Parsing and normalising feeds happens at build time in
// _partials/deskbar/feeds.html, which e2e/feeds.spec.mjs checks against the example site's fixtures.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ago } from '../assets/js/deskbar/lazy/feeds.js';

const now = Date.parse('2026-09-24T12:00:00Z');
const before = s => new Date(now - s * 1000);

test('ages count minutes, hours and days for a week, then give the date', () => {
  assert.equal(ago(before(5), now), '1m', 'under a minute rounds up to one');
  assert.equal(ago(before(59 * 60), now), '59m');
  assert.equal(ago(before(3600), now), '1h');
  assert.equal(ago(before(23 * 3600 + 3599), now), '23h');
  assert.equal(ago(before(86400), now), '1d');
  assert.equal(ago(before(6 * 86400), now), '6d');
  assert.match(ago(before(8 * 86400), now), /^1[56] Sept?$/);
  assert.match(ago(new Date('2025-12-01T12:00:00Z'), now), /^1 Dec 2025$/, 'another year shows the year');
});

test('a date in the future, from a clock that runs fast, counts as just now', () => {
  assert.equal(ago(new Date(now + 3600e3), now), '1m');
});
