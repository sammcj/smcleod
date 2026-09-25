// The Posts window (D36) is one window however it is opened, and on phones minimised windows wait in the panel
// switcher, since the home screen belongs to Latest posts and the icons.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useBrowser, open, shot, win, cards, desktop, phone, needs } from './lib.mjs';

useBrowser();

test('desktop: the Posts icon raises the one Posts window, restores it from the panel and reopens it once closed', async () => {
  const page = await open(desktop);
  await cards(page).first().waitFor();
  const posts = win(page, 'tracker'), icon = page.locator('#icons .dicon[href$="/posts/"]');
  const compact = await posts.boundingBox();
  await icon.click();
  assert.equal(await page.locator('.view[data-key="tracker"]').count(), 1, 'no second Posts window');
  assert.deepEqual(await posts.boundingBox(), compact, 'it stays where it is');

  await posts.locator('.tab .ctl.min').click();
  assert.equal(await posts.count(), 0, 'minimised');
  await icon.click();
  assert.deepEqual(await posts.boundingBox(), compact, 'the icon restores it from the panel');

  await posts.locator('.tab .ctl.close').click();
  assert.equal(await page.locator('.view[data-key="tracker"]').count(), 0, 'closed');
  assert.equal(await page.locator('#tasks .task', { hasText: '~/posts' }).count(), 0, 'no panel task once closed');
  await icon.click();
  await posts.locator('.pc').first().waitFor();
  const big = await posts.boundingBox();
  assert.ok(big.width > compact.width + 300, `reopened at the Posts window's full size (${big.width} wide)`);
  assert.equal(await page.evaluate(() => document.querySelector('.win.active .view:not([hidden])')?.dataset.key), 'tracker', 'and in front');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('phone: minimised windows wait in the panel switcher, leaving the home screen to Latest posts and the icons', async () => {
  const page = await open(phone);
  await cards(page).first().click();
  const reader = win(page, 'reader');
  await reader.locator('.rd h1').waitFor();
  await reader.locator('.tab.on .ctl.min').click();
  await page.waitForFunction(() => !document.documentElement.classList.contains('has-win'));
  assert.ok(await page.locator('#tasks').isHidden(), 'no row of tasks on the home screen');
  assert.equal(await page.locator('#winsN').textContent(), '1', 'the switcher counts it');
  await shot(page, 'phone-home-minimised');
  await page.click('#winsBtn');
  await page.locator('#switcher .sw-tab').first().click();
  await reader.locator('.rd h1').waitFor();
  assert.ok(await reader.isVisible(), 'restored from the switcher');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('desktop: dragging the Posts window tab moves it, and its controls still work', async () => {
  const page = await open(desktop);
  const w = win(page, 'tracker'), tab = w.locator('.tab .tt');
  await cards(page).first().waitFor();
  const before = await w.boundingBox(), t = await tab.boundingBox();
  await page.mouse.move(t.x + 30, t.y + t.height / 2);
  await page.mouse.down();
  await page.mouse.move(t.x + 130, t.y + 60, { steps: 5 });
  await page.mouse.move(t.x + 230, t.y + 110, { steps: 5 });
  await page.mouse.up();
  const after = await w.boundingBox();
  assert.ok(Math.abs(after.x - before.x - 200) <= 2 && Math.abs(after.y - before.y - 100) <= 2, `moved by 200,100: ${after.x - before.x},${after.y - before.y}`);
  await w.locator('.tab .ctl.min').click();
  assert.equal(await w.count(), 0, 'minimise still works after a drag');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

// A double-click is a desktop habit. Its second click must not toggle the window straight back, or land on the
// window beneath the closed switcher.
test('desktop: double-clicking the Posts window in the panel or the switcher leaves it in front', async () => {
  const page = await open(desktop);
  const tk = win(page, 'tracker');
  await cards(page).first().click();
  await win(page, 'reader').locator('.rd h1').waitFor();
  const inFront = () => page.evaluate(() => {
    const r = document.querySelector('.view[data-key="tracker"]').closest('.win');
    return !r.hidden && r.classList.contains('active') && [...document.querySelectorAll('.win:not([hidden])')].every(w => w === r || +w.style.zIndex < +r.style.zIndex);
  });

  await tk.locator('.tab .ctl.min').click();
  await page.locator('#tasks .task', { hasText: '~/posts' }).dblclick();
  await tk.waitFor();
  assert.ok(await inFront(), 'from the panel');

  await tk.locator('.tab .ctl.min').click();
  await page.locator('#winsBtn').click();
  await page.locator('#switcher .sw-open', { hasText: '~/posts' }).dblclick();
  await tk.waitFor();
  assert.ok(await inFront(), 'from the switcher');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('D24/D36: Home shows the Posts window at its spot, then puts it back minimised, or closes it again', async t => {
  if (!(await needs(t, '/about/'))) return;
  const page = await open(desktop, '/about/');
  const posts = win(page, 'tracker'), about = win(page, 'page:/about/'), task = page.locator('#tasks .task', { hasText: '~/posts' });
  await about.waitFor();
  const spot = await posts.boundingBox();

  await task.click();
  await posts.locator('.tab .ctl.min').click();
  await page.click('#homeBtn');
  assert.deepEqual(await posts.boundingBox(), spot, 'Home shows it at its spot');
  assert.equal(await about.count(), 0);
  await page.click('#homeBtn');
  await about.waitFor();
  assert.equal(await posts.count(), 0, 'minimised again');
  assert.equal(await page.locator('#tasks .task.min', { hasText: '~/posts' }).count(), 1);

  await task.click();
  await posts.locator('.tab .ctl.close').click();
  await page.click('#homeBtn');
  assert.deepEqual(await posts.boundingBox(), spot, 'Home opens it when it was closed');
  await page.click('#homeBtn');
  await about.waitFor();
  assert.equal(await page.locator('.view[data-key="tracker"]').count(), 0, 'and closes it again');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('phone: an app closed from its own address opens again', async t => {
  if (!(await needs(t, '/photos/'))) return;
  const page = await open(phone);
  // as its icon or a link does
  const openPhotos = () => page.evaluate(() => window.deskbar.go('/photos/')), photos = win(page, 'photos');
  await openPhotos();
  await photos.waitFor();
  assert.ok(await page.locator('#panel #winsBtn').isHidden(), 'no switcher for the one window on screen');
  await photos.locator('.tab.on .ctl.close').click();
  await photos.waitFor({ state: 'detached' });
  await page.waitForFunction(() => location.pathname === '/', null, { timeout: 3000 });
  await openPhotos();
  await photos.waitFor({ timeout: 5000 });
  assert.deepEqual(page.errors, []);
  await page.context().close();
});
