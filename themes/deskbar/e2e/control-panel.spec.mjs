// The Control panel (lazy/control-panel.js) and the settings behind it (settings.js): three panes with their own
// addresses (?pane=), choices that apply at once and come back before first paint, the dock styles, the reader
// font, the reader toolbar's controls sharing the Posts pane's settings, the Test screen saver button, and the old
// /appearance/ address. Skips without /control-panel/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { env, useBrowser, open, needs, shot, win, cards, path, desktop, phone } from './lib.mjs';

useBrowser();

const app = '/control-panel/';
const cp = page => win(page, 'control-panel');
const ready = page => cp(page).locator('.cp').waitFor();
const go = (page, url) => page.evaluate(u => window.deskbar.go(u), url);
const pick = (page, key, value) => cp(page).locator(`input[name="cp-${key}"][value="${value}"]`).check();
const checked = (page, key) => cp(page).locator(`input[name="cp-${key}"]:checked`).getAttribute('value');
const pane = page => cp(page).locator('.cp-pane:not([hidden])').getAttribute('id');
const navTo = (page, id) => cp(page).locator(`.cp-nav a[data-pane="${id}"]`).click();
const radios = (page, id) => cp(page).locator(`#cp-${id} input[type=radio]`).evaluateAll(rs => [...new Set(rs.map(r => r.name.slice(3)))]);
const attrs = page => page.evaluate(() => Object.fromEntries(Object.entries(document.documentElement.dataset)
  .filter(([k]) => ['theme', 'palette', 'deco', 'wall', 'dock', 'rdWidth', 'rdFont'].includes(k))));
const KEYS = ['palette', 'theme', 'deco', 'wall', 'dock', 'readerWidth', 'readerFont', 'textSize', 'saverKind', 'saver'];
const stored = page => page.evaluate(keys => Object.fromEntries(keys.flatMap(k => {
  const v = localStorage.getItem('deskbar:' + k);
  return v == null ? [] : [[k, JSON.parse(v)]];
})), KEYS);
const setSize = (page, n) => cp(page).locator('#cp-size').evaluate((el, n) => {
  el.value = n;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}, n);
const style = (page, sel, prop) => page.locator(sel).first().evaluate((el, p) => getComputedStyle(el)[p], prop);

test('three panes: Appearance first, then Posts and System, each at its own address', async t => {
  if (!(await needs(t, app))) return;
  const page = await open(desktop, app);
  await ready(page);
  assert.deepEqual(await cp(page).locator('.cp-nav a').allTextContents(), ['Appearance', 'Posts', 'System']);
  assert.equal(await pane(page), 'cp-appearance');
  assert.equal(await cp(page).locator('.cp-nav a[aria-current=page]').textContent(), 'Appearance');
  assert.deepEqual(await radios(page, 'appearance'), ['palette', 'theme', 'deco', 'wall', 'dock'], 'Appearance is the OS look only');
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

test('with the default look, no Control panel stylesheet loads', async t => {
  if (!(await needs(t, app))) return;
  const page = await open(desktop, '/');
  await page.locator('#themeBtn').click();
  await page.reload();
  await page.waitForSelector('html.wm-ready');
  assert.equal(await page.evaluate(() => performance.getEntriesByType('resource').filter(e => e.name.includes('/lazy/control-panel.')).length), 0);
  await page.context().close();
});

test('each palette, decorator and wallpaper applies', async t => {
  if (!(await needs(t, app))) return;
  const page = await open(desktop, app);
  await ready(page);
  await pick(page, 'theme', 'light');
  const tabs = { haiku: 'rgb(255, 203, 0)', beos: 'rgb(255, 203, 0)', xfce: 'rgb(163, 189, 223)', sage: 'rgb(181, 207, 156)',
    snow: 'rgb(188, 215, 251)', mint: 'rgb(174, 232, 211)', peach: 'rgb(255, 207, 186)', synthwave: 'rgb(255, 143, 203)',
    rose: 'rgb(233, 168, 166)', ember: 'rgb(245, 160, 74)', solar: 'rgb(213, 164, 28)', lagoon: 'rgb(255, 138, 112)' };
  const panels = new Set();
  for (const [p, tab] of Object.entries(tabs)) {
    await pick(page, 'palette', p);
    assert.equal(await style(page, '.win.active .tab.on', 'backgroundColor'), tab, p);
    panels.add(await style(page, '#panel', 'backgroundImage'));
  }
  assert.equal(panels.size, Object.keys(tabs).length, 'each palette has its own panel');

  const decos = { haiku: ['0', '4px', '0px'], beos: ['-1', '3px', '0px'], flat: ['0', '0px', '7px'], clear: ['0', '5px', '0px'], liquid: ['-3', '26px', '20px'] };
  for (const [d, want] of Object.entries(decos)) {
    await pick(page, 'deco', d);
    const got = [await style(page, '.win.active .ctl.close', 'order'), await style(page, '.win.active .frame', 'paddingTop'),
      await style(page, '.win.active .frame', 'borderTopRightRadius')];
    assert.deepEqual(got, want, d);
  }

  const walls = new Set();
  for (const w of ['rings', 'plain', 'grid', 'dots', 'hills', 'liquid']) {
    await pick(page, 'wall', w);
    walls.add(await style(page, 'body', 'backgroundImage') + (await style(page, 'body', 'backgroundColor')));
  }
  assert.equal(walls.size, 6, 'each wallpaper draws differently');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

// What sets each dock style apart, measured from the dock and its first launcher
const dockLook = page => page.evaluate(() => {
  const d = document.getElementById('dock'), s = getComputedStyle(d), k = d.querySelector('.dk');
  return {
    bg: s.backgroundColor + s.backgroundImage, radius: s.borderTopLeftRadius, width: Math.round(d.getBoundingClientRect().width),
    item: Math.round(k.getBoundingClientRect().width), icon: Math.round(k.querySelector('.ico').getBoundingClientRect().width),
  };
});
const shape = ({ bg, ...rest }) => rest;

// Liquid Ass, the Apple Liquid Glass spoof: a window style that brings its own wallpaper and the glass dock
const corners = (page, sel) => page.locator(sel).first().evaluate(el => {
  const s = getComputedStyle(el);
  return [s.borderTopLeftRadius, s.borderTopRightRadius, s.borderBottomRightRadius, s.borderBottomLeftRadius];
});
const box = async loc => (await loc.boundingBox()).x;

test('Liquid Ass: traffic lights on the left, glass everywhere, no two corners alike, and back before first paint', async t => {
  if (!(await needs(t, app))) return;
  const page = await open(desktop, app, () => localStorage.setItem('deskbar:dock', '"deskbar"'), { reducedMotion: 'no-preference' });
  await ready(page);
  await pick(page, 'deco', 'liquid');
  assert.deepEqual(await attrs(page), { deco: 'liquid', wall: 'liquid' }, 'its wallpaper, and the glass dock');
  assert.equal(await checked(page, 'wall'), 'liquid');
  assert.equal(await checked(page, 'dock'), 'glass');

  // red, yellow and green, left of the title
  const tab = cp(page).locator('.tab.on');
  const [close, min, max, title] = await Promise.all(['.ctl.close', '.ctl.min', '.ctl.max', '.tt'].map(s => box(tab.locator(s))));
  assert.ok(close < min && min < max && max < title, `${close} < ${min} < ${max} < ${title}`);
  const lights = await Promise.all(['close', 'min', 'max'].map(c => style(page, `.win.active .ctl.${c}`, 'backgroundImage')));
  for (const [l, rgb] of [[lights[0], 'rgb(255, 95, 87)'], [lights[1], 'rgb(254, 188, 46)'], [lights[2], 'rgb(40, 200, 64)']]) assert.ok(l.includes(rgb), l);

  // glass: blurred and saturated behind the frame, panel and dock, and see-through
  for (const sel of ['.win.active .frame', '#panel', '#dock']) {
    const f = await style(page, sel, 'backdropFilter');
    assert.match(f, /blur\(\d+px\) saturate\(/, sel);
  }
  assert.match(await style(page, '.win.active .frame', 'backgroundColor'), /^rgba\(.*, 0\.\d+\)$/, 'translucent frame');
  // over-rounded, every corner different, and not the same between elements
  const frame = await corners(page, '.win.active .frame'), views = await corners(page, '.win.active .views'), dock = await corners(page, '#dock');
  for (const [name, c] of [['frame', frame], ['views', views], ['dock', dock]]) {
    assert.equal(new Set(c).size, 4, `${name}: ${c}`);
    assert.ok(c.every(r => parseFloat(r) >= 10), `${name} is round: ${c}`);
  }
  assert.notDeepEqual(frame, views);
  assert.notDeepEqual(frame, dock);
  // shadows, lots of them
  assert.ok((await style(page, '.win.active .frame', 'boxShadow')).match(/rgba?\(/g).length >= 8, 'excessive');
  // a wobble on hover, where motion is allowed
  const btn = cp(page).getByRole('button', { name: 'Reset to defaults' });
  await btn.hover();
  assert.equal(await btn.evaluate(el => getComputedStyle(el).animationName), 'lq-jelly');
  await shot(page, 'liquid-ass');

  // back on reload before first paint, as the other looks are
  await page.context().addInitScript(() => requestAnimationFrame(() => {
    const f = document.querySelector('.win .frame');
    window.__first = { deco: document.documentElement.dataset.deco, filter: f && getComputedStyle(f).backdropFilter };
  }));
  await page.reload();
  await page.waitForSelector('html.wm-ready');
  const first = await (await page.waitForFunction(() => window.__first)).jsonValue();
  assert.equal(first.deco, 'liquid');
  if (first.filter) assert.match(first.filter, /blur/);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('leaving Liquid Ass puts back the wallpaper and dock it replaced, unless the visitor has changed them since', async t => {
  if (!(await needs(t, app))) return;
  // seeded once, not on every load, so the reload below keeps what the panel stored
  const page = await open(desktop, app, () => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('deskbar:wall', '"grid"');
    localStorage.setItem('deskbar:dock', '"panel"');
  });
  await ready(page);
  await pick(page, 'deco', 'liquid');
  assert.deepEqual(await attrs(page), { deco: 'liquid', wall: 'liquid' });
  // remembered across a reload
  await page.reload();
  await ready(page);
  await pick(page, 'deco', 'beos');
  assert.deepEqual(await attrs(page), { deco: 'beos', wall: 'grid', dock: 'panel' });
  assert.equal(await checked(page, 'wall'), 'grid');
  assert.equal(await checked(page, 'dock'), 'panel');

  // the visitor's own picks made while on Liquid Ass stay
  await pick(page, 'deco', 'liquid');
  await pick(page, 'wall', 'dots');
  await pick(page, 'dock', 'deskbar');
  await pick(page, 'deco', 'flat');
  assert.deepEqual(await attrs(page), { deco: 'flat', wall: 'dots', dock: 'deskbar' });

  // with nothing stored before, the defaults come back
  await cp(page).getByRole('button', { name: 'Reset to defaults' }).click();
  await pick(page, 'deco', 'liquid');
  await pick(page, 'deco', 'haiku');
  assert.deepEqual(await attrs(page), {});
  assert.equal(await checked(page, 'wall'), 'rings');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

// Whole looks with a stylesheet of their own (css/deskbar/looks/, look-<name> in the lazy map), whichever exist
const looks = page => page.evaluate(() => Object.entries(JSON.parse(document.getElementById('deskbar-lazy').textContent))
  .flatMap(([k, u]) => (k.startsWith('look-') ? [[k.slice(5), u.css]] : [])));
const linked = (page, href) => page.evaluate(h => !!document.querySelector(`head link[rel=stylesheet][href="${h}"]`), href);

test('a whole look loads its stylesheet, brings its wallpaper, sets its own colours and is back before first paint', async t => {
  if (!(await needs(t, app))) return;
  const page = await open(desktop, app);
  await ready(page);
  const all = await looks(page);
  if (!all.length) return t.skip('no looks in this build');
  await pick(page, 'wall', 'grid');
  for (const [name, css] of all) {
    assert.ok(await linked(page, css), `${name}: the Control panel loads every look's stylesheet for its thumbnails`);
    await pick(page, 'deco', name);
    await page.waitForFunction(n => document.documentElement.dataset.deco === n, name);
    assert.equal((await attrs(page)).wall, name, `${name} brings its wallpaper`);
    assert.equal(await cp(page).locator('fieldset:has([name="cp-palette"])').evaluate(f => f.disabled), true, `${name} sets its own colours`);
    // before first paint: head.html writes the link in while it is still parsing, ahead of the page's <body>
    await page.reload({ waitUntil: 'commit' });
    await page.waitForFunction(() => document.body);
    assert.equal(await linked(page, css), true, `${name} is linked from head.html on reload`);
    await ready(page);
  }
  await pick(page, 'deco', 'haiku');
  assert.deepEqual(await attrs(page), { wall: 'grid' }, 'leaving the last look puts back the wallpaper and dock');
  assert.equal(await cp(page).locator('fieldset:has([name="cp-palette"])').evaluate(f => f.disabled), false);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

// Clear: the same glass without the joke, with a title bar joined to the frame and its controls in one capsule
test('Clear: a glass title bar across the window, its controls together on the right, and a wallpaper of its own', async t => {
  if (!(await needs(t, app))) return;
  const page = await open(desktop, app, () => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('deskbar:wall', '"grid"');
    localStorage.setItem('deskbar:dock', '"panel"');
  }, { reducedMotion: 'no-preference' });
  await ready(page);
  await pick(page, 'deco', 'clear');
  assert.deepEqual(await attrs(page), { deco: 'clear', wall: 'clear' }, 'its wallpaper, and the glass dock');
  assert.equal(await checked(page, 'wall'), 'clear');

  // the tab spans the frame, and the controls follow the title, touching, inside it
  const tab = cp(page).locator('.tab.on'), frame = cp(page).locator('.frame');
  const [tb, fb] = [await tab.boundingBox(), await frame.boundingBox()];
  assert.ok(Math.abs(tb.x - fb.x) <= 1 && Math.abs(tb.width - fb.width) <= 1, `title bar ${JSON.stringify(tb)} over frame ${JSON.stringify(fb)}`);
  assert.ok(Math.abs(tb.y + tb.height - fb.y) <= 1, 'joined to the frame');
  const [title, min, max, close] = await Promise.all(['.tt', '.ctl.min', '.ctl.max', '.ctl.close'].map(s => tab.locator(s).boundingBox()));
  assert.ok(title.x < min.x && min.x < max.x && max.x < close.x, 'title, then minimise, maximise and close');
  assert.ok(Math.abs(min.x + min.width - max.x) <= 1 && Math.abs(max.x + max.width - close.x) <= 1, 'one capsule');
  assert.ok(close.x + close.width <= tb.x + tb.width && close.x + close.width >= tb.x + tb.width - 6, 'at the right end');

  // glass with even corners, one soft shadow and no wobble
  assert.match(await style(page, '.win.active .frame', 'backdropFilter'), /blur\(\d+px\) saturate\(/);
  const fc = await corners(page, '.win.active .frame');
  assert.deepEqual(fc.slice(2), ['12px', '12px'], `even lower corners: ${fc}`);
  assert.ok((await style(page, '.win.active .frame', 'boxShadow')).match(/rgba?\(/g).length <= 3, 'restrained');
  const btn = cp(page).getByRole('button', { name: 'Reset to defaults' });
  await btn.hover();
  assert.equal(await btn.evaluate(el => getComputedStyle(el).animationName), 'none');
  await shot(page, 'clear');

  // one glass look to the other swaps the wallpaper; leaving both puts the visitor's back
  await pick(page, 'deco', 'liquid');
  assert.deepEqual(await attrs(page), { deco: 'liquid', wall: 'liquid' });
  await pick(page, 'deco', 'clear');
  await pick(page, 'deco', 'haiku');
  assert.deepEqual(await attrs(page), { wall: 'grid', dock: 'panel' });
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('Liquid Ass with reduced motion: no wobble', async t => {
  if (!(await needs(t, app))) return;
  const page = await open(desktop, app, () => localStorage.setItem('deskbar:deco', '"liquid"'));
  await ready(page);
  const btn = cp(page).getByRole('button', { name: 'Reset to defaults' });
  await btn.hover();
  assert.equal(await btn.evaluate(el => getComputedStyle(el).animationName), 'none');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('dock styles are distinct, independent of the palette, and the same after a reload', async t => {
  if (!(await needs(t, app))) return;
  const page = await open(desktop, app);
  await ready(page);
  const styles = await cp(page).locator('input[name="cp-dock"]').evaluateAll(rs => rs.map(r => r.value));
  assert.deepEqual(styles, ['glass', 'deskbar', 'panel']);
  const seen = {};
  for (const s of styles) {
    await pick(page, 'dock', s);
    seen[s] = await dockLook(page);
    await shot(page, 'dock-' + s);
  }
  assert.equal(new Set(Object.values(seen).map(v => JSON.stringify(v))).size, 3, 'three different docks');
  assert.equal(seen.panel.width, 1440, 'Panel spans the screen');
  assert.equal(seen.deskbar.radius, '0px', 'Deskbar is square');

  // the palette doesn't change the dock style, and a maximised window stops above whichever dock is showing
  await pick(page, 'dock', 'deskbar');
  await pick(page, 'palette', 'sage');
  assert.equal(await page.evaluate(() => document.documentElement.dataset.dock), 'deskbar');
  assert.deepEqual(shape(await dockLook(page)), shape(seen.deskbar));
  await cp(page).locator('.tab.on .ctl.max').click();
  const gap = await page.evaluate(() => document.getElementById('dock').getBoundingClientRect().top - document.querySelector('.win.active').getBoundingClientRect().bottom);
  assert.ok(gap >= 0, `maximised window clear of the dock (${gap}px)`);

  // chosen this visit (stylesheet appended) and restored on reload (written in by head.html) look the same
  for (const s of styles) {
    await pick(page, 'dock', s);
    const now = await dockLook(page);
    await page.goto(env.base + '/');
    await page.waitForSelector('html.wm-ready');
    assert.deepEqual(await dockLook(page), now, `${s} after a reload`);
    await page.goto(env.base + app);
    await page.waitForSelector('html.wm-ready');
    await ready(page);
  }
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('a visitor with the retired Minimal dock stored gets the default dock', async t => {
  if (!(await needs(t, app))) return;
  const glass = await open(desktop, app);
  await ready(glass);
  const want = await dockLook(glass);
  await glass.context().close();

  const page = await open(desktop, app, () => localStorage.setItem('deskbar:dock', '"minimal"'));
  await ready(page);
  assert.deepEqual(await dockLook(page), want, 'the glass dock');
  assert.equal(await checked(page, 'dock'), 'glass');
  assert.deepEqual(await attrs(page), {});
  assert.deepEqual(await stored(page), {}, 'forgotten');
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
  const page = await open(desktop, app, () => localStorage.setItem('deskbar:saver', '10'));
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
  const page = await open(desktop, app + '?pane=system', () => localStorage.setItem('deskbar:saver', '0.05'));
  await ready(page);
  const saver = page.locator('.saver');
  assert.deepEqual(await cp(page).locator('input[name="cp-saver"]').evaluateAll(rs => rs.map(r => r.value)), ['0', '1', '5', '10', '30']);
  await pick(page, 'saver', '0');
  assert.equal(await page.evaluate(() => localStorage.getItem('deskbar:saver')), '0');
  await page.waitForTimeout(4500);
  assert.equal(await saver.count(), 0, 'off takes effect without a reload');

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
