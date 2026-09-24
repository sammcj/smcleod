// Spotlight search (D28): triggers (panel button, Cmd/Ctrl+K, "/" but never while typing), full-text results in
// groups, keyboard and pointer selection, opening through the router, focus handling, and the phone sheet.
// Queries come from the site's own index, so the spec runs on any deskbar site.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { env, useBrowser, open, shot, desktop, phone } from './lib.mjs';

useBrowser();

const dlg = page => page.locator('dialog.spotlight');
const isOpen = page => page.evaluate(() => !!document.querySelector('dialog.spotlight[open]'));
const q = page => dlg(page).locator('.sp-q');
const where = page => page.evaluate(() => location.pathname + location.search);
const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');

let index = null;
async function siteIndex(page) {
  index ||= (await (await fetch(env.base + await page.locator('#searchBtn').getAttribute('data-index'))).json()).entries;
  return index;
}

// A word found in exactly one entry's body and in no title, description, tag or series anywhere
function bodyOnlyWord(entries) {
  const shown = entries.map(e => norm([e.title, e.description, ...(e.tags || []), ...(e.series || [])].join(' '))).join(' ');
  for (const e of entries.filter(x => x.kind === 'post' && x.body)) {
    for (const w of new Set(norm(e.body).match(/[a-z]{9,}/g) || [])) {
      if (shown.includes(w)) continue;
      const hits = entries.filter(x => new RegExp('(^|[^a-z0-9])' + w).test(norm(x.body)));
      if (hits.length === 1) return { word: w, entry: e };
    }
  }
  return null;
}

async function openWithButton(page) {
  await page.locator('#searchBtn').click();
  await dlg(page).waitFor();
  await page.waitForFunction(() => !/Loading/.test(document.querySelector('.sp-status')?.textContent || ''));
}

test('the panel button opens a modal combobox dialog; Esc closes it and focus goes back', async () => {
  const page = await open(desktop, '/');
  await openWithButton(page);
  assert.ok(await isOpen(page));
  assert.equal(await dlg(page).getAttribute('aria-modal'), 'true');
  assert.ok(await q(page).evaluate(el => el === document.activeElement), 'the field has focus');
  assert.equal(await q(page).getAttribute('role'), 'combobox');
  assert.equal(await dlg(page).locator('[role="listbox"]').getAttribute('id'), await q(page).getAttribute('aria-controls'));
  assert.match(await dlg(page).locator('.sp-status').textContent(), /^Search \d+ posts/);

  // focus stays inside: Tab moves between the field and the close button only
  await page.keyboard.press('Tab');
  assert.ok(await dlg(page).locator('.sp-close').evaluate(el => el === document.activeElement));
  await page.keyboard.press('Tab');
  assert.ok(await q(page).evaluate(el => el === document.activeElement));
  await page.keyboard.press('Shift+Tab');
  assert.ok(await dlg(page).locator('.sp-close').evaluate(el => el === document.activeElement));

  await page.keyboard.press('Escape');
  assert.ok(!(await isOpen(page)));
  assert.ok(await page.locator('#searchBtn').evaluate(el => el === document.activeElement), 'focus returns to the button');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('Cmd+K, Ctrl+K and "/" open it, but never while typing in a field or editable text', async () => {
  const page = await open(desktop, '/');
  for (const key of ['Meta+K', 'Control+K', '/']) {
    await page.evaluate(() => document.activeElement?.blur());
    await page.keyboard.press(key);
    await dlg(page).waitFor();
    assert.ok(await isOpen(page), key + ' opens');
    assert.equal(await q(page).inputValue(), '', key + ' is not typed into the field');
    await page.keyboard.press('Escape');
    assert.ok(!(await isOpen(page)));
  }

  // the menu's search field keeps its own keys
  await page.locator('#menuBtn').click();
  await page.locator('#mnQ').click();
  await page.keyboard.type('a/b');
  await page.keyboard.press('Control+K');
  await page.keyboard.press('Meta+K');
  assert.ok(!(await isOpen(page)), 'no spotlight from inside an input');
  assert.equal(await page.locator('#mnQ').inputValue(), 'a/b', 'the slash is typed');
  await page.evaluate(() => document.getElementById('menu').hidePopover());

  // and so does editable content
  await page.evaluate(() => {
    const d = Object.assign(document.createElement('div'), { contentEditable: 'true', id: 'ed' });
    Object.assign(d.style, { position: 'fixed', top: '100px', left: '100px', width: '200px', height: '40px', zIndex: 200000, background: '#fff' });
    document.body.append(d);
  });
  await page.locator('#ed').click();
  await page.keyboard.type('x/y');
  await page.keyboard.press('Control+K');
  assert.ok(!(await isOpen(page)), 'no spotlight from contenteditable');
  assert.equal(await page.locator('#ed').textContent(), 'x/y');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('full-text search: a word only in a post body finds it, with a highlighted snippet; Enter opens it', async t => {
  const page = await open(desktop, '/');
  const found = bodyOnlyWord(await siteIndex(page));
  if (!found) return t.skip('no body-only word in this index');
  await openWithButton(page);
  await q(page).fill(found.word);
  const opt = dlg(page).locator('.sp-opt.on');
  await opt.waitFor();
  assert.equal(await opt.getAttribute('href'), found.entry.url);
  assert.equal(await opt.getAttribute('aria-selected'), 'true');
  assert.equal(await q(page).getAttribute('aria-activedescendant'), await opt.getAttribute('id'));
  assert.equal(await q(page).getAttribute('aria-expanded'), 'true');
  assert.equal(norm(await opt.locator('small mark').first().textContent()), found.word, 'the snippet shows the matched word');
  assert.equal(await dlg(page).locator('.sp-group[role="group"][aria-label="Posts"]').count(), 1);

  await page.keyboard.press('Enter');
  await page.waitForFunction(u => location.pathname === u, found.entry.url);
  assert.ok(!(await isOpen(page)));
  await page.locator(`.win:not([hidden]) .view:not([hidden]) h1`).filter({ hasText: found.entry.title }).first().waitFor();
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('arrow keys move the selection; no match says so', async () => {
  const page = await open(desktop, '/');
  await openWithButton(page);
  // a single common letter matches many entries across groups
  await q(page).fill('e');
  const opts = dlg(page).locator('.sp-opt');
  await opts.first().waitFor();
  const n = await opts.count();
  assert.ok(n > 2);
  const sel = () => dlg(page).locator('.sp-opt.on').getAttribute('id');
  assert.equal(await sel(), 'sp-o-0');
  await page.keyboard.press('ArrowDown');
  assert.equal(await sel(), 'sp-o-1');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  assert.equal(await sel(), 'sp-o-' + (n - 1), 'wraps round');
  assert.equal(await q(page).getAttribute('aria-activedescendant'), 'sp-o-' + (n - 1));

  await q(page).fill('zzqxqzz');
  assert.match(await dlg(page).locator('.sp-status').textContent(), /No results for "zzqxqzz"/);
  assert.equal(await opts.count(), 0);
  assert.equal(await q(page).getAttribute('aria-expanded'), 'false');
  await page.context().close();
});

test('tools, photo albums and tags are found and open in their own windows with a click', async t => {
  const page = await open(desktop, '/');
  const entries = await siteIndex(page);
  const cases = [
    ['Tools', entries.find(e => e.kind === 'tool')],
    ['Photos', entries.find(e => e.kind === 'photo' && e.url.includes('?album='))],
    ['Tags and series', entries.find(e => e.kind === 'tag')],
  ].filter(c => c[1]);
  if (!cases.length) return t.skip('no tools, albums or tags');
  for (const [group, e] of cases) {
    await openWithButton(page);
    await q(page).fill(e.title);
    const opt = dlg(page).locator(`.sp-group[aria-label="${group}"] .sp-opt[href="${e.url}"]`);
    await opt.waitFor();
    await opt.click();
    await page.waitForFunction(u => location.pathname + location.search === u, e.url);
    assert.ok(!(await isOpen(page)), group + ': closes on open');
    assert.equal(await where(page), e.url);
  }
  assert.ok(await page.locator('.win:not([hidden])').count() >= 1);
  // a click on the backdrop closes it
  await openWithButton(page);
  await page.mouse.click(10, 880);
  assert.ok(!(await isOpen(page)));
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

for (const theme of ['light', 'dark']) {
  test(`screenshots at 1440 and 390 (${theme})`, async () => {
    // init scripts are serialised, so each theme gets its own function rather than a closure
    const init = theme === 'dark'
      ? () => localStorage.setItem('deskbar:theme', '"dark"')
      : () => localStorage.setItem('deskbar:theme', '"light"');
    let page = await open(desktop, '/', init);
    await openWithButton(page);
    await q(page).fill('window');
    await dlg(page).locator('.sp-opt').first().waitFor();
    await page.keyboard.press('ArrowDown');
    await shot(page, `spotlight-1440-${theme}`);
    await page.context().close();

    page = await open(phone, '/', init);
    await openWithButton(page);
    const box = await dlg(page).boundingBox();
    assert.equal(Math.round(box.width), phone.width, 'a full-width sheet');
    assert.ok(box.x === 0 && box.y === 0);
    await q(page).fill('window');
    await dlg(page).locator('.sp-opt').first().waitFor();
    await shot(page, `spotlight-390-${theme}`);
    // Cancel closes on a phone
    await dlg(page).locator('.sp-close').click();
    assert.ok(!(await isOpen(page)));
    assert.deepEqual(page.errors, []);
    await page.context().close();
  });
}

test('phone: tap the button, tap a result, it opens as a window', async () => {
  const ctx = await env.browser.newContext({ viewport: phone, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(env.base + '/');
  await page.waitForSelector('html.wm-ready');
  const btn = page.locator('#searchBtn');
  assert.ok(await btn.isVisible(), 'the button is in the phone panel');
  await btn.tap();
  await dlg(page).waitFor();
  await q(page).fill('a');
  const opt = dlg(page).locator('.sp-opt').first();
  await opt.waitFor();
  const url = await opt.getAttribute('href');
  await opt.tap();
  await page.waitForFunction(u => location.pathname + location.search === u, url);
  assert.ok(!(await isOpen(page)));
  await page.locator('.win:not([hidden])').first().waitFor();
  await ctx.close();
});
