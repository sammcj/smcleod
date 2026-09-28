// What only one look does, beyond what looks.spec.mjs checks of them all: Platinum's startup chime, Pixel's night sky
// and cartridges, Memphis's pressed buttons, Broadsheet's reading bar, Clearlooks' window list and Phosphor's function
// keys.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useBrowser, open, openLook, needs, box, css, win, cards, desktop, phone } from './lib.mjs';

useBrowser();

test('picking Platinum plays the startup chime and sets the menus in Chicago; a reload stays quiet', async t => {
  if (!(await needs(t, '/control-panel/'))) return;
  // counts the chime's oscillators; the real context stays silent in a headless browser
  const spy = () => {
    window.__notes = 0;
    const start = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (...a) { window.__notes++; return start.apply(this, a); };
  };
  const page = await open(desktop, '/control-panel/', spy);
  await win(page, 'control-panel').locator('.cp').waitFor();
  await page.locator('.cp-opt', { hasText: 'Flat' }).click();
  assert.equal(await page.evaluate(() => window.__notes), 0, 'other styles are quiet');
  await page.locator('.cp-opt', { hasText: 'Platinum' }).first().click();
  await page.waitForFunction(() => document.documentElement.dataset.deco === 'platinum');
  assert.equal(await page.evaluate(() => window.__notes), 14, 'seven notes of two voices');
  assert.match(await css(page.locator('#panel'), 'fontFamily'), /Chicago FLF/);
  await page.reload();
  await page.waitForSelector('html.wm-ready');
  await win(page, 'control-panel').locator('.cp').waitFor();
  assert.equal(await page.evaluate(() => window.__notes), 0);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('Pixel: stars twinkle and clouds drift over the dusk sky, and the day sky has no stars', async () => {
  const layer = (page, pseudo, prop) => css(page.locator('body'), prop, pseudo);
  const dusk = await openLook(desktop, '/', { preset: 'pixel', theme: 'dark' }, { reducedMotion: 'no-preference' });
  assert.match(await css(dusk.locator('body'), 'backgroundImage'), /0b0a1f/, 'the night sky');
  assert.match(await layer(dusk, '::before', 'backgroundImage'), /svg\+xml/, 'stars');
  assert.equal(await layer(dusk, '::before', 'animationName'), 'pk-twinkle');
  assert.equal(await layer(dusk, '::after', 'animationName'), 'pk-drift');
  await dusk.context().close();
  const day = await openLook(desktop, '/', 'pixel');
  assert.match(await css(day.locator('body'), 'backgroundImage'), /2f7fd8/, 'the day sky');
  assert.equal(await layer(day, '::before', 'backgroundImage'), 'none', 'no stars by day');
  await day.context().close();
});

test('Pixel cartridges: pointing draws one out, and a running app lights its LED', async () => {
  const page = await openLook(desktop, '/posts/', { dock: 'pixel-cartridge' });
  await win(page, 'tracker').waitFor();
  const d = page.locator('#dock'), run = d.locator('.dk.run'), idle = d.locator('.dk:not(.run)');
  assert.equal(await css(idle, 'backgroundColor', '::after'), 'rgb(88, 34, 42)', 'an unlit LED');
  assert.equal(await css(run, 'backgroundColor', '::after'), 'rgb(255, 59, 59)', 'a lit LED');
  assert.equal(await css(d, 'pointerEvents', '::after'), 'none', 'the slot lip lets the pointer through');
  const before = await box(idle.locator('.ico'));
  await idle.first().hover();
  assert.ok((await box(idle.locator('.ico'))).y < before.y - 4, 'pointing draws the cartridge out');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('Memphis: a pressed toolbar button drops into its shadow', async () => {
  const page = await openLook(desktop, '/', 'memphis');
  await cards(page).first().click();
  const btn = win(page, 'reader').locator('.toolbar .tb:not(:disabled)').first();
  await btn.waitFor();
  const b = await btn.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  const s = await css(btn, ['translate', 'boxShadow']);
  await page.mouse.up();
  assert.deepEqual(s, { translate: '2px 2px', boxShadow: 'none' });
  await page.context().close();
});

test('Broadsheet: a grotesque headline over a serif body, and a reading bar that follows the scroll unless motion is reduced', async t => {
  const page = await openLook(desktop, '/', 'broadsheet', { reducedMotion: 'no-preference' });
  await cards(page).first().click();
  const r = win(page, 'reader');
  await r.locator('.rd h1').waitFor();
  assert.match(await css(r.locator('.rd h1'), 'fontFamily'), /Space Grotesk/);
  assert.match(await css(r.locator('.rd-body p'), 'fontFamily'), /^"?Literata/);
  const bar = await r.locator('.rd-scroll').evaluate(async el => {
    const s = () => getComputedStyle(el, '::before');
    const at = { supported: CSS.supports('animation-timeline: scroll()'), scrolls: el.scrollHeight > el.clientHeight + 100, name: s().animationName, position: s().position, from: parseFloat(s().backgroundSize) };
    el.scrollTop = (el.scrollHeight - el.clientHeight) / 2;
    await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
    return { ...at, to: parseFloat(s().backgroundSize) };
  });
  await page.context().close();
  if (!bar.supported) return t.skip('no scroll-driven animations in this browser');
  assert.deepEqual([bar.name, bar.position], ['bs-read', 'sticky']);
  if (bar.scrolls) assert.ok(bar.from < 5 && bar.to > 30 && bar.to < 70, `the bar fills with the scroll: ${bar.from}% then ${bar.to}%`);

  const still = await openLook(desktop, '/', 'broadsheet');
  await cards(still).first().click();
  await win(still, 'reader').locator('.rd h1').waitFor();
  assert.equal(await css(win(still, 'reader').locator('.rd-scroll'), 'content', '::before'), 'none');
  await still.context().close();
});

test('Clearlooks: the window list and the pager come down into the bottom panel, with or without its window style', async () => {
  for (const look of ['clearlooks', { deco: 'haiku', dock: 'clearlooks' }]) {
    const page = await openLook(desktop, '/posts/', look);
    await win(page, 'tracker').locator('a[data-url]').first().click();
    await win(page, 'reader').locator('.rd h1').waitFor();
    const dock = await box(page.locator('#dock')), at = JSON.stringify(look);
    assert.ok(Math.abs(dock.y + dock.height - desktop.height) <= 1 && dock.width === desktop.width && dock.height <= 40, `${at}: a slim panel along the bottom ${JSON.stringify(dock)}`);
    const tasks = page.locator('#tasks .task');
    assert.equal(await tasks.count(), 2, at);
    for (const t of await tasks.all()) assert.ok((await t.boundingBox()).y >= dock.y, `${at}: window list in the bottom panel`);
    const [home, pager] = [await box(page.locator('#dock #homeBtn')), await box(page.locator('#dock #winsBtn'))];
    assert.ok(home.x < 20 && pager.x + pager.width > desktop.width - 20, `${at}: Show desktop first, the pager last`);
    assert.notEqual(await css(page.locator('#dock #winsBtn'), 'content', '::after'), 'none', `${at}: a workspace pager`);
    // with its window style, a minimised window's title is in brackets
    if (look === 'clearlooks') {
      await win(page, 'reader').locator('.tab.on .ctl.min').click();
      await page.locator('#tasks .task.min').waitFor();
      assert.equal(await css(page.locator('#tasks .task.min span'), 'content', '::before'), '"["', at);
    }
    assert.deepEqual(page.errors, []);
    await page.context().close();
  }
  // its window style over the glass dock leaves the window list in the top panel
  const page = await openLook(desktop, '/posts/', { deco: 'clearlooks', wall: 'clearlooks' });
  await win(page, 'tracker').locator('.pc').first().waitFor();
  assert.equal(await css(page.locator('#tasks'), 'position'), 'static');
  await page.context().close();
});

test('Phosphor: the dock is a bar of numbered function keys along the bottom, under any window style, on a desktop and a phone', async () => {
  for (const [vp, look] of [[desktop, 'phosphor'], [desktop, { dock: 'phosphor' }], [phone, { deco: 'beos', palette: 'xfce', dock: 'phosphor', theme: 'dark' }]]) {
    const page = await openLook(vp, '/', look);
    const dock = page.locator('#dock'), key = dock.locator('.dk').first(), at = `${vp.width} ${JSON.stringify(look)}`;
    const db = await box(dock);
    assert.ok(db.x === 0 && Math.round(db.width) === vp.width, `${at}: across the screen ${JSON.stringify(db)}`);
    assert.equal(await css(key, 'content', '::before'), 'counter(fk)', `${at}: numbered keys`);
    assert.equal(await key.locator('.ico').isVisible(), false, `${at}: labels, not icons`);
    assert.ok(parseFloat(await css(key.locator('.lbl'), 'width')) > 40, `${at}: label shown`);
    const widths = await dock.locator('.dk').evaluateAll(ks => ks.map(k => Math.round(k.getBoundingClientRect().width)));
    assert.ok(Math.max(...widths) - Math.min(...widths) <= 1, `${at}: even keys ${widths}`);
    if (vp === desktop) {
      assert.ok(Math.round(db.y + db.height) === vp.height && db.height <= 40, `${at}: a slim bar on the bottom edge`);
      assert.equal(await css(dock.locator('#winsBtn'), 'content', '::after'), '"Windows"', at);
      assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--dock-h').trim()), '36px', `${at}: windows get the room`);
    }
    assert.deepEqual(page.errors, []);
    await page.context().close();
  }
});
