// Terminal app (lazy/terminal.js): commands over the site index, opening posts, history, completion and touch.
// Runs on any site with a /terminal/ page; the posts it opens come from the site's own index.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useBrowser, open, needs, shot, win, path, readerTitle, desktop, phone } from './lib.mjs';

useBrowser();

const term = page => win(page, 'terminal');
const input = page => term(page).locator('.term-in');
const out = page => term(page).locator('.term-out');
const lastLine = page => out(page).locator('.ln').last();

async function openTerminal(viewport, ctxOpts) {
  const page = await open(viewport, '/terminal/', undefined, ctxOpts);
  await input(page).waitFor();
  return page;
}

async function run(page, cmd) {
  await input(page).fill(cmd);
  await input(page).press('Enter');
}

// The newest post in the site index, which cat and ls show
const newest = page => page.evaluate(async () => {
  const idx = await (await fetch(document.documentElement.dataset.index)).json();
  const p = idx.posts.slice().sort((a, b) => b.date.localeCompare(a.date))[0];
  return { ...p, slug: p.url.replace(/\/+$/, '').split('/').pop(), year: p.date.slice(0, 4) };
});

test('ls and cd walk posts by year, and cat opens a post in the reader', async t => {
  if (!(await needs(t, '/terminal/'))) return;
  const page = await openTerminal(desktop);
  assert.ok(await input(page).evaluate(el => el === document.activeElement), 'the prompt takes focus on a desktop');
  const post = await newest(page);

  await run(page, 'ls');
  await lastLine(page).locator('button', { hasText: 'posts/' }).waitFor();
  await run(page, 'cd posts');
  assert.match(await term(page).locator('.term-ps').textContent(), /~\/posts\$ $/);
  await run(page, 'ls');
  await lastLine(page).locator('button', { hasText: post.year + '/' }).waitFor();
  await run(page, `cd ${post.year}`);
  await run(page, 'ls -l');
  await out(page).locator('a', { hasText: post.slug }).first().waitFor();
  await run(page, 'pwd');
  assert.equal(await lastLine(page).textContent(), `/posts/${post.year}`);
  await shot(page, 'terminal-ls');

  await run(page, `cat ${post.slug}`);
  await win(page, 'reader').locator('.rd h1').waitFor();
  assert.equal((await readerTitle(page)).trim(), post.title);
  assert.equal(path(page), post.url);
  assert.equal(await term(page).count(), 1, 'the terminal stays open beside the reader');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('history walks with up and down and survives a reload; Tab completes', async t => {
  if (!(await needs(t, '/terminal/'))) return;
  const page = await openTerminal(desktop);
  await run(page, 'echo one');
  await run(page, 'echo two');
  assert.equal(await lastLine(page).textContent(), 'two');
  await input(page).fill('draft');
  await input(page).press('ArrowUp');
  assert.equal(await input(page).inputValue(), 'echo two');
  await input(page).press('ArrowUp');
  assert.equal(await input(page).inputValue(), 'echo one');
  await input(page).press('ArrowDown');
  await input(page).press('ArrowDown');
  assert.equal(await input(page).inputValue(), 'draft', 'down past the newest brings back what was being typed');

  await input(page).fill('neof');
  await input(page).press('Tab');
  await page.waitForFunction(() => document.querySelector('.term-in').value === 'neofetch ');
  assert.ok(await input(page).evaluate(el => el === document.activeElement), 'Tab completing keeps focus');
  await input(page).fill('c');
  await input(page).press('Tab');
  await lastLine(page).filter({ hasText: 'clear' }).waitFor();
  assert.deepEqual((await lastLine(page).locator('span span').allTextContents()).sort(), ['cat', 'cd', 'clear'], 'candidates listed');

  await run(page, 'history');
  assert.match(await out(page).textContent(), /1 {2}echo one\s+2 {2}echo two/);
  await run(page, 'nosuchthing');
  assert.match(await lastLine(page).textContent(), /nosuchthing: command not found\. .*Try help/);

  await page.reload();
  await page.waitForSelector('html.wm-ready');
  await input(page).waitFor();
  await input(page).press('ArrowUp');
  assert.equal(await input(page).inputValue(), 'nosuchthing');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('Ctrl+C drops the line, Ctrl+L and clear empty the screen, output is plain text', async t => {
  if (!(await needs(t, '/terminal/'))) return;
  const page = await openTerminal(desktop);
  await input(page).fill('half typed');
  await input(page).press('Control+c');
  assert.equal(await input(page).inputValue(), '');
  assert.match(await lastLine(page).textContent(), /half typed\^C$/);
  await run(page, 'echo <b>not bold</b>');
  assert.equal(await lastLine(page).textContent(), '<b>not bold</b>');
  assert.equal(await out(page).locator('b').count(), 0);
  await input(page).press('Control+l');
  assert.equal(await out(page).locator('.ln').count(), 0);
  await run(page, 'whoami');
  await out(page).locator('.ln', { hasText: /^guest$/ }).waitFor();
  await run(page, 'uname -a');
  assert.match(await lastLine(page).textContent(), /^Haiku /);
  await run(page, 'clear');
  assert.equal(await out(page).locator('.ln').count(), 0);
  await run(page, 'exit');
  await term(page).waitFor({ state: 'detached' });
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('grep searches the site and its results open posts; chips run commands', async t => {
  if (!(await needs(t, '/terminal/'))) return;
  const page = await openTerminal(desktop);
  await term(page).locator('.term-chip', { hasText: 'help' }).click();
  await out(page).locator('.ln', { hasText: 'Commands.' }).waitFor();

  const post = await newest(page);
  const word = post.title.split(/\s+/).find(w => w.length > 3) || post.title;
  await run(page, `grep ${word}`);
  await out(page).locator('.ln', { hasText: /\d+ match/ }).waitFor();
  const hit = out(page).locator('a', { hasText: post.title }).first();
  assert.ok(await hit.locator('mark').count(), 'the matched word is marked');
  await hit.click();
  await win(page, 'reader').locator('.rd h1').waitFor();
  assert.equal(path(page), post.url);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('on a phone the prompt takes typing, and tapping output keeps the keyboard up', async t => {
  if (!(await needs(t, '/terminal/'))) return;
  const page = await openTerminal(phone, { hasTouch: true, isMobile: true });
  const focused = () => input(page).evaluate(el => el === document.activeElement);
  assert.equal(await focused(), false, 'no keyboard until the visitor asks for one');
  assert.equal(await input(page).evaluate(el => getComputedStyle(el).fontSize), '16px', 'large enough that iOS does not zoom');
  await input(page).tap();
  await page.keyboard.type('echo hi');
  await page.keyboard.press('Enter');
  assert.equal(await lastLine(page).textContent(), 'hi');
  await out(page).tap({ position: { x: 20, y: 10 } });
  assert.ok(await focused(), 'tapping output leaves focus in the prompt');
  await term(page).locator('.term-chip', { hasText: 'date' }).tap();
  assert.ok(await focused(), 'tapping a command keeps focus too');
  const box = await input(page).boundingBox();
  assert.ok(box && box.y + box.height <= phone.height, 'the prompt is on screen');
  await shot(page, 'terminal-phone');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});
