// Browser checks for routing edge cases, Tracker's lifecycle, the reader's own Back and Forward (D8), the window
// switcher popover, sortable list headers and shared layout links (?layout=).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { env, useBrowser, open, win, path, readerTitle, desktop, needs } from './lib.mjs';

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
    a.id = 'f5-pct';
    document.querySelector('.view[data-key="reader"] .rd-body').prepend(a);
  });
  await page.click('#f5-pct');
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
  await page.route('**/about/', async r => {
    if (r.request().resourceType() !== 'fetch') return r.continue();
    await new Promise(res => setTimeout(res, 800));
    await r.abort();
  });
  const n = countLoads(page);
  await page.evaluate(() => { window.deskbar.go('/about/'); });
  await page.evaluate(u => window.deskbar.go(u), posts[0].url);
  await readerIs(page, posts[0].title);
  await page.waitForTimeout(1300);
  assert.equal(n.loads, 0);
  assert.equal(path(page), posts[0].url);
  await page.context().close();
});

test('the same Tracker place chosen again adds no history, and the title follows the place', async () => {
  const { sectionURL, docTitles } = await index();
  const page = await open(desktop, sectionURL);
  const place = win(page, 'tracker').locator('nav.places button[data-k^="tags:"]').first();
  await place.waitFor();
  const n0 = await page.evaluate(() => history.length);
  for (let i = 0; i < 3; i++) await place.click();
  await page.waitForFunction(p => location.pathname !== p, sectionURL);
  assert.equal(await page.evaluate(() => history.length) - n0, 1);
  assert.equal(await page.title(), docTitles[path(page)]);
  await page.context().close();
});

test('closing and reopening Tracker leaves no listener behind', async () => {
  const { sectionURL, posts } = await index();
  const page = await open(desktop, posts[0].url);
  await win(page, 'tracker').locator('a[data-url]').first().waitFor();
  for (let i = 0; i < 3; i++) {
    await win(page, 'tracker').locator('.tab.on .ctl.close').click();
    await win(page, 'tracker').waitFor({ state: 'detached' });
    await page.evaluate(u => window.deskbar.go(u), sectionURL);
    await win(page, 'tracker').locator('a[data-url]').first().waitFor();
  }
  // each live Tracker marks the open post once per post opened, looking it up with CSS.escape
  await page.evaluate(() => { window.__marks = 0; const esc = CSS.escape; CSS.escape = s => { window.__marks++; return esc(s); }; });
  const next = win(page, 'tracker').locator(`a[data-url]:not([data-url="${posts[0].url}"])`).first();
  const title = await next.getAttribute('title');
  await next.click();
  await readerIs(page, title);
  assert.equal(await page.evaluate(() => window.__marks), 1);
  assert.equal(await page.locator('.view.tracker').count(), 1);
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

test('the window switcher is a native popover that redraws while open', async () => {
  const { posts } = await index();
  const page = await open(desktop, posts[0].url);
  await win(page, 'tracker').waitFor();
  const sw = page.locator('#switcher'), tabs = sw.locator('.sw-tab');
  await page.click('#winsBtn');
  await tabs.first().waitFor();
  assert.ok(await sw.evaluate(el => el.matches(':popover-open')));
  // the post's reader and Tracker
  assert.equal(await tabs.count(), 2);
  // on the desktop the switcher is a dock icon and its tabs rise from it, clear of the dock, with the focused
  // window's tab nearest the button and its icon over the button's centre
  const got = await page.evaluate(() => {
    const box = s => document.querySelector(s).getBoundingClientRect();
    const btn = box('#winsBtn'), tabs = [...document.querySelectorAll('#switcher .sw-tab')].map(t => t.getBoundingClientRect());
    return {
      where: document.getElementById('winsBtn').closest('#panel, #dock').id, sw: box('#switcher').bottom, dock: box('#dock').top,
      first: document.querySelector('#switcher .sw-tab').matches('.on'), rising: tabs[0].top > tabs[1].top,
      offset: Math.abs(box('#switcher .sw-tab .ico').x + 8 - (btn.x + btn.width / 2)),
    };
  });
  assert.equal(got.where, 'dock');
  assert.ok(got.sw <= got.dock, `switcher (bottom ${got.sw}) sits above the dock (top ${got.dock})`);
  assert.ok(got.first && got.rising, 'the focused window comes first, at the bottom of the column');
  assert.ok(got.offset <= 2, `tab icons line up over the button (${got.offset}px off)`);
  await sw.locator('.sw-close').first().click();
  await page.waitForFunction(() => document.querySelectorAll('#switcher .sw-tab').length === 1);
  await page.keyboard.press('Escape');
  await sw.waitFor({ state: 'hidden' });
  await page.click('#winsBtn');
  await sw.waitFor();
  await page.mouse.click(700, 500);
  await sw.waitFor({ state: 'hidden' });
  await page.context().close();
});

test('the window switcher works from the keyboard, marks minimised windows and previews on hover', async () => {
  const { posts } = await index();
  const page = await open(desktop, posts[0].url);
  await win(page, 'reader').locator('.rd h1').waitFor();
  await win(page, 'reader').locator('.ctl.min').click();
  const sw = page.locator('#switcher'), label = () => page.evaluate(() => document.activeElement.textContent);
  await page.locator('#winsBtn').focus();
  await page.keyboard.press('Enter');
  await sw.locator('.sw-tab').first().waitFor();
  // the minimised reader follows the open windows and says so; Tracker is first
  const min = sw.locator('.sw-tab.min').first();
  assert.equal(await min.locator('.sw-open span').textContent(), posts[0].title);
  assert.match(await min.locator('.sw-open').getAttribute('aria-label'), /, minimised$/);
  await page.keyboard.press('Tab');
  assert.ok(await page.evaluate(() => document.activeElement.matches('#switcher .sw-tab:first-child .sw-open')));
  // Up climbs the column, then on to the copy link at its top, and wraps round
  const first = await label();
  await page.keyboard.press('ArrowUp');
  assert.equal(await label(), posts[0].title);
  await page.keyboard.press('ArrowUp');
  assert.ok(await page.evaluate(() => document.activeElement.matches('.sw-link')));
  await page.keyboard.press('ArrowUp');
  assert.equal(await label(), first);
  await page.keyboard.press('ArrowDown');
  assert.ok(await page.evaluate(() => document.activeElement.matches('.sw-link')));
  // hovering a tab lifts its window above the others; leaving puts it back
  await sw.locator('.sw-tab').first().hover();
  assert.equal(await page.locator('.win.peek').count(), 1);
  await page.keyboard.press('Escape');
  await sw.waitFor({ state: 'hidden' });
  assert.equal(await page.locator('.win.peek').count(), 0);
  assert.ok(await page.evaluate(() => document.activeElement.id === 'winsBtn'), 'focus returns to the button');
  // choosing the minimised window restores and focuses it
  await page.click('#winsBtn');
  await min.locator('.sw-open').click();
  await sw.waitFor({ state: 'hidden' });
  await page.locator('.win.active .view[data-key="reader"]').waitFor();
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('list view sort headers are keyboard buttons, and aria-sort names the sorted column', async () => {
  const { sectionURL } = await index();
  const page = await open(desktop, sectionURL);
  const tk = win(page, 'tracker');
  await tk.locator('.seg[data-m="list"]').click();
  const sorted = () => tk.locator('th[aria-sort]').evaluateAll(ths => ths.map(t => `${t.dataset.sort} ${t.getAttribute('aria-sort')}`));
  assert.deepEqual(await sorted(), ['date descending']);
  await tk.locator('th[data-sort="title"] button').focus();
  await page.keyboard.press('Enter');
  assert.deepEqual(await sorted(), ['title ascending']);
  await page.keyboard.press('Space');
  assert.deepEqual(await sorted(), ['title descending']);
  // leave the stored view as it was for later tests in this browser
  await tk.locator('.seg[data-m="hybrid"]').click();
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
  const page = await open(desktop, posts[0].url + '?layout=zz,,%%,s500,r/nope-f5/,//x.example/');
  await win(page, 'reader').locator('.rd h1').waitFor();
  await page.waitForTimeout(300);
  assert.equal(new URL(page.url()).search, '');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});
