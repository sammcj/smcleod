// Enterprise Portal (lazy/enterprise.js): start-up, each workspace loading and passing axe on a desktop and a phone, the
// jokes that respond to input, workspace addresses, the Sign in button's factors, the survey, and the toast that leaves
// the window. Skips on a site without /enterprise/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useBrowser, open, needs, shot, win, go, path, audit, desktop, phone } from './lib.mjs';

useBrowser();

const url = '/enterprise/';
const ent = page => win(page, 'enterprise');
const button = (page, name) => ent(page).getByRole('button', { name, exact: true });
const dialog = (page, name) => ent(page).getByRole('dialog', { name });
const MARKS = { buddies: '.mb-log', milo: '.mi-stage', sentinel: '.ts-stats', jiro: '.ji-board', effluence: '.ef-page', pointless: '.pp-slide' };

const started = page => ent(page).locator('.ent-rail').waitFor();

async function visit(page, id) {
  await ent(page).locator(`.ent-tab[data-ws=${id}]`).click();
  await ent(page).locator(`.ent-${id} ${MARKS[id]}`).waitFor();
  // a render that throws partway leaves the frame's error in the pane, not a page error
  assert.equal(await ent(page).locator(`.ent-${id} [role=alert]`).count(), 0, `${id} rendered`);
}

test('every workspace loads and passes axe, and the Posts window makes way', async t => {
  if (!(await needs(t, url))) return;
  for (const [vp, colorScheme] of [[desktop, 'light'], [phone, 'dark']]) {
    const page = await open(vp, url, undefined, { colorScheme });
    await started(page);
    assert.equal(await win(page, 'tracker').count(), 0, 'Posts window closed');
    assert.equal(await ent(page).locator('.ent-tab[aria-current=page]').getAttribute('data-ws'), 'buddies');
    await button(page, 'Accept all').click();
    const found = [];
    for (const id of Object.keys(MARKS)) {
      await visit(page, id);
      // accepted once, the cookie banner stays gone
      assert.equal(await ent(page).locator('.ent-cookie').isHidden(), true);
      found.push(...(await audit(page)).map(f => `[${vp.width} ${colorScheme} ${id}] ${f}`));
      await shot(page, `enterprise-${vp.width}-${id}`);
      // the slide still gets room on a phone, under the ribbon
      if (id === 'pointless') {
        assert.ok((await ent(page).locator('.pp-slide').boundingBox()).width > 200, `${vp.width} slide width`);
        assert.ok(await button(page, 'Next').isVisible());
      }
    }
    assert.deepEqual(found, []);
    // on a phone a dialog still opens in view, the app being a screen tall
    await button(page, 'Dark mode').click();
    const box = await dialog(page, 'Upgrade to Enterprise Plus').locator('.ent-card').boundingBox();
    assert.ok(box.y >= 0 && box.y + box.height <= vp.height, `dialog in view: ${JSON.stringify(box)}`);
    assert.deepEqual(page.errors, []);
    await page.context().close();
  }
});

test('each workspace has an address, followed by the address bar', async t => {
  if (!(await needs(t, url))) return;
  const page = await open(desktop, url + '?ws=jiro');
  await ent(page).locator('.ent-jiro .ji-board').waitFor();
  await visit(page, 'milo');
  assert.equal(await page.evaluate(() => location.search), '?ws=milo');
  await visit(page, 'buddies');
  assert.equal(path(page) + (await page.evaluate(() => location.search)), url);
  // a link to another workspace while open switches the same window
  await go(page, url + '?ws=effluence');
  await ent(page).locator('.ent-effluence .ef-page').waitFor();
  assert.equal(await page.locator('.view[data-key=enterprise]').count(), 1);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('the jokes answer back', async t => {
  if (!(await needs(t, url))) return;
  const page = await open(desktop, url);
  await started(page);
  await button(page, 'Accept all').click();
  const w = ent(page);

  // Slack is blocked by TechOps, which sends you to MS Buddies
  await ent(page).locator('.ent-tab[data-ws=milo]').click();
  await button(page, 'Slack').click();
  await button(page, 'OK').click();
  assert.equal(await w.locator('.ent-tab[aria-current=page]').getAttribute('data-ws'), 'buddies');

  // MS Buddies: chats have no threads, channel replies hide, sending gets retained, security costs extra
  await w.getByRole('textbox', { name: 'Message' }).fill('my password is hunter2');
  await button(page, 'Send').click();
  await w.locator('.mb-msg', { hasText: 'Data Loss Prevention' }).waitFor();
  assert.deepEqual(await audit(page), [], 'the reply in a chat');
  await button(page, 'Reply in thread').click();
  await dialog(page, "Threads aren't available in chats").waitFor();
  await page.keyboard.press('Escape');
  await w.getByRole('button', { name: 'General' }).click();
  await button(page, '3 replies').click();
  await w.locator('.mb-replies', { hasText: 'Wrong thread' }).waitFor();
  await button(page, 'Security').click();
  assert.match(await dialog(page, 'Advanced Enterprise Security').textContent(), /Encrypt messages.*E7 Security add-on/);
  await button(page, 'Stay insecure').click();
  // CopePilot closes from its own panel, by button or Escape
  const cope = w.getByRole('form', { name: 'CopePilot' });
  await button(page, 'Ask CopePilot').click();
  await cope.getByRole('textbox', { name: 'Ask CopePilot' }).fill('Why is the build slow?');
  await page.keyboard.press('Enter');
  await cope.getByText(/You're absolutely right!.*it's not a bug/).waitFor();
  await cope.getByRole('button', { name: 'Close CopePilot' }).click();
  await cope.waitFor({ state: 'hidden' });
  await button(page, 'Ask CopePilot').click();
  await page.keyboard.press('Escape');
  await cope.waitFor({ state: 'hidden' });
  assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'Ask CopePilot');
  await button(page, 'Meeting chats').click();
  assert.equal(await w.locator('.mb-side li[data-kind]:visible').count(), 1, 'one meeting chat');

  await visit(page, 'jiro');
  await w.locator('.ji-card', { hasText: 'Fix bug' }).click();
  await w.locator('.ji-moves').getByRole('button', { name: 'Done', exact: true }).click();
  await dialog(page, 'Transition failed').waitFor();
  await page.keyboard.press('Escape');
  await w.locator('.ji-moves').getByRole('button', { name: 'Blocked', exact: true }).click();
  await w.locator('.ji-col[aria-label=Blocked] .ji-card', { hasText: 'Fix bug' }).waitFor();
  await w.locator('.ji-card', { hasText: 'Set up Jiro' }).dragTo(w.locator('.ji-col[aria-label="To do"]'));
  const move = dialog(page, 'Move issue');
  const [form, box] = [await move.locator('.ent-card').boundingBox(), await w.boundingBox()];
  assert.ok(form.y + form.height <= box.y + box.height, 'the move form fits the window');
  assert.ok(await move.getByRole('textbox', { name: 'Drag reason' }).isVisible());
  await move.getByRole('button', { name: 'Cancel' }).click();
  await w.locator('.ji-col[aria-label="In progress"] .ji-card', { hasText: 'Set up Jiro' }).waitFor();
  await button(page, 'Create').click();
  await w.getByRole('textbox', { name: 'Summary' }).fill('Fix bug (again)');
  await dialog(page, 'Create issue').getByRole('button', { name: 'Create', exact: true }).click();
  await dialog(page, '12 required fields are empty').waitFor();
  await button(page, 'OK').click();

  await visit(page, 'sentinel');
  await w.getByRole('textbox', { name: 'Software to request' }).fill('emacs');
  await button(page, 'Request software').click();
  assert.match(await w.locator('.ts-table tr', { hasText: 'emacs' }).textContent(), /Change Advisory Board/);
  await w.locator('summary', { hasText: '2 Zscalers running' }).click();
  await w.getByText('Zscaler (the other one)').waitFor();
  // the scanned path changes every 700ms without moving anything
  const tall = () => w.locator('.ts-stats').evaluate(e => e.offsetHeight);
  const was = await tall();
  for (let i = 0; i < 6; i++) { await page.waitForTimeout(350); assert.equal(await tall(), was, 'scanning keeps its height'); }

  await visit(page, 'milo');
  await button(page, 'Add sticky').click();
  assert.equal(await w.locator('.mi-note', { hasText: 'New idea' }).count(), 1);
  await button(page, 'Add sticky').click();
  await dialog(page, 'Upgrade to add more').waitFor();
  await button(page, 'OK').click();
  // the clutter only exists once you zoom out
  assert.equal(await w.locator('.mi-sprawl').count(), 0);
  await button(page, 'Zoom out too much').click();
  assert.ok(await w.locator('.mi-sprawl > *').count() > 300, 'too much to navigate');
  await button(page, 'Reset zoom to just the wrong amount').click();
  await shot(page, 'enterprise-milo-reset');
  await button(page, 'Zoom out too much').click();
  await shot(page, 'enterprise-milo-out');
  await button(page, 'Export').click();
  await button(page, 'Export .milo').click();
  assert.match(await dialog(page, 'Exported').textContent(), /\.milo" is ready/);
  await button(page, 'OK').click();

  await visit(page, 'effluence');
  await w.getByRole('searchbox', { name: 'Search Effluence' }).fill('vpn');
  await w.getByRole('searchbox', { name: 'Search Effluence' }).press('Enter');
  await w.locator('.ef-results li', { hasText: `"vpn" in a page you don't have access to` }).waitFor();
  await w.locator('.ent-effluence').getByRole('button', { name: 'Export', exact: true }).click();
  await button(page, 'Export .efx').click();
  assert.match(await dialog(page, 'Export complete').textContent(), /\(0 bytes\)/);
  await button(page, 'OK').click();
  // the page sits in a column narrower than a phone
  assert.ok((await w.locator('.ef-page').boundingBox()).width <= 340);

  await visit(page, 'pointless');
  await button(page, 'Next').click();
  assert.equal(await w.locator('.pp-count').textContent(), 'Slide 2 of 87');
  assert.equal(await w.locator('.pp-slide h2').textContent(), 'Agenda');
  const fonts = () => w.locator('.pp-slide li').evaluateAll(ls => ls.map(l => l.style.fontFamily));
  const before = await fonts();
  assert.ok(new Set(before).size > 1, 'mixed fonts');
  await button(page, 'Make fonts consistent').click();
  assert.notDeepEqual(await fonts(), before, 'differently inconsistent');
  await button(page, 'Align centre').click();
  assert.match(await w.locator('.pp-said').textContent(), /Snapped to an invisible text box/);
  await shot(page, 'enterprise-pointless-aligned');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('Sign in walks through every factor, and never remembers you', async t => {
  if (!(await needs(t, url))) return;
  const page = await open(desktop, url);
  await started(page);
  const w = ent(page);
  await button(page, 'Sign in').click();
  const step = w.getByRole('dialog');
  await step.getByRole('checkbox', { name: /Remember me/ }).check();
  assert.deepEqual(await audit(page), []);
  await button(page, 'Continue').click();
  assert.match(await step.textContent(), /We tried to remember you/);
  // Continue has the focus, so Enter walks the rest
  for (let i = 2; i <= 7; i++) await page.keyboard.press('Enter');
  await dialog(page, 'Signed in').waitFor();
  await button(page, 'OK').click();
  assert.equal(await w.locator('.ent-signin').textContent(), 'Signed in');
  await w.locator('.ent-nps', { hasText: 'sign-in experience' }).waitFor();
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('a survey interrupts, then a toast escapes onto the desktop and goes when the window closes', async t => {
  if (!(await needs(t, url))) return;
  const page = await open(desktop, '/');
  // the app's timers start when it opens, so a clock installed now runs them
  await page.clock.install();
  await go(page, url);
  await page.clock.runFor(3000);
  await started(page);
  await button(page, 'Accept all').click();

  await page.clock.runFor(18000);
  const nps = ent(page).locator('.ent-nps');
  await nps.getByRole('button', { name: '3', exact: true }).click();
  assert.match(await nps.textContent(), /rounded your 3 up to a 10/);
  assert.deepEqual(await audit(page), []);
  await nps.getByRole('button', { name: '0', exact: true }).click();
  await nps.getByRole('button', { name: 'Close' }).click();
  assert.equal(await nps.isHidden(), true);

  // signed out at 20 seconds, and signing back in fills itself in and goes
  await button(page, 'Sign in again').click();
  await dialog(page, 'Signing you back in').waitFor();
  await page.clock.runFor(2000);
  assert.deepEqual(await audit(page), []);
  await page.clock.runFor(3000);
  await dialog(page, 'Signing you back in').waitFor({ state: 'detached' });

  await page.clock.runFor(5000);
  const toast = page.locator('body > .ent-toast');
  await toast.waitFor();
  assert.match(await toast.textContent(), /Hello/);
  await page.clock.runFor(4000);
  assert.match(await toast.textContent(), /Hello\s*Quick chat\?/);
  assert.deepEqual(await audit(page), []);
  await ent(page).locator('.tab.on .ctl.close').click();
  await toast.waitFor({ state: 'detached' });
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test("the toast's Open lands in the chat, where you've already sent nohello.net", async t => {
  if (!(await needs(t, url))) return;
  const page = await open(desktop, '/');
  await page.clock.install();
  // MS Buddies already rendered, and showing another chat
  await go(page, url);
  await page.clock.runFor(3000);
  await started(page);
  await visit(page, 'jiro');
  await page.clock.runFor(28000);
  await page.locator('body > .ent-toast').getByRole('button', { name: 'Open' }).click();
  const w = ent(page);
  await w.locator('.ent-buddies .mb-top h2', { hasText: 'Darren Pike' }).waitFor();
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.ws), 'buddies', 'focus stays in the app');
  assert.equal(await w.getByRole('link', { name: 'https://nohello.net' }).getAttribute('href'), 'https://nohello.net');
  assert.match(await w.locator('.mb-card').textContent(), /nohello\.net.*no hello/);
  assert.deepEqual(await audit(page), []);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});
