// F7 review fixes: the Control panel stylesheet's place in the cascade, BeOS controls on phones, when the screen saver
// may start, long-press and selections versus the context menu, author comments in index.md, lazy bundles past the
// Resource Timing buffer, Chiptunes at rest, the saver setting and the window switcher (Home and End,
// the Posts window).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { env, useBrowser, open, needs, win, cards, desktop, phone } from './lib.mjs';

useBrowser();

let idx;
const index = async () => (idx ||= await (await fetch(env.base + '/deskbar.json')).json());
const go = (page, url) => page.evaluate(u => window.deskbar.go(u), url);
const menuOpen = page => page.locator('.ctx:popover-open').count();

// ---- Control panel: the same look whether chosen this visit (stylesheet appended) or restored on reload (head)

const PROPS = ['color', 'backgroundColor', 'backgroundImage', 'boxShadow', 'borderRadius', 'padding', 'width', 'height', 'order'];
const styleOf = (loc, props) => loc.evaluate((el, p) => { const s = getComputedStyle(el); return Object.fromEntries(p.map(k => [k, s[k]])); }, props);

async function looks(page, sketch) {
  const reader = win(page, 'reader');
  await reader.locator('.tab.on .tt').click();
  await page.mouse.move(2, 400);
  const out = {};
  const grab = async (name, loc) => { if (await loc.count()) out[name] = await styleOf(loc.first(), PROPS); };
  const hovered = async (name, loc) => {
    await loc.first().hover();
    await page.waitForTimeout(250);
    await grab(name, loc);
    await page.mouse.move(2, 400);
    await page.waitForTimeout(250);
  };
  await grab('close', reader.locator('.tab.on .ctl.close'));
  await grab('frame', reader.locator('.frame'));
  await grab('tb', reader.locator('.toolbar .tb').first());
  await grab('tab', reader.locator('.tab.on'));
  await grab('inactive ctl', win(page, 'tracker').locator('.tab.on .ctl.close'));
  await grab('seg on', win(page, 'tracker').locator('.seg.on'));
  await grab('seg', win(page, 'tracker').locator('.seg:not(.on)'));
  if (sketch) await grab('sketch tool', win(page, 'sketch').locator('.seg[aria-pressed=true]'));
  await hovered('close hover', reader.locator('.tab.on .ctl.close'));
  await hovered('min hover', reader.locator('.tab.on .ctl.min'));
  await page.click('#winsBtn');
  await page.locator('#switcher .sw-tab').first().waitFor();
  await grab('switcher ctl', page.locator('#switcher .sw-tab:not(.on) .ctl'));
  await page.keyboard.press('Escape');
  return out;
}

test('Control panel looks are the same chosen in this visit and after a reload', async t => {
  if (!(await needs(t, '/control-panel/'))) return;
  const sketch = (await fetch(env.base + '/sketch/')).ok;
  const { posts } = await index();
  const page = await open(desktop, posts[0].url);
  await win(page, 'reader').locator('.rd h1').waitFor();
  // a lazy app's stylesheet already in, so control-panel.css lands after it in this visit and before it on reload
  if (sketch) { await go(page, '/sketch/'); await win(page, 'sketch').locator('.sk-over').waitFor(); }
  await go(page, '/control-panel/');
  const ap = win(page, 'control-panel');
  await ap.locator('.cp').waitFor();
  for (const combo of [{ palette: 'sage', deco: 'flat' }, { palette: 'beos', deco: 'beos' }]) {
    await go(page, '/control-panel/');
    for (const [k, v] of Object.entries(combo)) await ap.locator(`input[name="cp-${k}"][value="${v}"]`).check();
    const now = await looks(page, sketch);
    // a fresh load of the post, so the Control panel (and its own copy of the stylesheet) stays closed
    await page.goto(env.base + posts[0].url);
    await page.waitForSelector('html.wm-ready');
    await win(page, 'reader').locator('.rd h1').waitFor();
    if (sketch) { await go(page, '/sketch/'); await win(page, 'sketch').locator('.sk-over').waitFor(); }
    const after = await looks(page, sketch);
    assert.deepEqual(after, now, `${JSON.stringify(combo)}: reload matches the visit`);
    if (combo.deco === 'flat') {
      assert.notEqual(now['seg on'].backgroundColor, now.seg.backgroundColor, 'Flat keeps the pressed view button');
      assert.equal(now['close hover'].color, 'rgb(255, 255, 255)', 'white cross on the red close box');
    }
  }
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('BeOS window controls stay touch sized on phones', async () => {
  const { posts } = await index();
  const page = await open(phone, posts[0].url, () => localStorage.setItem('deskbar:deco', '"beos"'));
  const reader = win(page, 'reader');
  await reader.locator('.rd h1').waitFor();
  const ctl = await styleOf(reader.locator('.tab.on .ctl.close'), ['width', 'height', 'order']);
  assert.deepEqual(ctl, { width: '32px', height: '32px', order: '-1' });
  assert.equal(await reader.locator('.tab.on .ctl.close svg').evaluate(s => getComputedStyle(s).width), '13px');
  assert.equal(await reader.locator('.frame').evaluate(f => getComputedStyle(f).padding), '0px');
  await page.context().close();
});

// ---- Screen saver

const quick = () => localStorage.setItem('deskbar:saver', JSON.stringify(0.02));
const saver = page => page.locator('.saver');

test('the screen saver stays away while a page window is open', async t => {
  if (!(await needs(t, '/about/'))) return;
  const page = await open(desktop, '/about/', quick);
  await page.locator('.win:not([hidden]) .view.reader').waitFor();
  await page.waitForTimeout(3000);
  assert.equal(await saver(page).count(), 0);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('a minimised reader does not keep the screen saver away', async () => {
  const { posts } = await index();
  const page = await open(desktop, posts[0].url, quick);
  const reader = win(page, 'reader');
  await reader.locator('.rd h1').waitFor();
  await reader.locator('.tab.on .ctl.min').click();
  await saver(page).waitFor({ timeout: 5000 });
  await page.keyboard.press('Escape');
  await saver(page).waitFor({ state: 'detached' });
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

// ---- Context menu

test('a long press while drawing in Sketch draws rather than opening the menu', async t => {
  if (!(await needs(t, '/sketch/'))) return;
  const page = await open(phone, '/sketch/', undefined, { hasTouch: true, isMobile: true });
  const over = win(page, 'sketch').locator('.sk-over');
  await over.waitFor();
  const b = await over.boundingBox();
  const cdp = await page.context().newCDPSession(page);
  const x = b.x + b.width / 2, y = b.y + b.height / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await page.waitForTimeout(900);
  assert.equal(await menuOpen(page), 0, 'no menu mid-stroke');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 40, y: y + 20 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(200);
  assert.equal(await menuOpen(page), 0);
  assert.equal(await win(page, 'sketch').getByRole('button', { name: 'Undo', exact: true }).isDisabled(), false, 'the stroke was drawn');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('right-clicking selected terminal text keeps the browser menu, with its Copy', async t => {
  if (!(await needs(t, '/terminal/'))) return;
  const page = await open(desktop, '/terminal/');
  const term = win(page, 'terminal');
  await term.locator('.term-in').fill('pwd');
  await term.locator('.term-in').press('Enter');
  const line = term.locator('.term-out > *').last();
  await line.waitFor();
  await page.evaluate(() => addEventListener('contextmenu', e => { window.__native = !e.defaultPrevented; }));
  await line.evaluate(el => getSelection().selectAllChildren(el));
  const box = await line.boundingBox();
  await page.mouse.click(box.x + 4, box.y + box.height / 2, { button: 'right' });
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => window.__native), true, 'browser menu');
  assert.equal(await menuOpen(page), 0);
  // with nothing selected the terminal window gets the desktop's menu as before
  await page.keyboard.press('Escape');
  await page.evaluate(() => getSelection().removeAllRanges());
  await page.mouse.click(box.x + 4, box.y + box.height / 2, { button: 'right' });
  await page.locator('.ctx:popover-open').waitFor();
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

// ---- index.md

const outsideCode = md => md.split('```').filter((_, i) => i % 2 === 0).join('');

test('index.md leaves out author HTML comments but keeps those in code', async () => {
  const { posts } = await index();
  let fenced = 0;
  for (const p of posts) {
    const res = await fetch(env.base + p.url + 'index.md');
    if (!res.ok) continue;
    const md = await res.text();
    assert.doesNotMatch(outsideCode(md), /<!--/, `${p.url}index.md`);
    if (/```[^]*<!--[^]*```/.test(md)) fenced++;
  }
  assert.ok(fenced > 0, 'a comment inside a code block survives');
});

// ---- About this desktop

test('About this desktop lists loaded bundles once the Resource Timing buffer is full', async t => {
  if (!(await needs(t, '/about-desktop/'))) return;
  const page = await open(desktop, '/', () => performance.setResourceTimingBufferSize(1));
  await go(page, '/about-desktop/');
  const facts = win(page, 'about-desktop').locator('.about-facts');
  await facts.waitFor();
  assert.match(await facts.textContent(), /about-desktop loaded/);
  await page.context().close();
});

// ---- Chiptunes

function spyPlayer() {
  const live = new Set(), si = setInterval, ci = clearInterval;
  window.__timers = live;
  window.setInterval = (fn, ms, ...a) => { const id = si(fn, ms, ...a); if (ms === 200) live.add(id); return id; };
  window.clearInterval = id => { live.delete(id); return ci(id); };
  window.__paints = 0;
  const clear = CanvasRenderingContext2D.prototype.clearRect;
  CanvasRenderingContext2D.prototype.clearRect = function (...a) { if (this.canvas.classList.contains('ct-scope')) window.__paints++; return clear.apply(this, a); };
}

test('Chiptunes rests while paused or minimised, and resumes where it paused', async t => {
  if (!(await needs(t, '/chiptunes/'))) return;
  const page = await open(desktop, '/chiptunes/', spyPlayer);
  const w = win(page, 'chiptunes');
  await w.locator('.view[data-loaded]').waitFor();
  const time = () => w.locator('.ct-time').textContent();
  await w.getByRole('button', { name: 'Play' }).click();
  // the seek slider's spoken value changes about once a second, not every frame
  const said = await w.locator('.ct-seek').evaluate(el => new Promise(done => {
    let n = 0;
    const mo = new MutationObserver(list => { n += list.length; });
    mo.observe(el, { attributes: true, attributeFilter: ['aria-valuetext'] });
    setTimeout(() => { mo.disconnect(); done(n); }, 2500);
  }));
  assert.ok(said <= 4, `${said} aria-valuetext updates in 2.5s`);
  await w.getByRole('button', { name: 'Pause' }).click();
  const at = await time();
  assert.match(at, /^0:0[2-3] /);
  assert.equal(await page.evaluate(() => window.__timers.size), 0, 'no scheduler running while paused');
  await page.waitForTimeout(800);
  assert.equal(await time(), at);
  await w.getByRole('button', { name: 'Play' }).click();
  await page.waitForTimeout(300);
  assert.match(await time(), /^0:0[2-4] /, 'carries on from where it paused');
  // minimised: still playing, but the scope is not drawn
  await w.locator('.tab.on .ctl.min').click();
  const p0 = await page.evaluate(() => window.__paints);
  await page.waitForTimeout(600);
  assert.equal(await page.evaluate(() => window.__paints), p0, 'no painting while minimised');
  assert.equal(await page.locator('.view[data-key="chiptunes"]').getAttribute('data-state'), 'playing');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

// ---- Control panel, System: screen saver setting

test('The Control panel sets the screen saver delay or turns it off, at once', async t => {
  if (!(await needs(t, '/control-panel/'))) return;
  const page = await open(desktop, '/control-panel/?pane=system', () => localStorage.setItem('deskbar:saver', '0.05'));
  const ap = win(page, 'control-panel');
  const radios = ap.locator('input[name="cp-saver"]');
  await radios.first().waitFor();
  assert.deepEqual(await radios.evaluateAll(rs => rs.map(r => r.value)), ['0', '1', '5', '10', '30']);
  await ap.locator('input[name="cp-saver"][value="0"]').check();
  assert.equal(await page.evaluate(() => localStorage.getItem('deskbar:saver')), '0');
  await page.waitForTimeout(4500);
  assert.equal(await saver(page).count(), 0, 'off takes effect without a reload');
  await ap.locator('input[name="cp-saver"][value="10"]').check();
  assert.equal(await page.evaluate(() => localStorage.getItem('deskbar:saver')), '10');
  await ap.getByRole('button', { name: 'Reset to defaults' }).click();
  assert.equal(await page.evaluate(() => localStorage.getItem('deskbar:saver')), null);
  const site = await page.evaluate(() => document.documentElement.dataset.saver);
  if (['0', '1', '5', '10', '30'].includes(site)) assert.equal(await ap.locator('input[name="cp-saver"]:checked').getAttribute('value'), site);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

// ---- Window switcher

test('Home and End move to the first and last entries of the window switcher', async t => {
  if (!(await needs(t, '/about/'))) return;
  const { posts } = await index();
  const page = await open(desktop, posts[0].url);
  await win(page, 'reader').locator('.rd h1').waitFor();
  await go(page, '/about/');
  await page.locator('.win:not([hidden]) .view[data-key="page:/about/"]').waitFor();
  await page.locator('#winsBtn').focus();
  await page.keyboard.press('Enter');
  const btns = page.locator('#switcher :is(.sw-open, .sw-link)');
  await btns.first().waitFor();
  await page.keyboard.press('Tab');
  const focused = () => page.evaluate(() => [...document.querySelectorAll('#switcher :is(.sw-open, .sw-link)')].indexOf(document.activeElement));
  await page.keyboard.press('End');
  assert.equal(await focused(), (await btns.count()) - 1);
  await page.keyboard.press('Home');
  assert.equal(await focused(), 0);
  await page.context().close();
});

test('the window switcher lists the Posts window, counts it in the badge and closes it', async () => {
  const page = await open(desktop);
  await cards(page).first().waitFor();
  assert.equal(await page.locator('#winsN').textContent(), '1', 'the badge counts the Posts window');
  await page.click('#winsBtn');
  const tab = page.locator('#switcher .sw-tab');
  await tab.first().waitFor();
  assert.equal(await tab.count(), 1);
  assert.equal(await tab.locator('.sw-open').textContent(), '~/posts');
  assert.equal(await page.locator('#switcher .sw-empty').count(), 0);
  await tab.locator('.sw-close').click();
  assert.equal(await page.locator('.view[data-key="tracker"]').count(), 0, 'closing it from the switcher closes the window');
  await page.locator('#switcher .sw-empty').waitFor();
  assert.equal(await page.locator('#winsN').textContent(), '');
  await page.keyboard.press('Escape');

  // minimised, it is marked so, and choosing it restores the window
  await page.locator('#icons .dicon[href$="/posts/"]').click();
  await win(page, 'tracker').locator('.tab .ctl.min').click();
  await page.click('#winsBtn');
  assert.match(await tab.locator('.sw-open').getAttribute('aria-label'), /^~\/posts, minimised$/);
  await tab.locator('.sw-open').click();
  await win(page, 'tracker').waitFor();
  assert.deepEqual(page.errors, []);
  await page.context().close();
});
