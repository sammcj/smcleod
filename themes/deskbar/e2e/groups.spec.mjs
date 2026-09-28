// Browser checks for window groups (D40): joining by a side band, the seam, the clip, swapping a member, leaving,
// the reading layout as a group, and phones, which never lay one out.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useBrowser, open, shot, win, cards, dragTab, desktop, phone, needs, settle } from './lib.mjs';

useBrowser();

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${+a.toFixed(2)} vs ${+b.toFixed(2)} (±${tol})`);
const box = (page, key) => win(page, key).boundingBox();
const centre = b => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

async function drag(page, from, to) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 8, from.y + 8, { steps: 2 });
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
}

// Posts at its home spot and About opened beside it, About's tab dropped on Posts' right edge
async function joined(t) {
  const page = await open(desktop);
  if (!(await needs(t, '/about/'))) return null;
  await cards(page).first().waitFor();
  await page.evaluate(() => window.deskbar.go('/about/'));
  await win(page, 'page:/about/').waitFor();
  const pb = await box(page, 'tracker');
  await dragTab(page, 'page:/about/', { x: pb.x + pb.width - 12, y: pb.y + pb.height / 2 });
  return { page, pb };
}

test('D40: dropping a window on another\'s side edge joins them, with a preview first', async t => {
  const r = await joined(t);
  if (!r) return;
  const { page, pb } = r;
  assert.equal(await page.locator('#snapPreview').getAttribute('class'), 'join', 'the preview marks a join');
  await shot(page, 'g1-join-preview');
  await page.mouse.up();
  const ab = await box(page, 'page:/about/'), pb2 = await box(page, 'tracker');
  assert.deepEqual([pb2.y, pb2.width, pb2.height], [pb.y, pb.width, pb.height], 'the window joined keeps its size');
  assert.ok(ab.x + ab.width <= desktop.width, 'the group moves back onto the desk');
  near(ab.x, pb2.x + pb2.width + 6, 1, 'the joiner sits one seam to its right');
  assert.deepEqual([ab.y, ab.height], [pb.y, pb.height], 'at its height');
  assert.ok(await win(page, 'page:/about/').locator('.seam').isVisible(), 'a seam joins them');
  assert.ok(await page.locator('#snapPreview').isHidden());
  await shot(page, 'g2-joined');

  // the seam trades width between them
  const s = centre(await win(page, 'page:/about/').locator('.seam').boundingBox());
  await drag(page, s, { x: s.x + 80, y: s.y });
  const [pb3, ab3] = [await box(page, 'tracker'), await box(page, 'page:/about/')];
  near(pb3.width, pb2.width + 80, 2, 'the left one widens');
  near(ab3.x + ab3.width, ab.x + ab.width, 2, 'the right edge stays');

  // the clip moves the group as one
  const c = centre(await page.locator('.clip').boundingBox());
  await drag(page, c, { x: c.x + 40, y: c.y + 30 });
  const [pb4, ab4] = [await box(page, 'tracker'), await box(page, 'page:/about/')];
  near(pb4.x - pb3.x, 40, 2, 'moved right');
  near(ab4.y - ab3.y, 30, 2, 'the other member moved down with it');

  // pressing it unjoins them where they are
  await page.locator('.clip').click();
  assert.equal(await page.locator('.win.gl').count(), 0, 'no seam once unjoined');
  assert.deepEqual(await box(page, 'tracker'), pb4);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('D40: closing a member puts the window it joined back where it was; keyboard can unjoin', async t => {
  const r = await joined(t);
  if (!r) return;
  const { page, pb } = r;
  await page.mouse.up();
  // the grip resizes the group: its height for both
  const g = centre(await win(page, 'page:/about/').locator('.grip').boundingBox());
  await drag(page, g, { x: g.x, y: g.y - 60 });
  near((await box(page, 'tracker')).height, pb.height - 60, 2, 'the grip resizes the whole group');
  await win(page, 'page:/about/').locator('.ctl.close').click();
  await win(page, 'page:/about/').waitFor({ state: 'detached' });
  assert.deepEqual(await box(page, 'tracker'), pb, 'Posts is back as it was before About joined');

  // Enter on the clip unjoins
  await page.evaluate(() => window.deskbar.go('/about/'));
  await win(page, 'page:/about/').waitFor();
  await dragTab(page, 'page:/about/', { x: pb.x + pb.width - 12, y: pb.y + pb.height / 2 });
  await page.mouse.up();
  await page.locator('.clip').focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('.win.gl').count(), 0);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('D40: the reading layout is a joined pair; a window dropped on the reader\'s middle swaps with it', async t => {
  const page = await open(desktop);
  if (!(await needs(t, '/about/'))) return;
  await cards(page).first().click();
  await win(page, 'reader').locator('.rd h1').waitFor();
  assert.ok(await win(page, 'reader').locator('.seam').isVisible(), 'Posts and the post are joined');
  const rb = await box(page, 'reader');

  await page.evaluate(() => window.deskbar.go('/about/'));
  await win(page, 'page:/about/').waitFor();
  const was = await box(page, 'page:/about/');
  await dragTab(page, 'page:/about/', centre(rb));
  assert.equal(await page.locator('#snapPreview').getAttribute('class'), 'swap', 'the preview marks a swap');
  await shot(page, 'g3-swap-preview');
  await page.mouse.up();
  assert.deepEqual(await box(page, 'page:/about/'), rb, 'About takes the reader\'s place');
  const moved = await box(page, 'reader');
  near(moved.x, was.x, 1, 'the reader goes where About was (x)');
  near(moved.width, was.width, 1, 'at its size');

  // dragging a member's tab takes it out: the post, now on its own, stays; Posts goes back to its own spot
  await dragTab(page, 'page:/about/', { x: 900, y: 500 });
  await page.mouse.up();
  assert.equal(await page.locator('.win.gl').count(), 0, 'no group left');
  const tb = await box(page, 'tracker');
  assert.ok(tb.x > 100, `Posts is back beside the icons (x=${tb.x})`);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('D40: phones never lay out a group', async () => {
  const page = await open(phone);
  await cards(page).first().click();
  await win(page, 'reader').locator('.rd h1').waitFor();
  assert.equal(await page.locator('.win.gl, .win.gr').count(), 0);
  assert.equal(await page.locator('.seam').filter({ visible: true }).count(), 0);
  await page.setViewportSize(desktop);
  await win(page, 'reader').locator('.seam').waitFor();
  await page.setViewportSize(phone);
  await page.waitForFunction(() => !document.querySelector('.win.gl'));
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('D40: the a key tiles a group as one unit and puts it back', async () => {
  const page = await open(desktop);
  await cards(page).first().click();
  await win(page, 'reader').locator('.rd h1').waitFor();
  const [tb, rb] = [await box(page, 'tracker'), await box(page, 'reader')];
  await page.keyboard.press('a');
  await settle(page);
  assert.ok(await win(page, 'reader').locator('.seam').isVisible(), 'still joined');
  await page.keyboard.press('a');
  await settle(page);
  assert.deepEqual([await box(page, 'tracker'), await box(page, 'reader')], [tb, rb], 'back as they were');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('D40: after Home, opening a post lays the reading pair out again', async () => {
  const page = await open(desktop);
  await cards(page).first().click();
  await win(page, 'reader').locator('.rd h1').waitFor();
  const [tb, rb] = [await box(page, 'tracker'), await box(page, 'reader')];
  await page.click('#homeBtn');
  await cards(page).nth(1).click();
  await win(page, 'reader').locator('.rd h1').waitFor();
  await settle(page);
  assert.deepEqual([await box(page, 'tracker'), await box(page, 'reader')], [tb, rb], 'Posts and the post side by side again');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('D40: a member moved while the rest of its group is minimised moves out of the group', async () => {
  const page = await open(desktop);
  await cards(page).first().click();
  await win(page, 'reader').locator('.rd h1').waitFor();
  await win(page, 'reader').locator('.ctl.min').click();
  const tb = await box(page, 'tracker');
  const fr = { x: tb.x + tb.width / 2, y: tb.y + tb.height - 2 };
  await drag(page, fr, { x: fr.x + 100, y: fr.y - 40 });
  const tb2 = await box(page, 'tracker');
  assert.ok(Math.abs(tb2.x - tb.x - 100) <= 2, `the frame border moved it (${tb.x} to ${tb2.x})`);
  await page.locator('#tasks .task.min').first().click();
  await win(page, 'reader').waitFor();
  assert.deepEqual(await box(page, 'tracker'), tb2, 'it stays where it was put');
  assert.equal(await page.locator('.win.gl').count(), 0, 'no longer joined');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});
