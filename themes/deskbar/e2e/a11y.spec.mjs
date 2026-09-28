// axe-core over the shell's states (lib.mjs axeStates) in the default look; looks.spec.mjs, palettes.spec.mjs and
// crt.spec.mjs audit the other looks, palettes and effects. lib.mjs explains the reduced matrix, AXE_ALL and AXE_MINOR.
// Then keyboard focus and reduced motion.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { env, useBrowser, open, win, cards, desktop, phone, axeStates, axeRuns, auditState } from './lib.mjs';

useBrowser();

for (const [i, name] of Object.keys(axeStates).entries()) {
  test(`axe: ${name}`, async t => {
    const found = [];
    for (const run of axeRuns(i)) {
      const got = await auditState(name, run);
      if (!got) return t.skip(`no ${name} on this site`);
      found.push(...got);
    }
    assert.deepEqual(found, []);
  });
}

// Where the focused element sits, and whether a sighted keyboard user can see it
const focusInfo = page => page.evaluate(() => {
  const e = document.activeElement, r = e.getBoundingClientRect();
  // its window, home screen or bar is on top at its centre, so it is not behind another window
  const box = e.closest(".win, #recent, #icons, #panel, #dock, #menu") || e;
  const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
  const area = e.closest('#panel') ? 'panel' : e.closest('.win') ? 'window' : e.closest('#icons') ? 'icons' : e.closest('#dock') ? 'dock' : e.closest('#desk') ? 'desk' : e.tagName;
  return { area, label: e.getAttribute('aria-label') || e.textContent.trim().slice(0, 30), visible: r.width > 0 && r.height > 0 && e.checkVisibility() && !!hit && (box.contains(hit) || hit.contains(box)) };
});

test('keyboard: Tab visits only visible controls, in panel, desktop, window and dock order', async () => {
  for (const vp of [desktop, phone]) {
    const page = await open(vp, '/posts/');
    await win(page, 'tracker').locator('.pc').first().waitFor();
    await page.evaluate(() => document.activeElement?.blur());
    const areas = [];
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      const f = await focusInfo(page);
      assert.ok(f.visible, `Tab ${i + 1} landed on a hidden element: ${JSON.stringify(f)}`);
      if (areas.at(-1) !== f.area) areas.push(f.area);
    }
    assert.equal(areas[0], 'panel', 'the panel comes first');
    const order = ['panel', 'icons', 'desk', 'window', 'dock'];
    const ranks = areas.filter(a => order.includes(a)).map(a => order.indexOf(a));
    // one pass through the page, possibly wrapping back to the panel at the end
    const wrap = ranks.findIndex((r, i) => i && r < ranks[i - 1]);
    const pass = wrap < 0 ? ranks : ranks.slice(0, wrap);
    assert.deepEqual(pass, [...pass].sort((a, b) => a - b), `focus order ${areas.join(' > ')}`);
    assert.ok(areas.includes('window'), 'the open window is reachable');
    await page.context().close();
  }
});

test('keyboard: closing or minimising the focused window hands focus to the next one, then to the menu button', async () => {
  const page = await open(desktop);
  await cards(page).first().click();
  await win(page, 'reader').locator('.rd h1').waitFor();
  await win(page, 'tracker').locator('.pc, .row').first().waitFor();
  const isFocused = l => l.evaluate(el => el === document.activeElement);

  await win(page, 'reader').locator('.tab.on .ctl.min').focus();
  await page.keyboard.press('Enter');
  assert.ok(await isFocused(win(page, 'tracker').locator('.tab.on .tt')), 'minimising passes focus to Tracker');

  await win(page, 'tracker').locator('.tab.on .ctl.close').focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'menuBtn', 'with only a minimised window left, focus goes to the menu button');

  // the popover menu hands focus back to its button on Escape
  await page.keyboard.press('Enter');
  await page.locator('#menu .mn-it').first().waitFor();
  await page.keyboard.press('Escape');
  assert.ok(await page.locator('#menu').isHidden());
  assert.equal(await page.evaluate(() => document.activeElement.id), 'menuBtn');
  await page.context().close();
});

// Opening a post and closing a window go through View Transitions, counted by wrapping startViewTransition
test('reduced motion turns off window animations', async () => {
  const anim = async reducedMotion => {
    const ctx = await env.browser.newContext({ viewport: desktop, reducedMotion });
    await ctx.addInitScript(() => {
      window.__vt = 0;
      const start = document.startViewTransition?.bind(document);
      if (start) document.startViewTransition = fn => { window.__vt++; return start(fn); };
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(env.base + '/posts/');
    await page.waitForSelector('html.wm-ready');
    const w = win(page, 'tracker');
    await w.locator('a[data-url]').first().click();
    await win(page, 'reader').locator('.rd h1').waitFor();
    await win(page, 'reader').locator('.tab.on .ctl.close').click();
    await win(page, 'reader').waitFor({ state: 'detached' });
    const got = await page.evaluate(() => ({
      transitions: window.__vt, preview: getComputedStyle(document.getElementById('snapPreview')).transitionDuration,
    }));
    await ctx.close();
    assert.deepEqual(errors, []);
    return got;
  };
  assert.deepEqual(await anim('no-preference'), { transitions: 2, preview: '0.12s' }, 'open and close animate by default');
  assert.deepEqual(await anim('reduce'), { transitions: 0, preview: '0s' });
});
