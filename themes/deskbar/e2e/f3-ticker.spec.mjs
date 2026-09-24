// Related posts ticker (D27): on the desktop it shows as soon as a post opens and a dismissal holds for that post
// only; phones keep the related block at the end of the post instead. POST_PATH names a post with
// related posts on the site under test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { env, useBrowser, open, shot, win, phone } from './lib.mjs';

useBrowser();

const post = process.env.POST_PATH || '/2026/07/window-managers-in-the-browser/';
const exists = async p => (await fetch(env.base + p)).ok;
const scroller = page => win(page, 'reader').locator('.rd-scroll');
const toBottom = page => scroller(page).evaluate(s => { s.scrollTop = s.scrollHeight; });

test('desktop: the ticker shows on open, without scrolling, and a dismissal holds for that post only', async t => {
  if (!(await exists(post))) return t.skip(`no ${post} on this site`);
  // short enough that the post scrolls, so "without scrolling" means something
  const page = await open({ width: 1280, height: 520 }, post);
  const reader = win(page, 'reader');
  const related = await reader.locator('.rd-related a').count();
  if (!related) return t.skip('post has no related posts');
  assert.ok(await scroller(page).evaluate(s => s.scrollHeight > s.clientHeight + 100), 'the post scrolls');

  const ticker = reader.locator('.ticker.in');
  await ticker.waitFor({ timeout: 1500 });
  assert.equal(await scroller(page).evaluate(s => s.scrollTop), 0, 'still at the top');
  assert.equal(await ticker.locator('a').count(), related);
  assert.ok(!(await reader.locator('.rd-related').isVisible()), 'the inline block gives way to the ticker');
  const [tb, sb] = [await ticker.boundingBox(), await scroller(page).boundingBox()];
  assert.ok(sb.y + sb.height <= tb.y + 1, 'the text area ends above the ticker');
  await shot(page, 'ticker-desktop');

  await ticker.locator('.ticker-x').click();
  assert.equal(await reader.locator('.ticker').count(), 0);
  await toBottom(page);
  assert.ok(await reader.locator('.rd-related').isVisible(), 'dismissing brings the inline block back');

  // another post still gets its ticker
  const other = await reader.locator('.rd-related a').first().getAttribute('href');
  await page.evaluate(u => window.deskbar.go(u), other);
  await page.waitForFunction(p => location.pathname === p, other);
  if (await reader.locator('.rd-related a').count()) await reader.locator('.ticker.in').waitFor({ timeout: 1500 });

  // the dismissed post stays dismissed
  await page.goBack();
  await page.waitForFunction(p => location.pathname === p, post);
  await page.waitForTimeout(300);
  assert.equal(await reader.locator('.ticker').count(), 0, 'dismissed for this post');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('phone: no ticker; the related posts wait at the end of the post', async t => {
  if (!(await exists(post))) return t.skip(`no ${post} on this site`);
  const page = await open(phone, post);
  const reader = page.locator('.view[data-key="reader"]');
  const related = reader.locator('.rd-related');
  if (!(await related.locator('a').count())) return t.skip('post has no related posts');
  await related.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  assert.ok(await related.isVisible(), 'the inline block is at the end of the post');
  assert.equal(await reader.locator('.ticker').count(), 0, 'no ticker taking space');
  await shot(page, 'related-phone');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});
