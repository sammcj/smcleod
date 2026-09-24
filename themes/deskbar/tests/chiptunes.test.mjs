// Chiptunes player (lazy/chiptunes.js): the song-data parser, the scheduler's timing, and the shipped songs
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { midi, parseSong, eventsBetween, playSong, readTracks, clock } from '../assets/js/deskbar/lazy/chiptunes.js';

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
const song = (patterns, order = Object.keys(patterns), bpm = 120) => ({
  bpm, steps: 4, order, patterns,
  channels: { lead: { wave: 'pulse', duty: 0.25 }, bass: { wave: 'triangle' }, drums: { wave: 'noise' } },
});

test('note names become MIDI numbers', () => {
  assert.equal(midi('C4'), 60);
  assert.equal(midi('A4'), 69);
  assert.equal(midi('F#5'), 78);
  assert.equal(midi('Bb3'), 58);
  assert.equal(midi('C-1'), 0);
  for (const bad of ['H4', 'C', 'c4', 'C#', '4C']) assert.equal(midi(bad), null, bad);
});

test('steps become timed notes: holds lengthen, rests and new notes cut, arpeggios parse', () => {
  const s = parseSong(song({ A: { lead: 'C4 - - . E4:47c - G4 .', drums: 'k . s h' } }));
  // 120 bpm in sixteenths: 0.125s a step, 8 steps
  near(s.step, 0.125);
  near(s.length, 1);
  const lead = s.events.filter(e => e.ch === 'lead');
  assert.deepEqual(lead.map(e => [e.t, e.dur, e.note]), [[0, 0.375, 60], [0.5, 0.25, 64], [0.75, 0.125, 67]]);
  assert.deepEqual(lead[1].arp, [0, 4, 7, 12]);
  assert.equal(lead[0].arp, undefined);
  // the four-step drum line repeats to fill the eight-step pattern
  assert.deepEqual(s.events.filter(e => e.ch === 'drums').map(e => [e.t, e.drum]), [[0, 'k'], [0.25, 's'], [0.375, 'h'], [0.5, 'k'], [0.75, 's'], [0.875, 'h']]);
  assert.deepEqual(s.events.map(e => e.t), s.events.map(e => e.t).toSorted((a, b) => a - b), 'time ordered');
});

test('patterns play in order; a hold carries across patterns but not into one that leaves the channel out', () => {
  const s = parseSong(song({ A: { lead: ['C4 - - -', '- - - -'] }, B: { lead: '- - D4 -' }, C: { bass: 'C2 - - -' } }, ['A', 'B', 'C', 'B']));
  near(s.length, 2.5);
  const lead = s.events.filter(e => e.ch === 'lead').map(e => [e.t, e.dur, e.note]);
  // the second B follows C, which has no lead line, so its leading holds have nothing to hold
  assert.deepEqual(lead, [[0, 1.25, 60], [1.25, 0.25, 62], [2.25, 0.25, 62]]);
});

test('bad song data is refused with a message naming the problem', () => {
  assert.throws(() => parseSong({}), /needs bpm/);
  assert.throws(() => parseSong(song({ A: { lead: 'C4' } }, ['B'])), /unknown pattern "B"/);
  assert.throws(() => parseSong(song({ A: { keys: 'C4' } })), /channel "keys": no such channel/);
  assert.throws(() => parseSong(song({ A: { lead: 'C4 . .', bass: 'C2 .' } })), /channel "bass": 2 steps don't fill 3/);
  assert.throws(() => parseSong(song({ A: { lead: 'X4' } })), /bad step "X4"/);
  assert.throws(() => parseSong(song({ A: { lead: 'C4:4z' } })), /bad step "C4:4z"/);
  assert.throws(() => parseSong(song({ A: { drums: 'C4' } })), /channel "drums": bad step "C4"/);
});

test('eventsBetween covers every note exactly once over consecutive windows, across loops', () => {
  const s = parseSong(song({ A: { lead: 'C4 D4 E4 F4', drums: 'k h' } }));
  near(s.length, 0.5);
  const got = [];
  for (let t = 0.3; t < 1.6; t += 0.07) got.push(...eventsBetween(s, t, t + 0.07));
  const want = [];
  for (let k = 0; k < 4; k++) for (const e of s.events) if (k * 0.5 + e.t >= 0.3 && k * 0.5 + e.t < 0.3 + 19 * 0.07) want.push(k * 0.5 + e.t);
  assert.deepEqual(got.map(e => +e.t.toFixed(9)), want.map(t => +t.toFixed(9)));
  // start inclusive, end exclusive
  assert.deepEqual(eventsBetween(s, 0.5, 0.625).map(e => [e.t, e.note ?? e.drum]), [[0.5, 60], [0.5, 'k']]);
  assert.equal(eventsBetween(s, 0.5, 0.5).length, 0);
});

// A fake audio clock: the scheduler only reads currentTime and makes a gain node
function fakeCtx() {
  const bus = { connected: true, connect() {}, disconnect() { this.connected = false; } };
  return { currentTime: 10, bus, createGain: () => bus };
}

test('the scheduler queues each note once, a second ahead, at its place on the audio clock', t => {
  mock.timers.enable({ apis: ['setInterval'] });
  t.after(() => mock.timers.reset());
  const s = parseSong(song({ A: { lead: 'C4 . . . D4 . . . E4 . . . F4 . . .' } }, undefined, 60));
  // 60 bpm: 0.25s a step, notes every second, 4 seconds long
  const ctx = fakeCtx(), played = [];
  let ends = 0;
  const run = playSong(ctx, (bus, c, e, when) => played.push([e.note, when]), {}, s, 0, () => false, () => ends++);
  // started 0.05s after "now"; the first tick looks one second ahead
  assert.deepEqual(played, [[60, 10.05]]);
  ctx.currentTime = 10.9; mock.timers.tick(200);
  assert.deepEqual(played, [[60, 10.05], [62, 11.05]]);
  ctx.currentTime = 11; mock.timers.tick(200);
  assert.equal(played.length, 2, 'nothing queued twice');
  near(run.pos(), 0.95);
  ctx.currentTime = 13.5; mock.timers.tick(200);
  assert.deepEqual(played.map(p => p[0]), [60, 62, 64, 65]);
  assert.equal(ends, 0);
  ctx.currentTime = 14.1; mock.timers.tick(200);
  assert.equal(played.length, 4, 'a single pass stops at the end of the song');
  assert.equal(ends, 1, 'and reports the end once the last note is done');
  ctx.currentTime = 14.5; mock.timers.tick(200);
  assert.equal(ends, 1, 'only once');
  run.stop();
  assert.equal(ctx.bus.connected, false, 'stopping drops everything still queued');
});

test('the scheduler starts from a seek position and loops on while repeat is on', t => {
  mock.timers.enable({ apis: ['setInterval'] });
  t.after(() => mock.timers.reset());
  const s = parseSong(song({ A: { lead: 'C4 . . . D4 . . . E4 . . . F4 . . .' } }, undefined, 60));
  const ctx = fakeCtx(), played = [];
  const run = playSong(ctx, (bus, c, e, when) => played.push([e.note, +when.toFixed(9)]), {}, s, 2.5, () => true);
  // from 2.5s: E4 (at 2s) is behind, F4 (at 3s) is 0.5s away
  assert.deepEqual(played, [[65, 10.55]]);
  ctx.currentTime = 11.2; mock.timers.tick(200);
  assert.deepEqual(played, [[65, 10.55], [60, 11.55]], 'wraps to the start of the song');
  near(run.pos(), 3.65);
  run.stop();
  const before = played.length;
  ctx.currentTime = 14; mock.timers.tick(1000);
  assert.equal(played.length, before, 'no ticks after stop');
});

test('the shipped songs parse, run 30 to 60 seconds, use every channel and end on the loop point', () => {
  const dir = join(import.meta.dirname, '../assets/chiptunes');
  const files = readdirSync(dir).filter(f => f.endsWith('.json'));
  assert.ok(files.length >= 3, 'at least three songs');
  for (const f of files) {
    const data = JSON.parse(readFileSync(join(dir, f), 'utf8')), s = parseSong(data);
    assert.ok(s.length >= 30 && s.length <= 60, `${f}: ${s.length.toFixed(1)}s`);
    assert.deepEqual(new Set(s.events.map(e => e.ch)), new Set(Object.keys(data.channels)), `${f}: every channel plays`);
    const waves = Object.values(data.channels).map(c => c.wave);
    for (const w of ['pulse', 'triangle', 'noise']) assert.ok(waves.includes(w), `${f}: has a ${w} channel`);
    const last = Math.max(...s.events.map(e => e.t + e.dur));
    assert.ok(last <= s.length + 1e-9, `${f}: nothing rings past the loop point`);
    // whole bars, so the loop lands on a downbeat
    assert.equal(Math.round(s.length / s.step) % 16, 0, `${f}: whole bars`);
  }
});

test('the track list comes from the page, and tracks without a source are skipped', () => {
  const li = (dataset, text = '') => ({ dataset, textContent: text });
  const list = { querySelectorAll: () => [
    li({ title: 'One', credit: 'AI', song: '/a.json' }),
    li({ url: 'https://example.org/b.ogg' }, ' Two '),
    li({ title: 'No source' }),
  ] };
  assert.deepEqual(readTracks(list), [
    { title: 'One', credit: 'AI', song: '/a.json', url: undefined },
    { title: 'Two', credit: '', song: undefined, url: 'https://example.org/b.ogg' },
  ]);
  assert.deepEqual(readTracks(null), []);
});

test('times show as minutes and seconds', () => {
  assert.equal(clock(0), '0:00');
  assert.equal(clock(38.4), '0:38');
  assert.equal(clock(75), '1:15');
  assert.equal(clock(NaN), '0:00');
});
