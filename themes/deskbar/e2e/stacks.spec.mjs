// Stacked (joined) windows: each tab carries its own title and close control, and a grey handle after the tabs holds
// the stack's minimise and maximise and moves the whole stack. The Posts window the desktop opens with joins stacks like
// any other (D36), while phones keep their home screen of posts outside the window manager.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useBrowser, open, shot, win, cards, visibleWins, desktop, phone, needs } from './lib.mjs';

useBrowser();

const centre = b => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

async function drag(page, from, to) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  // a short first leg passes the 5px drag threshold before the long move
  await page.mouse.move(from.x + 10, from.y + 10, { steps: 2 });
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();
}

// Drops the window showing src by its tab onto the tab of the window showing dst
async function join(page, src, dst) {
  const s = await win(page, src).locator('.tab.on .tt').boundingBox(), d = await win(page, dst).locator('.tab.on .tt').boundingBox();
  await drag(page, { x: s.x + 12, y: s.y + s.height / 2 }, { x: d.x + 20, y: d.y + d.height / 2 });
}

// About and Markdown stacked in one window, About's tab first
async function stackOfTwo(t) {
  if (!(await needs(t, '/about/', '/markdown/'))) return null;
  const page = await open(desktop, '/about/');
  await win(page, 'page:/about/').waitFor();
  await page.evaluate(() => window.deskbar.go('/markdown/'));
  const md = win(page, 'page:/markdown/');
  await md.waitFor();
  // page windows open at the same spot, so move Markdown clear of About first
  const tb = await md.locator('.tab.on .tt').boundingBox();
  await drag(page, { x: tb.x + 12, y: tb.y + tb.height / 2 }, { x: 900, y: 520 });
  await join(page, 'page:/markdown/', 'page:/about/');
  const stack = page.locator('.win:not([hidden]):has(.tabs.multi)');
  assert.equal(await stack.locator('.tab').count(), 2, 'stacked');
  return { page, stack };
}

test('stacked tabs size to their titles, with close at each end and one handle for the stack', async t => {
  const s = await stackOfTwo(t);
  if (!s) return;
  const { page, stack } = s;
  await shot(page, 'stack-two');
  const geo = await stack.evaluate(w => {
    const r = e => e.getBoundingClientRect(), tabs = [...w.querySelectorAll('.tab')], th = w.querySelector('.tabs .th');
    return {
      win: r(w.querySelector('.frame')).width,
      tabs: tabs.map(t => ({ right: r(t).right, width: r(t).width, close: r(t.querySelector('.ctl.close')).right, ctls: t.querySelectorAll('.ctl').length })),
      th: th && { left: r(th).left, right: r(th).right, cursor: getComputedStyle(th).cursor, min: !!th.querySelector('.ctl.min'), max: !!th.querySelector('.ctl.max') },
      frameRight: r(w.querySelector('.frame')).right,
    };
  });
  for (const tab of geo.tabs) {
    assert.ok(tab.right - tab.close <= 4, `close sits at the end of its tab (${tab.close} vs ${tab.right})`);
    assert.equal(tab.ctls, 1, 'a stacked tab has only its close control');
    assert.ok(tab.width < geo.win / 2, `the tab is sized to its title (${tab.width} of ${geo.win})`);
  }
  assert.ok(geo.th, 'the stack has a handle');
  assert.ok(geo.th.min && geo.th.max, 'minimise and maximise are on the handle');
  assert.equal(geo.th.cursor, 'move');
  assert.ok(geo.th.left >= geo.tabs.at(-1).right - 1, 'the handle follows the tabs');
  assert.ok(Math.abs(geo.th.right - geo.frameRight) <= 1, 'and reaches the frame edge');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('dragging the handle moves the whole stack; dragging a tab out detaches it', async t => {
  const s = await stackOfTwo(t);
  if (!s) return;
  const { page, stack } = s;
  const before = await stack.boundingBox(), th = await stack.locator('.tabs .th').boundingBox();
  const from = { x: th.x + 20, y: th.y + th.height / 2 };
  await drag(page, from, { x: from.x - 150, y: from.y + 80 });
  const after = await stack.boundingBox();
  assert.ok(Math.abs(after.x - before.x + 150) <= 2 && Math.abs(after.y - before.y - 80) <= 2, `moved by -150,80: ${after.x - before.x},${after.y - before.y}`);
  assert.equal(await stack.locator('.tab').count(), 2, 'still one stack');

  // the active tab tears off as readily as an inactive one
  const n = await visibleWins(page), on = await stack.locator('.tab.on .tt').boundingBox();
  await drag(page, { x: on.x + 12, y: on.y + on.height / 2 }, { x: 1100, y: 600 });
  assert.equal(await visibleWins(page), n + 1, 'the tab became its own window');
  assert.equal(await page.locator('.tabs.multi').count(), 0, 'no stack is left');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('the handle minimises and maximises the stack, and a third window joins by the handle', async t => {
  const s = await stackOfTwo(t);
  if (!s) return;
  const { page, stack } = s;
  const handle = stack.locator('.tabs .th');
  await handle.locator('.ctl.max').click();
  assert.ok((await stack.boundingBox()).width > 1400, 'maximised');
  await handle.locator('.ctl.max').click();
  assert.ok((await stack.boundingBox()).width < 1400, 'restored');
  await handle.locator('.ctl.min').click();
  assert.equal(await page.locator('.tabs.multi').count() - await page.locator('.win[hidden] .tabs.multi').count(), 0, 'minimised');
  await page.locator('#tasks .task.min').first().click();

  // a whole stack dropped by its handle onto another window's tab joins it
  await page.evaluate(() => window.deskbar.go('/contact/'));
  const other = win(page, 'mail');
  await other.waitFor();
  const ob = await other.locator('.tab.on .tt').boundingBox();
  await drag(page, { x: ob.x + 12, y: ob.y + ob.height / 2 }, { x: 1000, y: 650 });
  const hb = await handle.boundingBox(), tt = await other.locator('.tab.on .tt').boundingBox();
  await drag(page, { x: hb.x + 20, y: hb.y + hb.height / 2 }, centre(tt));
  assert.equal(await page.locator('.win:not([hidden]) .tabs.multi .tab').count(), 3, 'three tabs in one stack');
  await shot(page, 'stack-three');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('D36: the Posts window opens beside the icons, joins other windows, and they join it', async () => {
  const page = await open(desktop);
  const posts = win(page, 'tracker');
  await cards(page).first().waitFor();
  const b = await posts.boundingBox();
  const icons = await page.evaluate(() => Math.max(...[...document.querySelectorAll('#icons .dicon')].map(e => e.getBoundingClientRect().right)));
  assert.ok(b.x > icons && b.x < icons + 40 && b.width > 600 && b.width <= 632, `beside the icons, where Recent posts was (${b.x}, ${b.width}, icons end at ${icons})`);
  assert.equal(await posts.locator('.tab .tt').textContent(), '~/posts');
  assert.equal(await posts.locator('.seg.on').getAttribute('aria-label'), 'Latest and list view', 'in the card view, with the toolbar to change it');

  // a post dragged out opens in its own window, which then joins the Posts window by its tab
  const rp = cards(page).first(), rb = await rp.boundingBox();
  await drag(page, centre(rb), { x: 900, y: 300 });
  const post = page.locator('.win:not([hidden]):has(.view[data-key^="post:"])');
  await post.locator('.rd h1').waitFor();
  const key = await post.locator('.view').first().getAttribute('data-key');
  const postW = (await post.boundingBox()).width;
  await join(page, key, 'tracker');
  const stack = page.locator('.win:not([hidden]):has(.tabs.multi)');
  assert.equal(await stack.locator('.tab').count(), 2, 'the post joined the Posts window');
  assert.equal(await stack.locator('.view[data-key="tracker"]').count(), 1);
  assert.ok((await stack.boundingBox()).width >= postW - 1, 'the stack keeps the larger size, so the post is not squeezed into the Posts window');
  await shot(page, 'posts-joined');

  // the Posts window tears off again, then joins the post window by its own tab
  const rt = stack.locator('.tab', { hasText: '~/posts' }).locator('.tt');
  await drag(page, centre(await rt.boundingBox()), { x: 400, y: 560 });
  assert.equal(await page.locator('.tabs.multi').count(), 0, 'torn off');
  await join(page, 'tracker', key);
  assert.equal(await stack.locator('.tab').count(), 2, 'the Posts window joined the post');

  // its posts still open from inside the stack (the first is the post already beside it)
  await stack.locator('.tab', { hasText: '~/posts' }).locator('.tt').click();
  await stack.locator('.view[data-key="tracker"] .pc').nth(1).click();
  await win(page, 'reader').locator('.rd h1').waitFor();
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('D17: on a phone the recent posts are the home screen, not a window', async () => {
  const page = await open(phone);
  await page.locator('#recent .pc').first().waitFor();
  assert.equal(await page.locator('.win').count(), 0);
  assert.equal(await page.locator('#desk > #recent').count(), 1);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});
