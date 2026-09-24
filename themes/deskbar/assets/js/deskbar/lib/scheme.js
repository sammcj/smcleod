// The effective colour scheme: the visitor's pick (data-theme on <html>) or else the OS setting.
// Third-party renderers need it as a value, since they can't follow CSS light-dark() themselves.
const os = () => matchMedia('(prefers-color-scheme: dark)');

export const isDark = () => {
  const t = document.documentElement.dataset.theme;
  return t ? t === 'dark' : os().matches;
};

export function onSchemeChange(fn) {
  let last = isDark();
  const check = () => { if (isDark() !== last) { last = !last; fn(last); } };
  new MutationObserver(check).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  os().addEventListener('change', check);
}
