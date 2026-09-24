// The effective colour scheme: the visitor's pick (data-theme on <html>), light by default, or the OS setting under
// auto. Third-party renderers need it as a value, since they can't follow CSS light-dark() themselves.
const os = () => matchMedia('(prefers-color-scheme: dark)');

export const isDark = () => {
  const t = document.documentElement.dataset.theme || 'light';
  return t === 'auto' ? os().matches : t === 'dark';
};

export function onSchemeChange(fn) {
  let last = isDark();
  const check = () => { if (isDark() !== last) { last = !last; fn(last); } };
  new MutationObserver(check).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  os().addEventListener('change', check);
}
