// Every palette in appearance.js: render-blocking, so on before first paint, painting its own tab colour, and axe over
// the reading layout (focused and muted tabs) and the menu, one light and one dark, one desktop and one phone (lib.mjs
// axeRun). Each palette goes under a plain window style, wallpaper and
// dock taken in turn, so every pairing of palette and window style comes up across the list; AXE_ALL=1 audits each
// palette under every plain window style. The looks' own colours are looks.spec.mjs's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useBrowser, open, seed, css, win, desktop, AXE_ALL, axeRun, auditState } from './lib.mjs';
import { PALETTES, DECOS, WALLS, DOCKS, LOOKS, lookSheet } from '../assets/js/deskbar/lib/appearance.js';

useBrowser();

const DECO = DECOS.map(([v]) => v).filter(v => !LOOKS[v]);
const WALL = WALLS.map(([v]) => v).filter(v => !lookSheet(v));
const DOCK = DOCKS.map(([v]) => v).filter(v => !lookSheet(v));
const hex = h => `rgb(${h.match(/\w\w/g).map(x => parseInt(x, 16)).join(', ')})`;

test('each palette is render-blocking and paints its own tab colour, light and dark', async () => {
  const dark = {};
  for (const theme of ['light', 'dark']) {
    for (const [palette, , swatch] of PALETTES) {
      const page = await open(desktop, '/posts/', seed({ palette, theme }), { colorScheme: theme });
      const tab = await css(win(page, 'tracker').locator('.tab.on'), 'backgroundColor');
      if (theme === 'light') assert.equal(tab, hex(swatch.split(' ')[0]), `${palette}: the tab its swatch shows`);
      else dark[palette] = tab;
      // the default palette is the core CSS alone
      if (palette !== 'haiku') {
        const blocking = await page.evaluate(k => {
          const href = JSON.parse(document.getElementById('deskbar-lazy').textContent)[k]?.css;
          return !!document.querySelector(`head link[rel=stylesheet][href="${href}"]`) && performance.getEntriesByName(new URL(href, location).href)[0]?.renderBlockingStatus;
        }, 'palette-' + palette);
        assert.equal(blocking, 'blocking', `${palette} ${theme}: linked before first paint`);
      }
      assert.deepEqual(page.errors, []);
      await page.context().close();
    }
  }
  // in dark, a palette whose tab differs from the default's by day differs from it by night too
  for (const [palette, , swatch] of PALETTES) {
    if (swatch.split(' ')[0] !== PALETTES[0][2].split(' ')[0]) assert.notEqual(dark[palette], dark.haiku, `${palette}: its own dark tab`);
  }
});

for (const [i, [palette]] of PALETTES.entries()) {
  test(`axe: ${palette} palette`, async () => {
    const found = [];
    for (const [d, deco] of DECO.entries()) {
      if (!AXE_ALL && d !== i % DECO.length) continue;
      const settings = { palette, deco, wall: WALL[(i + d) % WALL.length], dock: DOCK[(i + d) % DOCK.length] };
      for (const [j, state] of ['reader', 'menu'].entries()) {
        for (const run of axeRun(i, j)) found.push(...await auditState(state, run, settings, `${palette} ${deco} ${settings.wall} ${settings.dock} `));
      }
    }
    assert.deepEqual(found, []);
  });
}
