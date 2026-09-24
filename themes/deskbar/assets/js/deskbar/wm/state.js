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

// A window's place, size, snap and stacking, as the Home toggle (D24) and Escape from a post (D36) put them back
const GEO = ['x', 'y', 'w', 'h', 'snap', 'prev', 'unmax', 'tabX', 'active', 'z'];
export const geoOf = w => Object.fromEntries(GEO.map(k => [k, w[k]]));

// Modules talk through events rather than importing each other, which keeps the dependency graph flat
const bus = new EventTarget();
export const emit = (type, detail) => bus.dispatchEvent(new CustomEvent(type, { detail }));
// Returns the unsubscribe function, for listeners that belong to a view and must go when it closes
export function on(type, fn) {
  const cb = e => fn(e.detail);
  bus.addEventListener(type, cb);
  return () => bus.removeEventListener(type, cb);
}
