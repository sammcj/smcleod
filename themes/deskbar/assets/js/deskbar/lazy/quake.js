// The ` key (wm/drag.js): the terminal drops down from the panel, Quake style, across the desk to 60% of the
// screen's height; pressed again while it has focus it rolls back up, minimised so its session stays. Phones just
// open it full screen.
export async function quake() {
  const { go, focusView, isPhone, wm: { S, findView, minimise, place, clampTab, tabH } } = window.deskbar;
  let v = findView('terminal'), w = v?.win;
  const slide = (to, ease) => (matchMedia('(prefers-reduced-motion: reduce)').matches ? null
    : w.el.animate([{ transform: 'none' }, { transform: `translateY(${-innerHeight * 0.6}px)` }], { duration: 180, easing: ease, direction: to }).finished);
  if (w && !w.min && S.focused === w) {
    if (!isPhone()) await slide('normal', 'ease-in');
    return minimise(w);
  }
  if (!v) {
    await go('/terminal/');
    // the app loads on demand too, so its window comes a little after the page does
    for (let i = 0; i < 180 && !(v = findView('terminal')); i++) await new Promise(requestAnimationFrame);
    if (!(w = v?.win)) return;
  }
  focusView(v);
  if (isPhone()) return;
  const desk = document.getElementById('desk'), th = tabH();
  Object.assign(w, {
    x: 0, y: th, w: desk.clientWidth, h: Math.round(innerHeight * 0.6 - desk.getBoundingClientRect().top) - th,
    snap: null, prev: null, unmax: null, placed: true,
  });
  place(w);
  clampTab(w);
  slide('reverse', 'ease-out');
  v.el.querySelector('.term input')?.focus({ preventScroll: true });
}
