// Shared window-manager state. Windows are plain objects ({ x, y, w, h, z, snap, prev, min, views, active, el })
// so layout logic (snap, home snapshot) can work on them without a DOM.
export const S = {
  wins: [],
  nextId: 1,
  z: 10,
  focused: null,
  split: 0.5,
  home: null, // D24 snapshot while the Home toggle is on
  booting: true, // true until the first page is on screen; nothing steals keyboard focus before then
};

// Runs fn as start-up does: no animation, and keyboard focus stays where it is
export function quietly(fn) {
  const was = S.booting;
  S.booting = true;
  try {
    return fn();
  } finally {
    S.booting = was;
  }
}

// Window geometry. A window's box, then its snap zone, the free size it came from (prev) and the half a maximised
// window restores to (unmax). Clearing SNAP (free) leaves a window at its box.
const BOX = ['x', 'y', 'w', 'h'], SNAP = ['snap', 'prev', 'unmax'];
export const free = Object.freeze(Object.fromEntries(SNAP.map(k => [k, null])));
// Where a window was before it joined a group (D40), to go back to once the group is down to it
export const SOLO = [...BOX, ...SNAP];
// What the a key's arrange puts back, a group's share and fill included
export const PLACE = [...SOLO, 'tabX', 'placed', 'share', 'fill'];
// A window's place, size, snap and stacking, as the Home toggle (D24) and Escape from a post (D36) put them back
const GEO = [...SOLO, 'tabX', 'active', 'z'];
export const pick = (w, keys) => Object.fromEntries(keys.map(k => [k, w[k]]));
export const geoOf = w => pick(w, GEO);

// Modules talk through events rather than importing each other, which keeps the dependency graph flat
const bus = new EventTarget();
export const emit = (type, detail) => bus.dispatchEvent(new CustomEvent(type, { detail }));
// Returns the unsubscribe function, for listeners that belong to a view and must go when it closes
export function on(type, fn) {
  const cb = e => fn(e.detail);
  bus.addEventListener(type, cb);
  return () => bus.removeEventListener(type, cb);
}
