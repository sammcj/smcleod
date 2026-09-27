// Shared browser setup for the e2e specs. Runs against the built example site by default; BASE_URL points
// the specs at any running deskbar site instead. SHOTS_DIR saves a screenshot at each named step.
import { before, after } from 'node:test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { serve } from './serve.mjs';

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
  // A site's Google Fonts swap in whenever they arrive, reflowing the desktop icons after windows were placed beside
  // them, so every page keeps its fallback fonts
  await ctx.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, r => r.abort());
  // fixtures point at example.org hosts (the Feeds app's pictures), which tests never reach
  await ctx.route(/^https?:\/\/([\w-]+\.)*example\.org\//, r => r.abort());
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  trackErrors(page);
  await page.goto(env.base + path);
  await page.waitForSelector('html.wm-ready');
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

// axe's violations, once axe-core is on the page, outside the exclude selectors. Windows the front window covers fade
// on purpose (.win.under, DESIGN.md Window model), which axe counts against their contrast; the visitor brings one
// forward to read it, and it is solid there, so their contrast is left to the audit of that window in front.
export const axeViolations = (page, exclude = []) => page.evaluate(x => window.axe.run({ exclude: x }, { iframes: false, resultTypes: ['violations'] }).then(r => r.violations.map(v => ({
  ...v, nodes: v.id === 'color-contrast' ? v.nodes.filter(n => !document.querySelector(n.target[0])?.closest('.win.under')) : v.nodes,
})).filter(v => v.nodes.length)), exclude);

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
