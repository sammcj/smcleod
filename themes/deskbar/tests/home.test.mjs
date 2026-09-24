import { test } from 'node:test';
import assert from 'node:assert/strict';
import { snapshotLayout, enterHome, restoreLayout } from '../assets/js/deskbar/home.js';

const win = (id, o = {}) => ({ id, x: 10 * id, y: 30, w: 400, h: 300, z: id, snap: null, prev: null, tabX: 0, active: 0, min: false, views: [{}], ...o });

function desk() {
  const tracker = win(1, { snap: 'l', prev: { x: 1, y: 2, w: 3, h: 4 } });
  const reader = win(2, { snap: 'r', z: 9, tabX: 40 });
  const about = win(3, { min: true });
  return { state: { wins: [tracker, reader, about], focused: reader, split: 0.25, home: null }, tracker, reader, about };
}

test('snapshot records only visible windows', () => {
  const { state, about } = desk();
  const s = snapshotLayout(state, '/post/');
  assert.equal(s.wins.length, 2);
  assert.ok(!s.wins.some(r => r.win === about));
  assert.equal(snapshotLayout({ ...state, wins: [about] }, '/'), null);
});

test('home minimises everything; restore puts the layout back exactly, with the Posts window record for the caller', () => {
  const { state, tracker, reader, about } = desk();
  const before = JSON.stringify([tracker, reader].map(({ x, y, w, h, z, snap, prev, tabX, active }) => ({ x, y, w, h, z, snap, prev, tabX, active })));
  const posts = { win: tracker, geo: { x: 1 }, min: false };
  enterHome(state, '/post/', () => [['el', 120]], posts);
  assert.ok(state.wins.every(w => w.min));
  assert.equal(state.focused, null);
  assert.equal(state.home.path, '/post/');

  // simulate the desk changing underneath while home
  state.split = 0.5;
  Object.assign(reader, { x: 0, w: 10, z: 99, snap: null });

  const s = restoreLayout(state);
  assert.equal(s.wins[0].scrolls[0][1], 120);
  const after = JSON.stringify([tracker, reader].map(({ x, y, w, h, z, snap, prev, tabX, active }) => ({ x, y, w, h, z, snap, prev, tabX, active })));
  assert.equal(after, before);
  assert.equal(tracker.min, false);
  assert.equal(reader.min, false);
  assert.equal(about.min, true, 'a window minimised before Home stays minimised');
  assert.equal(state.focused, reader);
  assert.equal(state.split, 0.25);
  assert.equal(s.posts, posts, 'the Posts window record comes back for the caller to put back');
  assert.equal(state.home, null);
});

test('windows closed while home are skipped on restore', () => {
  const { state, tracker, reader } = desk();
  enterHome(state, '/post/');
  state.wins = state.wins.filter(w => w !== reader);
  restoreLayout(state);
  assert.equal(tracker.min, false);
  assert.equal(state.focused, null, 'the focused window is gone, so the caller picks the top one');
});

test('restore without a snapshot is a no-op', () => {
  const { state } = desk();
  assert.equal(restoreLayout(state), null);
  assert.equal(state.split, 0.25);
});
