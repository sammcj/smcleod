// Phosphor (css/deskbar/looks/phosphor.css): a P3 amber tube. Text-mode windows with the title set into a double
// rule, a scanline and refresh-band overlay that never takes the pointer, a function-key bar for a dock, no Light
// mode, touch-sized on phones, nothing left behind when the look is off, and axe over its main states.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { env, useBrowser, open, needs, shot, win, cards, desktop, phone } from './lib.mjs';

useBrowser();

const LOOK = { deco: 'phosphor', wall: 'phosphor', dock: 'panel' };
const seed = look => `for (const [k, v] of Object.entries(${JSON.stringify(look)})) localStorage.setItem("deskbar:" + k, JSON.stringify(v));`;
const openLook = (vp, path, opts) => open(vp, path, seed(LOOK), opts);
const AMBER = 'rgb(255, 181, 46)', BLACK = 'rgb(13, 9, 0)';
const css = (loc, props, pseudo) => loc.evaluate((el, [ps, p]) => {
  const s = getComputedStyle(el, p);
  return Object.fromEntries(ps.map(k => [k, s[k]]));
}, [props, pseudo]);
const bodyPseudo = (page, pseudo, props) => page.evaluate(([p, ps]) => {
  const s = getComputedStyle(document.body, p);
  return Object.fromEntries(ps.map(k => [k, s[k]]));
}, [pseudo, props]);

test('Phosphor: amber text-mode windows, the title set into a double rule, [-][^][x] controls and no Light mode', async t => {
  if (!(await needs(t, '/posts/'))) return;
  const page = await openLook(desktop, '/posts/');
  const w = win(page, 'tracker');
  await w.locator('.pc').first().waitFor();
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme), 'dark');

  const frame = w.locator('.frame'), title = w.locator('.tab.on .tt');
  const f = await css(frame, ['borderTopStyle', 'borderTopWidth', 'borderTopColor', 'borderTopLeftRadius']);
  assert.deepEqual(f, { borderTopStyle: 'double', borderTopWidth: '3px', borderTopColor: AMBER, borderTopLeftRadius: '0px' });
  const tt = await css(title, ['backgroundColor', 'color', 'fontFamily']);
  assert.equal(tt.backgroundColor, AMBER, 'the focused title is in inverse video');
  assert.equal(tt.color, BLACK);
  assert.match(tt.fontFamily, /Mono|monospace/);
  // the title chip sits across the frame's top rule
  const [tb, fb] = [await title.boundingBox(), await frame.boundingBox()];
  assert.ok(tb.y < fb.y && tb.y + tb.height > fb.y + 3, `title ${JSON.stringify(tb)} across the rule of ${JSON.stringify(fb)}`);
  for (const [sel, text] of [['.ctl.min', '"[-]"'], ['.ctl.max', '"[^]"'], ['.ctl.close', '"[x]"']]) {
    assert.equal((await css(w.locator(`.tab.on ${sel}`), ['content'], '::before')).content, text);
  }
  // an unfocused window dims to a plain title in the rule
  await cards(page).first().click();
  await win(page, 'reader').locator('.rd h1').waitFor();
  assert.equal((await css(title, ['backgroundColor'])).backgroundColor, 'rgb(17, 11, 0)');
  assert.notEqual((await css(frame, ['borderTopColor'])).borderTopColor, AMBER);
  // post text keeps no bloom, for long reads
  assert.equal((await css(win(page, 'reader').locator('.rd p').first(), ['textShadow'])).textShadow, 'none');

  assert.equal(await page.locator('#themeBtn').isVisible(), false, 'a tube has no light mode');
  await shot(page, 'phosphor');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('Phosphor: the Control panel turns off Colours, Mode and Dock while the look is on', async t => {
  if (!(await needs(t, '/control-panel/'))) return;
  const page = await openLook(desktop, '/control-panel/');
  const cp = win(page, 'control-panel');
  await cp.locator('.cp').waitFor();
  for (const g of ['palette', 'theme', 'dock']) {
    assert.equal(await cp.locator(`fieldset:has([name="cp-${g}"])`).evaluate(f => f.disabled), true, `${g} is the look's`);
  }
  assert.equal(await cp.locator('fieldset:has([name="cp-wall"])').evaluate(f => f.disabled), false);
  // both thumbnails are drawn
  assert.equal((await css(cp.locator('.cp-deco.phosphor'), ['borderTopStyle'], '::after')).borderTopStyle, 'double');
  assert.equal((await css(cp.locator('.cp-wp.phosphor'), ['content'], '::before')).content, '"> _"');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('Phosphor: scanlines and a refresh band over the tube that never take a click, still under reduced motion', async t => {
  if (!(await needs(t, '/posts/'))) return;
  const page = await openLook(desktop, '/posts/', { reducedMotion: 'no-preference' });
  const w = win(page, 'tracker');
  await w.locator('.pc').first().waitFor();
  const scan = await bodyPseudo(page, '::before', ['content', 'position', 'pointerEvents', 'backgroundImage', 'zIndex']);
  assert.equal(scan.position, 'fixed');
  assert.equal(scan.pointerEvents, 'none');
  assert.match(scan.backgroundImage, /repeating-linear-gradient/);
  const band = await bodyPseudo(page, '::after', ['pointerEvents', 'animationName', 'display']);
  assert.deepEqual(band, { pointerEvents: 'none', animationName: 'ph-roll', display: 'block' });
  assert.equal(await page.evaluate(() => document.getAnimations().filter(a => a.animationName === 'ph-roll').length), 1);
  // over the windows, yet a click lands on what is under it
  const winZ = await w.evaluate(el => +getComputedStyle(el).zIndex || 0);
  assert.ok(+scan.zIndex > winZ, `overlay ${scan.zIndex} over window ${winZ}`);
  const card = w.locator('.pc').first(), b = await card.boundingBox();
  assert.equal(await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('.pc'), [b.x + b.width / 2, b.y + b.height / 2]), true);
  await card.click();
  await win(page, 'reader').locator('.rd h1').waitFor();
  // the burnt-in login prompt
  assert.match(await page.evaluate(() => getComputedStyle(document.getElementById('desk'), '::after').content), /^"LOGIN: ./);
  await page.context().close();

  const still = await openLook(desktop, '/posts/');
  const rm = await bodyPseudo(still, '::after', ['animationName', 'display']);
  assert.equal(rm.display, 'none', 'no rolling band under reduced motion');
  assert.equal(await still.evaluate(() => document.getAnimations().filter(a => a.animationName?.startsWith('ph-')).length), 0, 'nothing of the tube animates');
  await still.context().close();
});

test('Phosphor: the dock is a function-key bar across the bottom of the screen', async () => {
  const page = await openLook(desktop, '/');
  const dock = page.locator('#dock'), key = dock.locator('.dk').first();
  const db = await dock.boundingBox();
  assert.equal(db.x, 0);
  assert.equal(db.width, desktop.width, 'spans the screen');
  assert.equal(Math.round(db.y + db.height), desktop.height, 'on the bottom edge');
  assert.equal((await css(key, ['content'], '::before')).content, 'counter(fk)', 'numbered keys');
  assert.equal(await key.locator('.ico').isVisible(), false, 'labels, not icons');
  const lbl = await css(key.locator('.lbl'), ['backgroundColor', 'color', 'width']);
  assert.equal(lbl.backgroundColor, AMBER, 'label in inverse video');
  assert.equal(lbl.color, BLACK);
  assert.ok(parseFloat(lbl.width) > 40, `label shown, ${lbl.width}`);
  assert.equal((await css(dock.locator('#winsBtn'), ['content'], '::after')).content, '"Windows"');
  // keys share the width
  const widths = await dock.locator('.dk').evaluateAll(ks => ks.map(k => Math.round(k.getBoundingClientRect().width)));
  assert.ok(Math.max(...widths) - Math.min(...widths) <= 1, `even keys ${widths}`);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('Phosphor on a phone: a title bar over the full-screen window, touch-sized controls and keys', async t => {
  if (!(await needs(t, '/posts/'))) return;
  const page = await openLook(phone, '/', undefined);
  const key = page.locator('#dock .dk').first();
  const kb = await key.boundingBox();
  assert.ok(kb.height >= 44, `dock key ${kb.height}px tall`);
  await cards(page).first().click();
  const w = win(page, 'reader');
  await w.locator('.rd h1').waitFor();
  const [tab, frame] = [await w.locator('.tab.on').boundingBox(), await w.locator('.frame').boundingBox()];
  assert.equal(Math.round(frame.width), phone.width, 'full width');
  assert.ok(Math.abs(tab.y + tab.height - frame.y) <= 1, 'title bar above the frame');
  const close = await w.locator('.tab.on .ctl.close').boundingBox();
  assert.ok(close.width >= 44 && close.height >= 36, `close ${close.width}x${close.height}`);
  await shot(page, 'phosphor-phone');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('Phosphor leaves nothing behind when another look is on, though its stylesheet is loaded', async t => {
  if (!(await needs(t, '/control-panel/'))) return;
  const page = await open(desktop, '/control-panel/');
  const cp = win(page, 'control-panel');
  await cp.locator('.cp').waitFor();
  const href = await page.evaluate(() => JSON.parse(document.getElementById('deskbar-lazy').textContent)['look-phosphor'].css);
  await page.waitForFunction(h => !!document.querySelector(`head link[rel=stylesheet][href="${h}"]`)?.sheet, href);
  assert.notEqual((await css(cp.locator('.frame'), ['borderTopStyle'])).borderTopStyle, 'double');
  assert.equal((await bodyPseudo(page, '::before', ['content'])).content, 'none');
  assert.equal(await page.locator('#dock .dk .ico').first().isVisible(), true);
  assert.equal(await page.locator('#themeBtn').isVisible(), true);
  await page.context().close();
});

// axe over the look's main states, as a11y.spec.mjs does for the shell
const AXE = readFileSync(fileURLToPath(import.meta.resolve('axe-core/axe.min.js')), 'utf8');
async function audit(page, exclude = []) {
  await page.addScriptTag({ content: AXE });
  const { violations } = await page.evaluate(x => window.axe.run({ exclude: x }, { iframes: false, resultTypes: ['violations'] }), exclude);
  return violations.filter(v => ['serious', 'critical'].includes(v.impact))
    .flatMap(v => v.nodes.map(n => `${v.impact} ${v.id}: ${n.target.join(' ')} ${n.failureSummary?.split('\n')[1]?.trim() ?? ''}`));
}
const states = {
  posts: { path: '/posts/', setup: page => win(page, 'tracker').locator('.pc').first().waitFor() },
  reader: { path: '/', async setup(page) { await cards(page).first().click(); await win(page, 'reader').locator('.rd h1').waitFor(); } },
  // axe measures the desktop icons' labels against the menu row over them, though the menu hides them
  menu: { path: '/', exclude: ['#icons'], async setup(page) { await page.locator('#menuBtn').click(); await page.locator('#menu .mn-it').first().waitFor(); } },
  terminal: {
    path: '/terminal/',
    need: '/terminal/',
    async setup(page) {
      const input = win(page, 'terminal').locator('.term-in');
      for (const cmd of ['help', 'ls -l posts', 'grep the', 'nosuchcommand', 'neofetch']) { await input.fill(cmd); await input.press('Enter'); }
      await win(page, 'terminal').locator('.term-out .nf').waitFor();
    },
  },
  switcher: {
    path: '/posts/',
    async setup(page) {
      await win(page, 'tracker').locator('a[data-url]').first().click();
      await win(page, 'reader').locator('.rd h1').waitFor();
      await page.locator('#winsBtn').click();
      await page.locator('#switcher .sw-tab').first().waitFor();
    },
  },
  controlpanel: { path: '/control-panel/', need: '/control-panel/', setup: page => win(page, 'control-panel').locator('.cp').waitFor() },
};

test('axe: Phosphor over its main states at 1440 and 390, with either stored mode', async () => {
  const found = [];
  for (const [name, s] of Object.entries(states)) {
    if (s.need && !(await fetch(env.base + s.need)).ok) continue;
    for (const [vp, w] of [[desktop, 1440], [phone, 390]]) {
      for (const theme of ['light', 'dark']) {
        const ctx = await env.browser.newContext({ viewport: vp, reducedMotion: 'reduce', colorScheme: theme });
        await ctx.addInitScript(seed({ ...LOOK, theme }));
        const page = await ctx.newPage();
        await page.goto(env.base + s.path);
        await page.waitForSelector('html.wm-ready');
        await s.setup(page);
        for (const v of await audit(page, s.exclude)) found.push(`[${name} ${w} ${theme}] ${v}`);
        await ctx.close();
      }
    }
  }
  assert.deepEqual(found, []);
});
