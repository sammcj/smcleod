// Content rendering: code copy, lazy Mermaid and MathJax, footnotes, heading links and reader width
// (the related posts ticker is in f3-ticker.spec.mjs). The renderers are stubbed so the tests need no network and
// run fast; one test draws real diagrams with the self-hosted Mermaid. MD_PAGE and POST_PATH name a
// markdown-features page and a tagged post on the site under test, and MERMAID_PAGE a page with a flowchart.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { env, useBrowser, open, trackErrors, shot, win, desktop, phone, needs } from './lib.mjs';

useBrowser();

const mdPage = process.env.MD_PAGE || '/markdown/';
const post = process.env.POST_PATH || '/2026/07/window-managers-in-the-browser/';
const diagramPage = process.env.MERMAID_PAGE || mdPage;
const exists = async p => (await fetch(env.base + p)).ok;

const MERMAID_URL = /\/vendor\/mermaid-\d+\.\d+\.\d+\/mermaid\.esm\.min\.mjs$/;
const MERMAID_STUB = `export default {
  initialize(c) { if (c.theme) (window.mmdThemes ||= []).push(c.theme); },
  async render(id, src) { return { svg: '<svg data-stub="' + id + '" width="10" height="10"></svg>' }; },
};`;
const MATHJAX_STUB = `window.MathJax.startup = { promise: Promise.resolve() };
window.MathJax.typesetPromise = async els => { for (const e of els) e.dataset.typeset = 'yes'; };`;
const sri = body => 'sha384-' + createHash('sha384').update(body).digest('base64');

// open() with the renderers stubbed and requests to them counted. The pinned MathJax hash can't match a stub, so
// the page is told the stub's hash (window.deskbarCDN), which still exercises the integrity check.
async function openStubbed(viewport, path, opts = {}) {
  const ctx = await env.browser.newContext({ viewport, reducedMotion: 'reduce', ...opts });
  await ctx.addInitScript(cdn => { window.deskbarCDN = cdn; }, { mathjax: { integrity: sri(MATHJAX_STUB) } });
  const hits = { mermaid: 0, mathjax: 0 };
  const stub = (kind, body) => route => {
    hits[kind]++;
    route.fulfill({ status: 200, contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' }, body });
  };
  await ctx.route(MERMAID_URL, stub('mermaid', MERMAID_STUB));
  await ctx.route(/cdn\.jsdelivr\.net\/npm\/mathjax@/, stub('mathjax', MATHJAX_STUB));
  const page = await ctx.newPage();
  trackErrors(page);
  await page.goto(env.base + path);
  await page.waitForSelector('html.wm-ready');
  return { page, hits };
}

const scroller = page => win(page, 'reader').locator('.rd-scroll');

test('markdown page: renderers load lazily, render routed content and follow the colour scheme', async t => {
  if (!(await exists(mdPage))) return t.skip(`no ${mdPage} on this site`);
  const { page, hits } = await openStubbed(desktop, '/');
  await page.waitForTimeout(300);
  assert.deepEqual(hits, { mermaid: 0, mathjax: 0 }, 'nothing loads for pages without diagrams or maths');

  await page.evaluate(u => window.deskbar.go(u), mdPage);
  const view = page.locator(`.view[data-key="page:${mdPage}"]`);
  await view.locator('pre.mermaid.drawn svg[data-stub]').waitFor();
  await view.locator('.rd-host[data-typeset="yes"]').waitFor();
  assert.deepEqual(hits, { mermaid: 1, mathjax: 1 });
  assert.deepEqual(await page.evaluate(() => window.mmdThemes), ['default']);

  // the colour scheme switch redraws diagrams with the matching Mermaid theme
  await page.locator('#themeBtn').click();
  await page.waitForFunction(() => window.mmdThemes.length === 2);
  assert.deepEqual(await page.evaluate(() => window.mmdThemes), ['default', 'dark']);
  assert.equal(hits.mermaid, 1, 'the library loads once');

  // footnotes and definition lists render as markup the theme styles
  assert.equal(await view.locator('.footnotes li').count(), 1);
  assert.equal(await view.locator('dl dt').count(), 2);
  await shot(page, 's1-markdown');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('code blocks get a copy button that copies only the code', async t => {
  if (!(await exists(mdPage))) return t.skip(`no ${mdPage} on this site`);
  const { page } = await openStubbed(desktop, mdPage);
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: env.base });
  const block = page.locator('.view .rd .highlight').first();
  await block.hover();
  const btn = block.locator('.copy');
  await btn.click();
  await page.waitForFunction(b => b.textContent === 'Copied', await btn.elementHandle());
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  assert.match(copied, /^func greet/);
  assert.ok(!copied.includes('Copy'), 'button label is not part of the copied text');
  await page.context().close();
});

test('footnote references scroll the window to the note', async t => {
  if (!(await exists(mdPage))) return t.skip(`no ${mdPage} on this site`);
  const { page } = await openStubbed({ width: 1280, height: 520 }, mdPage);
  const view = page.locator(`.view[data-key="page:${mdPage}"]`);
  await view.locator('.footnote-ref').click();
  const note = view.locator('.footnotes li').first();
  await page.waitForFunction(el => {
    const r = el.getBoundingClientRect(), s = el.closest('.rd-scroll').getBoundingClientRect();
    return r.top >= s.top - 1 && r.top < s.bottom;
  }, await note.elementHandle());
  await page.context().close();
});

// The related posts ticker (D27) is covered in f3-ticker.spec.mjs

test('D12: deep links scroll the reader to the heading; tapping a heading reveals its link', async t => {
  if (!(await exists(post))) return t.skip(`no ${post} on this site`);
  let page = await open({ width: 1280, height: 520 }, post + '#focus');
  const head = win(page, 'reader').locator('h2#focus');
  await page.waitForFunction(el => {
    const r = el.getBoundingClientRect(), s = el.closest('.rd-scroll').getBoundingClientRect();
    return Math.abs(r.top - s.top) < 40;
  }, await head.elementHandle());
  await page.context().close();

  const ctx = await env.browser.newContext({ viewport: phone, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  page = await ctx.newPage();
  await page.goto(env.base + post);
  await page.waitForSelector('html.wm-ready');
  const h = page.locator('.view[data-key="reader"] h2#snapping');
  const link = h.locator('.hlink');
  assert.equal(await link.evaluate(e => getComputedStyle(e).opacity), '0', 'hidden until tapped');
  await h.tap({ position: { x: 5, y: 5 } });
  assert.ok(await h.evaluate(e => e.classList.contains('show-link')));
  assert.equal(await link.evaluate(e => getComputedStyle(e).opacity), '1');
  await ctx.close();
});

test('reader width: the toolbar button cycles narrow, normal and wide, and persists', async t => {
  if (!(await exists(post))) return t.skip(`no ${post} on this site`);
  const page = await open(desktop, post);
  const rd = win(page, 'reader').locator('.rd').first();
  const btn = win(page, 'reader').locator('.tb.width');
  const width = () => rd.evaluate(e => e.getBoundingClientRect().width);
  const normal = await width();
  await btn.click();
  assert.equal(await page.evaluate(() => document.documentElement.dataset.rdWidth), 'wide');
  const wide = await width();
  await btn.click();
  const narrow = await width();
  assert.ok(narrow < normal && normal < wide, `narrow ${narrow} < normal ${normal} < wide ${wide}`);
  assert.match(await btn.getAttribute('aria-label'), /narrow/);
  await page.reload();
  await page.waitForSelector('html.wm-ready');
  assert.equal(await page.evaluate(() => document.documentElement.dataset.rdWidth), 'narrow');
  await page.context().close();
});

test('MathJax loads from its pinned URL, and a copy that fails its integrity check is refused', async t => {
  if (!(await exists(mdPage))) return t.skip(`no ${mdPage} on this site`);
  const ctx = await env.browser.newContext({ viewport: desktop, reducedMotion: 'reduce' });
  let hits = 0;
  await ctx.route(/cdn\.jsdelivr\.net\/npm\/mathjax@\d+\.\d+\.\d+\/tex-mml-chtml\.js$/, route => {
    hits++;
    route.fulfill({ status: 200, contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' }, body: 'window.tampered = true;' });
  });
  await ctx.route(MERMAID_URL, route => route.fulfill({ status: 200, contentType: 'text/javascript', body: MERMAID_STUB }));
  const page = await ctx.newPage();
  const refused = page.waitForEvent('console', m => m.type() === 'error' && /mathjax failed to load/.test(m.text()));
  await page.goto(env.base + mdPage);
  await refused;
  assert.equal(hits, 1, 'the pinned MathJax file was requested');
  assert.equal(await page.evaluate(() => window.tampered), undefined, 'the tampered script never ran');
  await ctx.close();
});

test('Mermaid loads from the site itself and draws real diagrams in the light and dark themes', async t => {
  if (!(await exists(diagramPage))) return t.skip(`no ${diagramPage} on this site`);
  const ctx = await env.browser.newContext({ viewport: desktop, reducedMotion: 'reduce', colorScheme: 'light' });
  await ctx.route(/cdn\.jsdelivr\.net\//, route => route.abort());
  // A post with many photos fires the window load event after Mermaid has loaded, and a web font can still be on
  // its way then. Mermaid's own draw-on-load must not run in that gap: a slow image and a slow font recreate it.
  await ctx.route('**/slow-load.png', route => setTimeout(() => route.fulfill({ status: 404 }).catch(() => {}), 1000));
  await ctx.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => document.body.append(Object.assign(new Image(), { src: '/slow-load.png', alt: '' })));
    const load = document.fonts.load.bind(document.fonts);
    document.fonts.load = (...a) => new Promise(r => setTimeout(r, 2000)).then(() => load(...a));
  });
  const page = await ctx.newPage();
  trackErrors(page);
  const origins = new Set();
  page.on('request', r => { if (/mermaid/.test(r.url())) origins.add(new URL(r.url()).origin); });
  await page.goto(env.base + diagramPage);
  const svg = page.locator('.view pre.mermaid.drawn svg').first();
  await svg.waitFor({ timeout: 20000 });
  const look = () => svg.evaluate(s => ({
    nodes: s.querySelectorAll('.node').length,
    label: s.querySelector('.nodeLabel')?.textContent.trim(),
    fill: getComputedStyle(s.querySelector('.node rect, .node polygon, .node path')).fill,
  }));
  const light = await look();
  assert.ok(light.nodes > 1 && light.label, `a real diagram, not the source (${JSON.stringify(light)})`);
  await shot(page, 'f4-mermaid-light');
  await page.locator('#themeBtn').click();
  await page.waitForFunction(f => {
    const n = document.querySelector('.view pre.mermaid.drawn svg .node rect, .view pre.mermaid.drawn svg .node polygon');
    return n && getComputedStyle(n).fill !== f;
  }, light.fill);
  const dark = await look();
  assert.equal(dark.nodes, light.nodes, 'redrawn with the dark theme');
  await shot(page, 'f4-mermaid-dark');
  assert.deepEqual([...origins], [new URL(env.base).origin], 'Mermaid and its chunks come from the site itself');
  assert.deepEqual(page.errors, []);
  await ctx.close();
});

test('admonitions (hugo-admonitions module) render styled in the light and dark themes', async t => {
  if (!(await exists(mdPage))) return t.skip(`no ${mdPage} on this site`);
  const { page } = await openStubbed(desktop, mdPage);
  const adm = page.locator('.view .rd .admonition').first();
  await adm.scrollIntoViewIfNeeded();
  const look = () => adm.evaluate(e => {
    const s = getComputedStyle(e), head = e.querySelector('.admonition-header');
    return { edge: s.borderLeftWidth, colour: s.borderLeftColor, bg: s.backgroundColor, head: head && getComputedStyle(head).color, icon: !!head?.querySelector('svg') };
  });
  const light = await look();
  assert.equal(light.edge, '3px', 'the theme\'s callout style applies');
  assert.equal(light.head, light.colour, 'the header takes the type colour');
  assert.ok(light.icon, 'the module\'s icon renders');
  assert.notEqual(light.bg, 'rgba(0, 0, 0, 0)');
  await shot(page, 'f1-admonition-light');
  await page.locator('#themeBtn').click();
  await page.waitForFunction(c => getComputedStyle(document.querySelector('.view .rd .admonition')).borderLeftColor !== c, light.colour);
  const dark = await look();
  assert.equal(dark.edge, '3px');
  assert.equal(dark.head, dark.colour);
  assert.notEqual(dark.bg, light.bg, 'the tint follows the dark reading background');
  await shot(page, 'f1-admonition-dark');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('on a phone, long inline code and bare links wrap, so a post never scrolls sideways', async t => {
  if (!(await needs(t, mdPage))) return;
  const ctx = await env.browser.newContext({ viewport: phone, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  trackErrors(page);
  await page.goto(env.base + mdPage);
  await page.locator('.rd-scroll .rd-body').first().waitFor();
  const over = await page.evaluate(() => { const s = [...document.querySelectorAll('.rd-scroll')].find(e => e.offsetParent); return s.scrollWidth - s.clientWidth; });
  assert.equal(over, 0, `the post is ${over}px wider than its window`);
  assert.deepEqual(page.errors, []);
  await ctx.close();
});
