// Apps loaded on first open (loader.js), through the example site's About this desktop app (lazy/about-desktop.js).
// Skips on a site without /about-desktop/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useBrowser, open, needs, shot, win, path, desktop } from './lib.mjs';

useBrowser();

const about = '/about-desktop/';
const bundle = /\/js\/deskbar-lazy\/about-desktop\.[^/]*\.js$/;
const loads = page => page.evaluate(() => performance.getEntriesByType('resource').filter(e => e.name.includes('/js/deskbar-lazy/about-desktop.')).length);
const go = (page, u) => page.evaluate(u => window.deskbar.go(u), u);
const facts = page => win(page, 'about-desktop').locator('.about-facts');

test('an on-demand app loads only when opened, then survives routing and Back/Forward', async t => {
  if (!(await needs(t, about))) return;
  const page = await open(desktop, '/');
  assert.equal(await loads(page), 0, 'bundle not loaded before the app opens');

  await go(page, about);
  await facts(page).waitFor();
  assert.equal(path(page), about);
  assert.match(await facts(page).textContent(), /Hugo \d/);
  await facts(page).locator('dd', { hasText: /KB gzipped, in \d files/ }).waitFor();
  assert.match(await facts(page).textContent(), /about-desktop loaded/);
  assert.match(await facts(page).locator('summary').textContent(), /^\d+ bundles, [1-9]\d* loaded so far$/, 'the bundle list folded to a count');
  assert.equal(await facts(page).locator('details').getAttribute('open'), null);
  assert.ok(await win(page, 'about-desktop').evaluate(v => {
    const credits = [...v.querySelectorAll('.rd h2')].find(e => e.textContent.includes('Credits'));
    return !!(credits && credits.compareDocumentPosition(v.querySelector('.about-facts')) & Node.DOCUMENT_POSITION_FOLLOWING);
  }), 'the facts follow the page text');
  const keys = win(page, 'about-desktop').locator('.about-keys');
  assert.deepEqual(await keys.locator('h3').allTextContents(), ['Anywhere', 'Tracker and posts', 'Windows, Photos and folders'], "the ? key's groups");
  assert.ok(await keys.locator('dt kbd', { hasText: /^\?$/ }).count(), 'the ? key itself is listed');
  assert.equal(await win(page, 'about-desktop').locator('.lazy-note').count(), 0);
  assert.equal(await win(page, 'about-desktop').locator('.view').getAttribute('aria-busy'), null);
  await shot(page, 'lazy-about-desktop');

  await go(page, '/about/');
  await page.waitForURL(u => u.pathname === '/about/');
  await page.goBack();
  await page.waitForURL(u => u.pathname === about);
  await facts(page).waitFor();
  assert.equal(await facts(page).count(), 1, 'Back shows the same window, mounted once');
  await page.goForward();
  await page.waitForURL(u => u.pathname === '/about/');
  assert.equal(await loads(page), 1, 'bundle fetched once');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('an on-demand app works as the first page loaded', async t => {
  if (!(await needs(t, about))) return;
  const page = await open(desktop, about);
  await facts(page).waitFor();
  assert.equal(await win(page, 'about-desktop').locator('.rd h2', { hasText: 'Credits' }).count(), 1, 'first page content kept');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('About this desktop lists loaded bundles once the Resource Timing buffer is full', async t => {
  if (!(await needs(t, about))) return;
  const page = await open(desktop, '/', () => performance.setResourceTimingBufferSize(1));
  await go(page, about);
  await facts(page).waitFor();
  assert.match(await facts(page).textContent(), /about-desktop loaded/);
  await page.context().close();
});

test('an on-demand app shows its loading state, a readable error if loading fails, and retries', async t => {
  if (!(await needs(t, about))) return;
  const page = await open(desktop, '/');
  let release;
  const held = new Promise(r => { release = r; });
  await page.route(bundle, async route => { await held; await route.abort(); });

  await go(page, about);
  const note = win(page, 'about-desktop').locator('.lazy-note');
  await note.filter({ hasText: 'Loading' }).waitFor();
  assert.equal(await note.getAttribute('role'), 'status');
  assert.equal(await win(page, 'about-desktop').locator('.view').getAttribute('aria-busy'), 'true');

  release();
  await note.filter({ hasText: "didn't load" }).waitFor();
  assert.equal(await note.getAttribute('role'), 'alert');
  assert.equal(await win(page, 'about-desktop').locator('.view').getAttribute('aria-busy'), null);

  await page.unroute(bundle);
  await go(page, '/about/');
  await go(page, about);
  await facts(page).waitFor();
  assert.equal(await note.count(), 0, 'error cleared on retry');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});
