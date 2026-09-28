// The Control panel app (lazy/control-panel.js) and the settings behind it (settings.js): three panes with their own
// addresses (?pane=), choices that apply at once and come back before first paint, the reader font, the reader
// toolbar's controls sharing the Posts pane's settings, Reset, the Test screen saver button, the old /appearance/
// address, its launchers and its phone layout. What each Appearance choice shows is in appearance.spec.mjs. Skips
// without /control-panel/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { env, useBrowser, open, needs, shot, win, cards, path, desktop, phone, seed, style, go, cp, ready, pick, checked, attrs, stored } from './lib.mjs';

useBrowser();

const app = '/control-panel/';
const pane = page => cp(page).locator('.cp-pane:not([hidden])').getAttribute('id');
const navTo = (page, id) => cp(page).locator(`.cp-nav a[data-pane="${id}"]`).click();
const radios = (page, id) => cp(page).locator(`#cp-${id} input[type=radio]`).evaluateAll(rs => [...new Set(rs.map(r => r.name.slice(3)))]);
const setSize = (page, n) => cp(page).locator('#cp-size').evaluate((el, n) => {
  el.value = n;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}, n);

test('three panes: Appearance first, then Posts and System, each at its own address', async t => {
  if (!(await needs(t, app))) return;
  const page = await open(desktop, app);
  await ready(page);
  assert.deepEqual(await cp(page).locator('.cp-nav a').allTextContents(), ['Appearance', 'Posts', 'System']);
  assert.equal(await pane(page), 'cp-appearance');
  assert.equal(await cp(page).locator('.cp-nav a[aria-current=page]').textContent(), 'Appearance');
  assert.deepEqual(await radios(page, 'appearance'), ['preset', 'deco', 'palette', 'theme', 'dock', 'wall', 'crt'], 'Appearance is the OS look only, presets first');
  assert.deepEqual(await radios(page, 'posts'), ['readerWidth', 'readerFont']);
  assert.equal(await cp(page).locator('#cp-posts #cp-size').count(), 1, 'text size is on the Posts pane');
  assert.deepEqual(await radios(page, 'system'), ['saverKind', 'saver']);

  await navTo(page, 'posts');
  assert.equal(await pane(page), 'cp-posts');
  assert.equal(page.url(), env.base + app + '?pane=posts', 'the address names the pane');
  await shot(page, 'control-panel-posts');
  await navTo(page, 'system');
  assert.equal(await pane(page), 'cp-system');
  assert.equal(page.url(), env.base + app + '?pane=system');
  await shot(page, 'control-panel-system');
  await navTo(page, 'appearance');
  assert.equal(page.url(), env.base + app);

  // straight to a pane, by load and by an in-shell link
  await page.goto(env.base + app + '?pane=system');
  await page.waitForSelector('html.wm-ready');
  await ready(page);
  assert.equal(await pane(page), 'cp-system');
  await go(page, app + '?pane=posts');
  await page.waitForFunction(() => location.search === '?pane=posts');
  assert.equal(await pane(page), 'cp-posts');
  assert.equal(await page.locator('.win:not([hidden]) .view[data-key="control-panel"]').count(), 1, 'one Control panel window');
  // a link to the bare address shows the first pane again
  await go(page, app);
  await page.waitForFunction(() => location.search === '');
  assert.equal(await pane(page), 'cp-appearance');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test("a copied layout link comes back to the pane that was showing", async t => {
  if (!(await needs(t, app, '/about/'))) return;
  const page = await open(desktop, '/about/');
  await go(page, app + '?pane=system');
  await ready(page);
  await page.evaluate(() => { navigator.clipboard.writeText = s => { window.__copied = s; return Promise.resolve(); }; });
  // the pane changes after opening, and the link follows it
  await navTo(page, 'posts');
  await page.click('#winsBtn');
  await page.click('#switcher .sw-link');
  await page.waitForFunction(() => window.__copied);
  const u = new URL(await page.evaluate(() => window.__copied));
  assert.equal(u.pathname + u.searchParams.get('pane'), app + 'posts');
  await page.context().close();

  assert.match(u.searchParams.get('layout'), /(^|,)\/control-panel\/\?pane=posts(,|$)/, 'the window is listed with its pane');

  // with another page on top, the Control panel comes back from the layout parameter alone
  const again = await open(desktop, '/about/?layout=/about/,/control-panel/?pane=system');
  await ready(again);
  assert.equal(await pane(again), 'cp-system');
  assert.equal(path(again), '/about/');
  assert.deepEqual(again.errors, []);
  await again.context().close();
});

test('choices apply at once, persist, and are back on reload before first paint', async t => {
  if (!(await needs(t, app))) return;
  const page = await open(desktop, app);
  await ready(page);
  assert.deepEqual(await stored(page), {}, 'a first visit stores nothing');
  for (const [k, v] of Object.entries({ palette: 'xfce', theme: 'dark', deco: 'beos', wall: 'grid', dock: 'panel' })) await pick(page, k, v);
  await navTo(page, 'posts');
  await pick(page, 'readerWidth', 'wide');
  await pick(page, 'readerFont', 'sans');
  await setSize(page, 20);
  const want = { theme: 'dark', palette: 'xfce', deco: 'beos', wall: 'grid', dock: 'panel', rdWidth: 'wide', rdFont: 'sans' };
  assert.deepEqual(await attrs(page), want);
  assert.deepEqual(await stored(page), { palette: 'xfce', theme: 'dark', deco: 'beos', wall: 'grid', dock: 'panel', readerWidth: 'wide', readerFont: 'sans', textSize: 20 });
  assert.equal(await style(page, '.win.active .tab.on', 'backgroundColor'), 'rgb(138, 168, 210)', 'dark Xfce tab');
  assert.equal(await cp(page).locator('.cp-size span').textContent(), '20px');

  // At the first frame after the reload the stylesheet has loaded, as a render-blocking one, and applies
  await page.context().addInitScript(() => requestAnimationFrame(() => {
    const d = document.documentElement, css = performance.getEntriesByType('resource').find(e => e.name.includes('/lazy/control-panel.'));
    const dock = document.getElementById('dock');
    window.__first = {
      palette: d.dataset.palette, dock: d.dataset.dock, wall2: getComputedStyle(d).getPropertyValue('--wall-2').trim(),
      blocking: css?.renderBlockingStatus, dockLeft: dock && getComputedStyle(dock).left,
    };
  }));
  await page.reload();
  await page.waitForSelector('html.wm-ready');
  await ready(page);
  assert.deepEqual(await page.evaluate(() => window.__first), {
    palette: 'xfce', dock: 'panel', wall2: 'light-dark(#3f6189, #1d2d42)', blocking: 'blocking', dockLeft: '0px',
  });
  assert.deepEqual(await attrs(page), want);
  assert.equal(await pane(page), 'cp-posts', 'the reload keeps the pane, as the address names it');
  assert.equal(await page.evaluate(() => document.documentElement.style.getPropertyValue('--rd-size')), '20px');
  for (const [k, v] of Object.entries({ palette: 'xfce', theme: 'dark', deco: 'beos', wall: 'grid', dock: 'panel', readerWidth: 'wide', readerFont: 'sans' })) {
    assert.equal(await checked(page, k), v, `${k} shows the stored choice`);
  }
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test("the Posts pane and the reader's toolbar share width, text size and font, live", async t => {
  if (!(await needs(t, app))) return;
  const page = await open(desktop, '/');
  // counted from requests, since a busy page can fill the resource timing buffer before the font arrives
  let atkinson = 0;
  page.on('request', r => { if (r.url().includes('AtkinsonHyperlegible')) atkinson++; });
  await cards(page).first().click();
  const reader = win(page, 'reader');
  await reader.locator('.rd h1').waitFor();
  await go(page, app + '?pane=posts');
  await ready(page);
  await reader.locator('button[aria-label="Larger text"]').dispatchEvent('click'); // under the Control panel window
  assert.equal(await cp(page).locator('#cp-size').inputValue(), '19');
  assert.equal(await cp(page).locator('.cp-size span').textContent(), '19px');
  await reader.locator('.tb.width').dispatchEvent('click');
  assert.equal(await checked(page, 'readerWidth'), 'wide', 'normal steps to wide');

  await pick(page, 'readerWidth', 'narrow');
  assert.equal(await reader.locator('.tb.width').getAttribute('aria-label'), 'Reader width: narrow');
  await setSize(page, 22);
  assert.equal(await style(page, '.win:has(.view[data-key=reader]) .rd', 'fontSize'), '22px');

  const font = () => style(page, '.win:has(.view[data-key=reader]) .rd', 'fontFamily');
  assert.match(await font(), /Source Serif 4/);
  assert.equal(atkinson, 0, 'Atkinson Hyperlegible is not fetched until chosen');
  await pick(page, 'readerFont', 'atkinson');
  assert.match(await font(), /^"?Atkinson Hyperlegible/);
  assert.match(await style(page, '.cp-sample', 'fontFamily'), /^"?Atkinson Hyperlegible/, 'the sample shows the choice');
  await page.waitForFunction(() => document.fonts.check('16px "Atkinson Hyperlegible"'));
  assert.ok(atkinson > 0, 'fetched once chosen');
  await pick(page, 'readerFont', 'mono');
  assert.match(await font(), /JetBrains Mono/);
  await pick(page, 'readerFont', 'sans');
  assert.match(await font(), /Noto Sans/);
  assert.match(await style(page, '.win:has(.view[data-key=reader]) .rd h2, .win:has(.view[data-key=reader]) .rd h1', 'fontFamily'), /Noto Sans/, 'headings keep the UI font');
  await shot(page, 'control-panel-posts-reader');

  await page.locator('#themeBtn').click();
  await navTo(page, 'appearance');
  assert.notEqual(await checked(page, 'theme'), 'auto', 'the panel theme button shows in the app');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('Reset to defaults resets the pane on screen only', async t => {
  if (!(await needs(t, app))) return;
  const page = await open(desktop, app, seed({ saver: 10 }));
  await ready(page);
  for (const [k, v] of Object.entries({ palette: 'sage', theme: 'dark', deco: 'flat', wall: 'hills', dock: 'panel' })) await pick(page, k, v);
  await navTo(page, 'posts');
  await pick(page, 'readerWidth', 'narrow');
  await pick(page, 'readerFont', 'mono');
  await setSize(page, 23);
  await navTo(page, 'appearance');
  await cp(page).getByRole('button', { name: 'Reset to defaults' }).click();
  assert.deepEqual(await stored(page), { readerWidth: 'narrow', readerFont: 'mono', textSize: 23, saver: 10 }, 'Posts and System keep theirs');
  assert.deepEqual(await attrs(page), { rdWidth: 'narrow', rdFont: 'mono' });
  for (const [k, v] of Object.entries({ palette: 'haiku', theme: 'light', deco: 'haiku', wall: 'rings', dock: 'glass' })) {
    assert.equal(await checked(page, k), v, k);
  }
  assert.equal(await cp(page).getByRole('status').textContent(), 'Appearance is back to the defaults.');

  await navTo(page, 'posts');
  assert.equal(await cp(page).getByRole('status').textContent(), '', 'the note goes with the pane');
  await cp(page).getByRole('button', { name: 'Reset to defaults' }).click();
  assert.deepEqual(await stored(page), { saver: 10 });
  assert.equal(await cp(page).locator('#cp-size').inputValue(), '18');
  await navTo(page, 'system');
  await cp(page).getByRole('button', { name: 'Reset to defaults' }).click();
  assert.deepEqual(await stored(page), {});
  await page.reload();
  await page.waitForSelector('html.wm-ready');
  assert.deepEqual(await attrs(page), {}, 'still the defaults after a reload');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('System: the screen saver delay applies at once, and Test screen saver starts it now', async t => {
  if (!(await needs(t, app))) return;
  const page = await open(desktop, app + '?pane=system', seed({ saver: 1 }));
  await ready(page);
  // the idle watcher's timers from here on are fake (see screensaver.spec.mjs)
  await page.clock.install();
  const saver = page.locator('.saver');
  assert.deepEqual(await cp(page).locator('input[name="cp-saver"]').evaluateAll(rs => rs.map(r => r.value)), ['0', '1', '5', '10', '30']);
  await pick(page, 'saver', '0');
  assert.equal(await page.evaluate(() => localStorage.getItem('deskbar:saver')), '0');

  // Test starts it even with the saver off, and it goes as usual
  const btn = cp(page).getByRole('button', { name: 'Test screen saver' });
  await btn.click();
  await saver.waitFor();
  await page.waitForFunction(() => document.querySelector('.saver')?.classList.contains('on'));
  await shot(page, 'control-panel-saver-test');
  const box = await btn.boundingBox();
  await page.mouse.move(box.x + 200, box.y + 200, { steps: 4 });
  await saver.waitFor({ state: 'detached' });
  assert.equal(await pane(page), 'cp-system');

  // off takes effect without a reload, even for the timer armed by the press that turned it off. The saver's
  // bundle is loaded by now, so a saver would be up as soon as the time passed.
  await pick(page, 'saver', '1');
  await pick(page, 'saver', '0');
  await page.clock.fastForward(61_000);
  assert.equal(await saver.count(), 0, 'off takes effect without a reload');

  await pick(page, 'saver', '10');
  assert.equal(await page.evaluate(() => localStorage.getItem('deskbar:saver')), '10');
  await cp(page).getByRole('button', { name: 'Reset to defaults' }).click();
  assert.equal(await page.evaluate(() => localStorage.getItem('deskbar:saver')), null);
  const site = await page.evaluate(() => document.documentElement.dataset.saver);
  if (['0', '1', '5', '10', '30'].includes(site)) assert.equal(await checked(page, 'saver'), site);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('/appearance/ still works: it opens the Control panel on the Appearance pane', async t => {
  if (!(await needs(t, app, '/appearance/'))) return;
  // an alias stub redirects to the site's absolute permalink, so a direct load is the browser's business; the shell
  // follows it to the page's path
  const page = await open(desktop, '/');
  await go(page, '/appearance/');
  await page.waitForFunction(p => location.pathname === p, app);
  await ready(page);
  assert.equal(await pane(page), 'cp-appearance');
  // from another pane too
  await navTo(page, 'system');
  await go(page, '/appearance/');
  await page.waitForFunction(() => location.search === '');
  assert.equal(await pane(page), 'cp-appearance');
  assert.equal(path(page), app);
  // the old Appearance menu entry and context menu item point at the Control panel now
  assert.equal(await page.locator('a[href$="/appearance/"]').count(), 0);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('the dock and menu launch it', async t => {
  if (!(await needs(t, app))) return;
  const page = await open(desktop, '/');
  const dockLink = page.locator(`#dock a.dk[href$="${app}"]`);
  if (await dockLink.count()) {
    await dockLink.click();
    await ready(page);
    assert.equal(path(page), app);
  }
  assert.ok(await page.locator(`#menu a[href$="${app}"]`).count(), 'listed in the menu');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('on a phone the panes stack, fill the screen and have touch-sized controls', async t => {
  if (!(await needs(t, app))) return;
  const page = await open(phone, app);
  await ready(page);
  const nav = await cp(page).locator('.cp-nav').boundingBox(), body = await cp(page).locator('#cp-appearance').boundingBox();
  assert.ok(nav.y + nav.height <= body.y + 1, 'the pane list sits above the pane');
  await shot(page, 'control-panel-phone-appearance');
  // every control a finger uses is at least 44px tall
  const small = async id => cp(page).locator(`#cp-${id}`).evaluate(p => [...p.querySelectorAll('.cp-opt, button, input[type=range]'), ...document.querySelectorAll('.cp-nav a, .cp-foot button')]
    .filter(e => e.getClientRects().length && e.getBoundingClientRect().height < 44).map(e => e.className || e.textContent));
  assert.deepEqual(await small('appearance'), []);
  for (const id of ['posts', 'system']) {
    await navTo(page, id);
    assert.deepEqual(await small(id), [], id);
    await shot(page, 'control-panel-phone-' + id);
  }
  const over = await page.evaluate(() => document.querySelector('.cp').scrollWidth - document.querySelector('.cp').clientWidth);
  assert.equal(over, 0, 'nothing wider than the screen');
  await navTo(page, 'appearance');
  await pick(page, 'deco', 'flat');
  assert.equal(await style(page, '.win.active .frame', 'borderTopRightRadius'), '0px');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});
