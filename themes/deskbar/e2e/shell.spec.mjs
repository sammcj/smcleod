// Browser checks for the shell: home, reading layout, single reader, snapping, the Home toggle, history and phones.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { env, useBrowser, open, shot, win, cards, visibleWins, path, readerTitle, dragTab, desktop, phone } from './lib.mjs';

useBrowser();

test('desktop: home, reading layout, reader reuse, snap, Home toggle and Back', async () => {
  const page = await open(desktop);

  // D9/D19/D36: first load is the desktop and the Posts window, compact and left of centre beside the icons
  const posts = win(page, 'tracker');
  await cards(page).first().waitFor();
  const wb = await posts.boundingBox();
  assert.ok(wb.x > 100 && wb.x < 300, `Posts window sits beside the icon column (x=${wb.x})`);
  assert.ok(wb.width <= 632, `and is compact (${wb.width} wide)`);
  assert.equal(await visibleWins(page), 1);
  await shot(page, 'd1-home');

  // D7: opening a post gives Tracker 25% on the left and the reader 75% on the right
  const first = cards(page).first(), firstURL = await first.getAttribute('href');
  await first.click();
  await win(page, 'reader').locator('.rd h1').waitFor();
  assert.equal(path(page), firstURL);
  const tb = await win(page, 'tracker').boundingBox(), rb = await win(page, 'reader').boundingBox();
  assert.ok(tb.x < rb.x, 'tracker is left of the reader');
  assert.ok(Math.abs(tb.width / 1440 - 0.25) < 0.05, `tracker is about a quarter wide (${tb.width})`);
  assert.ok(Math.abs(rb.width / 1440 - 0.75) < 0.05, `reader is about three quarters wide (${rb.width})`);
  const firstTitle = await readerTitle(page);
  await shot(page, 'd2-reading');

  // D8: a second post replaces the reader's content rather than opening another window
  const second = win(page, 'tracker').locator(`.pc:not([data-url="${firstURL}"]), .row:not([data-url="${firstURL}"])`).first();
  const secondURL = await second.getAttribute('data-url');
  // D3/D4: a single click opens
  await second.click();
  await page.waitForURL(u => u.pathname === secondURL);
  await page.waitForFunction(t => document.querySelector('.view[data-key="reader"] .rd h1')?.textContent !== t, firstTitle);
  assert.equal(await page.locator('.view[data-key="reader"]').count(), 1);
  assert.equal(await visibleWins(page), 2);
  assert.equal(await page.evaluate(() => document.activeElement?.closest('.view')?.dataset.key + ' ' + document.activeElement.tagName), 'reader H1',
    'keyboard focus moves to the new heading');
  await shot(page, 'd3-second-post');

  // Back returns the reader to the first post
  await page.goBack();
  await page.waitForURL(u => u.pathname === firstURL);
  await page.waitForFunction(t => document.querySelector('.view[data-key="reader"] .rd h1')?.textContent === t, firstTitle);

  // D5: dragging the reader to the left edge shows a preview, then snaps it to the left half
  await dragTab(page, 'reader', { x: 2, y: 450 });
  assert.ok(await page.locator('#snapPreview').isVisible(), 'snap preview shows while dragging');
  await shot(page, 'd4-snap-preview');
  await page.mouse.up();
  const sb = await win(page, 'reader').boundingBox();
  assert.ok(sb.x < 12, `snapped to the left edge (x=${sb.x})`);
  assert.ok(Math.abs(sb.width / 1440 - 0.5) < 0.03, `snapped to half the desk (${sb.width})`);
  await shot(page, 'd5-snapped');

  // D24: Home hides everything and shows the Posts window at its home spot; pressing it again restores the exact layout
  const before = { r: await win(page, 'reader').boundingBox(), t: await win(page, 'tracker').boundingBox() };
  await page.click('#homeBtn');
  assert.equal(await visibleWins(page), 1);
  assert.deepEqual(await posts.boundingBox(), wb);
  assert.equal(path(page), '/');
  await shot(page, 'd6-home-toggle');
  await page.click('#homeBtn');
  assert.equal(path(page), firstURL);
  assert.deepEqual(await win(page, 'reader').boundingBox(), before.r);
  assert.deepEqual(await win(page, 'tracker').boundingBox(), before.t);

  // D24: browser Back from Home restores the snapshot too
  await page.click('#homeBtn');
  assert.equal(await visibleWins(page), 1);
  await page.goBack();
  await page.waitForURL(u => u.pathname === firstURL);
  assert.equal(await visibleWins(page), 2);
  assert.deepEqual(await win(page, 'reader').boundingBox(), before.r);
  await shot(page, 'd7-back-restored');

  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('desktop: tag links open Tracker at the tag, dock opens a page window, theme persists', async () => {
  const page = await open(desktop);
  await cards(page).first().click();
  const chip = win(page, 'reader').locator('.chips .chip').first();
  await chip.waitFor();
  const [tagURL, tag] = [await chip.getAttribute('href'), (await chip.textContent()).trim()];
  await chip.click();
  await page.waitForURL(u => u.pathname === tagURL);
  await page.waitForFunction(t => [...document.querySelectorAll('.tab .tt')].some(e => e.textContent === t), `~/tags/${tag}`);
  const rows = await win(page, 'tracker').locator('.row, .pc').count();
  assert.ok(rows > 0, 'Tracker lists the tagged posts');
  await shot(page, 'd8-tag');

  // a non-post page opens in its own window and leaves the reader alone
  // the last launcher for a page on this site; the Control panel is an app, not a page window
  const dockPage = page.locator('#dock .dk:not([target]):not([href$="/control-panel/"])').last(), pageURL = await dockPage.getAttribute('href');
  await dockPage.click();
  await page.waitForURL(u => u.pathname === pageURL);
  await page.locator(`.view[data-key="page:${pageURL}"] .rd h1`).first().waitFor();
  assert.equal(await page.locator('.view[data-key="reader"]').count(), 1);
  // the split handle stays above the snapped pair but under a floating window raised over them
  const [dz, pz, rz] = await page.evaluate(k => [
    '#divider', `.win:has(.view[data-key="${k}"])`, '.win:has(.view[data-key="reader"])',
  ].map(s => +getComputedStyle(document.querySelector(s)).zIndex), `page:${pageURL}`);
  assert.ok(dz >= rz && dz < pz, `divider z ${dz} sits between the reader (${rz}) and the page window (${pz})`);

  const theme = await page.evaluate(() => getComputedStyle(document.body).colorScheme);
  await page.click('#themeBtn');
  const flipped = await page.evaluate(() => document.documentElement.dataset.theme);
  assert.ok(flipped === 'light' || flipped === 'dark');
  await shot(page, 'd9-theme');
  await page.reload();
  await page.waitForSelector('html.wm-ready');
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), flipped, `theme persists (was ${theme})`);

  assert.deepEqual(page.errors, []);
  await page.context().close();
});


// A double-click is a desktop habit. Its second press lands on the root while the window opens (a view transition
// is under way), or on the icon again once it has, so presses on the same spot are ignored for a moment.
test('double-clicking a desktop or dock icon opens it once, and the second press goes nowhere', async () => {
  const page = await open(desktop);
  await page.locator('#icons .dicon').nth(1).waitFor();
  await page.evaluate(() => document.addEventListener('mousedown', () => window.presses++));
  for (const [sel, gap] of [['#icons .dicon >> nth=1', 60], ['#icons .dicon >> nth=1', 150], ['#icons .dicon >> nth=1', 260], ['#dock a >> nth=2', 150]]) {
    const b = await page.locator(sel).boundingBox(), x = b.x + b.width / 2, y = b.y + 16;
    const before = await page.evaluate(() => { window.presses = 0; return history.length; });
    await page.mouse.move(x, y);
    await page.mouse.down({ clickCount: 1 });
    await page.mouse.up({ clickCount: 1 });
    await page.waitForTimeout(gap);
    await page.mouse.down({ clickCount: 2 });
    await page.mouse.up({ clickCount: 2 });
    await page.waitForTimeout(600);
    const after = await page.evaluate(() => ({ presses: window.presses, len: history.length, sel: getSelection().toString() }));
    assert.equal(after.presses, 1, `${sel} ${gap}ms: the second press is swallowed`);
    assert.ok(after.len <= before + 1, `${sel} ${gap}ms: one history entry at most`);
    assert.equal(after.sel, '', 'nothing selected');
  }
  assert.deepEqual(page.errors, []);
  await page.context().close();
});
test('D4: window controls, minimise to panel, stacking tabs and closing', async () => {
  const page = await open(desktop);
  await cards(page).first().click();
  await win(page, 'reader').locator('.rd h1').waitFor();
  const reader = win(page, 'reader'), readerTab = reader.locator('.tab.on');

  // double-clicking a tab maximises, the restore control puts it back
  const snapped = await reader.boundingBox();
  await readerTab.locator('.tt').dblclick();
  assert.ok((await reader.boundingBox()).width > 1400, 'maximised');
  await readerTab.locator('.ctl.max').click();
  assert.deepEqual(await reader.boundingBox(), snapped);

  // minimise sends Tracker to the panel; its task button brings it back
  await win(page, 'tracker').locator('.tab.on .ctl.min').click();
  assert.equal(await win(page, 'tracker').count(), 0);
  await page.locator('#tasks .task.min', { hasText: '~/posts' }).click();
  assert.equal(await win(page, 'tracker').count(), 1);

  // dropping Tracker's tab on the reader's tab stacks them in one frame
  const tt = await win(page, 'tracker').locator('.tab.on .tt').boundingBox(), rt = await readerTab.boundingBox();
  await page.mouse.move(tt.x + 10, tt.y + tt.height / 2);
  await page.mouse.down();
  await page.mouse.move(tt.x + 200, tt.y + 60, { steps: 5 });
  await page.mouse.move(rt.x + 60, rt.y + rt.height / 2, { steps: 8 });
  await page.mouse.up();
  assert.equal(await visibleWins(page), 1);
  assert.equal(await page.locator('.win .tabs.multi[role="tablist"] button.tt[role="tab"]').count(), 2);
  assert.equal(await page.locator('.tabs.multi [role="tab"][aria-selected="true"]').count(), 1);
  await shot(page, 'd10-stacked');

  // closing the reader points the address bar at what is still showing
  const readerURL = path(page);
  // the reader was there first, so its tab leads the stack
  await page.locator('.tabs.multi .tab').first().locator('.ctl.close').click();
  assert.equal(await page.locator('.view[data-key="reader"]').count(), 0);
  assert.notEqual(path(page), readerURL);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('q and w close the focused window, except while typing, with a modifier or with a menu open', async () => {
  const page = await open(desktop);
  await cards(page).first().click();
  const reader = win(page, 'reader'), tracker = win(page, 'tracker');
  await reader.locator('.rd h1').click();
  const readers = page.locator('.view[data-key="reader"]');

  await tracker.locator('input[type="search"]').focus();
  await page.keyboard.press('q');
  assert.equal(await tracker.locator('input[type="search"]').inputValue(), 'q', 'typed into the search field');
  assert.equal(await tracker.count(), 1);

  await reader.locator('.rd h1').click();
  await page.keyboard.press('Alt+w');
  await page.keyboard.press('Shift+Q');
  assert.equal(await readers.count(), 1, 'modified keys are left alone');
  await page.click('#winsBtn');
  await page.locator('#switcher .sw-tab').first().waitFor();
  await page.keyboard.press('w');
  assert.equal(await readers.count(), 1, 'an open menu keeps the keys');
  await page.keyboard.press('Escape');

  await reader.locator('.rd h1').click();
  await page.keyboard.press('w');
  await readers.waitFor({ state: 'detached' });
  assert.equal(await tracker.count(), 1, 'only the focused window closed');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('D12: a heading URL opens the post scrolled to that heading, and heading links update the address', async () => {
  const home = await open(desktop);
  const postURL = await cards(home).first().getAttribute('href');
  await home.context().close();
  const probe = await open(desktop, postURL);
  const ids = await probe.locator('.view[data-key="reader"] .rd-body h2[id]').evaluateAll(hs => hs.map(h => h.id));
  await probe.context().close();
  assert.ok(ids.length >= 2, 'post has headings to link to');

  const page = await open(desktop, `${postURL}#${ids.at(-1)}`);
  const scroller = win(page, 'reader').locator('.rd-scroll');
  await page.waitForFunction(() => document.querySelector('.view[data-key="reader"] .rd-scroll')?.scrollTop > 0);
  const deep = await scroller.evaluate(e => e.scrollTop);
  await win(page, 'reader').locator(`h2[id="${ids[0]}"] .hlink`).click({ force: true });
  await page.waitForURL(u => u.hash === '#' + ids[0]);
  assert.ok(await scroller.evaluate(e => e.scrollTop) < deep, 'scrolled up to the first heading');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('D36: Escape closes a post opened from the Posts window and puts the window back where it was', async () => {
  const page = await open(desktop);
  const posts = win(page, 'tracker'), reader = win(page, 'reader'), readers = page.locator('.view[data-key="reader"]');
  await cards(page).first().waitFor();
  const home = await posts.boundingBox();
  const first = await cards(page).first().getAttribute('href');
  await cards(page).first().click();
  await reader.locator('.rd h1').waitFor();
  assert.notDeepEqual(await posts.boundingBox(), home, 'the reading layout moved it');

  // an open menu, and typing, keep their Escape
  await page.click('#winsBtn');
  await page.locator('#switcher .sw-tab').first().waitFor();
  await page.keyboard.press('Escape');
  assert.ok(await page.locator('#switcher').isHidden(), 'Escape closed the switcher');
  await posts.locator('input[type="search"]').focus();
  await page.keyboard.press('Escape');
  assert.equal(await readers.count(), 1, 'the post stays open');

  await reader.locator('.rd h1').click();
  await page.keyboard.press('Escape');
  assert.equal(await readers.count(), 0, 'Escape in the reader closes the post');
  assert.deepEqual(await posts.boundingBox(), home, 'and the Posts window is back where it was');
  await page.waitForURL(u => u.pathname === '/');
  assert.equal(await page.evaluate(() => document.activeElement?.closest('.win')?.querySelector('.view:not([hidden])')?.dataset.key), 'tracker', 'keyboard focus is in the Posts window');
  assert.equal(await posts.locator('.open').count(), 0, 'no post is marked as being read');
  await shot(page, 'd11-escape');

  // Escape stepped back in history, so Forward opens the post again and Back never revisits it
  await page.goForward();
  await reader.locator('.rd h1').waitFor({ timeout: 5000 });
  assert.equal(path(page), first);

  // a Posts window at its full size and a place of its own, with the post opened from the keyboard
  await page.goto(env.base + '/posts/');
  await page.waitForSelector('html.wm-ready');
  await posts.locator('.pc').first().waitFor();
  const full = await posts.boundingBox();
  await posts.locator('.pc').first().focus();
  await page.keyboard.press('Enter');
  await reader.locator('.rd h1').waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await readers.count(), 0);
  assert.deepEqual(await posts.boundingBox(), full);
  assert.equal(path(page), '/posts/');

  // a post the page opened with came from no Posts window, so Escape leaves it alone
  const postURL = await posts.locator('.pc').first().getAttribute('href');
  await page.goto(env.base + postURL);
  await page.waitForSelector('html.wm-ready');
  await reader.locator('.rd h1').click();
  await page.keyboard.press('Escape');
  assert.equal(await readers.count(), 1);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('D36: Escape leaves the post alone during Home and once Tracker is closed; a Tracker at a new place keeps its address', async () => {
  const page = await open(desktop);
  const posts = win(page, 'tracker'), reader = win(page, 'reader'), readers = page.locator('.view[data-key="reader"]');
  await cards(page).first().click();
  await reader.locator('.rd h1').waitFor();
  const url = path(page);

  // Home keeps its snapshot, so its second press still puts everything back
  await page.click('#homeBtn');
  await page.keyboard.press('Escape');
  assert.equal(await readers.count(), 1, 'Escape during Home leaves the post');
  await page.click('#homeBtn');
  await reader.waitFor();
  assert.equal(path(page), url);

  // the reader's post came from the whole list, but Tracker has moved on to a tag since
  const tag = await posts.locator('.place-sel option[value^="tags:"]').first().getAttribute('value');
  await posts.locator('.place-sel').selectOption(tag);
  await page.waitForURL(u => u.pathname !== url);
  const tagURL = path(page);
  await reader.locator('.rd h1').click();
  await page.keyboard.press('Escape');
  assert.equal(await readers.count(), 0);
  assert.equal(path(page), tagURL, 'the address names the place Tracker shows');

  // Tracker closed after the post opened: nothing to put back
  await posts.locator('.pc, .row').first().click();
  await reader.locator('.rd h1').waitFor();
  await posts.locator('.tab.on .ctl.close').click();
  await reader.locator('.rd h1').click();
  await page.keyboard.press('Escape');
  assert.equal(await readers.count(), 1, 'Escape leaves the post once Tracker is closed');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('phone: home screen, one full-screen window, switcher and Back', async () => {
  const page = await open(phone);
  const home = page.locator('#recent');
  await cards(page).first().waitFor();
  const wb = await home.boundingBox();
  assert.ok(wb.width > 330, 'the home screen fills the phone width');
  assert.equal(await visibleWins(page), 0, 'D17: the phone home screen has no Posts window');
  assert.ok(await page.locator('#dock').isVisible(), 'dock shows on the home screen');
  await shot(page, 'm1-home');

  const first = cards(page).first(), firstURL = await first.getAttribute('href');
  await first.click();
  await win(page, 'reader').locator('.rd h1').waitFor();
  assert.equal(path(page), firstURL);
  assert.equal(await visibleWins(page), 1, 'D17: one window at a time');
  const rb = await win(page, 'reader').boundingBox();
  assert.ok(rb.x === 0 && rb.width === 390, 'reader is full width');
  assert.ok(await page.locator('#dock').isHidden(), 'the dock gives way to a full-screen window');
  assert.ok(rb.y + rb.height >= 843, `reader reaches the bottom of the screen (${rb.y + rb.height})`);
  await shot(page, 'm2-reader');

  // a link to a heading lands it below the pinned panel, tab and toolbar
  const hid = await page.evaluate(() => document.querySelector('.view.reader .rd-body h2[id]')?.id);
  if (hid) {
    await page.evaluate(([u, id]) => window.deskbar.go(u + '#' + id), [firstURL, hid]);
    await page.waitForFunction(() => scrollY > 0);
    const [hb, tbar] = await Promise.all([page.locator('#' + hid).boundingBox(), win(page, 'reader').locator('.toolbar').boundingBox()]);
    assert.ok(hb.y >= tbar.y + tbar.height, `the heading sits below the toolbar (${hb.y} vs ${tbar.y + tbar.height})`);
    await page.evaluate(() => scrollTo(0, 0));
  }

  // the dock hides behind the window, so the switcher lives in the panel on phones
  assert.equal(await page.evaluate(() => document.getElementById('winsBtn').closest('#panel, #dock').id), 'panel');
  await page.click('#winsBtn');
  const tab = page.locator('#switcher .sw-tab').first();
  assert.ok(await tab.isVisible());
  // there it rolls down from the panel, and its tabs span the column as a full-screen window's tab does
  const [tb, pb, sb] = await Promise.all([tab.boundingBox(), page.locator('#panel').boundingBox(), page.locator('#switcher').boundingBox()]);
  assert.ok(tb.y >= pb.y + pb.height && sb.x >= 0 && sb.x + sb.width <= 390, 'the column hangs below the panel, on screen');
  assert.ok(tb.width >= 280 && tb.height >= 42, `tabs are full width and touch sized (${tb.width}x${tb.height})`);
  await shot(page, 'm3-switcher');
  // the page itself scrolls on a phone, and the reader and the home screen each keep their own place in it
  await page.evaluate(() => scrollTo(0, 400));
  await page.waitForFunction(() => scrollY === 400);
  // Show desktop is Home's job (D24), so the switcher leaves it out; on a phone Home is first in the panel
  await page.click('#panelHome');
  assert.equal(await visibleWins(page), 0);
  assert.ok(await home.isVisible());
  assert.equal(await page.evaluate(() => scrollY), 0, 'the home screen starts at its top');

  await page.goBack();
  await page.waitForURL(u => u.pathname === firstURL);
  assert.equal(await visibleWins(page), 1);
  assert.equal(await page.evaluate(() => scrollY), 400, 'the reader is back where it was');

  // from the home screen, another post opens in the reader, in view and at its top
  await page.click('#panelHome');
  const second = cards(page).nth(1), secondURL = await second.getAttribute('href');
  await second.click();
  await page.waitForURL(u => u.pathname === secondURL);
  await win(page, 'reader').locator('.rd h1').waitFor();
  assert.equal(await visibleWins(page), 1, 'the reader shows');
  assert.equal(await page.evaluate(() => scrollY), 0, 'the new post starts at its top');

  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('no JS: pages are plain readable documents', async () => {
  const ctx = await env.browser.newContext({ viewport: { width: 1024, height: 800 }, javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto(env.base + '/');
  const href = await page.locator('main .plist a').first().getAttribute('href');
  await page.goto(env.base + href);
  assert.ok(await page.locator('main .rd h1').isVisible());
  assert.ok(await page.locator('#desk').isHidden());
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains('wm')), false);
  await shot(page, 'n1-nojs-post');
  await ctx.close();
});
