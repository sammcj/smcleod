// Window motion (windows.js morph): minimise zooms a window into its panel task, restoring zooms it back out, and
// maximise morphs the frame. Every other spec runs with reduced motion, which updates at once; these turn motion on,
// read the running animations, then finish them so nothing waits on the clock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useBrowser, open, shot, win, desktop, phone } from './lib.mjs';

useBrowser();

const motion = { reducedMotion: 'no-preference' };

// The view transition animations on screen: pseudo-element, duration and first and last keyframes
const running = page => page.evaluate(() => document.getAnimations()
  .filter(a => /view-transition/.test(a.effect?.pseudoElement || ''))
  .map(a => {
    const k = a.effect.getKeyframes();
    return { pe: a.effect.pseudoElement, ms: a.effect.getTiming().duration, from: k[0], to: k[k.length - 1] };
  }));

// Waits for an animation on pseudo, saves a screenshot part way through (SHOTS_DIR), then finishes every animation
async function midway(page, pseudo, name) {
  // the one that moves it, rather than the UA's own fade on the same pseudo-element
  await page.waitForFunction(p => document.getAnimations().some(a => a.effect?.pseudoElement === p && a.effect.getKeyframes().some(k => k.transform)), pseudo);
  const anims = await running(page);
  await page.evaluate(() => document.getAnimations().forEach(a => { a.pause(); a.currentTime = 90; }));
  await shot(page, name);
  await page.evaluate(() => document.getAnimations().forEach(a => a.finish()));
  return anims.find(a => a.pe === pseudo && (a.to.transform || a.from.transform));
}

// the centre of el's box
const centre = b => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

test('minimise zooms the window into its panel task and restoring zooms it back out', async () => {
  const page = await open(desktop, '/about/', undefined, motion);
  const w = win(page, 'page:/about/');
  await w.waitFor();
  const id = await page.evaluate(() => document.querySelector('#tasks .task[data-w]').dataset.w);
  const task = page.locator(`#tasks .task[data-w="${id}"]`);
  const wb = await w.boundingBox(), tb = await task.boundingBox();

  await w.locator('.tab .ctl.min').click();
  const out = await midway(page, `::view-transition-old(w-${id})`, 'motion-minimise');
  assert.ok(out, 'the window\'s snapshot animates');
  assert.ok(out.ms >= 150 && out.ms <= 220, `duration ${out.ms}ms`);
  assert.equal(Number(out.to.opacity), 0);
  const [, dx, dy, s] = /translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([\d.]+)\)/.exec(out.to.transform) || [];
  assert.ok(Number(s) < 0.3, 'it shrinks');
  const to = { x: centre(wb).x + Number(dx), y: centre(wb).y + Number(dy) };
  assert.ok(Math.abs(to.x - centre(tb).x) < 4 && Math.abs(to.y - centre(tb).y) < 4, `it lands on the task (${to.x},${to.y})`);
  await w.waitFor({ state: 'hidden' });

  await task.click();
  const back = await midway(page, `::view-transition-new(w-${id})`, 'motion-restore');
  assert.ok(back.ms >= 150 && back.ms <= 220);
  assert.equal(Number(back.from.opacity), 0, 'it grows out of the task');
  assert.equal(Number(back.to.opacity ?? 1), 1);
  await w.waitFor();
  // the name is cleared afterwards, so the next transition doesn't pick this window up
  await page.waitForFunction(() => !document.querySelector('.win').style.viewTransitionName);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('maximise and restore morph the frame between its sizes', async () => {
  const page = await open(desktop, '/about/', undefined, motion);
  const w = win(page, 'page:/about/');
  await w.waitFor();
  const id = await page.evaluate(() => document.querySelector('#tasks .task[data-w]').dataset.w);
  await w.locator('.tab .ctl.max').click();
  const grow = await midway(page, `::view-transition-group(w-${id})`, 'motion-maximise');
  assert.ok(grow, 'the frame morphs');
  assert.ok(grow.ms >= 150 && grow.ms <= 220, `duration ${grow.ms}ms`);
  await page.waitForFunction(() => !document.documentElement.matches(':active-view-transition'));
  const big = await w.boundingBox();
  assert.ok(big.width > 1300, 'maximised');
  await w.locator('.tab .ctl.max').click();
  const shrink = await midway(page, `::view-transition-group(w-${id})`, 'motion-unmaximise');
  assert.ok(shrink.ms >= 150 && shrink.ms <= 220);
  await page.waitForFunction(() => !document.documentElement.matches(':active-view-transition'));
  assert.ok((await w.boundingBox()).width < 1000, 'restored');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('the Posts window zooms into its panel task and back', async () => {
  const page = await open(desktop, '/', undefined, motion);
  const posts = win(page, 'tracker');
  await posts.locator('.pc').first().waitFor();
  const task = page.locator('#tasks .task', { hasText: '~/posts' }), id = await task.getAttribute('data-w');
  await posts.locator('.tab .ctl.min').click();
  const out = await midway(page, `::view-transition-old(w-${id})`, 'motion-posts-minimise');
  assert.ok(out && Number(out.to.opacity) === 0 && /scale/.test(out.to.transform));
  await posts.waitFor({ state: 'hidden' });
  await task.click();
  const back = await midway(page, `::view-transition-new(w-${id})`, 'motion-posts-restore');
  assert.ok(back && Number(back.from.opacity) === 0 && /scale/.test(back.from.transform));
  await posts.waitFor();
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('reduced motion and phones minimise and restore without animating', async () => {
  for (const [viewport, opts] of [[desktop, {}], [phone, motion]]) {
    const page = await open(viewport, '/about/', undefined, opts);
    const w = win(page, 'page:/about/');
    await w.waitFor();
    await page.evaluate(() => {
      window.vts = 0;
      const start = document.startViewTransition?.bind(document);
      if (start) document.startViewTransition = cb => { window.vts++; return start(cb); };
    });
    if (viewport === desktop) {
      await w.locator('.tab .ctl.min').click();
      assert.ok(await w.isHidden(), 'hidden at once');
      await page.locator('#tasks .task[data-w]').first().click();
      assert.ok(await w.isVisible(), 'back at once');
    } else {
      await w.locator('.tab .ctl.min').click();
      assert.ok(await w.isHidden(), 'hidden at once on a phone');
    }
    assert.equal(await page.evaluate(() => window.vts), 0, 'no view transition');
    assert.deepEqual(page.errors, []);
    await page.context().close();
  }
});
