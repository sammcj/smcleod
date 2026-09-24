// Chiptunes (`window: chiptunes`): a small media player for the playlist that layouts/chiptunes.html renders from
// data/chiptunes.yaml. A track is either song data synthesised live with WebAudio (no audio files at all) or an
// audio file hosted elsewhere. Opening the player plays the first track once the visitor has pressed something on
// the page, which browsers require before sound; a page loaded straight into the player waits for Play. The audio
// context is only created then. Closing the window stops the audio.
//
// Song data (JSON): { bpm, steps, channels: { <name>: channel }, patterns: { <name>: { <channel>: line } }, order }
// - steps: steps per beat (4 = sixteenth notes). A line is space-separated steps, or an array of them (one per bar).
//   A line shorter than its pattern repeats to fill it, so a one-bar drum beat can serve a four-bar pattern.
// - A step is a note (C4, F#5, Bb3), a note with an arpeggio of semitone offsets in hex (C4:47 plays C E G in
//   turn), "-" to hold the previous note, or "." for silence. Noise channels take k(ick), s(nare), h(at), o(pen hat).
// - channel: { wave: square|pulse|triangle|noise, duty (pulse), vol, decay (s), sustain (0-1), arp (s per arpeggio
//   note), vib: [rate Hz, depth cents] }
import { h, svgBtn, stroke, find } from '../lib/dom.js';
import { store } from '../lib/store.js';

const NOTES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const DRUMS = 'ksho';

// MIDI note number: C4 = 60
export function midi(tok) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(tok);
  if (!m) return null;
  return 12 * (+m[3] + 1) + NOTES[m[1]] + (m[2] === '#') - (m[2] === 'b');
}

function step(tok, noise, where) {
  if (noise) {
    if (tok.length === 1 && DRUMS.includes(tok)) return { drum: tok };
  } else {
    const [n, arp] = tok.split(':'), note = midi(n);
    if (note != null && (arp == null || /^[0-9a-f]+$/.test(arp))) return { note, arp: arp && [0, ...[...arp].map(c => parseInt(c, 16))] };
  }
  throw new Error(`${where}: bad step "${tok}"`);
}

// Song data to a flat, time-ordered list of notes: { t, dur, ch, note, arp } or { t, dur, ch, drum }, in seconds
export function parseSong(s) {
  if (!(s?.bpm > 0) || !s.channels || !s.patterns || !s.order?.length) throw new Error('song needs bpm, channels, patterns and order');
  const sec = 60 / s.bpm / (s.steps || 4), events = [], held = {};
  let at = 0;
  for (const name of s.order) {
    const pat = s.patterns[name];
    if (!pat) throw new Error(`unknown pattern "${name}"`);
    const lines = Object.entries(pat).map(([ch, v]) => [ch, [v].flat().join(' ').split(/\s+/).filter(Boolean)]);
    const len = Math.max(...lines.map(([, l]) => l.length));
    for (const [ch, toks] of lines) {
      const c = s.channels[ch], where = `pattern "${name}", channel "${ch}"`;
      if (!c) throw new Error(`${where}: no such channel`);
      if (!toks.length || len % toks.length) throw new Error(`${where}: ${toks.length} steps don't fill ${len}`);
      for (let i = 0; i < len; i++) {
        const tok = toks[i % toks.length];
        if (tok === '-') { if (held[ch]) held[ch].steps++; continue; }
        held[ch] = null;
        if (tok !== '.') events.push(held[ch] = { at: at + i, steps: 1, ch, ...step(tok, c.wave === 'noise', where) });
      }
    }
    // a pattern that leaves a channel out silences it, so a later "-" has nothing to hold
    for (const ch in held) if (!(ch in pat)) held[ch] = null;
    at += len;
  }
  const list = events
    .map(({ at: a, steps: n, ...e }) => ({ ...e, t: a * sec, dur: n * sec }))
    .sort((a, b) => a.t - b.t);
  return { step: sec, length: at * sec, events: list, channels: s.channels };
}

// The notes starting in [from, to), in song time that keeps counting across loops
export function eventsBetween(song, from, to) {
  const out = [], L = song.length;
  for (let k = Math.max(0, Math.floor(from / L)); k * L < to; k++) {
    for (const e of song.events) {
      const t = k * L + e.t;
      if (t >= from && t < to) out.push({ ...e, t });
    }
  }
  return out;
}

export const clock = s => (s = Math.max(0, Math.floor(s || 0)), `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);

// ---- synthesis

const hz = n => 440 * 2 ** ((n - 69) / 12);

function pulseWave(ctx, duty) {
  const n = 48, re = new Float32Array(n), im = new Float32Array(n);
  for (let k = 1; k < n; k++) {
    re[k] = Math.sin(2 * Math.PI * k * duty) / (Math.PI * k);
    im[k] = (1 - Math.cos(2 * Math.PI * k * duty)) / (Math.PI * k);
  }
  return ctx.createPeriodicWave(re, im);
}

function noiseBuffer(ctx) {
  const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

const DRUM = { k: [1.4, 0.16], s: [0.8, 0.14], h: [0.3, 0.04], o: [0.35, 0.22] };

function makeSynth(ctx) {
  const waves = {}, noise = noiseBuffer(ctx);
  function drum(g, kind, t, v) {
    const [gain, len] = DRUM[kind];
    g.gain.setValueAtTime(v * gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    let src;
    if (kind === 'k') {
      // a falling sine thump reads as a kick; noise alone sounds like a snare
      src = ctx.createOscillator();
      src.frequency.setValueAtTime(150, t);
      src.frequency.exponentialRampToValueAtTime(40, t + len);
      src.connect(g);
    } else {
      src = ctx.createBufferSource();
      src.buffer = noise;
      const f = ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = kind === 's' ? 1200 : 6500;
      src.connect(f).connect(g);
    }
    src.start(t);
    src.stop(t + len + 0.02);
  }
  return function play(out, c, e, t) {
    const g = ctx.createGain(), v = c.vol ?? 0.15, end = t + e.dur;
    g.connect(out);
    if (e.drum) return drum(g, e.drum, t, v);
    const o = ctx.createOscillator();
    if (c.wave === 'pulse') o.setPeriodicWave(waves[c.duty] ||= pulseWave(ctx, c.duty || 0.25));
    else o.type = c.wave === 'triangle' ? 'triangle' : 'square';
    o.frequency.setValueAtTime(hz(e.note), t);
    if (e.arp) for (let s = t, i = 0; s < end; s += c.arp || 0.04, i++) o.frequency.setValueAtTime(hz(e.note + e.arp[i % e.arp.length]), s);
    // attack, decay to the sustain level, and a short release so notes never click
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v, t + 0.005);
    g.gain.setTargetAtTime(v * (c.sustain ?? 0.7), t + 0.005, (c.decay || 0.2) / 3);
    g.gain.setTargetAtTime(0, end, 0.015);
    if (c.vib) {
      // vibrato eases in, so short notes stay clean
      const lfo = ctx.createOscillator(), depth = ctx.createGain();
      lfo.frequency.value = c.vib[0];
      depth.gain.setValueAtTime(0, t);
      depth.gain.linearRampToValueAtTime(c.vib[1], Math.min(end, t + 0.3));
      lfo.connect(depth).connect(o.detune);
      lfo.start(t);
      lfo.stop(end + 0.1);
    }
    o.connect(g);
    o.start(t);
    o.stop(end + 0.1);
  };
}

// Schedules a song ahead of the audio clock. The lookahead is long because pausing, stopping and seeking (each drops
// the bus) act at once however much is queued, and a long lookahead survives the timer throttling of background tabs.
const AHEAD = 1, TICK = 200;
// onEnd runs from the timer rather than an animation frame, so a playlist moves on in a background tab too.
export function playSong(ctx, synth, dest, song, from, loop, onEnd) {
  const bus = ctx.createGain(), t0 = ctx.currentTime + 0.05;
  bus.connect(dest);
  let done = from, ended = false;
  const tick = () => {
    const now = ctx.currentTime - t0 + from, to = loop() ? now + AHEAD : Math.min(now + AHEAD, song.length);
    if (!loop() && now >= song.length && !ended) { ended = true; return onEnd?.(); }
    if (to <= done) return;
    for (const e of eventsBetween(song, done, to)) synth(bus, song.channels[e.ch], e, t0 + e.t - from);
    done = to;
  };
  tick();
  const timer = setInterval(tick, TICK);
  return {
    pos: () => Math.max(from, ctx.currentTime - t0 + from),
    stop() { clearInterval(timer); bus.disconnect(); },
  };
}

// ---- player window

const ICONS = {
  prev: '<path d="M3 3v10M13 3L5.5 8 13 13z" fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>',
  next: '<path d="M13 3v10M3 3l7.5 5L3 13z" fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>',
  play: '<path d="M4 2.5v11L13.5 8z" fill="currentColor"/>',
  pause: '<path d="M3.5 2.5h3v11h-3zM9.5 2.5h3v11h-3z" fill="currentColor"/>',
  repeat: stroke('M2.5 7V6a2 2 0 0 1 2-2h8l-2-2m3.5 7v1a2 2 0 0 1-2 2h-8l2 2', 1.6),
  vol: '<path d="M2 6h3l4-3v10l-4-3H2z" fill="currentColor"/>' + stroke('M11.5 5.5a3.5 3.5 0 0 1 0 5', 1.5),
};

// Track list from the page: <li data-song|data-url data-credit> title </li>
export function readTracks(list) {
  return [...(list?.querySelectorAll('li') || [])]
    .map(li => ({ title: li.dataset.title || li.textContent.trim(), credit: li.dataset.credit || '', song: li.dataset.song, url: li.dataset.url }))
    .filter(t => t.song || t.url);
}

export function mount(v, page, { fresh }) {
  if (!fresh) return;
  const tracks = readTracks(find(page.content(), '.ct-tracks'));
  let ctx = null, synth, master, scope, run = null, audio = null, source = null, cur = 0, playing = false, repeat = false, raf = 0;
  // where a synthesised track stands while paused: it keeps no scheduler then, and Play starts one from here
  let held = 0;
  // counts calls to start(), so one still waiting on song data can tell a later one has taken over
  let starts = 0;
  let vol = store.get('chiptunes-volume', 0.7);

  const btn = (name, label, fn) => svgBtn(label, ICONS[name], fn, 'ct-b');
  const playBtn = btn('play', 'Play', () => (playing ? pause() : play()));
  const repeatBtn = btn('repeat', 'Repeat track', () => {
    repeat = !repeat;
    repeatBtn.setAttribute('aria-pressed', repeat);
    // nothing past the end of this pass is queued without repeat, so carry on from here as a single pass
    if (!repeat && run) start(pos() % len(tracks[cur]));
  });
  repeatBtn.setAttribute('aria-pressed', 'false');
  playBtn.classList.add('ct-play');
  const seek = h('input', { class: 'ct-seek', type: 'range', min: 0, max: 1000, value: 0, 'aria-label': 'Position', disabled: true });
  const volume = h('input', { class: 'ct-vol', type: 'range', min: 0, max: 100, value: Math.round(vol * 100), 'aria-label': 'Volume' });
  const title = h('b', { class: 'ct-title' }), credit = h('span', { class: 'ct-credit' }), time = h('span', { class: 'ct-time' });
  const canvas = h('canvas', { class: 'ct-scope', width: 480, height: 96, 'aria-hidden': 'true' });
  const status = h('div', { class: 'status', role: 'status' });
  const rows = tracks.map((t, i) => h('li', {},
    h('button', { type: 'button', class: 'ct-row', onclick: () => select(i, true) },
      h('span', { class: 'ct-n' }, String(i + 1).padStart(2, '0')),
      h('span', { class: 'ct-name' }, t.title, h('small', {}, t.credit)),
      h('span', { class: 'ct-len' }))));

  v.el.append(h('div', { class: 'ct' },
    h('div', { class: 'ct-lcd' }, canvas, h('div', { class: 'ct-info' }, title, credit, time)),
    seek,
    h('div', { class: 'ct-ctl' }, btn('prev', 'Previous track', () => skip(-1)), playBtn, btn('next', 'Next track', () => skip(1)), repeatBtn,
      h('span', { class: 'ct-volbox' }, volume)),
    h('ol', { class: 'ct-list', 'aria-label': 'Playlist' }, rows)),
  status);
  volume.insertAdjacentHTML('beforebegin', `<svg viewBox="0 0 16 16" aria-hidden="true">${ICONS.vol}</svg>`);

  const len = t => (t?.data ? t.data.length : audio?.duration || 0);
  const pos = () => (audio ? audio.currentTime : run ? run.pos() : held);

  // Song data is small, so every track's is fetched up front to show lengths in the list
  const loadSong = t => (t.load ||= fetch(t.song).then(r => {
    if (!r.ok) throw new Error(`${t.song}: ${r.status}`);
    return r.json();
  }).then(d => { t.data = parseSong(d); rows[tracks.indexOf(t)].querySelector('.ct-len').textContent = clock(t.data.length); return t.data; }));
  Promise.all(tracks.filter(t => t.song).map(t => loadSong(t).catch(err => console.error(err)))).then(() => {
    v.el.dataset.loaded = '';
    note();
    paint();
  });

  // The status bar sums up the playlist, or says what went wrong. Unchanged text isn't re-announced.
  const note = (msg = tracks.length ? `${tracks.length} tracks` : 'No tracks in the playlist.') => {
    if (status.textContent !== msg) status.textContent = msg;
  };

  function ensureContext() {
    if (ctx) return;
    // created after a press on the page (Play, or opening the player), which is what browsers require
    ctx = new AudioContext();
    master = ctx.createGain();
    scope = ctx.createAnalyser();
    scope.fftSize = 1024;
    master.gain.value = vol;
    master.connect(scope).connect(ctx.destination);
    synth = makeSynth(ctx);
  }

  function stopTrack() {
    run?.stop();
    run = null;
    source?.disconnect();
    source = null;
    if (audio) {
      audio.pause();
      // dropping the source and reloading ends the download and frees the element
      audio.removeAttribute('src');
      audio.load();
      audio = null;
    }
  }

  // Starts the current track at `from` seconds. Rendered tracks go through the analyser for the scope; a host that
  // doesn't allow cross-origin reads gets a plain <audio> instead, which plays but leaves the scope flat.
  // While paused a synthesised track only moves its place (held); Play schedules it from there.
  async function start(from = 0) {
    const t = tracks[cur], id = ++starts;
    stopTrack();
    held = from;
    note();
    if (t.song) {
      if (!playing) return;
      let ok = true;
      try { await loadSong(t); } catch { ok = false; }
      if (id !== starts || !ctx || !playing) return;
      if (!ok) return fail(t);
      run = playSong(ctx, synth, master, t.data, from, () => repeat, () => skip(1));
    } else {
      const a = audio = new Audio();
      a.crossOrigin = 'anonymous';
      a.src = t.url;
      source = ctx.createMediaElementSource(a);
      source.connect(master);
      a.onended = () => (repeat ? start() : skip(1));
      a.onerror = () => {
        if (audio !== a) return;
        const plain = audio = new Audio(t.url);
        plain.volume = vol;
        plain.onended = a.onended;
        plain.onerror = () => audio === plain && fail(t);
        plain.currentTime = from;
        if (playing) plain.play().catch(() => {});
      };
      a.currentTime = from;
      if (playing) a.play().catch(() => {});
    }
  }

  function fail(t) {
    note(`Couldn't load ${t.title}.`);
    pause();
  }

  function select(i, andPlay) {
    cur = (i + tracks.length) % tracks.length;
    rows.forEach((r, j) => (j === cur ? r.firstChild.setAttribute('aria-current', 'true') : r.firstChild.removeAttribute('aria-current')));
    title.textContent = tracks[cur].title;
    credit.textContent = tracks[cur].credit;
    if (andPlay) play(true);
    // paused mid-track: the new track waits paused at its start, ready for Play
    else if (audio || held) start();
    paint();
  }

  const skip = d => select(cur + d, playing);

  function play(restart) {
    ensureContext();
    playing = true;
    ctx.resume();
    if (restart || (!run && !audio)) start(restart ? 0 : held); else audio?.play().catch(() => {});
    render();
  }

  function pause() {
    playing = false;
    // start() while paused drops the scheduler and holds the place
    if (run) start(pos() % len(tracks[cur]));
    ctx?.suspend();
    audio?.pause();
    render();
  }

  function render() {
    playBtn.innerHTML = `<svg viewBox="0 0 16 16" aria-hidden="true">${ICONS[playing ? 'pause' : 'play']}</svg>`;
    playBtn.title = playing ? 'Pause' : 'Play';
    playBtn.setAttribute('aria-label', playBtn.title);
    v.el.dataset.state = playing ? 'playing' : 'paused';
    // seeking needs the audio context, which only a press of Play may start
    seek.disabled = !ctx;
    cancelAnimationFrame(raf);
    if (playing) raf = requestAnimationFrame(frame);
    paint();
  }

  // nothing to see while the window is minimised, behind another tab or the page is hidden
  function frame() {
    if (!document.hidden && v.el.checkVisibility?.() !== false) paint();
    raf = requestAnimationFrame(frame);
  }

  const wave = new Uint8Array(512);
  function paint() {
    const t = tracks[cur], L = len(t), p = L ? pos() % L : 0;
    time.textContent = t ? `${clock(p)} / ${clock(L)}` : 'No tracks';
    if (document.activeElement !== seek) seek.value = L ? Math.round((p / L) * 1000) : 0;
    // set only when it changes, about once a second, so screen readers aren't told every frame
    const said = `${clock(p)} of ${clock(L)}`;
    if (seek.getAttribute('aria-valuetext') !== said) seek.setAttribute('aria-valuetext', said);
    const g = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
    g.clearRect(0, 0, W, H);
    g.strokeStyle = 'rgba(255,203,0,.14)';
    g.lineWidth = 1;
    g.beginPath();
    for (let x = 0; x <= W; x += 40) { g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); }
    for (let y = 0; y <= H; y += 24) { g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); }
    g.stroke();
    if (scope && playing) scope.getByteTimeDomainData(wave); else wave.fill(128);
    g.strokeStyle = '#ffcb00';
    g.lineWidth = 2;
    g.beginPath();
    for (let i = 0; i < wave.length; i++) g[i ? 'lineTo' : 'moveTo']((i / (wave.length - 1)) * W, (wave[i] / 255) * H);
    g.stroke();
  }

  seek.addEventListener('input', () => {
    const L = len(tracks[cur]);
    if (!L || !ctx) return;
    const to = (seek.value / 1000) * L;
    if (audio) audio.currentTime = to; else start(to);
    paint();
  });
  volume.addEventListener('input', () => {
    vol = volume.value / 100;
    if (master) master.gain.value = vol;
    if (audio && !audio.crossOrigin) audio.volume = vol;
    store.set('chiptunes-volume', vol);
  });

  v.teardown = () => {
    cancelAnimationFrame(raf);
    stopTrack();
    ctx?.close();
    ctx = null;
  };

  if (tracks.length) select(0, false);
  else note();
  render();
  if (tracks.length && navigator.userActivation?.hasBeenActive) {
    play();
    // a browser that still holds the context back (Safari may, outside the press itself) leaves it to Play
    setTimeout(() => { if (playing && ctx?.state !== 'running') pause(); }, 600);
  }
}
