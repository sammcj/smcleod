// Browser checks for navigation: Tracker views and places, search, the menu, the tray and find in post.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useBrowser, open, needs, shot, win, cards, path, readerTitle, desktop, phone } from './lib.mjs';

// example site pages the example-only tests assert on
const jsPost = '/2025/11/keeping-javascript-small/', haikuPost = '/2024/03/notes-on-haikus-window-tabs/';

useBrowser();

const view = (tk, m) => tk.locator(`.seg[data-m="${m}"]`).click();
const tabTitle = (page, key) => win(page, key).locator('.tab.on .tt').textContent();

test('Tracker: hybrid, list and icon views, wide and snapped narrow, one click opens', async t => {
  if (!(await needs(t, jsPost, haikuPost))) return;
  const page = await open(desktop, '/posts/');
  const tk = win(page, 'tracker');
  await tk.locator('.pc').first().waitFor();
  assert.equal(await tk.locator('.pc').count(), 4, 'the example site has four posts, all in Latest');
  await shot(page, 'tracker-hybrid-wide');
  await view(tk, 'list');
  assert.equal(await tk.locator('table.list tbody tr').count(), 4);
  await shot(page, 'tracker-list-wide');
  await view(tk, 'icons');
  assert.equal(await tk.locator('.grid .gi').count(), 4);
  assert.ok(await tk.locator('.places').isVisible(), 'wide Tracker shows the places sidebar');
  await shot(page, 'tracker-icons-wide');

  // D3/D4 and D7: a single click on an icon opens the post and snaps Tracker to the narrow quarter
  const first = tk.locator('.gi').first(), url = await first.getAttribute('href');
  await first.click();
  await page.waitForURL(u => u.pathname === url);
  await win(page, 'reader').locator('.rd h1').waitFor();
  assert.ok(await tk.locator('.gi.open').count(), 'the open post is marked');
  assert.ok(await tk.locator('.places').isHidden(), 'narrow Tracker swaps the sidebar for a picker');
  assert.ok(await tk.locator('.place-sel').isVisible());
  await shot(page, 'tracker-icons-narrow');
  await view(tk, 'list');
  await shot(page, 'tracker-list-narrow');
  await view(tk, 'hybrid');
  await shot(page, 'tracker-hybrid-narrow');
  assert.deepEqual(page.errors, []);
});

test('thumbnails: front matter thumbnail, then cover, then generated art; rows show mini icons', async t => {
  if (!(await needs(t, jsPost, haikuPost, '/tags/design/'))) return;
  const page = await open(desktop, '/posts/');
  const tk = win(page, 'tracker');
  await tk.locator('.pc img').first().waitFor();
  const loaded = loc => loc.evaluateAll(els => Promise.all(els.map(e => e.decode().then(() => e.naturalWidth > 0, () => false))));
  const cards = tk.locator('.pc .pc-img');
  const srcs = await cards.evaluateAll(els => els.map(e => e.getAttribute('src')));
  assert.equal(srcs.length, await tk.locator('.pc').count(), 'every card has an image');
  assert.ok(!(await loaded(cards)).includes(false), 'every card image loads');
  const byTitle = Object.fromEntries(await tk.locator('.pc').evaluateAll(els => els.map(e => [e.title, e.querySelector('img').getAttribute('src')])));
  assert.match(byTitle['Keeping JavaScript small'], /photo-2_hu/, 'thumbnail wins, processed to size');
  assert.match(byTitle["Notes on Haiku's window tabs"], /^\/deskbar\/art\/\w+\.svg$/, 'no image: generated art');
  assert.equal(new Set(srcs).size, srcs.length, 'no two posts share a thumbnail');

  await page.goto(page.url().replace(/\/posts\/$/, '/tags/design/'));
  await page.waitForSelector('html.wm-ready');
  await tk.locator('.row').first().waitFor();
  const minis = tk.locator('.row img.tico');
  assert.equal(await minis.count(), await tk.locator('.row').count(), 'every post row has a mini icon');
  assert.ok(!(await loaded(minis)).includes(false), 'every mini icon loads');
  await shot(page, 'tracker-rows-mini');
  assert.deepEqual(page.errors, []);
});

test('Tracker: tag and taxonomy pages are Tracker places; menu apps are linked from the sidebar', async t => {
  if (!(await needs(t, '/tags/design/', '/blog/category/engineering/', '/blog/category/retro/'))) return;
  const page = await open(desktop, '/tags/design/');
  const tk = win(page, 'tracker');
  await tk.locator('.pc, .row').first().waitFor();
  assert.equal(await tabTitle(page, 'tracker'), '~/tags/design');
  assert.equal(await tk.locator('.row').count(), 2);
  assert.equal(await page.locator('.view[data-key="reader"]').count(), 0, 'a tag page is not shown in the reader');
  await shot(page, 'tracker-tag-page');

  await tk.locator('.places button[data-k="tax:tags"]').click();
  await page.waitForURL(u => u.pathname === '/tags/');
  assert.equal(await tabTitle(page, 'tracker'), '~/tags');
  assert.equal(await tk.locator('.row').count(), 5, 'one folder per tag');

  // category term pages live at /blog/category/:slug/ while the list page is /categories/
  await page.goto(page.url().replace(/\/tags\/$/, '/blog/category/engineering/'));
  await page.waitForSelector('html.wm-ready');
  await tk.locator('.row').first().waitFor();
  assert.equal(await tabTitle(page, 'tracker'), '~/categories/Engineering');
  assert.deepEqual(await tk.locator('.row .row-t').allTextContents(), ['Window managers in the browser', "Notes on Haiku's window tabs"]);
  assert.ok(await tk.locator('.places button[data-k="categories:Engineering"].on').count(), 'the sidebar marks the category');
  await shot(page, 'tracker-category-page');
  await tk.locator('.places button[data-k="tax:categories"]').click();
  await page.waitForURL(u => u.pathname === '/categories/');
  assert.deepEqual(await tk.locator('.row .row-t').allTextContents(), ['Engineering', 'Retro']);
  await tk.locator('.row', { hasText: 'Retro' }).click();
  await page.waitForURL(u => u.pathname === '/blog/category/retro/');
  assert.deepEqual(await tk.locator('.row .row-t').allTextContents(), ["Notes on Haiku's window tabs"]);

  // menu groups with an app page link to it
  await tk.locator('.places button[data-k="app:Photos"]').click();
  await page.waitForURL(u => u.pathname === '/photos/');
  assert.deepEqual(page.errors, []);
});

test('Tracker: a menu group whose app page is missing lists its entries in place', async t => {
  if (!(await needs(t, '/tools/demo/', '/colours/'))) return;
  // what a site sees before it builds /tools/: the menu has no "Open Tools" entry
  const page = await open(desktop, '/posts/', () => document.addEventListener('readystatechange', () => {
    document.querySelector('#menu .mn-sec[data-group="Tools"] .mn-app')?.remove();
  }, { once: true }));
  const tk = win(page, 'tracker');
  await tk.locator('.places button[data-k="grp:Tools"]').click();
  assert.deepEqual(await tk.locator('.row .row-t').allTextContents(), ['Demo tool', 'Colour table']);
  assert.equal(await tabTitle(page, 'tracker'), '~/tools');
  assert.equal(await tk.locator('.places button[data-k="app:Tools"]').count(), 0);
  assert.deepEqual(page.errors, []);
});

test('search: Tracker ranks compact rows; the menu searches posts and entries and hands off to Tracker', async t => {
  if (!(await needs(t, jsPost, haikuPost))) return;
  const page = await open(desktop, '/posts/');
  const tk = win(page, 'tracker');
  await tk.locator('.pc').first().waitFor();
  await tk.locator('.toolbar input[type=search]').fill('window');
  await tk.locator('.row').first().waitFor();
  // title matches rank above the post that only mentions windows in its description
  assert.deepEqual(await tk.locator('.row .row-t').allTextContents(),
    ["Notes on Haiku's window tabs", 'Window managers in the browser', 'Static sites with real URLs']);
  assert.match(await tk.locator('.status').textContent(), /3 items matching "window"/);
  await shot(page, 'tracker-search');

  await page.locator('#menuBtn').click();
  const menu = page.locator('#menu');
  assert.ok(await menu.evaluate(m => m.matches(':popover-open')));
  // the toggle event that focuses search is queued, and only a fine pointer gets focus (no phone keyboard pop-up)
  if (await page.evaluate(() => matchMedia('(pointer: fine)').matches)) await page.waitForFunction(() => document.activeElement.id === 'mnQ');
  await menu.locator('.mn-cats button', { hasText: 'Pages' }).hover();
  assert.ok(await menu.locator('.mn-sec[data-group="Pages"]').isVisible());
  assert.ok(await menu.locator('.mn-sec[data-group="Writing"]').isHidden());
  await shot(page, 'menu-open');
  await page.locator('#mnQ').fill('about');
  assert.deepEqual(await menu.locator('.mn-res .mn-it .lbl').first().textContent(), 'About');
  await page.locator('#mnQ').fill('static');
  await menu.locator('.mn-res .mn-posts .mn-it').first().waitFor();
  await shot(page, 'menu-search');
  await menu.locator('.mn-more').click();
  assert.ok(!(await menu.evaluate(m => m.matches(':popover-open'))), 'the menu closes');
  assert.equal(await tabTitle(page, 'tracker'), 'Find: static');

  await page.locator('#menuBtn').click();
  assert.equal(await page.locator('#mnQ').inputValue(), '', 'search clears when the menu closes');
  await page.locator('#mnQ').fill('javascript');
  await menu.locator('.mn-posts .mn-it').first().click();
  await page.waitForURL(u => u.pathname === '/2025/11/keeping-javascript-small/');
  assert.equal(await readerTitle(page), 'Keeping JavaScript small');
  assert.deepEqual(page.errors, []);
});

test('tray and find in post', async t => {
  if (!(await needs(t, '/2026/07/window-managers-in-the-browser/'))) return;
  const page = await open(desktop, '/2026/07/window-managers-in-the-browser/');
  const tray = page.locator('#tray a');
  assert.deepEqual(await tray.evaluateAll(as => as.map(a => a.getAttribute('aria-label'))), ['GitHub', 'RSS feed']);
  assert.equal(await tray.last().getAttribute('href'), '/index.xml');

  const rd = win(page, 'reader');
  await rd.locator('.rd h1').waitFor();
  await rd.locator('.fd-btn').click();
  await rd.locator('.findbar input').fill('window');
  await page.waitForFunction(() => CSS.highlights.get('deskbar-find')?.size > 1);
  assert.match(await rd.locator('.fd-n').textContent(), /^1 of \d+$/);
  await rd.locator('.findbar input').press('Enter');
  assert.match(await rd.locator('.fd-n').textContent(), /^2 of \d+$/);
  await shot(page, 'find-in-post');
  await rd.locator('.findbar input').press('Escape');
  assert.ok(await rd.locator('.findbar').isHidden());
  assert.equal(await page.evaluate(() => CSS.highlights.has('deskbar-find')), false, 'closing clears the highlights');
  assert.deepEqual(page.errors, []);
});

// Every visible category and entry, with a drawn icon: a sprite symbol that exists, laid out at a readable size
async function menuIcons(menu) {
  return menu.evaluate(m => [...m.querySelectorAll('.mn-cats button, .mn-sec h3, .mn-sec .mn-it')].filter(e => e.checkVisibility()).map(e => {
    const s = e.querySelector(':scope > svg.ico'), id = s?.querySelector('use')?.getAttribute('href');
    const r = s?.getBoundingClientRect();
    return { row: e.textContent.trim().slice(0, 30), ok: !!(id && document.querySelector(`symbol${id}`) && r.width >= 14 && r.height >= 14) };
  }));
}

test('menu: every category and entry shows an icon, desktop and phone', async () => {
  for (const vp of [desktop, phone]) {
    const page = await open(vp);
    await page.locator('#menuBtn').click();
    const menu = page.locator('#menu');
    const groups = await menu.locator('.mn-sec[data-group]').evaluateAll(s => s.map(e => e.dataset.group));
    const rows = [];
    // wide screens show one group at a time, so step through each from the rail
    if (await menu.locator('.mn-cats').isVisible()) {
      for (const g of groups) {
        await menu.locator('.mn-cats button', { hasText: g }).click();
        rows.push(...await menuIcons(menu));
      }
    } else rows.push(...await menuIcons(menu));
    assert.ok(rows.length > groups.length, `rows: ${rows.length}`);
    assert.deepEqual(rows.filter(r => !r.ok).map(r => r.row), [], `${vp.width}px rows without an icon`);
    assert.deepEqual(page.errors, []);
  }
});

test('phone: menu, Tracker views and the window switcher at 390px', async () => {
  const page = await open(phone);
  await cards(page).first().waitFor();
  await shot(page, 'phone-home');
  assert.ok(await page.locator('#tray').isHidden(), 'the tray moves into the menu on phones');
  await page.locator('#menuBtn').click();
  const menu = page.locator('#menu');
  const mb = await menu.boundingBox();
  assert.ok(mb.width > 370, `menu spans the screen (${mb.width})`);
  assert.ok(await menu.locator('.mn-cats').isHidden());
  // group names come from each site's config, so check every group rather than the example site's names
  const groups = await menu.locator('.mn-sec[data-group]').evaluateAll(s => s.map(e => e.dataset.group));
  assert.ok(groups[0] === 'Writing' && groups.length > 1, `groups: ${groups}`);
  for (const g of groups) assert.ok(await menu.locator(`.mn-sec[data-group="${g}"]`).isVisible(), g + ' shows');
  assert.ok(await menu.locator('.mn-foot a').first().isVisible());
  const entry = await menu.locator('.mn-sec .mn-it').first().boundingBox();
  assert.ok(entry.height >= 44, `entries are touch sized (${entry.height})`);
  await shot(page, 'phone-menu');
  await menu.locator('.mn-it', { hasText: 'All posts' }).click();
  const tk = win(page, 'tracker');
  await tk.locator('.pc').first().waitFor();
  await shot(page, 'phone-tracker-hybrid');
  await view(tk, 'list');
  await shot(page, 'phone-tracker-list');
  await view(tk, 'icons');
  await shot(page, 'phone-tracker-icons');
  await view(tk, 'hybrid');

  await page.locator('#menuBtn').click();
  await menu.locator('.mn-it[title="About"]').click();
  await page.waitForURL(u => u.pathname === '/about/');
  await page.locator('#winsBtn').click();
  // About is on screen, so its tab is the focused one, nearest the button
  assert.equal(await page.locator('#switcher .sw-tab').count(), 2);
  assert.ok(await page.locator('#switcher .sw-tab').first().evaluate(t => t.matches('.on') && /About/.test(t.textContent)));
  await shot(page, 'phone-switcher');
  assert.equal(path(page), '/about/');
  assert.deepEqual(page.errors, []);
});

// A press that wobbles a few pixels used to start the browser's drag of the link or its thumbnail, which ate the click
test('Tracker: a single click opens a post even when the pointer wobbles; Cmd/Ctrl-click selects, middle-click is left to the browser', async () => {
  const page = await open(desktop, '/posts/');
  const tk = win(page, 'tracker');
  const card = tk.locator('.pc').nth(1), img = card.locator('img').first();
  await img.waitFor();
  const url = await card.getAttribute('href'), b = await img.boundingBox();
  await page.mouse.move(b.x + 20, b.y + 20);
  await page.mouse.down();
  await page.mouse.move(b.x + 26, b.y + 23, { steps: 3 });
  await page.mouse.up();
  await page.waitForURL(u => u.pathname === url);
  await win(page, 'reader').locator('.rd h1').waitFor();
  const row = tk.locator('[data-url]').nth(2), other = await row.getAttribute('data-url');
  let tabs = 0;
  page.context().on('page', () => tabs++);
  await row.click({ modifiers: ['ControlOrMeta'] });
  await tk.locator('.sel').first().waitFor();
  assert.equal(tabs, 0, 'Cmd/Ctrl-click selects rather than opening a tab');
  // Headless Chromium on Linux opens no tab when the press lands in a pane that scrolls (seen in CI), so the check is
  // that the shell leaves the press to the browser
  await page.evaluate(() => addEventListener('mousedown', e => { if (e.button === 1) window.midPress = e.defaultPrevented ? 'taken' : 'left'; }));
  await row.click({ button: 'middle' });
  assert.equal(await page.evaluate(() => window.midPress), 'left', 'a middle press reaches the browser');
  for (const p of page.context().pages()) if (p !== page) await p.close();
  assert.equal(path(page), url, 'neither click touches the reader');
  assert.notEqual(other, url);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

// A mail client's preview pane: the reader follows the selection, and a run of arrow presses is one history entry
test('Tracker: Up and Down move the selection and the reader follows it', async t => {
  const page = await open(desktop, '/posts/');
  const tk = win(page, 'tracker');
  // the list view is one column, so Down is always the next post (grids go by rows: tests/keys.test.mjs)
  await tk.locator('.seg[data-m="list"]').click();
  await tk.locator('tr[data-url] a').first().click();
  const urls = await tk.locator('tr[data-url]').evaluateAll(xs => xs.map(x => x.dataset.url));
  if (urls.length < 3) return t.skip('needs three posts');
  await page.waitForURL(u => u.pathname === urls[0]);
  await win(page, 'reader').locator('.rd h1').waitFor();
  await tk.locator('tr[data-url] a').first().focus();
  const n0 = await page.evaluate(() => history.length);
  const selected = () => page.evaluate(() => document.activeElement?.closest('[data-url]')?.dataset.url);
  const reading = u => tk.locator(`[data-url="${u}"].open`).waitFor();

  await page.keyboard.press('ArrowDown');
  assert.equal(await selected(), urls[1], 'the selection moves at once');
  await reading(urls[1]);
  assert.equal(path(page), urls[1]);
  assert.equal(await readerTitle(page), (await tk.locator(`tr[data-url="${urls[1]}"] a`).textContent()).trim());
  assert.equal(await selected(), urls[1], 'keyboard focus stays in Tracker');
  assert.ok(await tk.evaluate(e => e.classList.contains('active')), 'Tracker stays the active window');
  await page.keyboard.press('ArrowDown');
  await reading(urls[2]);
  await page.keyboard.press('ArrowUp');
  await reading(urls[1]);
  assert.equal(await page.evaluate(() => history.length), n0 + 1, 'one history entry for the run');
  await page.goBack();
  await page.waitForURL(u => u.pathname === urls[0]);
  await reading(urls[0]);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('Space pages through the open post when focus is outside its text, and inputs keep their Space', async () => {
  const page = await open(desktop, '/posts/');
  const tk = win(page, 'tracker'), rd = win(page, 'reader');
  // the longest post, so there is more than a page to scroll
  await tk.locator('.seg[data-m="list"]').click();
  await tk.locator('th[data-sort="words"] button').click();
  await tk.locator('tbody tr a').first().click();
  await rd.locator('.rd h1').waitFor();
  const sc = rd.locator('.rd-scroll');
  const top = () => sc.evaluate(e => e.scrollTop);
  const [sh, ch] = await sc.evaluate(e => [e.scrollHeight, e.clientHeight]);
  assert.ok(sh > ch * 1.5, `the post is long enough to page through (${sh} > ${ch})`);

  await rd.locator('.tab.on .tt').click();
  await page.keyboard.press('Space');
  const down = await top();
  assert.ok(down > ch / 2 && down < ch, `Space scrolled a page less a little overlap (${down} of ${ch})`);
  await page.keyboard.press('Shift+Space');
  assert.equal(await top(), 0, 'Shift+Space scrolled back up');

  // after a click on a Tracker row (the same post, then another) the reader is the focused window and Space pages it
  await tk.locator('tbody tr a').first().click();
  await page.keyboard.press('Space');
  assert.ok(await top() > ch / 2, 'Space after clicking the open post in Tracker');
  const next = tk.locator('tbody tr a').nth(1), nextURL = await next.getAttribute('href');
  await next.click();
  await page.waitForURL(u => u.pathname === nextURL);
  await rd.locator('.rd h1').waitFor();
  await page.waitForFunction(() => document.querySelector('.view.reader .rd-scroll').scrollTop === 0);
  if ((await sc.evaluate(e => e.scrollHeight - e.clientHeight)) > 20) {
    await page.keyboard.press('Space');
    assert.ok(await top() > 0, 'Space after opening another post from Tracker');
  }

  // Spotlight's field keeps its Space
  const before = await top();
  await page.keyboard.press('ControlOrMeta+k');
  const q = page.locator('dialog.spotlight input');
  await q.waitFor();
  await page.keyboard.press('Space');
  assert.equal(await q.inputValue(), ' ');
  assert.equal(await top(), before, 'the post did not move under Spotlight');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});
