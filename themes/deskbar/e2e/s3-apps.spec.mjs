// Photos, the lightbox, tools, folders and Mail. Runs against the example site; on another site each test skips
// when its page is missing. PHOTOS_POST names a post with 3 or more photos (the example site's by default).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { env, useBrowser, open, trackErrors, shot, win, visibleWins, path, desktop, phone } from './lib.mjs';

useBrowser();

const post = process.env.PHOTOS_POST || '/2025/11/keeping-javascript-small/';
const has = async p => (await fetch(env.base + p)).ok;
const query = page => new URL(page.url()).search;

test('Photos shows albums, a grid and a lightbox whose state is in the address', async t => {
  if (!(await has('/photos/'))) return t.skip('no /photos/ on this site');
  const page = await open(desktop, '/photos/');
  const w = win(page, 'photos');
  await w.locator('.ph-grid .ph img').first().waitFor();
  const albums = await w.locator('.albums .al').count();
  assert.ok(albums >= 2, 'albums listed in the sidebar');
  await shot(page, 's3-photos-grid-desktop');

  const second = w.locator('.albums .al').nth(1);
  const id = await second.getAttribute('data-album');
  await second.click();
  assert.equal(query(page), '?album=' + encodeURIComponent(id));
  assert.equal(await w.locator('.al.on').getAttribute('data-album'), id);

  const first = w.locator('.albums .al').first();
  await first.click();
  const n = await w.locator('.ph-grid .ph').count();
  await w.locator('.ph-grid .ph').first().click();
  const lb = w.locator('.lightbox');
  await lb.waitFor();
  assert.match(query(page), /photo=1$/);
  assert.equal(await lb.locator('.lb-n').textContent(), `1 / ${n}`);
  await shot(page, 's3-photos-lightbox-desktop');
  await page.keyboard.press('ArrowRight');
  assert.equal(await lb.locator('.lb-n').textContent(), `2 / ${n}`);
  assert.match(query(page), /photo=2$/);
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await lb.locator('.lb-n').textContent(), `${n} / ${n}`, 'previous from the first wraps to the last');

  // opening a photo added one history entry, so Back closes the viewer
  await page.goBack();
  await lb.waitFor({ state: 'hidden' });
  assert.doesNotMatch(query(page), /photo=/);
  await page.goForward();
  await lb.waitFor();

  await page.keyboard.press('Escape');
  await lb.waitFor({ state: 'hidden' });
  assert.doesNotMatch(query(page), /photo=/);

  // a photo address loads straight into the viewer
  const direct = await open(desktop, `/photos/?album=${encodeURIComponent(id)}&photo=1`);
  await win(direct, 'photos').locator('.lightbox').waitFor();
  assert.deepEqual(page.errors.concat(direct.errors), []);
  await page.context().close();
  await direct.context().close();
});

test('Photos opens on the pinned album and leaves excluded photos out', async t => {
  if (!(await has('/photos/'))) return t.skip('no /photos/ on this site');
  const page = await open(desktop, '/photos/');
  const w = win(page, 'photos');
  await w.locator('.ph-grid .ph img').first().waitFor();
  // the example site lists Wallpapers last with pin: true
  if ((await w.locator('.albums .al[data-album="wallpapers"]').count()) === 0) return t.skip('not the example site');
  assert.equal(await w.locator('.albums .al').first().getAttribute('data-album'), 'wallpapers');
  assert.equal(await w.locator('.al.on').getAttribute('data-album'), 'wallpapers');
  // Linked images lists three suns and excludes the second
  await w.locator('.albums .al[data-album="links"]').click();
  assert.deepEqual(await w.locator('.ph-grid .ph img').evaluateAll(els => els.map(e => e.alt)), ['A yellow sun', 'A third sun']);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('Photos on a phone: album menu and swipe', async t => {
  if (!(await has('/photos/'))) return t.skip('no /photos/ on this site');
  const page = await open(phone, '/photos/');
  const w = win(page, 'photos');
  await w.locator('.ph-grid .ph img').first().waitFor();
  assert.ok(await w.locator('.album-sel').isVisible(), 'narrow windows pick albums from a menu');
  assert.ok(!(await w.locator('.albums').isVisible()));
  await shot(page, 's3-photos-grid-phone');
  await w.locator('.ph-grid .ph').first().click();
  const lb = w.locator('.lightbox');
  await lb.waitFor();
  const box = await lb.boundingBox();
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width - 40, y);
  await page.mouse.down();
  await page.mouse.move(box.x + 40, y, { steps: 5 });
  await page.mouse.up();
  assert.match(await lb.locator('.lb-n').textContent(), /^2 \//, 'swiping left shows the next photo');
  await shot(page, 's3-photos-lightbox-phone');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('a post with photos opens them in the lightbox and offers View photos', async t => {
  if (!(await has(post))) return t.skip(`no ${post} on this site`);
  const page = await open(desktop, post);
  const w = win(page, 'reader');
  const chip = w.locator('.photos-chip');
  await chip.waitFor();
  assert.match(await chip.textContent(), /^View photos \(\d+\)$/);

  await w.locator('.rd-body img.zoom').nth(1).click();
  const lb = w.locator('.lightbox');
  await lb.waitFor();
  assert.match(await lb.locator('.lb-n').textContent(), /^2 \//);
  await page.keyboard.press('ArrowRight');
  assert.match(await lb.locator('.lb-n').textContent(), /^3 \//);
  await page.keyboard.press('Escape');
  await lb.waitFor({ state: 'hidden' });
  assert.ok(await w.isVisible(), 'Escape closes only the viewer over the post');

  if (await has('/photos/')) {
    await chip.click();
    const pw = win(page, 'photos');
    await pw.locator('.ph-grid .ph').first().waitFor();
    assert.ok(await pw.locator('.al.on').count(), 'the post\'s album is selected');
    assert.equal(await pw.locator('.ph-grid .ph').count(), Number((await chip.textContent()).match(/\d+/)[0]));
  }
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('the Tools folder opens embedded and page tools in their own windows', async t => {
  if (!(await has('/tools/')) || !(await has('/tools/demo/'))) return t.skip('no example tools on this site');
  const page = await open(desktop, '/tools/');
  const folder = win(page, 'folder:/tools/');
  assert.ok((await folder.locator('.folder a').count()) >= 2);
  await folder.locator('.folder a[href="/tools/demo/"]').click();
  const tool = win(page, 'tool:/tools/demo/');
  const frame = tool.locator('iframe.tool-frame');
  await frame.waitFor();
  assert.equal(await page.frameLocator('.view[data-key="tool:/tools/demo/"] iframe').locator('h1').textContent(), 'Demo tool');
  assert.equal(await tool.locator('.rd h1').count(), 0, 'only the frame shows');

  // the tool window covers the folder, so this one opens as a link from elsewhere would
  await page.evaluate(() => window.deskbar.go('/colours/'));
  const colours = win(page, 'tool:/colours/');
  await colours.locator('table').waitFor();
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('errors thrown inside a tool\'s frame are not counted against the shell, and the shell\'s own still are', async t => {
  if (!(await has('/tools/demo/'))) return t.skip('no example tools on this site');
  const ctx = await env.browser.newContext({ viewport: desktop, reducedMotion: 'reduce' });
  await ctx.route('**/tools/demo.html', async route => {
    const res = await route.fetch();
    route.fulfill({ response: res, body: (await res.text()).replace('</body>', '<script>throw new Error("tool boom")</script></body>') });
  });
  const page = await ctx.newPage();
  trackErrors(page);
  const inTool = page.waitForEvent('pageerror', e => e.message === 'tool boom');
  await page.goto(env.base + '/tools/demo/');
  await inTool;
  assert.deepEqual(page.errors, []);
  const inShell = page.waitForEvent('pageerror', e => e.message === 'shell boom');
  await page.addScriptTag({ content: 'setTimeout(() => { throw new Error("shell boom"); });' });
  await inShell;
  assert.deepEqual(page.errors, ['shell boom']);
  await ctx.close();
});

test('Contact opens as a Mail compose window', async t => {
  if (!(await has('/contact/'))) return t.skip('no /contact/ on this site');
  for (const [vp, name] of [[desktop, 'desktop'], [phone, 'phone']]) {
    const page = await open(vp, '/contact/');
    const w = win(page, 'mail');
    await w.locator('form').waitFor();
    assert.ok(await w.locator('.toolbar .send').isVisible());
    assert.ok(!(await w.locator('form [type=submit]').isVisible()), 'the toolbar Send replaces the form button');
    for (const f of ['name', 'email', 'message']) assert.ok(await w.locator(`[name=${f}]`).isVisible(), f);
    await shot(page, 's3-contact-' + name);
    assert.deepEqual(page.errors, []);
    await page.context().close();
  }
});

test('without JavaScript the Photos page is a plain gallery', async t => {
  if (!(await has('/photos/'))) return t.skip('no /photos/ on this site');
  const ctx = await env.browser.newContext({ viewport: desktop, javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto(env.base + '/photos/');
  assert.ok((await page.locator('#content .ph-grid a.ph img').count()) > 0);
  const manifest = await page.locator('[data-albums]').getAttribute('data-albums');
  const albums = await (await fetch(env.base + manifest)).json();
  assert.ok(Array.isArray(albums) && albums.every(a => a.id && a.items.length), 'manifest lists albums with images');
  await ctx.close();
});

const photosURL = '/photos/';
const inLightbox = page => page.evaluate(() => !!document.activeElement?.closest('.lightbox'));

test('Home then Back restores reader, Tracker and Photos together', async t => {
  if (!(await has(photosURL)) || !(await has(post))) return t.skip('needs /photos/ and a post');
  const page = await open(desktop, post);
  await win(page, 'tracker').waitFor();
  await page.evaluate(u => window.deskbar.go(u), photosURL);
  await win(page, 'photos').locator('.ph-grid .ph').first().waitFor();
  assert.equal(await visibleWins(page), 3);
  await page.locator('#homeBtn').click();
  assert.equal(await visibleWins(page), 1, 'only the Posts window, at its home spot');
  await page.goBack();
  await page.waitForURL(u => u.pathname === photosURL);
  for (const key of ['reader', 'tracker', 'photos']) await win(page, key).waitFor();
  assert.equal(await visibleWins(page), 3, 'Home\'s snapshot answers Back before Photos\' own hook');
  await shot(page, 'f1-home-back-three');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('closing the lightbox leaves another window\'s address alone', async t => {
  if (!(await has(photosURL)) || !(await has(post))) return t.skip('needs /photos/ and a post');
  const page = await open(desktop, photosURL);
  const w = win(page, 'photos'), lb = w.locator('.lightbox');
  await w.locator('.ph-grid .ph').first().click();
  await lb.waitFor();
  assert.match(query(page), /photo=1$/);
  await page.evaluate(u => window.deskbar.go(u), post);
  await page.waitForURL(u => u.pathname === post);
  await page.locator('.view[data-key="photos"] .lb-close').dispatchEvent('click');
  await page.locator('.view[data-key="photos"] .lightbox').waitFor({ state: 'hidden' });
  assert.equal(path(page), post);
  assert.equal(query(page), '', 'the post\'s address was not overwritten with a Photos one');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('the lightbox keeps keyboard focus inside while open and returns it to the thumbnail', async t => {
  if (!(await has(photosURL))) return t.skip('no /photos/ on this site');
  const page = await open(desktop, photosURL);
  const w = win(page, 'photos'), lb = w.locator('.lightbox');
  const thumbs = w.locator('.ph-grid .ph');
  await thumbs.first().waitFor();
  const n = await thumbs.count();
  await thumbs.nth(1).focus();
  await page.keyboard.press('Enter');
  await lb.waitFor();
  assert.ok(await inLightbox(page));
  for (const key of ['Tab', 'Tab', 'Tab', 'Tab', 'Shift+Tab', 'Shift+Tab', 'Shift+Tab', 'Shift+Tab', 'Shift+Tab']) {
    await page.keyboard.press(key);
    assert.ok(await inLightbox(page), `focus stays in the viewer after ${key}`);
  }
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Escape');
  await lb.waitFor({ state: 'hidden' });
  const want = String((1 + 1) % n);
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.i), want, 'focus is on the last photo\'s thumbnail');
  await page.context().close();
});

test('Photos: the arrow keys move through the album grid, Enter opens, Escape goes back to the grid', async t => {
  if (!(await has(photosURL))) return t.skip('no /photos/ on this site');
  const page = await open(desktop, photosURL);
  const w = win(page, 'photos'), lb = w.locator('.lightbox'), thumbs = w.locator('.ph-grid .ph');
  await thumbs.first().waitFor();
  const n = await thumbs.count();
  if (n < 3) return t.skip('the first album has fewer than three photos');
  const at = () => page.evaluate(() => document.activeElement?.dataset.i);
  await thumbs.first().focus();
  for (const [key, want] of [['ArrowRight', '1'], ['ArrowRight', '2'], ['ArrowLeft', '1'], ['ArrowLeft', '0'], ['ArrowLeft', '0']]) {
    await page.keyboard.press(key);
    assert.equal(await at(), want, `${key} to photo ${want}`);
  }
  // Down goes to the photo below, in the same column
  const col = async () => Math.round((await page.evaluate(() => document.activeElement.getBoundingClientRect().x)));
  const x0 = await col();
  if (await thumbs.evaluateAll(xs => xs.some(x => x.offsetTop > xs[0].offsetTop))) {
    await page.keyboard.press('ArrowDown');
    assert.notEqual(await at(), '0', 'Down moved');
    assert.equal(await col(), x0, 'same column');
    await page.keyboard.press('ArrowUp');
    assert.equal(await at(), '0');
  }

  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await lb.waitFor();
  assert.equal(await lb.locator('.lb-n').textContent(), `2 / ${n}`);
  await page.keyboard.press('ArrowRight');
  assert.equal(await lb.locator('.lb-n').textContent(), `3 / ${n}`);
  await page.keyboard.press('Escape');
  await lb.waitFor({ state: 'hidden' });
  assert.ok(await w.isVisible(), 'the Photos window stays open');
  assert.equal(await at(), '2', 'focus is on the photo last shown');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await at(), '1', 'and the arrows carry on from there');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('D26: the gallery shortcode gives a post an album and the View photos chip', async t => {
  const haiku = process.env.GALLERY_POST || '/2024/03/notes-on-haikus-window-tabs/';
  if (!(await has(photosURL)) || !(await has(haiku))) return t.skip(`needs /photos/ and ${haiku}`);
  const page = await open(desktop, haiku);
  const chip = win(page, 'reader').locator('.photos-chip');
  await chip.waitFor();
  assert.equal(await chip.textContent(), 'View photos (2)', 'fewer than 3 photos, but opted in');
  assert.equal(new URL(await chip.getAttribute('href'), env.base).pathname, photosURL, 'the Photos address comes from the site');
  const manifest = /data-albums="?([^"\s>]+)/.exec(await (await fetch(env.base + photosURL)).text())[1];
  const albums = await (await fetch(env.base + manifest)).json();
  const auto = albums.filter(a => a.auto).map(a => a.post);
  assert.ok(auto.includes(haiku));
  if (!process.env.BASE_URL) assert.deepEqual(auto, [haiku], 'posts that do not opt in get no album');
  await page.context().close();
});

test('D12 in app windows: a deep link and an in-page anchor scroll the tool window', async t => {
  if (!(await has('/colours/'))) return t.skip('no /colours/ on this site');
  const vp = { width: 1280, height: 400 };
  // the heading is near the end, so the window scrolls as far as it can, bringing the heading into view
  const atTop = el => {
    const sc = el.closest('.scroller'), r = el.getBoundingClientRect(), s = sc.getBoundingClientRect();
    return sc.scrollTop > 0 && r.top >= s.top - 1 && r.bottom <= s.bottom + 1;
  };
  let page = await open(vp, '/colours/#notes');
  await page.waitForFunction(atTop, await win(page, 'tool:/colours/').locator('h2#notes').elementHandle());
  await page.context().close();

  page = await open(vp, '/colours/');
  const w = win(page, 'tool:/colours/'), head = w.locator('h2#notes');
  assert.ok(!(await head.evaluate(atTop)));
  await w.locator('a:not(.hlink)[href$="#notes"]').click();
  await page.waitForFunction(atTop, await head.elementHandle());
  assert.equal(new URL(page.url()).hash, '#notes');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('links to standalone HTML files open tool windows and the page never leaves the shell', async t => {
  const postURL = process.env.TOOL_LINK_POST || '/2026/05/static-sites-with-real-urls/';
  if (!(await has(postURL)) || !(await has('/tools/demo/'))) return t.skip('no example tool links on this site');
  const page = await open(desktop, postURL);
  await page.evaluate(() => { window.stillHere = true; });
  const reader = win(page, 'reader');
  await reader.locator('a[href="/tools/demo.html"]').click();
  const demo = win(page, 'tool:/tools/demo/');
  await demo.locator('iframe.tool-frame').waitFor();
  assert.equal(path(page), '/tools/demo/', 'a file with a tool page opens that page');
  assert.equal(await demo.locator('a[target=_blank]').count(), 0, 'no new-tab links');

  await page.locator('.view[data-key="reader"] a[href="/tools/stopwatch.html"]').dispatchEvent('click');
  const sw = win(page, 'tool:/tools/stopwatch.html');
  await sw.locator('iframe.tool-frame[src="/tools/stopwatch.html"]').waitFor();
  assert.equal((await sw.locator('.tab.on .tt').textContent()).trim(), 'Stopwatch', 'titled from the file');
  assert.equal(path(page), '/tools/demo/', 'the file\'s own address is never in the address bar');
  assert.ok(await page.evaluate(() => window.stillHere), 'no full page load');
  await shot(page, 'f1-tool-file');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});
