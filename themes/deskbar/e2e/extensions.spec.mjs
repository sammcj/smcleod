// Extension points and content handling: page scripts, onMounted, reader addons, onPop hooks, odd URLs and
// redirects. Extensions are queued through window.deskbar before the shell starts, as a site script would.
// ALIAS_PATH names an alias URL on the site under test (the example site's is the default). SCRIPT_PAGE and
// SCRIPT_SELECTOR name a site page whose scripts build its content.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { env, useBrowser, open, needs, shot, win, cards, path, desktop } from './lib.mjs';

useBrowser();

const record = () => {
  const log = (window.extLog = []);
  (window.deskbar ||= []).push(api => {
    api.onMounted(({ page, root }) => log.push(['mounted', page.url, root.isConnected]));
    api.addReaderAddon(({ view, page, scroller, win }) => {
      log.push(['addon', page.url, view.key, !!win?.el.isConnected, scroller.classList.contains('scroller')]);
      return () => log.push(['cleanup', page.url]);
    });
    api.addReaderAddon(({ page }) => { log.push(['pages-addon', page.url]); }, { pages: true });
    api.onPop(key => { log.push(['pop', key]); return false; });
  });
};
const logOf = (page, ...types) => page.evaluate(t => window.extLog.filter(e => t.includes(e[0])), types);
const scriptsPage = '/page-scripts/';
const counterView = page => page.locator(`.view[data-key="page:${scriptsPage}"]`);
const libLoads = page => {
  const hits = [];
  page.on('request', r => { if (r.url().endsWith('/js/counter-lib.js')) hits.push(r.url()); });
  return hits;
};

test('page scripts keep their listeners on first load and run once, in order, when routed', async t => {
  if (!(await fetch(env.base + scriptsPage)).ok) return t.skip(`no ${scriptsPage} on this site`);

  // loaded directly: the scripts ran with the page, so they must not run again when the window takes the nodes
  let page = await open(desktop, scriptsPage, record);
  await counterView(page).locator('#counter-btn').click();
  assert.equal(await counterView(page).locator('#counter-out').textContent(), '1', 'listener bound at load survives');
  assert.equal(await counterView(page).locator('#counter-log').textContent(), 'inline, lib, after lib');
  assert.equal(await counterView(page).locator('#counter-ready').textContent(), 'loaded', 'window load listeners still fire');
  assert.deepEqual(await logOf(page, 'mounted'), [['mounted', scriptsPage, true]], 'onMounted sees the initial page');
  assert.deepEqual(await logOf(page, 'addon', 'pages-addon'), [['pages-addon', scriptsPage]], 'page windows get opted-in addons only');
  assert.deepEqual(page.errors, []);
  await page.context().close();

  // routed: DOMParser content, so the shell re-creates the scripts and waits for the external one
  page = await open(desktop, '/', record);
  const hits = libLoads(page);
  await page.evaluate(u => window.deskbar.go(u), scriptsPage);
  await counterView(page).locator('#counter-log').filter({ hasText: 'after lib' }).waitFor();
  assert.equal(await counterView(page).locator('#counter-log').textContent(), 'inline, lib, after lib');
  assert.equal(await counterView(page).locator('#counter-ready').textContent(), 'loaded', 'window load listeners still fire');
  await counterView(page).locator('#counter-btn').click();
  assert.equal(await counterView(page).locator('#counter-out').textContent(), '1');
  assert.equal(hits.length, 1, 'external script loads once');
  assert.deepEqual(await logOf(page, 'mounted'), [['mounted', scriptsPage, true]]);
  await shot(page, 'x1-page-scripts');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('reader addons run after placement and clean up before the next post and on close', async () => {
  const page = await open(desktop, '/', record);
  const first = cards(page).first(), p1 = await first.getAttribute('href');
  await first.click();
  await win(page, 'reader').locator('.rd h1').waitFor();
  const second = win(page, 'tracker').locator(`.pc:not([data-url="${p1}"]), .row:not([data-url="${p1}"])`).first();
  const p2 = await second.getAttribute('data-url');
  await win(page, 'tracker').locator('.pc, .row').first().waitFor();
  await second.click();
  await page.waitForURL(u => u.pathname === p2);
  await win(page, 'reader').locator('.tab.on .ctl.close').click();
  assert.deepEqual(await logOf(page, 'addon', 'cleanup'), [
    ['addon', p1, 'reader', true, true], ['cleanup', p1], ['addon', p2, 'reader', true, true], ['cleanup', p2],
  ]);
  assert.deepEqual((await logOf(page, 'pages-addon')).map(e => e[1]), [p1, p2]);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('onPop hooks form a list: Home keeps its restore and later hooks see other Back steps', async () => {
  const page = await open(desktop, '/', record);
  assert.equal(await page.locator('#homeBtn').getAttribute('role'), 'button');
  const first = cards(page).first(), p1 = await first.getAttribute('href');
  await first.click();
  await win(page, 'tracker').locator('.pc, .row').first().waitFor();
  const second = win(page, 'tracker').locator(`.pc:not([data-url="${p1}"]), .row:not([data-url="${p1}"])`).first();
  const p2 = await second.getAttribute('data-url');
  await second.click();
  await page.waitForURL(u => u.pathname === p2);
  await page.goBack();
  await page.waitForURL(u => u.pathname === p1);
  await win(page, 'reader').locator('.rd h1').waitFor();
  assert.deepEqual(await logOf(page, 'pop'), [['pop', p1]]);

  // Home's hook comes first and handles its own Back, so the site hook is not asked
  await page.click('#homeBtn');
  await page.goBack();
  await page.waitForURL(u => u.pathname === p1);
  assert.ok(await win(page, 'reader').isVisible(), 'Home snapshot restored');
  assert.deepEqual(await logOf(page, 'pop'), [['pop', p1]]);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('the shell starts on a URL with a file extension (a 404 at /missing.php)', async () => {
  const page = await open(desktop, '/missing.php');
  await page.locator('.view[data-key="page:/missing.php"] h1').first().waitFor();
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('a trailing-slash redirect keeps relative images working and records the real URL', async () => {
  const page = await open(desktop, '/');
  const index = await page.evaluate(() => fetch(document.documentElement.dataset.index).then(r => r.json()));
  // the post with the most bundle images is the likeliest to reference them relatively
  const post = index.posts.reduce((m, p) => (p.images > m.images ? p : m));
  await page.evaluate(u => window.deskbar.go(u), post.url.replace(/\/$/, ''));
  await page.waitForURL(u => u.pathname === post.url);
  await win(page, 'reader').locator('.rd h1').waitFor();
  // lazy images may not have loaded yet, so check that every src resolves rather than waiting on them
  const broken = await page.evaluate(async () => {
    const srcs = [...document.querySelectorAll('.view[data-key="reader"] .rd img')].map(i => i.src);
    const ok = await Promise.all(srcs.map(u => fetch(u, { method: 'HEAD' }).then(r => r.ok, () => false)));
    return srcs.filter((_, i) => !ok[i]);
  });
  assert.deepEqual(broken, []);
  await shot(page, 'x2-redirected-images');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('an alias link opens the real page in place, without a full page load', async t => {
  const alias = process.env.ALIAS_PATH || '/old/window-managers/';
  if (!(await needs(t, alias))) return;
  const page = await open(desktop, '/');
  await page.evaluate(href => {
    window.stillHere = true;
    const a = Object.assign(document.createElement('a'), { href, textContent: 'old link', id: 'alias-link' });
    document.querySelector('.tracker .toolbar').append(a);
  }, alias);
  await page.click('#alias-link');
  await win(page, 'reader').locator('.rd h1').waitFor();
  assert.notEqual(path(page), alias);
  assert.equal(await page.evaluate(() => window.stillHere), true, 'same document');
  await page.goBack();
  await page.waitForURL(u => u.pathname === '/');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

// Site-specific: SCRIPT_PAGE names a page whose scripts build its content, SCRIPT_SELECTOR what they build
test('a routed page whose scripts render its content works as it does when loaded directly', async t => {
  const url = process.env.SCRIPT_PAGE, sel = process.env.SCRIPT_SELECTOR || 'input, select';
  if (!url) return t.skip('SCRIPT_PAGE not set');
  const page = await open(desktop, '/');
  await page.evaluate(u => window.deskbar.go(u), url);
  await page.locator(`.view[data-key="page:${url}"] :is(${sel})`).first().waitFor({ state: 'attached' });
  await shot(page, 'x3-script-page-routed');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});
