// Chiptunes (lazy/chiptunes.js): the playlist loads, opening the player after a press plays the first track while a
// page loaded straight into it waits for Play, Play starts the audio context, and closing the window stops the
// audio. Skips on a site without /chiptunes/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useBrowser, open, needs, shot, win, desktop, phone } from './lib.mjs';

useBrowser();

const url = '/chiptunes/';

// Records every AudioContext the page makes, so the tests can see whether sound started and stopped
function spyAudio() {
  const Real = window.AudioContext;
  window.__audio = [];
  window.AudioContext = class extends Real {
    constructor(...a) { super(...a); window.__audio.push(this); }
  };
}
const contexts = page => page.evaluate(() => window.__audio.map(c => c.state));
const time = page => win(page, 'chiptunes').locator('.ct-time').textContent();

async function openPlayer(viewport = desktop) {
  const page = await open(viewport, url, spyAudio);
  const w = win(page, 'chiptunes');
  await w.locator('.view[data-loaded]').waitFor();
  return { page, w };
}

test('the playlist loads with lengths, and nothing plays until Play', async t => {
  if (!(await needs(t, url))) return;
  const { page, w } = await openPlayer();
  const rows = w.locator('.ct-row');
  assert.ok((await rows.count()) >= 3, 'tracks listed');
  for (const len of await w.locator('.ct-len').allTextContents()) assert.match(len, /^[0-5]:\d\d$/);
  assert.equal(await rows.first().locator('.ct-name').textContent(), 'Carburettor Cruise', 'the first track, with no credit');
  assert.equal(await w.locator('.ct-row[aria-current]').count(), 1, 'the first track is cued');
  assert.match(await w.locator('.status').textContent(), /\d+ tracks/);
  await page.waitForTimeout(500);
  assert.deepEqual(await contexts(page), [], 'no audio context before a click');
  assert.equal(await w.locator('.view').getAttribute('data-state'), 'paused');
  assert.equal(await w.locator('.ct-seek').isDisabled(), true);
  await shot(page, 'chiptunes-idle');
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('opening the player from the desktop plays the first track', async t => {
  if (!(await needs(t, url))) return;
  const page = await open(desktop, '/', spyAudio);
  // any press on the page lets it make sound
  await page.mouse.click(desktop.width - 60, desktop.height / 2);
  await page.evaluate(u => window.deskbar.go(u), url);
  const w = win(page, 'chiptunes');
  await page.waitForFunction(() => window.__audio[0]?.state === 'running');
  assert.equal(await w.locator('.view').getAttribute('data-state'), 'playing');
  assert.match(await w.locator('.ct-row[aria-current]').textContent(), /Carburettor Cruise/);
  await page.waitForFunction(() => /^0:0[1-9] \//.test(document.querySelector('.app-chiptunes .ct-time').textContent));
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('Play starts the audio, Pause suspends it, and closing the window stops it', async t => {
  if (!(await needs(t, url))) return;
  const { page, w } = await openPlayer();
  const play = w.getByRole('button', { name: 'Play', exact: true });
  await play.click();
  await page.waitForFunction(() => window.__audio[0]?.state === 'running');
  assert.equal(await w.locator('.view').getAttribute('data-state'), 'playing');
  await page.waitForFunction(() => /^0:0[1-9] \//.test(document.querySelector('.app-chiptunes .ct-time').textContent));
  // the analyser hears the synth, so notes really are reaching the output
  await page.waitForFunction(() => {
    const c = document.querySelector('.ct-scope'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const rows = new Set();
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200 && d[i] > 200 && d[i + 2] < 80) rows.add(Math.floor(i / 4 / c.width));
    return rows.size > 8;
  });
  await shot(page, 'chiptunes-playing');

  await w.getByRole('button', { name: 'Pause' }).click();
  await page.waitForFunction(() => window.__audio[0].state === 'suspended');
  const paused = await time(page);
  await page.waitForTimeout(1200);
  assert.equal(await time(page), paused, 'the clock stops while paused');

  const first = await w.locator('.ct-title').textContent();
  await w.getByRole('button', { name: 'Next track' }).click();
  assert.notEqual(await w.locator('.ct-title').textContent(), first);
  assert.equal(await w.locator('.ct-row[aria-current]').count(), 1);
  await w.locator('.ct-row').nth(2).click();
  await page.waitForFunction(() => window.__audio[0].state === 'running');
  assert.equal(await w.locator('.ct-row').nth(2).getAttribute('aria-current'), 'true', 'clicking a track plays it');
  assert.equal((await contexts(page)).length, 1, 'one audio context for the window');

  await w.locator('.tab.on .ctl.close').click();
  await page.waitForFunction(() => window.__audio[0].state === 'closed');
  assert.equal(await win(page, 'chiptunes').count(), 0);
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

// A mono 16-bit WAV of a 440Hz tone
function wav(seconds, rate = 8000) {
  const n = seconds * rate, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 12000), 44 + i * 2);
  return b;
}

test('plays audio hosted elsewhere, with or without CORS, and moves on when a track ends', async t => {
  if (!(await needs(t, url))) return;
  const page = await open(desktop, '/', spyAudio);
  const tone = wav(2);
  await page.route('https://cors.example/tone.wav', r => r.fulfill({ body: tone, contentType: 'audio/wav', headers: { 'access-control-allow-origin': '*' } }));
  // Playwright adds CORS headers to a fulfilled response that has none, so this host shares with another origin only
  let plainLoads = 0;
  await page.route('https://plain.example/tone.wav', r => {
    plainLoads++;
    return r.fulfill({ body: tone, contentType: 'audio/wav', headers: { 'access-control-allow-origin': 'https://elsewhere.example' } });
  });
  // two rendered tracks added to the end of the playlist the page lists
  await page.route(u => new URL(u).pathname === url, async r => {
    const res = await r.fetch(), html = await res.text();
    const extra = '<li data-title="Shared" data-url="https://cors.example/tone.wav"></li><li data-title="Plain" data-url="https://plain.example/tone.wav"></li>';
    await r.fulfill({ response: res, body: html.replace(/(<ol class="?ct-tracks"?>.*?)<\/ol>/s, `$1${extra}</ol>`) });
  });
  await page.evaluate(u => window.deskbar.go(u), url);
  const w = win(page, 'chiptunes');
  await w.locator('.view[data-loaded]').waitFor();
  const rows = w.locator('.ct-row'), n = await rows.count();
  assert.equal(await rows.nth(n - 2).textContent(), `${String(n - 1).padStart(2, '0')}Shared`);

  await rows.nth(n - 2).click();
  await page.waitForFunction(() => window.__audio[0]?.state === 'running');
  await page.waitForFunction(() => /^0:01 \/ 0:02$/.test(document.querySelector('.app-chiptunes .ct-time').textContent));
  // rows of the scope the trace covers: a moving wave spans many, a flat line two or three
  const traceRows = () => page.evaluate(() => {
    const c = document.querySelector('.ct-scope'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, rows = new Set();
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200 && d[i] > 200 && d[i + 2] < 80) rows.add(Math.floor(i / 4 / c.width));
    return rows.size;
  });
  assert.ok((await traceRows()) > 8, 'shared with CORS, the tone reaches the analyser');
  // at the end it moves on to the next track, which its host won't share, so a plain <audio> plays it
  await w.locator('.ct-title', { hasText: 'Plain' }).waitFor({ timeout: 5000 });
  await page.waitForFunction(() => /^0:01 \/ 0:02$/.test(document.querySelector('.app-chiptunes .ct-time').textContent));
  assert.ok((await traceRows()) <= 4, 'played outside the analyser, the scope stays flat');
  assert.ok(plainLoads >= 2, 'refused with CORS, then fetched again without');
  assert.equal(await w.locator('.status').textContent(), `${n} tracks`, 'no error shown');
  // and after the last track it wraps round to the first
  await w.locator('.ct-row').first().and(w.locator('[aria-current]')).waitFor({ timeout: 5000 });
  assert.deepEqual(page.errors, []);
  await page.context().close();
});

test('the player fits a phone', async t => {
  if (!(await needs(t, url))) return;
  const { page, w } = await openPlayer(phone);
  const box = await w.locator('.ct-ctl').boundingBox();
  assert.ok(box.x >= 0 && box.x + box.width <= phone.width, 'controls on screen');
  await shot(page, 'chiptunes-phone');
  await page.context().close();
});
