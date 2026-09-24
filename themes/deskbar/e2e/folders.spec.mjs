// Folders listing items from a data file (layouts/folder.html `items`). The first test runs on any site: every
// folder on its desktop opens and lists items. The others use the example site's /links/ and /projects/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { env, useBrowser, open, win, desktop, phone, needs } from './lib.mjs';

useBrowser();

const html = async p => (await fetch(env.base + p)).text();

test('each desktop and menu folder opens and lists its items, with links to other sites in a new tab', async t => {
  const page = await open(desktop, '/');
  const hrefs = await page.locator('#icons a.dicon, #menu a').evaluateAll(as => [...new Set(as.map(a => a.getAttribute('href')).filter(h => h.startsWith('/')))]);
  const folders = [];
  for (const h of hrefs) if (/data-window="?folder\b/.test(await html(h))) folders.push(h);
  if (!folders.length) return t.skip('no folders on this desktop');
  for (const f of folders) {
    // a window may cover the desktop icons, so open each as a link from elsewhere would
    await page.evaluate(p => window.deskbar.go(p), f);
    const w = win(page, 'folder:' + f);
    await w.locator('.folder li').first().waitFor();
    const links = await w.locator('.folder li > a:first-child').evaluateAll(as => as.map(a => ({ href: a.href, target: a.target })));
    assert.ok(links.length > 0, `${f} lists items`);
    for (const l of links) {
      const external = new URL(l.href).origin !== new URL(env.base).origin;
      assert.equal(l.target, external ? '_blank' : '', `${l.href} in ${f}`);
    }
    // icons and card previews are small local files; a missing one would show a broken image
    const srcs = await w.locator('.folder img.ico, .folder img.thumb').evaluateAll(is => is.map(i => i.src));
    for (const s of srcs) {
      assert.equal(new URL(s).origin, new URL(env.base).origin, `${s} in ${f} is not hotlinked`);
      const r = await fetch(s);
      assert.ok(r.ok && /^image\//.test(r.headers.get('content-type')), `${s} in ${f}`);
    }
  }
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('a data folder groups items by category, with image, sprite and monogram icons', async t => {
  if (!(await html('/links/')).includes('gohugo.io')) return t.skip('no example links folder');
  // without JS the page is the same list of links
  assert.match(await html('/links/'), /<ul class="?folder"?>\s*<li><a href="?https:\/\/gohugo.io/);
  const page = await open(desktop, '/links/');
  const w = win(page, 'folder:/links/');
  await w.locator('.folder li').first().waitFor();
  assert.deepEqual(await w.locator('.folder-h').allTextContents(), ['Tools', 'Reading']);
  assert.equal(await w.locator('.folder img.ico').count(), 1);
  assert.equal(await w.locator('.folder svg.ico').count(), 2);
  assert.equal((await w.locator('.folder .mono').textContent()).trim(), 'M');
  assert.equal(await w.locator('.folder .mono').evaluate(e => getComputedStyle(e).borderRadius), '9px', 'the folder item stylesheet loaded');
  // an item on this site opens in its own window, as any site link does
  await w.locator('.folder a[href="/about/"]').click();
  await win(page, 'page:/about/').waitFor();
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('a list folder shows descriptions and meta, and an item page opens in the site', async t => {
  if (!(await html('/projects/')).includes('window-notes')) return t.skip('no example projects folder');
  const page = await open(desktop, '/projects/');
  const w = win(page, 'folder:/projects/');
  const rows = w.locator('.folder-list li');
  await rows.first().waitFor();
  assert.equal(await rows.count(), 2);
  assert.equal(await rows.first().locator('.fi-m').textContent(), 'HTML · 12 stars');
  assert.equal(await rows.first().locator('.fi-page').count(), 0);
  const more = rows.nth(1).locator('.fi-page');
  assert.equal(await more.getAttribute('target'), null);
  await more.click();
  await page.waitForFunction(() => location.pathname !== '/projects/');
  assert.match(new URL(page.url()).pathname, /window-managers/);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('a cards folder previews each item from its feed, its stored thumb or a monogram, at build time', async t => {
  if (!(await needs(t, '/videos/'))) return;
  // without JS the page has the same cards: small WebP files cut to thumbSize, lazy, with their size reserved
  const doc = await html('/videos/');
  assert.match(doc, /<ul class="?folder folder-cards"?>/);
  for (const img of doc.match(/<img class="?thumb"?[^>]*>/g)) {
    assert.match(img, /src="?\/previews\/[\w-]+\.webp/);
    assert.match(img, /width="?320"? height="?180"?/);
    assert.match(img, /loading="?lazy"?/);
  }
  const page = await open(desktop, '/videos/');
  const w = win(page, 'folder:/videos/');
  const cards = w.locator('.folder-cards > li');
  await cards.first().waitFor();
  const card = name => cards.filter({ has: page.locator('b', { hasText: name }) });
  const src = async name => new URL(await card(name).locator('img.thumb').getAttribute('src'), env.base).pathname;
  // a YouTube-style feed: the newest video by date (listed second), with its title
  assert.match(await src('Haiku Talks'), /^\/previews\/newest_/);
  assert.equal(await card('Haiku Talks').locator('.fi-new').textContent(), 'Building a desktop in the browser');
  // a podcast feed: the show's artwork rather than an episode's, the newest episode and the item's description
  assert.match(await src('Radio Deskbar'), /^\/previews\/art_/);
  assert.deepEqual(await card('Radio Deskbar').locator('small').allTextContents(), ['Episode 2: Window tabs', 'A show about desktops']);
  // a feed that fails falls back to the stored thumb, and no preview at all to a monogram of the card's shape
  assert.match(await src('Quiet Channel'), /^\/previews\/fallback_/);
  const mono = card('No Preview').locator('.thumb.mono');
  assert.equal((await mono.textContent()).trim(), 'N');
  const box = await mono.boundingBox();
  assert.ok(Math.abs(box.width / box.height - 16 / 9) < 0.02, `monogram is 16:9, not ${box.width}x${box.height}`);
  // the letterboxed 4:3 thumbnail is cropped to its 16:9 picture, so no black bar shows at the top
  const top = await w.locator('img.thumb').first().evaluate(async img => {
    img.loading = 'eager';
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    return [img.naturalWidth, img.naturalHeight, ...g.getImageData(c.width / 2, 1, 1, 1).data.slice(0, 3)];
  });
  assert.deepEqual(top.slice(0, 2), [320, 180]);
  assert.ok(Math.max(...top.slice(2)) > 60, `top row is picture, not a black bar: rgb ${top.slice(2)}`);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('cards sit two or more to a row on a phone', async t => {
  if (!(await needs(t, '/videos/'))) return;
  const page = await open(phone, '/videos/', null, { hasTouch: true, isMobile: true });
  const w = win(page, 'folder:/videos/');
  const cards = w.locator('.folder-cards > li');
  await cards.first().waitFor();
  const [a, b] = [await cards.nth(0).boundingBox(), await cards.nth(1).boundingBox()];
  assert.equal(Math.round(a.y), Math.round(b.y), 'the first two cards share a row');
  assert.ok(b.x + b.width <= phone.width, 'and fit the screen');
  assert.ok(a.width >= 140, `cards stay readable at ${a.width}px`);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('the arrow keys move through a folder\'s icons, across its groups, and Enter opens one', async t => {
  if (!(await html('/links/')).includes('gohugo.io')) return t.skip('no example links folder');
  const page = await open(desktop, '/links/');
  const w = win(page, 'folder:/links/');
  await w.locator('.folder li').first().waitFor();
  const at = () => page.evaluate(() => document.activeElement?.querySelector(':scope > span:not(.ico)')?.textContent);
  await w.locator('.folder a').first().focus();
  // Tools: Hugo, Haiku; Reading: MDN Web Docs, About this site, each group a row of its own
  for (const [key, want] of [['ArrowRight', 'Haiku'], ['ArrowDown', 'About this site'], ['ArrowLeft', 'MDN Web Docs'], ['ArrowUp', 'Hugo'], ['ArrowUp', 'Hugo'], ['ArrowDown', 'MDN Web Docs']]) {
    await page.keyboard.press(key);
    assert.equal(await at(), want, `${key} to ${want}`);
  }
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await win(page, 'page:/about/').waitFor();
  assert.deepEqual(page.errors, []);
  await page.context().close();
});
