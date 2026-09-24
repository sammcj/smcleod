// Page content entering a window. Routed content comes from DOMParser and cached pages from clones, and the
// browser runs neither kind of <script>, so they are re-created here. Scripts that ran with the original page
// load keep their DOM (the nodes are moved, not copied) and are not run twice.
//
// Extension point: onMounted(fn) calls fn({ root, page, view }) every time page content enters a window,
// initial page included, after the content's own scripts have run. Use it for renderers (diagrams, maths,
// embeds) rather than per-page inline scripts. Content scripts run in global scope on every mount, so a
// page that can open twice must not use top-level let/const/class (wrap them in a block or IIFE).

const executed = new WeakSet();
const hooks = [];
const JS = /^(|module|(text|application)\/(java|ecma)script)$/i;

export const onMounted = fn => { hooks.push(fn); };

// Scripts inside the document's own <main> have already run by the time the shell boots
export function markExecuted(root) {
  for (const s of root.querySelectorAll('script')) executed.add(s);
}

// Scripts written for a normal page load often wait for load or DOMContentLoaded, which fired long before a
// routed page mounts. While content scripts run, listeners they add for those events are held and called
// once the last script has finished, which is when the page would have loaded.
// Mounts can overlap (two windows loading pages at once), so the patch goes on with the first and comes off,
// firing what it held, when the last one ends. Only listeners added by the scripts being mounted are held
// (document.currentScript), so shell and third-party code adding its own listeners meanwhile is unaffected.
// Module scripts have no currentScript and are not held.
const mounting = new Set();
let holds = 0, held = [];

function holdingAdd(type, fn, opts) {
  // a bare addEventListener(...) call from a page script arrives with no receiver
  const t = this ?? window;
  const late = (t === window && type === 'load') || (t === document && type === 'DOMContentLoaded');
  if (late && fn && mounting.has(document.currentScript)) held.push([t, type, fn]);
  else EventTarget.prototype.addEventListener.call(t, type, fn, opts);
}

// scripts: the script elements about to run. Returns the release function for this mount.
export function holdLoadListeners(scripts) {
  for (const s of scripts) mounting.add(s);
  if (holds++ === 0) window.addEventListener = document.addEventListener = holdingAdd;
  return () => {
    for (const s of scripts) mounting.delete(s);
    if (--holds > 0) return;
    delete window.addEventListener;
    delete document.addEventListener;
    const due = held;
    held = [];
    for (const [target, type, fn] of due) {
      const ev = new Event(type);
      try { typeof fn === 'function' ? fn.call(target, ev) : fn.handleEvent(ev); } catch (err) { console.error(err); }
    }
  };
}

// In document order; an external script finishes loading before the next one runs, as it would in a page
async function runScripts(root) {
  const todo = [...root.querySelectorAll('script')].filter(s => !executed.has(s) && JS.test(s.type.trim()));
  if (!todo.length) return;
  const fresh = todo.map(old => {
    const s = document.createElement('script');
    for (const a of old.attributes) s.setAttribute(a.name, a.value);
    s.text = old.text;
    executed.add(s);
    return s;
  });
  const release = holdLoadListeners(fresh);
  try {
    for (const [i, s] of fresh.entries()) {
      const loaded = s.src ? new Promise(r => { s.onload = s.onerror = r; }) : null;
      todo[i].replaceWith(s);
      if (loaded) await loaded;
    }
  } finally {
    release();
  }
}

// root: the element the page's nodes were just placed in. view: the window view showing them.
export async function mountContent(root, page, view) {
  await runScripts(root);
  // the view may have moved on to another page while scripts loaded
  if (!root.isConnected || view.page !== page) return;
  for (const fn of hooks) {
    try { fn({ root, page, view }); } catch (err) { console.error(err); }
  }
}
