// Contact as a Mail-style compose window (`window: mail`). The page's first form keeps its own action and fields
// (a site's contact shortcode, laid out by the .mail-form styles); the window adds a Send button to its toolbar.
// Submitting is an ordinary form post, so the form service's redirect lands on a normal page load.
// Loaded on first open through lazyApp (loader.js).
import { h, find } from '../lib/dom.js';

export function mount(v, page, { fresh }) {
  if (!fresh) return;
  const nodes = page.content(), form = find(nodes, 'form');
  if (form) {
    // the window's tab already names the page, so the form stands in for the whole article. The form's own
    // submit button is hidden in the window but still sent, as the service may expect its name.
    const submit = form.querySelector('[type=submit]');
    v.el.append(h('div', { class: 'toolbar' },
      h('button', { class: 'tb send', type: 'button', onclick: () => form.requestSubmit(submit) }, 'Send')));
  }
  const body = h('div', { class: 'mail-body scroller' }, ...(form ? [form] : nodes));
  v.el.append(body);
  window.deskbar.mountContent(body, page, v);
}
