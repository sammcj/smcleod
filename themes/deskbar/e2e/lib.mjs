// Shared browser setup for the e2e specs. Runs against the built example site by default; BASE_URL points
// the specs at any running deskbar site instead. SHOTS_DIR saves a screenshot at each named step.
import { before, after } from 'node:test';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { serve } from './serve.mjs';
import { PRESETS } from '../assets/js/deskbar/lib/appearance.js';

export const env = { browser: null, base: '', server: null };
const shots = process.env.SHOTS_DIR;
if (shots) mkdirSync(shots, { recursive: true });

export function useBrowser() {
  before(async () => {
    env.base = process.env.BASE_URL;
    if (!env.base) {
      env.server = await serve(process.env.SITE_DIR || join(import.meta.dirname, '../.build/public'));
      env.base = env.server.url;
    }
    env.browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
    // The specs assume the theme's own default look, so a site's starting look (params.deskbar.appearance) is left
    // out of its pages unless a context asks for it with { siteLook: true }
    const DEFAULTS = /<script[^>]*id="?deskbar-defaults"?[^>]*>[^<]*<\/script>/;
    if (!DEFAULTS.test(await (await fetch(env.base + '/')).text())) return;
    const launch = env.browser.newContext.bind(env.browser);
    env.browser.newContext = async ({ siteLook, ...opts } = {}) => {
      const ctx = await launch(opts);
      if (!siteLook) await ctx.route(u => u.href.startsWith(env.base), async r => {
        if (r.request().resourceType() !== 'document') return r.fallback();
        // a test may close its page mid-request
        try {
          const res = await r.fetch();
          if (!res.headers()['content-type']?.includes('html')) return await r.fulfill({ response: res });
          await r.fulfill({ response: res, body: (await res.text()).replace(DEFAULTS, '') });
        } catch { /* closed */ }
      });
      return ctx;
    };
  });
  after(async () => {
    await env.browser?.close();
    env.server?.close();
  });
}

// Collects uncaught errors in page.errors. Playwright reports errors from iframes too, and a tool window's iframe
// runs the site's own standalone HTML, so errors whose stack lies wholly in files only an iframe loaded are left out.
export function trackErrors(page) {
  page.errors = [];
  const main = new Set(), framed = new Set();
  page.on('request', r => {
    try { (r.frame() === page.mainFrame() ? main : framed).add(r.url()); } catch { /* service worker request */ }
  });
  page.on('pageerror', e => {
    const urls = [...String(e.stack).matchAll(/(https?:\/\/[^\s()]+?):\d+:\d+/g)].map(m => m[1]);
    if (urls.length && urls.every(u => framed.has(u) && !main.has(u))) return;
    page.errors.push(e.message);
  });
}

// Example-only tests name the fixture pages they assert on, and skip on a site without them
export async function needs(t, ...paths) {
  for (const p of paths) {
    if (!(await fetch(env.base + p)).ok) { t.skip(`no ${p} on this site`); return false; }
  }
  return true;
}

// init: a function run in the page before any of its scripts, e.g. to queue window.deskbar extensions.
// ctxOpts: extra browser context options, e.g. { hasTouch: true, isMobile: true } for a touch device.
export async function open(viewport, path = '/', init, ctxOpts = {}) {
  const ctx = await env.browser.newContext({ viewport, reducedMotion: 'reduce', ...ctxOpts });
  // fixtures point at example.org hosts (the Feeds app's pictures), which tests never reach. The theme self-hosts its
  // fonts, but a site's standalone tool pages may still pull Google Fonts; tests stay offline
  await ctx.route(/^https?:\/\/(([\w-]+\.)*example\.org|fonts\.(googleapis|gstatic)\.com)\//, r => r.abort());
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  trackErrors(page);
  await page.goto(env.base + path);
  await page.waitForSelector('html.wm-ready');
  // web fonts swap in whenever they arrive, reflowing the desktop icons and window text, so tests start once they have
  await page.evaluate(() => document.fonts.ready);
  return page;
}

export const shot = (page, name) => shots && page.screenshot({ path: join(shots, name + '.png') });
export const win = (page, key) => page.locator(`.win:not([hidden]):has(.view[data-key="${key}"]:not([hidden]))`);
// The Posts window opens compact (D36); tests of the wide archive browser (places sidebar, table) maximise it
export async function widePosts(page) {
  await win(page, 'tracker').locator('.tab.on .ctl.max').click();
  await page.waitForFunction(() => document.querySelector('.win:has(.view[data-key="tracker"])')?.getBoundingClientRect().width > 1000);
}
export const visibleWins = page => page.locator('.win:not([hidden])').count();
// The post cards a visit starts from: the Posts window's on the desktop (D36), the home screen's on phones (D17)
export const cards = page => page.locator('#recent .pc, .tracker .pc').filter({ visible: true });
export const path = page => new URL(page.url()).pathname;
export const readerTitle = page => win(page, 'reader').locator('.rd h1').first().textContent();
export const desktop = { width: 1440, height: 900 }, phone = { width: 390, height: 844 };
export const box = loc => loc.first().boundingBox();
// Computed style of a locator's first element or its pseudo-element: one property's value, or { prop: value } for a list
export const css = (loc, props, pseudo = null) => loc.first().evaluate((el, [ps, p]) => {
  const s = getComputedStyle(el, p);
  return Array.isArray(ps) ? Object.fromEntries(ps.map(k => [k, s[k]])) : s[ps];
}, [props, pseudo]);
// An init script storing visitor settings (settings.js keys, e.g. { deco: 'beos', theme: 'dark' }) before the page's own
// scripts run. Unset keys keep settings.js's defaults, whose theme is light.
export const seed = s => `for (const [k, v] of Object.entries(${JSON.stringify(s)})) localStorage.setItem('deskbar:' + k, JSON.stringify(v));`;
// look: a preset id from appearance.js (window style, colours, wallpaper, dock and CRT together), settings to store, or
// both as { preset, ...settings }, e.g. { preset: 'pixel', theme: 'dark' }
export const openLook = (vp, path, look, ctxOpts) => {
  const { preset, ...rest } = typeof look === 'string' ? { preset: look } : look;
  const found = preset === undefined ? {} : PRESETS.find(p => p.id === preset);
  if (!found) throw new Error(`no preset ${preset} in appearance.js`);
  const { id, label, ...settings } = found;
  return open(vp, path, seed({ ...settings, ...rest }), ctxOpts);
};
// One property of the first element a selector matches
export const style = (page, sel, prop) => css(page.locator(sel), prop);
// Follows an in-shell link, as a click on it would
export const go = (page, url) => page.evaluate(u => window.deskbar.go(u), url);

// The Control panel (control-panel.spec.mjs, appearance.spec.mjs): its window, once built; a choice made in it, and
// the one showing as checked; the settings shown on <html>; and those stored (nothing for a default)
export const cp = page => win(page, 'control-panel');
export const ready = page => cp(page).locator('.cp').waitFor();
export const pick = (page, key, value) => cp(page).locator(`input[name="cp-${key}"][value="${value}"]`).check();
export const checked = (page, key) => cp(page).locator(`input[name="cp-${key}"]:checked`).evaluateAll(rs => rs[0]?.value ?? null);
export const attrs = page => page.evaluate(() => Object.fromEntries(Object.entries(document.documentElement.dataset)
  .filter(([k]) => ['theme', 'palette', 'deco', 'wall', 'dock', 'crt', 'rdWidth', 'rdFont'].includes(k))));
const STORED = ['palette', 'theme', 'deco', 'wall', 'dock', 'crt', 'readerWidth', 'readerFont', 'textSize', 'saverKind', 'saver'];
export const stored = page => page.evaluate(keys => Object.fromEntries(keys.flatMap(k => {
  const v = localStorage.getItem('deskbar:' + k);
  return v == null ? [] : [[k, JSON.parse(v)]];
})), STORED);
// Waits n animation frames (two by default), by which time what the page just changed has been laid out and drawn
export const settle = (page, n = 2) => page.evaluate(n => new Promise(done => {
  const f = () => (--n ? requestAnimationFrame(f) : done());
  requestAnimationFrame(f);
}), n);

// axe's violations, once axe-core is on the page, outside the exclude selectors. Windows the front window covers fade
// on purpose (.win.under, DESIGN.md Window model), which axe counts against their contrast; the visitor brings one
// forward to read it, and it is solid there, so their contrast is left to the audit of that window in front.
export const axeViolations = (page, exclude = []) => page.evaluate(x => window.axe.run({ exclude: x }, { iframes: false, resultTypes: ['violations'] }).then(r => r.violations.map(v => ({
  ...v, nodes: v.id === 'color-contrast' ? v.nodes.filter(n => !document.querySelector(n.target[0])?.closest('.win.under')) : v.nodes,
})).filter(v => v.nodes.length)), exclude);

// axe runs a reduced matrix by default. axeRuns(i): the i-th item it audits (a state, an effect, a look) in two viewport
// and mode pairs that between them cover desktop and phone, light and dark, alternating so neighbouring items get the
// other two. axeRun(i, j): one of those pairs for the item's j-th state, alternating with j and swapping every other
// pair of items, so across four items each state comes up in all four pairs. AXE_ALL=1 audits the full cross-product.
// AXE_MINOR=1 also fails on minor and moderate findings, not just serious and critical. Tool iframes are skipped, as
// their content is the site's own standalone HTML.
export const AXE_ALL = !!process.env.AXE_ALL;
const AXE = readFileSync(fileURLToPath(import.meta.resolve('axe-core/axe.min.js')), 'utf8');
const FAIL_ON = process.env.AXE_MINOR ? null : new Set(['serious', 'critical']);
const RUNS = [[desktop, 'light'], [phone, 'dark'], [desktop, 'dark'], [phone, 'light']];
export const axeRuns = (i = 0) => AXE_ALL ? RUNS : RUNS.slice(i % 2 * 2, i % 2 * 2 + 2);
export const axeRun = (i, j) => AXE_ALL ? RUNS : [axeRuns(i)[(j + (i >> 1)) % 2]];

// The page's axe findings as lines, "impact rule: target reason"
export async function audit(page, exclude = []) {
  if (!(await page.evaluate(() => !!window.axe))) await page.addScriptTag({ content: AXE });
  return (await axeViolations(page, exclude))
    .filter(v => !FAIL_ON || FAIL_ON.has(v.impact))
    .flatMap(v => v.nodes.map(n => `${v.impact} ${v.id}: ${n.target.join(' ')} ${n.failureSummary?.split('\n')[1]?.trim() ?? ''}`));
}

// The shell states axe checks. path: where a fresh page starts (a function when it depends on the site), need: a page
// the state needs, which a site may lack, setup: gets the page to the state, exclude: selectors axe leaves out.
const openPost = async page => {
  await cards(page).first().click();
  await win(page, 'reader').locator('.rd h1').waitFor();
};
export const axeStates = {
  home: { path: '/' },
  reader: { path: '/', setup: openPost },
  tracker: { path: '/posts/', setup: page => win(page, 'tracker').locator('.pc').first().waitFor() },
  // axe measures the desktop icons' labels against the menu row over them, though the menu hides them
  menu: {
    path: '/',
    exclude: ['#icons'],
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
  switcher: {
    path: '/posts/',
    async setup(page) {
      // two windows, so both the focused and the muted tab styles are checked; a phone shows the switcher only then
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
      await openPost(page);
      await win(page, 'reader').locator('.tab.on .tt').click({ button: 'right' });
      await page.locator('.ctx:popover-open [role="menuitem"]').first().waitFor();
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
  // The Tools folder's first tool page, which opens in a tool window. The folder lists apps too (the real site's starts
  // with Chiptunes), so the tool is the first link whose page names the tool window.
  tool: {
    need: '/tools/',
    async path() {
      const folder = await (await fetch(env.base + '/tools/')).text();
      const links = [...(folder.match(/class="?folder"?>[\s\S]*?<\/ul>/)?.[0] ?? '').matchAll(/href="?(\/[^"\s>]*)/g)].map(m => m[1]);
      for (const href of links) if (/data-window="?tool\b/.test(await (await fetch(env.base + href)).text())) return href;
    },
    setup: page => page.locator('.win:not([hidden]) .view[data-key^="tool:"]').waitFor(),
  },
  contact: { path: '/contact/', need: '/contact/', setup: page => win(page, 'mail').locator('form').waitFor() },
  terminal: {
    path: '/terminal/',
    need: '/terminal/',
    async setup(page) {
      // every kind of output: links, command buttons, marks, dim and error text, then a half-typed line, as axe
      // measures a field's text only when it has some
      const input = win(page, 'terminal').locator('.term-in');
      for (const cmd of ['help', 'ls -l posts', 'grep the', 'nosuchcommand', 'neofetch']) {
        await input.fill(cmd);
        await input.press('Enter');
      }
      await win(page, 'terminal').locator('.term-out .nf').waitFor();
      await input.fill('ls');
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

// Audits one of axeStates in a fresh page with the visitor settings stored, as '[tag state width mode] finding' lines.
// A state whose page the site lacks, or which has no path on it, gives null.
export async function auditState(name, [vp, theme], settings = {}, tag = '') {
  const s = axeStates[name];
  if (s.need && !(await fetch(env.base + s.need)).ok) return null;
  const path = typeof s.path === 'function' ? await s.path() : s.path;
  if (!path) return null;
  const page = await open(vp, path, seed({ ...settings, theme }), { colorScheme: theme });
  await s.setup?.(page);
  const found = (await audit(page, s.exclude)).map(v => `[${tag}${name} ${vp.width} ${theme}] ${v}`);
  await page.context().close();
  return found;
}

// Phones: the gaps between a window's title bar and its sticky toolbar, at the top of the page and scrolled down.
// A look that clips .views pushes the toolbar down at the top and stops it sticking once scrolled.
export async function toolbarGaps(page, w) {
  const gap = async () => {
    const [tab, bar] = [await w.locator('.tab.on').boundingBox(), await w.locator('.toolbar').first().boundingBox()];
    return Math.round(bar.y - tab.y - tab.height);
  };
  const top = await gap();
  await page.evaluate(() => scrollTo(0, 800));
  await page.waitForFunction(() => scrollY > 0);
  const scrolled = await gap();
  await page.evaluate(() => scrollTo(0, 0));
  return [top, scrolled];
}

export async function dragTab(page, key, to) {
  const tab = win(page, key).locator('.tab.on .tt');
  const b = await tab.boundingBox();
  await page.mouse.move(b.x + 20, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + 60, b.y + 40, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 8 });
}
