// Code loaded on first use, so an app or desktop feature adds nothing to the shell's size until someone opens it.
// Hugo builds each assets/js/deskbar/lazy/<name>.js, with css/deskbar/lazy/<name>.css when there is one, into its
// own fingerprinted file and lists them in <script id="deskbar-lazy"> (_partials/deskbar/lazy.html).
//
// Extension points:
// - lazyApp({ kind, name = kind, ...defineApp options }) registers a window app (apps/index.js) whose code is
//   lazy/<name>.js. The other options (key, geometry, size) go to defineApp as they are.
//   That module exports mount(view, page, opts) with the defineApp contract (apps/registry.js), doing per-window
//   set-up when opts.fresh. The window opens at once with a loading note, and mount runs once the code is in.
// - loadLazy(name) resolves to the module once its stylesheet has loaded too. For features that are not windows
//   (a context menu, a screen saver) the trigger stays in the shell and loads the rest from there. A whole look,
//   css/deskbar/looks/<name>.css, is listed as look-<name> with a stylesheet and no script.
// A lazy module is a separate bundle. It may import ../lib/ helpers, which are copied in, but reaches the shell
// through window.deskbar (go, onMounted, mountContent...): importing a shell module would give it a second copy
// of that module's state.
import { h } from './lib/dom.js';
import { defineApp, scrollToAnchor } from './apps/registry.js';

let urls = null;
const modules = {}, sheets = {}, fails = {}, got = new Set();

// resolves on error too: a missing stylesheet leaves the app unstyled rather than unusable
const loadCss = href => (sheets[href] ||= new Promise(done => {
  const l = h('link', { rel: 'stylesheet', href });
  l.onload = l.onerror = done;
  document.head.append(l);
}));

export function loadLazy(name) {
  urls ||= JSON.parse(document.getElementById('deskbar-lazy')?.textContent || '{}');
  const u = urls[name];
  if (!u) return Promise.reject(new Error(`no lazy bundle named "${name}"`));
  // A failed load is forgotten, so opening the app again retries. Browsers remember a module URL that failed,
  // so a retry asks for the same file under a new query.
  const n = fails[name];
  // a look is a stylesheet alone, and resolves to undefined
  return (modules[name] ||= Promise.all([u.js && import(n ? `${u.js}?retry=${n}` : u.js), u.css && loadCss(u.css)])
    .then(([m]) => { got.add(name); return m; })
    .catch(err => { delete modules[name]; fails[name] = (n || 0) + 1; throw err; }));
}

// Names of the bundles this visit has loaded, for About this desktop; the Resource Timing buffer forgets them once
// it fills
export const loaded = () => [...got];

// The first page's content() hands over the live <main> nodes, which boot clears straight after the first mount,
// so they are taken now and handed out on the next call. mountContent() needs the same page object, so it is
// patched rather than copied.
function hold(page) {
  const take = page.content, nodes = take();
  page.content = () => { page.content = take; return nodes; };
}

// Views whose app has mounted once. One that failed to load or mount stays out, so opening it again mounts afresh.
const ready = new WeakSet();

// The defineApp mount of a lazy app: a loading note, then the bundle's own mount, or a readable error in its place
export function lazyMount(name) {
  return (v, page, opts) => {
    hold(page);
    const note = !ready.has(v) && (v.el.querySelector(':scope > .lazy-note') || v.el.appendChild(h('p', { class: 'lazy-note' })));
    if (note) {
      note.setAttribute('role', 'status');
      note.textContent = 'Loading…';
      v.el.setAttribute('aria-busy', 'true');
    }
    loadLazy(name).then(m => {
      // closed while loading
      if (!v.el.isConnected) return;
      // asked here, as another open may have mounted it while this one waited
      m.mount(v, page, { ...opts, fresh: !ready.has(v) });
      ready.add(v);
      note?.remove();
      v.el.removeAttribute('aria-busy');
      scrollToAnchor(v, opts.hash);
    }).catch(err => {
      console.error(err);
      if (!note || !v.el.isConnected || ready.has(v)) return;
      v.el.removeAttribute('aria-busy');
      note.setAttribute('role', 'alert');
      note.textContent = `${page.title} didn't load. Check your connection, then open it again.`;
      // whatever a failed mount had built goes, so the next one starts on an empty view
      v.el.replaceChildren(note);
    });
  };
}

export function lazyApp({ name, ...app }) {
  defineApp({ ...app, mount: lazyMount(name || app.kind) });
}
