// Default window sizes (defineApp size: 'large'). Applications open at about 80% of the desk, right of the desktop
// icon column so the icons stay in reach, above the dock and centred in the room left. Small apps and dialogs keep
// their own sizes, and phones still show every window full screen (D17). Each page is skipped when a site lacks it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { env, useBrowser, open, desktop, phone } from './lib.mjs';

useBrowser();

const laptop = { width: 1280, height: 720 };
// [path, view key]: the example site's apps, then smcleod.net's
const LARGE = [
  ['/tools/demo/', 'tool:/tools/demo/'], ['/photos/', 'photos'], ['/terminal/', 'terminal'], ['/sketch/', 'sketch'],
  ['/enterprise/', 'enterprise'],
  ['/agentic-coding-tools/', 'tool:/agentic-coding-tools/'], ['/vram-estimator/', 'tool:/vram-estimator/'],
];
const SMALL = [['/contact/', 'mail', 620], ['/control-panel/', 'control-panel', 900], ['/chiptunes/', 'chiptunes', 400]];

const present = async list => (await Promise.all(list.map(async e => ((await fetch(env.base + e[0])).ok ? e : null)))).filter(Boolean);

// The window's frame, the desk, the icon column and the dock, in page pixels
const layout = (page, key) => page.evaluate(k => {
  const box = el => { const r = el?.getBoundingClientRect(); return r && { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
  const tab = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--tab-h'), 10);
  const icons = document.getElementById('icons');
  return {
    win: box(document.querySelector(`.win:not([hidden]) .view[data-key="${k}"]`)?.closest('.win')),
    desk: box(document.getElementById('desk')), dock: box(document.getElementById('dock')), tab,
    // the icons themselves, as a short desk wraps them into a second column the #icons box doesn't widen for
    icons: icons && getComputedStyle(icons).display !== 'none' ? { r: Math.max(...[...icons.children].map(e => e.getBoundingClientRect().right)), w: icons.offsetWidth } : null,
  };
}, key);

async function opened(vp, path, key) {
  const page = await open(vp, path);
  await page.locator(`.win:not([hidden]) .view[data-key="${key}"]`).waitFor();
  return page;
}

for (const vp of [desktop, laptop]) {
  test(`applications open at about 80% of a ${vp.width}x${vp.height} desk, right of the icons`, async () => {
    for (const [path, key] of await present(LARGE)) {
      const page = await opened(vp, path, key);
      const { win: w, desk, dock, icons, tab } = await layout(page, key), at = `${path} ${JSON.stringify(w)}`;
      assert.ok(icons && icons.w > 0, 'the icon column shows');
      assert.ok(w.l >= icons.r + 4, `clear of the icon column (right edge ${icons.r}): ${at}`);
      assert.ok(w.r <= desk.r - 4, `inside the desk: ${at}`);
      assert.ok(w.t - tab >= desk.t, `its tab below the panel: ${at}`);
      assert.ok(w.b <= dock.t, `above the dock (top ${dock.t}): ${at}`);
      const room = desk.r - 10 - (icons.r + 4);
      assert.ok(w.w >= Math.min(room, desk.w * 0.75) - 2 && w.w <= desk.w * 0.85, `about 80% of the desk width: ${at}`);
      assert.ok(w.h >= (dock.t - desk.t - tab) * 0.8, `most of the desk height: ${at}`);
      assert.ok(Math.abs((w.l - icons.r) - (desk.r - w.r)) <= 16, `centred right of the icons: ${at}`);
      assert.deepEqual(page.errors, [], path);
      await page.context().close();
    }
  });
}

test('small apps and dialogs keep their own sizes', async () => {
  for (const [path, key, width] of await present(SMALL)) {
    const page = await opened(desktop, path, key);
    const { win: w } = await layout(page, key);
    assert.equal(Math.round(w.w), width, path);
    await page.context().close();
  }
});

test('the Control panel is as tall as the Posts window at its home spot, top edges level', async t => {
  if (!(await fetch(env.base + '/control-panel/')).ok) return t.skip('no /control-panel/ on this site');
  for (const vp of [desktop, laptop]) {
    const page = await opened(vp, '/', 'tracker');
    const posts = (await layout(page, 'tracker')).win;
    await page.evaluate(() => window.deskbar.go('/control-panel/'));
    await page.locator('.win:not([hidden]) .view[data-key="control-panel"]').waitFor();
    const w = (await layout(page, 'control-panel')).win;
    assert.deepEqual([Math.round(w.t), Math.round(w.h)], [Math.round(posts.t), Math.round(posts.h)], `${vp.width}x${vp.height}`);
    await page.context().close();
  }
});

test('a page with windowTile opens tiled to the left, full height, clear of the desktop icons', async t => {
  const html = await (await fetch(env.base + '/about/')).text();
  if (!/data-tile="?60/.test(html)) return t.skip('no /about/ with windowTile: 60 on this site');
  for (const vp of [desktop, laptop]) {
    const page = await opened(vp, '/about/', 'page:/about/');
    const { win: w, desk, dock, icons } = await layout(page, 'page:/about/');
    const at = `${vp.width}x${vp.height}`;
    assert.ok(w.l >= icons.r && w.l <= icons.r + 12, `starts just right of the icons: ${at}`);
    assert.ok(Math.abs(w.r - (desk.l + desk.w * 0.6)) <= 8, `ends at 60% of the desk: ${at}`);
    assert.ok(w.b <= dock.t && dock.t - w.b <= 30, `reaches down to the dock: ${at}`);
    await page.context().close();
  }
});

test('About this desktop opens just right of the Posts window, top edges level, when there is room', async t => {
  if (!(await fetch(env.base + '/about-desktop/')).ok) return t.skip('no /about-desktop/ on this site');
  for (const vp of [desktop, laptop]) {
    const page = await opened(vp, '/', 'tracker');
    await page.evaluate(() => window.deskbar.go('/about-desktop/'));
    await page.locator('.win:not([hidden]) .view[data-key="about-desktop"]').waitFor();
    const { win: posts } = await layout(page, 'tracker'), { win: w, desk } = await layout(page, 'about-desktop');
    const at = `${vp.width}x${vp.height}`;
    assert.ok(w.l >= posts.r && w.l - posts.r <= 16, `beside Posts, not over it: ${at} ${JSON.stringify({ posts, w })}`);
    assert.ok(Math.abs(w.t - posts.t) <= 1, `top edges level: ${at}`);
    assert.ok(w.r <= desk.l + desk.w, `on the desk: ${at}`);
    await page.context().close();
  }
  // a Posts window too wide to leave room: against the far side of the desk from Posts, covering as little of it as it
  // can. That is the right edge unless a second column of desktop icons pushes Posts past the middle.
  const page = await opened(desktop, '/', 'tracker');
  const grip = await page.locator('.win:has(.view[data-key="tracker"]) .grip').boundingBox();
  await page.mouse.move(grip.x + 4, grip.y + 4);
  await page.mouse.down();
  await page.mouse.move(grip.x + 504, grip.y + 4, { steps: 5 });
  await page.mouse.up();
  await page.evaluate(() => window.deskbar.go('/about-desktop/'));
  await page.locator('.win:not([hidden]) .view[data-key="about-desktop"]').waitFor();
  const { win: posts } = await layout(page, 'tracker'), { win: w, desk, icons } = await layout(page, 'about-desktop');
  assert.ok(desk.w - posts.r < 420, `Posts is wide here: ${JSON.stringify(posts)}`);
  const far = posts.l + posts.w / 2 < desk.l + desk.w / 2
    ? Math.abs(desk.l + desk.w - 10 - w.r) <= 1
    : Math.abs(w.l - (icons.r + 12)) <= 2;
  assert.ok(far, `against the far side from Posts: ${JSON.stringify({ posts, w, desk, icons })}`);
  assert.ok(Math.abs(w.t - posts.t) <= 1, 'top edges level');
  await page.context().close();
});

test('a large app on a phone still fills the screen', async () => {
  const [[path, key]] = await present(LARGE);
  const page = await opened(phone, path, key);
  const { win: w } = await layout(page, key);
  assert.ok(w.w >= phone.width - 2, `full width: ${JSON.stringify(w)}`);
  await page.context().close();
});

for (const vp of [laptop, desktop]) test(`on a ${vp.width}x${vp.height} screen every desktop icon sits above the dock`, async () => {
  const page = await open(vp, '/');
  await page.locator('#icons .dicon').last().waitFor();
  const posts = page.locator('.win:has(.view[data-key="tracker"])');
  await posts.waitFor();
  const { last, right, dock } = await page.evaluate(() => {
    const r = [...document.querySelectorAll('#icons .dicon')].map(e => e.getBoundingClientRect());
    return { last: Math.max(...r.map(b => b.bottom)), right: Math.max(...r.map(b => b.right)), dock: document.getElementById('dock').getBoundingClientRect().top };
  });
  assert.ok(last <= dock, `last icon ends at ${last}, dock starts at ${dock}`);
  const rb = await posts.boundingBox();
  assert.ok(rb.x >= right, `the Posts window starts at ${rb.x}, the icons end at ${right}`);
  assert.ok(rb.y + rb.height <= dock, `and stops above the dock (${rb.y + rb.height}, dock at ${dock})`);
});

// A long icon list wraps into another column rather than running under the dock
test('a long desktop icon list wraps into columns above the dock', async () => {
  const page = await open(laptop, '/');
  await page.locator('#icons .dicon').last().waitFor();
  const g = await page.evaluate(() => {
    const icons = document.getElementById('icons');
    for (let n = 0; n < 10; n++) icons.append(icons.lastElementChild.cloneNode(true));
    const r = [...icons.querySelectorAll('.dicon')].map(e => e.getBoundingClientRect());
    return { bottom: Math.max(...r.map(b => b.bottom)), columns: new Set(r.map(b => Math.round(b.left))).size, dock: document.getElementById('dock').getBoundingClientRect().top };
  });
  assert.ok(g.columns > 1, 'wrapped into another column');
  assert.ok(g.bottom <= g.dock, `icons end at ${g.bottom}, dock starts at ${g.dock}`);
});
