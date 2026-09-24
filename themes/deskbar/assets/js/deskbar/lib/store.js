// Settings are a nicety, so storage failures (private modes, disabled storage) are ignored.
// The inline script in head.html reads the same "deskbar:" keys before first paint.
const P = 'deskbar:';

export const store = {
  get(k, d) {
    try { return JSON.parse(localStorage.getItem(P + k)) ?? d; } catch { return d; }
  },
  // null removes the key
  set(k, v) {
    try { if (v == null) localStorage.removeItem(P + k); else localStorage.setItem(P + k, JSON.stringify(v)); } catch { /* ignored */ }
  },
};
