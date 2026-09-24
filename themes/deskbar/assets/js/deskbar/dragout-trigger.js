// D32: posts dragged out of Tracker onto the desk open in windows of their own (reader.js openPosts).
// In Tracker, Cmd/Ctrl-click and Shift-click select posts, as does Shift+Up/Down, to drag or open together.
// Only the presses live in the shell; the ghost, the selection, its keys and its toolbar button load on first use
// (lazy/dragout.js). Items carry their post's address in data-post. Phones show one window at a time (D17), and a
// finger drags to scroll the list, so neither gets any of it.
import { loadLazy } from './loader.js';
import { drag } from './wm/drag.js';
import { isPhone } from './wm/windows.js';

const mod = () => loadLazy('dragout');
const post = e => !isPhone() && e.target.closest?.('[data-post]');

// The release after a drag would click the link the drag started on
function eatClick() {
  const stop = e => { e.preventDefault(); e.stopPropagation(); };
  addEventListener('click', stop, { capture: true, once: true });
  setTimeout(() => removeEventListener('click', stop, true));
}

// root: the list; select: Tracker's selection
export function dragOut(root, select) {
  root.addEventListener('pointerdown', e => {
    const it = post(e);
    if (!it || e.button || e.pointerType === 'touch') return;
    let lift;
    // further than a press wobbles, so a shaky click still opens the post (H2)
    drag(e, (dx, dy, ev) => {
      if (!lift && Math.hypot(dx, dy) < 12) return;
      lift ||= mod().then(m => m.lift(it, root), () => null);
      lift.then(g => g?.move(ev));
    }, (_, ev) => {
      if (!lift) return;
      eatClick();
      lift.then(g => g?.drop(ev));
    });
  });
  if (!select) return;
  // the modified click would open a browser tab or window
  const pick = (e, it, how) => { e.preventDefault(); mod().then(m => m.pick(root, it, how), console.error); };
  root.addEventListener('click', e => {
    const it = post(e);
    if (it && !e.altKey && (e.metaKey || e.ctrlKey || e.shiftKey)) pick(e, it, e.shiftKey ? 'range' : 'toggle');
  });
  root.addEventListener('keydown', e => {
    const it = post(e);
    if (it && e.shiftKey && !e.metaKey && !e.ctrlKey && /^Arrow(Up|Down)$/.test(e.key)) pick(e, it, e.key);
  });
}
