// Overlapping mounts of page scripts that wait for load or DOMContentLoaded (content.js holdLoadListeners)
import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.window = new EventTarget();
globalThis.document = new EventTarget();
document.currentScript = null;
const { holdLoadListeners } = await import('../assets/js/deskbar/content.js');

test('overlapping mounts hold their scripts\' load listeners until the last mount ends', () => {
  const calls = [];
  const a = {}, b = {};
  const releaseA = holdLoadListeners([a]);
  document.currentScript = a;
  window.addEventListener('load', () => calls.push('a load'));

  const releaseB = holdLoadListeners([b]);
  document.currentScript = b;
  document.addEventListener('DOMContentLoaded', () => calls.push('b ready'));

  // shell or third-party code adding a listener meanwhile is not a mounted script, so it registers normally
  document.currentScript = null;
  window.addEventListener('load', () => calls.push('other load'));
  window.dispatchEvent(new Event('load'));
  assert.deepEqual(calls, ['other load']);

  releaseA();
  assert.deepEqual(calls, ['other load'], 'held until every mount has ended');
  // B is still mounting, so its scripts keep being held after A ends
  document.currentScript = b;
  window.addEventListener('load', { handleEvent: () => calls.push('b load') });
  document.currentScript = null;

  releaseB();
  assert.deepEqual(calls, ['other load', 'a load', 'b ready', 'b load']);
  assert.ok(!Object.hasOwn(window, 'addEventListener') && !Object.hasOwn(document, 'addEventListener'), 'patch removed');

  // once released, nothing is held any more
  document.currentScript = a;
  window.addEventListener('load', () => calls.push('late'));
  document.currentScript = null;
  window.dispatchEvent(new Event('load'));
  assert.deepEqual(calls.slice(-2), ['other load', 'late']);
});

test('a bare addEventListener call from a page script still works while held', () => {
  const s = {}, release = holdLoadListeners([s]);
  const add = window.addEventListener;
  let clicked = 0;
  document.currentScript = s;
  add('click', () => clicked++);
  document.currentScript = null;
  window.dispatchEvent(new Event('click'));
  release();
  assert.equal(clicked, 1);
});
