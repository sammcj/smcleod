// Feeds (layouts/feeds.html, lazy/feeds.js): opens from the Applications folder, lists items newest first with
// unread counts, previews the selected item with a link out, keeps read state, moves with the arrow keys, folds to
// fewer panes as it narrows and reads without JavaScript. On the example site the items come from local fixtures
// (exampleSite/assets/feeds/), so the build-time parsing is checked exactly; on another site the checks are generic.
// Skips on a site without /feeds/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { env, useBrowser, open, needs, shot, win, desktop, phone } from './lib.mjs';

useBrowser();

const url = '/feeds/';
const fixtures = async () => (await (await fetch(env.base + url)).text()).includes('Example News');

async function openFeeds(viewport = desktop, path = url, ctxOpts) {
  const page = await open(viewport, path, null, ctxOpts);
  const w = win(page, 'feeds');
  await w.locator('.view[data-loaded]').waitFor();
  return { page, w };
}
const count = async loc => Number((await loc.textContent()) || 0);

test('opens from the Applications folder with every item, newest first, all unread', async t => {
  if (!(await needs(t, url, '/tools/'))) return;
  const page = await open(desktop, '/tools/');
  await win(page, 'folder:/tools/').locator(`.folder a[href="${url}"]`).click();
  const w = win(page, 'feeds');
  await w.locator('.view[data-loaded]').waitFor();
  const rows = w.locator('.fd-row');
  const n = await rows.count();
  assert.ok(n > 0, 'items listed');
  const times = await w.locator('.fd-row time').evaluateAll(ts => ts.map(t => Date.parse(t.dateTime)));
  assert.deepEqual(times, [...times].sort((a, b) => b - a), 'newest first');
  assert.equal(await w.locator('.fd-row.unread').count(), n, 'all unread on a first visit');
  const feeds = w.locator('.fd-feed');
  assert.equal(await feeds.first().locator('span').textContent(), 'All items');
  assert.equal(await count(feeds.first().locator('small')), n);
  let sum = 0;
  for (const s of await feeds.locator('small').allTextContents()) sum += Number(s || 0);
  assert.equal(sum, n * 2, 'the feeds add up to All items');
  assert.match(await w.locator('.status').textContent(), new RegExp(`^${n} items?, ${n} unread\\. Fetched `));
  if (await fixtures()) {
    assert.deepEqual(await w.locator('.fd-t').allTextContents(), ['Haiku R1/beta6 released', 'Atom entry one', 'Markup is shown as text',
      'A relative link', 'Atom entry two', 'A long summary', 'Kernel notes', 'Tom & Jerry'], 'RSS and Atom merged; undated and past-perFeed items dropped');
    assert.deepEqual(await feeds.locator('span').allTextContents(), ['All items', 'Example News', 'Example Blog'],
      'OPML order, folders flattened, excluded, failed and empty feeds left out');
    assert.deepEqual(await feeds.locator('small').allTextContents(), ['8', '5', '3']);
    const long = await w.locator('.fd-row', { hasText: 'A long summary' }).locator('.fd-s').textContent();
    assert.ok(long.length <= 283 && long.endsWith('...') && !long.includes('never reach'), 'summaries are capped');
  }
  await shot(page, 'feeds-desktop');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('Refresh lists what the latest build fetched, and says so when it cannot', async t => {
  if (!(await needs(t, url))) return;
  const { page, w } = await openFeeds();
  const n = await w.locator('.fd-row').count();
  // a newer build of the page with one more item, then a failing one
  let fail = false;
  await page.route(/\/feeds\/$/, async route => {
    if (fail) return route.fulfill({ status: 503, body: '' });
    const res = await route.fetch();
    const item = `<li data-feed="Fresh Feed" data-date="${new Date().toISOString()}"><a href="https://example.com/fresh">A fresh item</a></li>`;
    return route.fulfill({ response: res, body: (await res.text()).replace(/<ol[^>]*fd-items[^>]*>/, m => m + item) });
  });
  const refresh = w.locator('.toolbar button', { hasText: 'Refresh' });
  await refresh.click();
  await w.locator('.fd-row').nth(n).waitFor();
  assert.equal(await w.locator('.fd-t').first().textContent(), 'A fresh item', 'newest first');
  assert.ok(await w.locator('.fd-feed', { hasText: 'Fresh Feed' }).count(), 'its feed gets a place in the sidebar');
  assert.match(await w.locator('.status').textContent(), new RegExp(`^${n + 1} items, `));
  assert.ok(await refresh.isEnabled());

  fail = true;
  await refresh.click();
  await assert.doesNotReject(w.locator('.status', { hasText: "Couldn't refresh" }).waitFor());
  assert.equal(await w.locator('.fd-row').count(), n + 1, 'the items on screen stay');
  assert.ok(await refresh.isEnabled());
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('selecting an item previews it, links out in a new tab, and stays read after a reload', async t => {
  if (!(await needs(t, url))) return;
  const { page, w } = await openFeeds();
  const row = w.locator('.fd-row').nth(1);
  const title = await row.locator('.fd-t').textContent();
  const all = w.locator('.fd-feed').first().locator('small');
  const before = await count(all);
  await row.click();
  assert.equal(await row.getAttribute('aria-current'), 'true');
  assert.equal(await w.locator('.fd-pane h2').textContent(), title);
  const link = w.locator('.fd-pane a.fd-open');
  assert.equal(await link.textContent(), 'Open article');
  assert.equal(await link.getAttribute('target'), '_blank');
  assert.match(await link.getAttribute('rel'), /\bnoopener\b/);
  // the same URL the page lists for readers without JavaScript
  const listed = await page.evaluate(async ([u, t]) => {
    const doc = new DOMParser().parseFromString(await (await fetch(u)).text(), 'text/html');
    return [...doc.querySelectorAll('.fd-items a')].find(a => a.textContent === t)?.getAttribute('href');
  }, [url, title]);
  assert.equal(await link.getAttribute('href'), listed);
  assert.match(listed, /^https?:\/\//);
  assert.equal(await row.evaluate(b => b.classList.contains('unread')), false, 'marked read');
  assert.equal(await count(all), before - 1);
  if (await fixtures()) {
    assert.equal(await link.getAttribute('href'), 'https://blog.example.org/one/', 'Atom rel=alternate, not the enclosure');
    assert.equal(await w.locator('.fd-pane .fd-sum').textContent(), 'First entry.', 'HTML summary as plain text');
    await w.locator('.fd-row', { hasText: 'A relative link' }).click();
    assert.equal(await link.getAttribute('href'), 'https://news.example.org/2026/09/relative/', 'relative links resolve against the site');
  }
  await page.reload();
  await page.waitForSelector('html.wm-ready');
  await w.locator('.view[data-loaded]').waitFor();
  assert.equal(await w.locator('.fd-row', { hasText: title }).first().evaluate(b => b.classList.contains('unread')), false, 'read state persists');
  await w.getByRole('button', { name: 'Mark all as read' }).click();
  assert.equal(await w.locator('.fd-row.unread').count(), 0);
  assert.equal(await count(all), 0);
  assert.equal(await w.getByRole('button', { name: 'Mark all as read' }).isDisabled(), true);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('arrow keys, Home and End move through the items and the preview follows', async t => {
  if (!(await needs(t, url))) return;
  const { page, w } = await openFeeds();
  const rows = w.locator('.fd-row');
  const n = await rows.count();
  if (n < 3) return t.skip('fewer than three items');
  await rows.first().click();
  await page.keyboard.press('ArrowDown');
  assert.equal(await rows.nth(1).getAttribute('aria-current'), 'true');
  assert.equal(await rows.nth(1).evaluate(b => b === document.activeElement), true, 'focus moves with the selection');
  assert.equal(await w.locator('.fd-pane h2').textContent(), await rows.nth(1).locator('.fd-t').textContent());
  assert.equal(await w.locator('.fd-row[tabindex="0"]').count(), 1, 'one tab stop in the list');
  await page.keyboard.press('End');
  assert.equal(await rows.nth(n - 1).getAttribute('aria-current'), 'true');
  await page.keyboard.press('ArrowUp');
  assert.equal(await rows.nth(n - 2).getAttribute('aria-current'), 'true');
  await page.keyboard.press('Home');
  assert.equal(await rows.first().getAttribute('aria-current'), 'true');
  assert.equal(await w.locator('.fd-row[aria-current]').count(), 1);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('a feed in the sidebar shows only its items', async t => {
  if (!(await needs(t, url))) return;
  const { page, w } = await openFeeds();
  const feed = w.locator('.fd-feed').filter({ has: page.locator('small:not(:empty)') }).nth(1);
  const name = await feed.locator('span').textContent(), n = await count(feed.locator('small'));
  await feed.click();
  assert.equal(await feed.getAttribute('aria-current'), 'true');
  assert.deepEqual(new Set(await w.locator('.fd-m span').allTextContents()), new Set([name]));
  assert.equal(await w.locator('.fd-row').count(), n);
  assert.match(await w.locator('.status').textContent(), new RegExp(`^${n} items?, ${n} unread`));
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('feed markup is shown as text, never run', async t => {
  if (!(await needs(t, url)) || !(await fixtures())) return t.skip('needs the example fixtures');
  const { page, w } = await openFeeds();
  await w.locator('.fd-row', { hasText: 'Markup is shown as text' }).click();
  assert.equal(await w.locator('.fd-pane .fd-sum').textContent(), 'Write <img src=x onerror=alert(1)> in a post.');
  await w.locator('.fd-row', { hasText: 'Haiku R1/beta6 released' }).click();
  assert.equal(await w.locator('.fd-pane .fd-sum').textContent(), 'Release notes & downloads.', 'script bodies are dropped');
  assert.equal(await w.locator('.view img, .view script').count(), 0);
  assert.notEqual(await page.title(), 'pwned');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('a narrower window swaps the sidebar for a menu, and a phone shows one pane at a time', async t => {
  if (!(await needs(t, url))) return;
  let { page, w } = await openFeeds();
  await w.evaluate(el => { el.style.width = '640px'; });
  assert.equal(await w.locator('.fd-side').isVisible(), false);
  assert.equal(await w.locator('.fd-sel').isVisible(), true);
  assert.equal(await w.locator('.fd-list').isVisible(), true);
  assert.equal(await w.locator('.fd-pane').isVisible(), true);
  const second = await w.locator('.fd-sel option').nth(1).getAttribute('value');
  await w.locator('.fd-sel').selectOption(second);
  assert.deepEqual(new Set(await w.locator('.fd-m span').allTextContents()), new Set([second]));
  await page.context().close();

  ({ page, w } = await openFeeds(phone, url, { hasTouch: true, isMobile: true }));
  const vw = await page.evaluate(() => innerWidth);
  const box = await w.boundingBox();
  assert.ok(box.width >= vw - 2, 'full screen on a phone');
  assert.equal(await w.locator('.fd-pane').isVisible(), false);
  const row = w.locator('.fd-row').first();
  const title = await row.locator('.fd-t').textContent();
  await row.tap();
  assert.equal(await w.locator('.fd-list').isVisible(), false);
  assert.equal(await w.locator('.fd-pane h2').textContent(), title);
  assert.equal(await w.locator('.fd-pane h2').evaluate(e => e === document.activeElement), true, 'focus moves to the item');
  assert.equal(await w.locator('.fd-open').isVisible(), true);
  await shot(page, 'feeds-phone-item');
  await w.getByRole('button', { name: 'Items' }).tap();
  assert.equal(await w.locator('.fd-list').isVisible(), true);
  assert.equal(await row.evaluate(e => e === document.activeElement), true, 'focus returns to the item in the list');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no sideways scroll');
  await shot(page, 'feeds-phone-list');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('without JavaScript the Feeds page lists the latest items and the feeds', async t => {
  if (!(await needs(t, url))) return;
  const ctx = await env.browser.newContext({ viewport: desktop, javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto(env.base + url);
  const links = page.locator('#content .fd-items li h3 a');
  assert.ok((await links.count()) > 0);
  assert.ok(await links.first().isVisible());
  for (const href of await links.evaluateAll(as => as.map(a => a.getAttribute('href')))) assert.match(href, /^https?:\/\//);
  assert.ok((await page.locator('#content .fd-feeds li').count()) > 0);
  if (await fixtures()) assert.equal(await page.locator('.fd-feeds li', { hasText: 'Offline Feed' }).count(), 0, 'a feed with nothing to show is left out');
  await ctx.close();
});
