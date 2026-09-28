// The ` key (wm/drag.js): the terminal drops down from the panel, Quake style, across the desk to 60% of the
// screen's height; pressed again while it has focus it rolls back up, minimised so its session stays. Phones just
// open it full screen.
export async function quake() {
  const { go, focusView, isPhone, wm: { S, free, findView, minimise, place, clampTab, tabH, refresh } } = window.deskbar;
  let v = findView('terminal'), w = v?.win;
  const slide = (to, ease) => (matchMedia('(prefers-reduced-motion: reduce)').matches ? null
    : w.el.animate([{ transform: 'none' }, { transform: `translateY(${-innerHeight * 0.6}px)` }], { duration: 180, easing: ease, direction: to }).finished);
  if (w && !w.min && S.focused === w) {
    if (!isPhone()) await slide('normal', 'ease-in');
    return minimise(w);
  }
  if (!v) {
    // go resolves once the page is in its window; a newer navigation or a failed load leaves none. A handler that
    // throws rejects go instead, unless a View Transition ran it (router.js updated).
    await go('/terminal/');
    if (!(w = (v = findView('terminal'))?.win)) return;
  }
  focusView(v);
  if (isPhone()) return;
  const desk = document.getElementById('desk'), th = tabH();
  Object.assign(w, free, {
    x: 0, y: th, w: desk.clientWidth, h: Math.round(innerHeight * 0.6 - desk.getBoundingClientRect().top) - th, placed: true,
  });
  place(w);
  clampTab(w);
  // it came forward before taking its new place, so which windows it covers is worked out again
  refresh();
  slide('reverse', 'ease-out');
  v.el.querySelector('.term input')?.focus({ preventScroll: true });
}
