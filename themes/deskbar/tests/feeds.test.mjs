// Feeds app (lazy/feeds.js): the item list's short ages, feed addresses and the initial standing in for a missing icon.
// Parsing and normalising feeds happens at build time in _partials/deskbar/feeds.html, which e2e/feeds.spec.mjs checks against the example site's fixtures.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ago, feedHref, feedOf, initial } from '../assets/js/deskbar/lazy/feeds.js';

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

test("a feed's own address names it, whatever its name holds, and the Feeds page's address names none", () => {
  for (const name of ['Example News', "Simon Willison's Weblog", 'A & B / C?d=1#e', 'Blog – Hackaday']) {
    const href = feedHref('/feeds/', name);
    assert.match(href, /^\/feeds\/\?feed=[^&#/ ]+$/, 'one query parameter, encoded');
    assert.equal(feedOf(href), name);
  }
  assert.equal(feedHref('/feeds/?feed=Old', 'New'), '/feeds/?feed=New', "from another feed's tab");
  assert.equal(feedOf('/feeds/'), '');
  assert.equal(feedOf('/feeds/?utm_source=x'), '');
});

test("a feed without an icon shows its first letter or digit, capitalised", () => {
  assert.equal(initial('the dude abides'), 'T');
  assert.equal(initial('  "ig.nore.me"'), 'I');
  assert.equal(initial('9to5Mac'), '9');
  assert.equal(initial('éclair'), 'É');
  assert.equal(initial('***'), '#');
});
