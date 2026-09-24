// Sketch (lazy/sketch.js): strokes, shapes, undo and redo, PNG export, pen pressure, touch, and the drawing
// surviving a resize and a reload. Skips on a site without /sketch/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { useBrowser, open, needs, shot, win, desktop, phone } from './lib.mjs';

useBrowser();

const url = '/sketch/', W = 1200, H = 900;
const stage = page => win(page, 'sketch').locator('.sk-over');

// Canvas units to page pixels
async function toPage(page, [x, y]) {
  const b = await stage(page).boundingBox();
  return [b.x + (x * b.width) / W, b.y + (y * b.height) / H];
}

async function drag(page, from, to) {
  const [x0, y0] = await toPage(page, from), [x1, y1] = await toPage(page, to);
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  await page.mouse.move(x1, y1, { steps: 12 });
  await page.mouse.up();
}

// RGB of the drawing at a point, in canvas units
const px = (page, x, y) => page.evaluate(([x, y]) =>
  [...document.querySelector('.app-sketch .sk-canvas:not(.sk-over)').getContext('2d').getImageData(x, y, 1, 1).data].slice(0, 3), [x, y]);
const WHITE = [255, 255, 255];

async function openSketch(viewport = desktop, ctx) {
  const page = await open(viewport, url, undefined, ctx);
  await stage(page).waitFor();
  return page;
}

const tool = (page, name) => win(page, 'sketch').getByRole('button', { name, exact: true });

test('draws strokes and shapes, with undo and redo', async t => {
  if (!(await needs(t, url))) return;
  const page = await openSketch();
  assert.deepEqual(await px(page, 600, 450), WHITE, 'starts on blank paper');
  assert.equal(await tool(page, 'Undo').isDisabled(), true);

  await drag(page, [200, 450], [1000, 450]);
  assert.deepEqual(await px(page, 600, 450), [31, 31, 31], 'a black pen stroke');
  assert.deepEqual(await px(page, 600, 300), WHITE);

  await tool(page, 'Rectangle').click();
  await tool(page, 'Red').click();
  await tool(page, 'Fill shapes').click();
  await drag(page, [100, 100], [300, 300]);
  assert.deepEqual(await px(page, 200, 200), [215, 38, 61], 'a filled red rectangle');
  await shot(page, 'sketch-drawn');

  await tool(page, 'Undo').click();
  assert.deepEqual(await px(page, 200, 200), WHITE, 'undo removes the rectangle');
  assert.deepEqual(await px(page, 600, 450), [31, 31, 31], 'and keeps the stroke');
  await tool(page, 'Undo').click();
  assert.deepEqual(await px(page, 600, 450), WHITE, 'undo removes the stroke');
  assert.equal(await tool(page, 'Undo').isDisabled(), true);
  await tool(page, 'Redo').click();
  await tool(page, 'Redo').click();
  assert.deepEqual(await px(page, 200, 200), [215, 38, 61], 'redo brings both back');
  assert.equal(await tool(page, 'Redo').isDisabled(), true);

  await tool(page, 'Eraser').click();
  await drag(page, [150, 200], [250, 200]);
  assert.deepEqual(await px(page, 200, 200), WHITE, 'the eraser paints paper');
  await win(page, 'sketch').getByRole('button', { name: 'Clear' }).click();
  assert.deepEqual(await px(page, 600, 450), WHITE, 'clear empties the page');
  await tool(page, 'Undo').click();
  assert.deepEqual(await px(page, 600, 450), [31, 31, 31], 'and can be undone');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('strokes older than the undo history stay on the page', async t => {
  if (!(await needs(t, url))) return;
  const page = await openSketch();
  // more dots than the history holds (200), the first ones in the top row
  for (let i = 0; i < 205; i++) {
    const [x, y] = await toPage(page, [50 + (i % 20) * 50, 50 + Math.floor(i / 20) * 50]);
    await page.mouse.click(x, y);
  }
  await tool(page, 'Undo').click();
  assert.deepEqual(await px(page, 50, 50), [31, 31, 31], 'the first dot survives a redraw');
  assert.deepEqual(await px(page, 250, 550), WHITE, 'the last dot is undone');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('Save PNG downloads the drawing as a PNG', async t => {
  if (!(await needs(t, url))) return;
  const page = await openSketch();
  await drag(page, [100, 100], [900, 700]);
  const [dl] = await Promise.all([page.waitForEvent('download'), win(page, 'sketch').getByRole('button', { name: 'Save PNG' }).click()]);
  assert.match(dl.suggestedFilename(), /^sketch-\d{8}-\d{4}\.png$/);
  const png = readFileSync(await dl.path());
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], 'PNG signature');
  // IHDR width and height: the full canvas, whatever size the window shows it at
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [W, H]);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('the drawing survives a window resize and a reload', async t => {
  if (!(await needs(t, url))) return;
  const page = await openSketch();
  await drag(page, [200, 450], [1000, 450]);
  await page.setViewportSize({ width: 900, height: 640 });
  assert.deepEqual(await px(page, 600, 450), [31, 31, 31], 'kept through a resize');
  // the new size still maps the pointer onto the right canvas point
  await drag(page, [600, 100], [600, 800]);
  assert.deepEqual(await px(page, 600, 200), [31, 31, 31]);
  await page.waitForFunction(() => localStorage.getItem('deskbar:sketch')?.includes('data:image/png'));
  await page.reload();
  await stage(page).waitFor();
  await page.waitForFunction(() => {
    const d = document.querySelector('.app-sketch .sk-canvas:not(.sk-over)').getContext('2d').getImageData(600, 450, 1, 1).data;
    return d[0] < 100;
  });
  assert.deepEqual(await px(page, 600, 200), [31, 31, 31], 'restored after a reload');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

// Stroke thickness down a column of the canvas
const thickness = (page, x, y0, y1) => page.evaluate(([x, y0, y1]) => {
  const d = document.querySelector('.app-sketch .sk-canvas:not(.sk-over)').getContext('2d').getImageData(x, y0, 1, y1 - y0).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i] < 128) n++;
  return n;
}, [x, y0, y1]);

test('a pen draws thicker with more pressure', async t => {
  if (!(await needs(t, url))) return;
  const page = await openSketch();
  const cdp = await page.context().newCDPSession(page);
  const pen = async (from, to, force) => {
    const [x0, y0] = await toPage(page, from), [x1, y1] = await toPage(page, to);
    const ev = (type, x, y) => cdp.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, pointerType: 'pen', force });
    await ev('mousePressed', x0, y0);
    for (let i = 1; i <= 10; i++) await ev('mouseMoved', x0 + ((x1 - x0) * i) / 10, y0 + ((y1 - y0) * i) / 10);
    await ev('mouseReleased', x1, y1);
  };
  await pen([200, 300], [1000, 300], 0.1);
  await pen([200, 600], [1000, 600], 1);
  const light = await thickness(page, 600, 250, 350), firm = await thickness(page, 600, 550, 650);
  assert.ok(light > 0, 'a light stroke still draws');
  assert.ok(firm > light * 2, `firm ${firm}px vs light ${light}px`);
  await page.context().close();
});

test('draws with touch on a phone', async t => {
  if (!(await needs(t, url))) return;
  const page = await openSketch(phone, { hasTouch: true, isMobile: true });
  const cdp = await page.context().newCDPSession(page);
  const [x0, y0] = await toPage(page, [200, 450]), [x1, y1] = await toPage(page, [1000, 450]);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
  for (let i = 1; i <= 10; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + ((x1 - x0) * i) / 10, y: y0 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.deepEqual(await px(page, 600, 450), [31, 31, 31]);
  await shot(page, 'sketch-phone');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});
