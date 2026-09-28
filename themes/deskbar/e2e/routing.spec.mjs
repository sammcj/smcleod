// Routing in the browser: edge cases, history entries for Tracker places, the reader's own Back and Forward (D8)
// and shared layout links (?layout=).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { env, useBrowser, open, win, path, readerTitle, desktop, needs, widePosts } from './lib.mjs';

useBrowser();

// The shell's own post index, for addresses that exist on whichever site is under test
let idx = null;
const index = async () => (idx ||= await (await fetch(env.base + '/deskbar.json')).json());

// Counts full page loads after the first, which the shell should never cause
function countLoads(page) {
  const n = { loads: 0 };
  page.on('load', () => n.loads++);
  return n;
}

const readerIs = (page, title) => page.waitForFunction(t => document.querySelector('.view[data-key="reader"] .rd h1')?.textContent === t, title);

test('a malformed % in the hash still boots the desktop, and links keep routing inside it', async () => {
  const { posts } = await index();
  const page = await open(desktop, posts[0].url + '#100%');
  await win(page, 'reader').locator('.rd h1').waitFor();
  const n = countLoads(page);
  // a same-page link with a stray % as well
  await page.evaluate(() => {
    const a = Object.assign(document.createElement('a'), { href: '#50%', textContent: 'fifty' });
    a.id = 'pct-link';
    document.querySelector('.view[data-key="reader"] .rd-body').prepend(a);
  });
  await page.click('#pct-link');
  await page.evaluate(u => window.deskbar.go(u), posts[1].url);
  await page.waitForURL(u => u.pathname === posts[1].url);
  await readerIs(page, posts[1].title);
  assert.equal(n.loads, 0, 'no full page load');
  assert.ok(await page.evaluate(() => document.documentElement.classList.contains('wm-ready')));
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('a failed navigation that finishes after a newer one does not load its page over the desktop', async t => {
  if (!(await needs(t, '/about/'))) return;
  const { posts } = await index();
  const page = await open(desktop, '/');
  // the /about/ fetch is held until the newer navigation has shown its post, then fails
  let release;
  const held = new Promise(res => { release = res; });
  await page.route('**/about/', async r => {
    if (r.request().resourceType() !== 'fetch') return r.continue();
    await held;
    await r.abort();
  });
  const n = countLoads(page);
  await page.evaluate(() => {
    addEventListener('beforeunload', () => { window.__leaving = true; });
    window.__slow = window.deskbar.go('/about/');
  });
  await page.evaluate(u => window.deskbar.go(u), posts[0].url);
  await readerIs(page, posts[0].title);
  release();
  // go() settles once the router has dealt with the failure, which is when a full load would start
  await page.evaluate(() => window.__slow);
  assert.equal(await page.evaluate(() => window.__leaving), undefined, 'no full page load begins');
  assert.equal(n.loads, 0);
  assert.equal(path(page), posts[0].url);
  await page.context().close();
});

test('the same Tracker place chosen again adds no history, and the title follows the place', async () => {
  const { sectionURL, docTitles } = await index();
  const page = await open(desktop, sectionURL);
  await widePosts(page);
  const place = win(page, 'tracker').locator('nav.places button[data-k^="tags:"]').first();
  await place.waitFor();
  const n0 = await page.evaluate(() => history.length);
  for (let i = 0; i < 3; i++) await place.click();
  await page.waitForFunction(p => location.pathname !== p, sectionURL);
  assert.equal(await page.evaluate(() => history.length) - n0, 1);
  assert.equal(await page.title(), docTitles[path(page)]);
  await page.context().close();
});

test('D8: reader Back and Forward walk the posts the reader showed, not other windows', async () => {
  const { posts } = await index();
  const page = await open(desktop, posts[0].url);
  const back = win(page, 'reader').locator('.tb.nav[aria-label="Back"]'), fwd = win(page, 'reader').locator('.tb.nav[aria-label="Forward"]');
  await win(page, 'reader').locator('.rd h1').waitFor();
  assert.ok(await back.isDisabled() && await fwd.isDisabled(), 'nothing to go back to yet');
  await page.evaluate(u => window.deskbar.go(u), posts[1].url);
  await readerIs(page, posts[1].title);
  // a Tracker place moves the address bar but is not part of the reader's history. Snapped to a quarter, Tracker
  // offers its places as a menu.
  const sel = win(page, 'tracker').locator('select.place-sel');
  await sel.selectOption(await sel.evaluate(s => [...s.options].find(o => o.value.startsWith('tags:')).value));
  await page.waitForFunction(u => location.pathname !== u, posts[1].url);
  const place = await win(page, 'tracker').getAttribute('aria-label');
  await back.click();
  await readerIs(page, posts[0].title);
  assert.equal(path(page), posts[0].url);
  assert.equal(await win(page, 'tracker').getAttribute('aria-label'), place, 'Tracker stays where it was');
  assert.ok(await back.isDisabled() && await fwd.isEnabled());
  await fwd.click();
  await readerIs(page, posts[1].title);
  assert.ok(await fwd.isDisabled() && await back.isEnabled());
  // browser Back still walks the whole history, and the reader buttons follow
  await page.goBack();
  await readerIs(page, posts[0].title);
  assert.ok(await back.isDisabled());
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

// Rect of the window showing a view, in desk-relative fractions
const frac = (page, key) => page.evaluate(k => {
  const d = document.getElementById('desk').getBoundingClientRect();
  const r = document.querySelector(`.win:not([hidden]) .view[data-key="${k}"]:not([hidden])`)?.closest('.win').getBoundingClientRect();
  return r && { x: (r.x - d.x) / d.width, w: r.width / d.width };
}, key);

test('a copied layout link reopens the same windows and snaps, then leaves a clean address', async t => {
  if (!(await needs(t, '/about/'))) return;
  const { posts } = await index();
  const page = await open(desktop, posts[0].url);
  await win(page, 'tracker').locator('a[data-url]').first().waitFor();
  await page.evaluate(() => window.deskbar.go('/about/'));
  await win(page, 'page:/about/').waitFor();
  await page.evaluate(() => { navigator.clipboard.writeText = s => { window.__copied = s; return Promise.resolve(); }; });
  await page.click('#winsBtn');
  await page.click('#switcher .sw-link');
  await page.waitForFunction(() => window.__copied);
  const link = await page.evaluate(() => window.__copied);
  const u = new URL(link);
  assert.equal(u.pathname, '/about/', 'the address names the page on top');
  assert.match(u.searchParams.get('layout'), /^s25,/);
  await page.context().close();

  const again = await open(desktop, u.pathname + u.search);
  await win(again, 'reader').locator('.rd h1').waitFor();
  await win(again, 'page:/about/').waitFor();
  await again.waitForFunction(() => document.querySelector('.win.active .view[data-key="page:/about/"]'));
  assert.equal(new URL(again.url()).search, '', 'the layout parameter is dropped from the address');
  assert.equal(path(again), '/about/');
  assert.equal(await readerTitle(again), posts[0].title);
  const tr = await frac(again, 'tracker'), rd = await frac(again, 'reader');
  assert.ok(tr.x < 0.02 && Math.abs(tr.w - 0.25) < 0.03, `Tracker snapped left at a quarter (${JSON.stringify(tr)})`);
  assert.ok(Math.abs(rd.x + rd.w - 1) < 0.02 && Math.abs(rd.w - 0.75) < 0.03, `reader snapped right (${JSON.stringify(rd)})`);
  assert.deepEqual(again.errors, []);
  await again.context().close();
});

test('a layout closes windows it does not list, such as the reading layout\'s Tracker', async () => {
  const { posts } = await index();
  const page = await open(desktop, `${posts[0].url}?layout=m${posts[0].url}`);
  await page.waitForFunction(() => document.querySelectorAll('.win').length === 1 && !document.querySelector('.view[data-key="tracker"]'));
  const rd = await frac(page, 'reader');
  assert.ok(rd.x < 0.02 && rd.w > 0.97, `reader maximised (${JSON.stringify(rd)})`);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('a malformed layout parameter is ignored', async () => {
  const { posts } = await index();
  const page = await open(desktop, posts[0].url + '?layout=zz,,%%,s500,r/nope/,//x.example/');
  await win(page, 'reader').locator('.rd h1').waitFor();
  await page.waitForFunction(() => location.search === '');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});
