// Window keys (wm/drag.js): f maximises the focused window and restores it, ` drops the terminal down, and ? lists
// every shortcut (lazy/shortcuts.js). Escape closes the focused window (D43). None fires while a field has the keys.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { env, useBrowser, open, win, desktop, settle } from './lib.mjs';

useBrowser();

test('f maximises the focused window and restores it, but not while typing', async () => {
  const page = await open(desktop, '/posts/');
  const tk = win(page, 'tracker');
  await tk.locator('.pc').first().waitFor();
  await tk.locator('.tab.on .tt').click();
  const before = await tk.boundingBox();

  await tk.locator('input[type=search]').focus();
  await page.keyboard.press('f');
  await settle(page);
  assert.deepEqual(await tk.boundingBox(), before, 'f is just a letter in the search field');

  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press('f');
  await settle(page);
  const max = await tk.boundingBox(), desk = await page.locator('#desk').boundingBox();
  assert.ok(max.width > desk.width - 20 && max.width > before.width, `maximised to the desk (${max.width} of ${desk.width})`);

  await page.keyboard.press('f');
  await settle(page);
  assert.deepEqual(await tk.boundingBox(), before, 'a second f restores it');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('` drops the terminal down across the desk to 60% of the screen, and ` in it rolls it back up', async t => {
  if (!(await fetch(env.base + '/terminal/')).ok) return t.skip('no /terminal/ on this site');
  const page = await open(desktop, '/');
  await page.keyboard.press('`');
  const term = win(page, 'terminal');
  await term.locator('.term input').waitFor();
  await settle(page);
  const b = await term.boundingBox(), desk = await page.locator('#desk').boundingBox();
  assert.ok(Math.abs(b.width - desk.width) < 2, `full width (${b.width} of ${desk.width})`);
  assert.ok(Math.abs(b.y + b.height - desktop.height * 0.6) < 3, `bottom at 60% of the screen (${b.y + b.height})`);
  assert.ok(await term.locator('.term input').evaluate(i => i === document.activeElement), 'the prompt has focus');

  await term.locator('.term input').type('echo hi');
  await page.keyboard.press('`');
  await term.waitFor({ state: 'hidden' });
  await page.keyboard.press('~');
  await term.waitFor();
  assert.equal(await term.locator('.term input').inputValue(), 'echo hi', 'the session is kept');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('? lists the shortcuts, and ? again or Escape closes the list', async () => {
  const page = await open(desktop, '/');
  const list = page.locator('dialog.shortcuts');
  await page.keyboard.press('?');
  await list.waitFor();
  assert.ok(await list.evaluate(d => d.open));
  const keys = await list.locator('kbd').allTextContents();
  for (const k of ['?', 'a', 'f', 'q', 'w', 'Esc']) assert.ok(keys.includes(k), `lists ${k}`);

  await page.keyboard.press('?');
  assert.equal(await list.evaluate(d => d.open), false, '? again closes it');
  // focus goes back to the page a moment after the dialog closes; until then a key still lands in the dialog
  await page.waitForFunction(() => !document.activeElement?.closest('dialog'));
  await page.keyboard.press('?');
  // the module is already loaded, but opening still waits on its promise
  await page.waitForFunction(() => document.querySelector('dialog.shortcuts').open);
  await page.keyboard.press('Escape');
  assert.equal(await list.evaluate(d => d.open), false, 'Escape closes it');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('Escape closes the focused window, but only after a field or lightbox inside it has had it (D43)', async t => {
  if (!(await fetch(env.base + '/photos/')).ok) return t.skip('no /photos/ on this site');
  const page = await open(desktop, '/photos/');
  const w = win(page, 'photos');
  await w.locator('.ph-grid .ph').first().click();
  const lb = w.locator('.lightbox');
  await lb.waitFor();
  await page.keyboard.press('Escape');
  await lb.waitFor({ state: 'hidden' });
  assert.ok(await w.isVisible(), 'the first Escape closes only the lightbox');
  await page.keyboard.press('Escape');
  await w.waitFor({ state: 'detached' });

  await page.evaluate(() => window.deskbar.go('/posts/'));
  const tk = win(page, 'tracker');
  await tk.locator('input[type=search]').focus();
  await page.keyboard.press('Escape');
  await settle(page);
  assert.ok(await tk.isVisible(), 'Escape in a field leaves the window open');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});
