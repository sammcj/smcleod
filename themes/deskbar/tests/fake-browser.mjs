// The slice of a browser router.js touches: location, history, document and window listeners. Install it before
// importing the router, as the router reads these globals when it runs.
export function fakeBrowser(start) {
  const b = {
    cur: new URL(start),
    assigned: [], pushed: [], listeners: [], reloads: 0,
    // the latest popstate listener, as the browser would call it on Back
    popstate: e => b.listeners.findLast(l => l[1] === 'popstate')[2](e),
  };
  const remove = fn => b.listeners.splice(b.listeners.findIndex(l => l[2] === fn), 1);
  globalThis.location = {
    get href() { return b.cur.href; }, get pathname() { return b.cur.pathname; }, get search() { return b.cur.search; },
    get hash() { return b.cur.hash; }, get origin() { return b.cur.origin; },
    assign(u) { b.assigned.push(u); }, reload() { b.reloads++; },
  };
  globalThis.history = {
    state: null,
    pushState(s, _, h) { this.state = s; b.cur = new URL(h, b.cur); b.pushed.push(h); },
    replaceState(s, _, h) { this.state = s; if (h) b.cur = new URL(h, b.cur); },
  };
  globalThis.document = {
    title: '',
    addEventListener(type, fn) { b.listeners.push(['document', type, fn]); },
    removeEventListener(type, fn) { remove(fn); },
  };
  globalThis.addEventListener = (type, fn) => b.listeners.push(['window', type, fn]);
  globalThis.removeEventListener = (type, fn) => remove(fn);
  return b;
}
