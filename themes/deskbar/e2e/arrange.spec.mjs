// Arranging windows: folders tile beside each other as they open (apps/registry.js `tile`), and the a key tiles every
// open window and a second press puts them back (wm/drag.js). Uses the example site's /links/, /projects/ and /videos/ folders.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useBrowser, open, win, desktop, dragTab, needs } from './lib.mjs';

useBrowser();

const box = (page, key) => win(page, key).boundingBox();
const overlap = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
// the tab sits above the frame, so a window's own box starts that much higher
const withTab = async (page, key) => { const b = await box(page, key), t = await win(page, key).locator('.tab.on').boundingBox(); return { ...b, y: t.y, height: b.y + b.height - t.y }; };
async function openFolder(page, p) {
  await page.evaluate(to => window.deskbar.go(to), p);
  await win(page, 'folder:' + p).locator('.folder li').first().waitFor();
  // the open transition and the tiling finish a frame later
  await page.waitForTimeout(300);
}

test('folders opened one after another sit side by side, and one moved by hand stays where it was put', async t => {
  if (!(await needs(t, '/links/', '/projects/', '/videos/'))) return;
  const page = await open(desktop, '/');
  await openFolder(page, '/links/');
  await openFolder(page, '/projects/');
  const [l, p] = [await withTab(page, 'folder:/links/'), await withTab(page, 'folder:/projects/')];
  assert.ok(!overlap(l, p), `the second folder opens beside the first (${JSON.stringify([l, p])})`);

  await dragTab(page, 'folder:/links/', { x: 700, y: 600 });
  await page.mouse.up();
  const moved = await box(page, 'folder:/links/');
  await openFolder(page, '/videos/');
  assert.deepEqual(await box(page, 'folder:/links/'), moved, 'the folder moved by hand stays put');
  const [p2, v] = [await withTab(page, 'folder:/projects/'), await withTab(page, 'folder:/videos/')];
  assert.ok(!overlap(p2, v), 'the new folder tiles with the other untouched one');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('the a key tiles every open window, each filling its tile, and puts them back when pressed again, but not while typing', async t => {
  if (!(await needs(t, '/links/', '/projects/'))) return;
  const page = await open(desktop, '/');
  await win(page, 'tracker').waitFor();
  await openFolder(page, '/links/');
  await openFolder(page, '/projects/');
  const keys = ['tracker', 'folder:/links/', 'folder:/projects/'];

  // typed into Tracker's search, a is just a letter
  const before = await Promise.all(keys.map(k => box(page, k)));
  await win(page, 'tracker').locator('input[type=search]').focus();
  await page.keyboard.press('a');
  await page.waitForTimeout(300);
  assert.deepEqual(await Promise.all(keys.map(k => box(page, k))), before, 'nothing moves while typing');

  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press('a');
  await page.waitForTimeout(400);
  const boxes = await Promise.all(keys.map(k => withTab(page, k)));
  boxes.forEach((a, i) => boxes.slice(i + 1).forEach(b => assert.ok(!overlap(a, b), 'no two windows overlap')));
  const area = boxes.reduce((n, b) => n + b.width * b.height, 0);
  assert.ok(area > desktop.width * desktop.height * 0.6, `together they fill most of the desk (${Math.round(area / (desktop.width * desktop.height) * 100)}%)`);

  // pressed again, a puts every window back where it was
  await page.keyboard.press('a');
  await page.waitForTimeout(400);
  assert.deepEqual(await Promise.all(keys.map(k => box(page, k))), before, 'a second press undoes the arrangement');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});
