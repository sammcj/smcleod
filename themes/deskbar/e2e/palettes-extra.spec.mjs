// Crisp, the pastel Lilac, Blossom and Lemon, and the bold Cobalt and Racing palettes: each links its stylesheet
// before first paint and paints its own tab, and axe finds no serious or critical violations over the reading layout
// (focused and muted tabs), the menu and Tracker, light and dark, at 1440 and 390, and under each window style.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { useBrowser, open, needs, shot, win, cards, desktop, phone } from './lib.mjs';

useBrowser();

const AXE = readFileSync(fileURLToPath(import.meta.resolve('axe-core/axe.min.js')), 'utf8');
const TAB = {
  crisp: ['rgb(255, 207, 15)', 'rgb(245, 196, 0)'], lilac: ['rgb(204, 184, 246)', 'rgb(194, 173, 244)'],
  blossom: ['rgb(255, 196, 217)', 'rgb(245, 168, 196)'], lemon: ['rgb(255, 233, 138)', 'rgb(245, 220, 110)'],
  cobalt: ['rgb(255, 155, 61)', 'rgb(255, 143, 46)'], racing: ['rgb(233, 165, 96)', 'rgb(217, 149, 90)'],
};
const THEMES = ['light', 'dark'];

const seed = s => `for (const [k, v] of Object.entries(${JSON.stringify(s)})) localStorage.setItem("deskbar:" + k, JSON.stringify(v));`;
const openAs = (vp, path, s) => open(vp, path, seed(s), { colorScheme: s.theme });

async function audit(page) {
  await page.addScriptTag({ content: AXE });
  const { violations } = await page.evaluate(() => window.axe.run(document, { iframes: false, resultTypes: ['violations'] }));
  return violations
    .filter(v => ['serious', 'critical'].includes(v.impact))
    .flatMap(v => v.nodes.map(n => `${v.impact} ${v.id}: ${n.target.join(' ')} ${n.failureSummary?.split('\n')[1]?.trim() ?? ''}`));
}

async function reader(page) {
  await cards(page).first().click();
  await win(page, 'reader').locator('.rd h1').waitFor();
}

async function menu(page) {
  await page.locator('#menuBtn').click();
  await page.locator('#menu .mn-it').first().waitFor();
}

test('new palettes: linked before first paint, each with its own tab colour', async () => {
  for (const [palette, colours] of Object.entries(TAB)) {
    for (const [i, theme] of THEMES.entries()) {
      const page = await openAs(desktop, '/', { palette, theme });
      await reader(page);
      const bg = await win(page, 'reader').locator('.tab.on').evaluate(e => getComputedStyle(e).backgroundColor);
      assert.equal(bg, colours[i], `${palette} ${theme} tab`);
      await shot(page, `palette-${palette}-${theme}`);
      await menu(page);
      await shot(page, `palette-${palette}-${theme}-menu`);
      await page.context().close();
    }
  }
});

test('axe: new palettes over the reader, menu and Tracker, light and dark, desktop and phone', async t => {
  if (!(await needs(t, '/posts/'))) return;
  const found = [];
  for (const palette of Object.keys(TAB)) {
    for (const [vp, w] of [[desktop, 1440], [phone, 390]]) {
      for (const theme of THEMES) {
        const s = { palette, theme }, at = `[${palette} ${w} ${theme}`;
        let page = await openAs(vp, '/', s);
        await reader(page);
        for (const v of await audit(page)) found.push(`${at} reader] ${v}`);
        await menu(page);
        for (const v of await audit(page)) found.push(`${at} menu] ${v}`);
        await page.context().close();
        page = await openAs(vp, '/posts/', s);
        await win(page, 'tracker').locator('.pc').first().waitFor();
        for (const v of await audit(page)) found.push(`${at} tracker] ${v}`);
        await page.context().close();
      }
    }
  }
  assert.deepEqual(found, []);
});

// Each palette under the other window styles, spread across the dock styles and wallpapers. Clear restyles the
// phone's full-screen windows too.
test('axe: new palettes under the BeOS, Flat and Clear window styles', async () => {
  const looks = [
    { palette: 'crisp', deco: 'beos', wall: 'plain', dock: 'deskbar' }, { palette: 'crisp', deco: 'clear', wall: 'clear', dock: 'glass' },
    { palette: 'lilac', deco: 'flat', wall: 'dots', dock: 'panel' }, { palette: 'lilac', deco: 'clear', wall: 'clear', dock: 'glass' },
    { palette: 'blossom', deco: 'beos', wall: 'hills', dock: 'glass' }, { palette: 'blossom', deco: 'clear', wall: 'plain', dock: 'glass' },
    { palette: 'lemon', deco: 'flat', wall: 'rings', dock: 'deskbar' }, { palette: 'lemon', deco: 'clear', wall: 'clear', dock: 'panel' },
    { palette: 'cobalt', deco: 'flat', wall: 'grid', dock: 'panel' }, { palette: 'cobalt', deco: 'clear', wall: 'clear', dock: 'glass' },
    { palette: 'racing', deco: 'beos', wall: 'grid', dock: 'deskbar' }, { palette: 'racing', deco: 'clear', wall: 'hills', dock: 'glass' },
  ];
  const found = [];
  for (const look of looks) {
    for (const [vp, w] of look.deco === 'clear' ? [[desktop, 1440], [phone, 390]] : [[desktop, 1440]]) {
      for (const theme of THEMES) {
        const page = await openAs(vp, '/', { ...look, theme }), at = `[${look.palette} ${look.deco} ${w} ${theme}`;
        await reader(page);
        for (const v of await audit(page)) found.push(`${at} reader] ${v}`);
        if (w === 1440) await shot(page, `palette-${look.palette}-${look.deco}-${theme}`);
        await menu(page);
        for (const v of await audit(page)) found.push(`${at} menu] ${v}`);
        await page.context().close();
      }
    }
  }
  assert.deepEqual(found, []);
});
