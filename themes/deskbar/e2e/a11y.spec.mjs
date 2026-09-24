// axe-core over the shell's main states at 1440 and 390, in the light and dark themes. Serious and critical
// violations fail. Tool iframes are skipped, since their content is the site's own standalone HTML.
// AXE_ALL=1 also fails on minor and moderate violations, to see everything axe reports.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { env, useBrowser, open, win, cards, desktop, phone } from './lib.mjs';

useBrowser();

const AXE = readFileSync(fileURLToPath(import.meta.resolve('axe-core/axe.min.js')), 'utf8');
const FAIL_ON = process.env.AXE_ALL ? null : new Set(['serious', 'critical']);
const has = async p => (await fetch(env.base + p)).ok;

// look: other visitor settings (settings.js) to store first, e.g. { palette: 'xfce', deco: 'flat' }
async function openAs(viewport, theme, path, look = {}) {
  const ctx = await env.browser.newContext({ viewport, reducedMotion: 'reduce', colorScheme: theme });
  await ctx.addInitScript(s => { for (const k in s) localStorage.setItem('deskbar:' + k, JSON.stringify(s[k])); }, { ...look, theme });
  const page = await ctx.newPage();
  await page.goto(env.base + path);
  await page.waitForSelector('html.wm-ready');
  return page;
}

async function audit(page) {
  await page.addScriptTag({ content: AXE });
  const { violations } = await page.evaluate(() => window.axe.run(document, { iframes: false, resultTypes: ['violations'] }));
  return violations
    .filter(v => !FAIL_ON || FAIL_ON.has(v.impact))
    .flatMap(v => v.nodes.map(n => `${v.impact} ${v.id}: ${n.target.join(' ')} ${n.failureSummary?.split('\n')[1]?.trim() ?? ''}`));
}

// The first link of a folder page, so the tool and post states work on any site
async function firstLink(page, sel) {
  const a = page.locator(sel).first();
  await a.waitFor();
  return a.getAttribute('href');
}

const states = {
  home: { path: '/' },
  reader: {
    path: '/',
    async setup(page) {
      await cards(page).first().click();
      await win(page, 'reader').locator('.rd h1').waitFor();
    },
  },
  tracker: { path: '/posts/', setup: page => win(page, 'tracker').locator('.pc').first().waitFor() },
  menu: {
    path: '/',
    async setup(page) {
      await page.locator('#menuBtn').click();
      await page.locator('#menu .mn-it').first().waitFor();
    },
  },
  spotlight: {
    path: '/',
    async setup(page) {
      await page.locator('#searchBtn').click();
      await page.locator('dialog.spotlight .sp-q').waitFor();
      await page.waitForFunction(() => !/Loading/.test(document.querySelector('.sp-status')?.textContent || ''));
      await page.keyboard.type('the');
      await page.locator('dialog.spotlight [role="option"]').first().waitFor();
    },
  },
  photos: {
    path: '/photos/',
    need: '/photos/',
    async setup(page) {
      await win(page, 'photos').locator('.ph-grid .ph img').first().waitFor();
      await win(page, 'photos').locator('.ph-grid .ph').first().click();
      await win(page, 'photos').locator('.lightbox').waitFor();
    },
  },
  tool: {
    path: '/tools/',
    need: '/tools/',
    async setup(page) {
      const href = await firstLink(win(page, 'folder:/tools/'), '.folder a');
      await page.evaluate(h => window.deskbar.go(h), href);
      await page.locator(`.win:not([hidden]) .view[data-key$=":${href}"]`).waitFor();
    },
  },
  contact: { path: '/contact/', need: '/contact/', setup: page => win(page, 'mail').locator('form').waitFor() },
  terminal: {
    path: '/terminal/',
    need: '/terminal/',
    async setup(page) {
      // every kind of output: links, command buttons, marks, dim and error text
      const input = win(page, 'terminal').locator('.term-in');
      for (const cmd of ['help', 'ls -l posts', 'grep the', 'nosuchcommand', 'neofetch']) {
        await input.fill(cmd);
        await input.press('Enter');
      }
      await win(page, 'terminal').locator('.term-out .nf').waitFor();
    },
  },
  switcher: {
    path: '/posts/',
    async setup(page) {
      // two windows, so both the focused and the muted tab styles are checked
      await win(page, 'tracker').locator('a[data-url]').first().click();
      await win(page, 'reader').locator('.rd h1').waitFor();
      await page.locator('#winsBtn').click();
      await page.locator('#switcher .sw-tab').first().waitFor();
    },
  },
  contextmenu: {
    path: '/',
    async setup(page) {
      // a post's window menu has every kind of item, including a separator
      await cards(page).first().click();
      await win(page, 'reader').locator('.tab.on .tt').click({ button: 'right' });
      await page.locator('.ctx:popover-open [role="menuitem"]').first().waitFor();
    },
  },
  controlpanel: { path: '/control-panel/', need: '/control-panel/', setup: page => win(page, 'control-panel').locator('.cp').waitFor() },
  controlpanelposts: { path: '/control-panel/?pane=posts', need: '/control-panel/', setup: page => win(page, 'control-panel').locator('#cp-posts:not([hidden])').waitFor() },
  controlpanelsystem: { path: '/control-panel/?pane=system', need: '/control-panel/', setup: page => win(page, 'control-panel').locator('#cp-system:not([hidden])').waitFor() },
  sketch: { path: '/sketch/', need: '/sketch/', setup: page => win(page, 'sketch').locator('.sk-over').waitFor() },
  chiptunes: { path: '/chiptunes/', need: '/chiptunes/', setup: page => win(page, 'chiptunes').locator('.view[data-loaded]').waitFor() },
  feeds: {
    path: '/feeds/',
    need: '/feeds/',
    async setup(page) {
      // one item read and selected, so unread, read and current rows and the preview are all on screen
      const w = win(page, 'feeds');
      await w.locator('.view[data-loaded]').waitFor();
      await w.locator('.fd-row').nth(1).click();
    },
  },
};

// The palettes, decorators and dock styles the Control panel offers (lazy/control-panel.css), over the reading layout's two
// windows (focused and muted tabs) and then the menu, which shares the panel's colours
test('axe: every palette, decorator and dock style, light and dark', async t => {
  if (!(await has('/control-panel/'))) return t.skip('no /control-panel/ on this site');
  const found = [];
  const looks = [
    { palette: 'beos', deco: 'beos', wall: 'plain', dock: 'deskbar' }, { palette: 'xfce', deco: 'flat', wall: 'grid', dock: 'panel' },
    { palette: 'sage', deco: 'haiku', wall: 'hills', dock: 'glass' }, { palette: 'haiku', deco: 'flat', wall: 'dots', dock: 'deskbar' },
    // Liquid Ass over its own wallpaper, and over a plain one, where axe can see through the glass to work out contrast
    { palette: 'haiku', deco: 'liquid', wall: 'liquid', dock: 'glass' }, { palette: 'xfce', deco: 'liquid', wall: 'plain', dock: 'panel' },
    { palette: 'beos', deco: 'liquid', wall: 'plain', dock: 'glass' }, { palette: 'mint', deco: 'clear', wall: 'clear', dock: 'glass' },
    // the light palettes, whose panel is light too
    { palette: 'snow', deco: 'haiku', wall: 'rings', dock: 'glass' }, { palette: 'mint', deco: 'beos', wall: 'dots', dock: 'panel' },
    { palette: 'peach', deco: 'flat', wall: 'hills', dock: 'deskbar' },
    // Synthwave's colours without its whole look
    { palette: 'synthwave', deco: 'haiku', wall: 'rings', dock: 'glass' }, { palette: 'synthwave', deco: 'beos', wall: 'grid', dock: 'panel' },
    { palette: 'synthwave', deco: 'flat', wall: 'dots', dock: 'deskbar' },
    // Rosé, Ember, Solar and Lagoon, whose tinted content and reader backgrounds carry the text
    { palette: 'rose', deco: 'haiku', wall: 'rings', dock: 'glass' }, { palette: 'rose', deco: 'liquid', wall: 'plain', dock: 'glass' },
    { palette: 'ember', deco: 'flat', wall: 'grid', dock: 'deskbar' }, { palette: 'solar', deco: 'beos', wall: 'dots', dock: 'panel' },
    { palette: 'lagoon', deco: 'clear', wall: 'clear', dock: 'glass' }, { palette: 'lagoon', deco: 'haiku', wall: 'hills', dock: 'deskbar' },
    // Platinum, Clearlooks, Phosphor, Broadsheet and Synthwave run axe in their own look-*.spec.mjs
  ];
  for (const look of looks) {
    // Liquid Ass and Clear restyle the phone's full-screen windows too
    for (const [vp, w] of ['liquid', 'clear'].includes(look.deco) ? [[desktop, 1440], [phone, 390]] : [[desktop, 1440]]) {
      for (const theme of ['light', 'dark']) {
        const page = await openAs(vp, theme, '/', look);
        await states.reader.setup(page);
        for (const v of await audit(page)) found.push(`[${look.palette} ${look.deco} ${w} ${theme} reader] ${v}`);
        await states.menu.setup(page);
        for (const v of await audit(page)) found.push(`[${look.palette} ${look.deco} ${w} ${theme} menu] ${v}`);
        await page.context().close();
      }
    }
  }
  assert.deepEqual(found, []);
});

for (const [name, s] of Object.entries(states)) {
  test(`axe: ${name} at 1440 and 390, light and dark`, async t => {
    if (s.need && !(await has(s.need))) return t.skip(`no ${s.need} on this site`);
    const found = [];
    for (const [vp, w] of [[desktop, 1440], [phone, 390]]) {
      for (const theme of ['light', 'dark']) {
        const page = await openAs(vp, theme, s.path);
        await s.setup?.(page);
        for (const v of await audit(page)) found.push(`[${name} ${w} ${theme}] ${v}`);
        await page.context().close();
      }
    }
    assert.deepEqual(found, []);
  });
}

// Where the focused element sits, and whether a sighted keyboard user can see it
const focusInfo = page => page.evaluate(() => {
  const e = document.activeElement, r = e.getBoundingClientRect();
  // its window, home screen or bar is on top at its centre, so it is not behind another window
  const box = e.closest(".win, #recent, #icons, #panel, #dock, #menu") || e;
  const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
  const area = e.closest('#panel') ? 'panel' : e.closest('.win') ? 'window' : e.closest('#icons') ? 'icons' : e.closest('#dock') ? 'dock' : e.closest('#desk') ? 'desk' : e.tagName;
  return { area, label: e.getAttribute('aria-label') || e.textContent.trim().slice(0, 30), visible: r.width > 0 && r.height > 0 && e.checkVisibility() && !!hit && (box.contains(hit) || hit.contains(box)) };
});

test('keyboard: Tab visits only visible controls, in panel, desktop, window and dock order', async () => {
  for (const vp of [desktop, phone]) {
    const page = await open(vp, '/posts/');
    await win(page, 'tracker').locator('.pc').first().waitFor();
    await page.evaluate(() => document.activeElement?.blur());
    const areas = [];
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      const f = await focusInfo(page);
      assert.ok(f.visible, `Tab ${i + 1} landed on a hidden element: ${JSON.stringify(f)}`);
      if (areas.at(-1) !== f.area) areas.push(f.area);
    }
    assert.equal(areas[0], 'panel', 'the panel comes first');
    const order = ['panel', 'icons', 'desk', 'window', 'dock'];
    const ranks = areas.filter(a => order.includes(a)).map(a => order.indexOf(a));
    // one pass through the page, possibly wrapping back to the panel at the end
    const wrap = ranks.findIndex((r, i) => i && r < ranks[i - 1]);
    const pass = wrap < 0 ? ranks : ranks.slice(0, wrap);
    assert.deepEqual(pass, [...pass].sort((a, b) => a - b), `focus order ${areas.join(' > ')}`);
    assert.ok(areas.includes('window'), 'the open window is reachable');
    await page.context().close();
  }
});

test('keyboard: closing or minimising the focused window hands focus to the next one, then to the menu button', async () => {
  const page = await open(desktop);
  await cards(page).first().click();
  await win(page, 'reader').locator('.rd h1').waitFor();
  await win(page, 'tracker').locator('.pc, .row').first().waitFor();
  const isFocused = l => l.evaluate(el => el === document.activeElement);

  await win(page, 'reader').locator('.tab.on .ctl.min').focus();
  await page.keyboard.press('Enter');
  assert.ok(await isFocused(win(page, 'tracker').locator('.tab.on .tt')), 'minimising passes focus to Tracker');

  await win(page, 'tracker').locator('.tab.on .ctl.close').focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'menuBtn', 'with only a minimised window left, focus goes to the menu button');

  // the popover menu hands focus back to its button on Escape
  await page.keyboard.press('Enter');
  await page.locator('#menu .mn-it').first().waitFor();
  await page.keyboard.press('Escape');
  assert.ok(await page.locator('#menu').isHidden());
  assert.equal(await page.evaluate(() => document.activeElement.id), 'menuBtn');
  await page.context().close();
});

// Opening a post and closing a window go through View Transitions, counted by wrapping startViewTransition
test('reduced motion turns off window animations', async () => {
  const anim = async reducedMotion => {
    const ctx = await env.browser.newContext({ viewport: desktop, reducedMotion });
    await ctx.addInitScript(() => {
      window.__vt = 0;
      const start = document.startViewTransition?.bind(document);
      if (start) document.startViewTransition = fn => { window.__vt++; return start(fn); };
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(env.base + '/posts/');
    await page.waitForSelector('html.wm-ready');
    const w = win(page, 'tracker');
    await w.locator('a[data-url]').first().click();
    await win(page, 'reader').locator('.rd h1').waitFor();
    await win(page, 'reader').locator('.tab.on .ctl.close').click();
    await win(page, 'reader').waitFor({ state: 'detached' });
    const got = await page.evaluate(() => ({
      transitions: window.__vt, preview: getComputedStyle(document.getElementById('snapPreview')).transitionDuration,
    }));
    await ctx.close();
    assert.deepEqual(errors, []);
    return got;
  };
  assert.deepEqual(await anim('no-preference'), { transitions: 2, preview: '0.12s' }, 'open and close animate by default');
  assert.deepEqual(await anim('reduce'), { transitions: 0, preview: '0s' });
});
