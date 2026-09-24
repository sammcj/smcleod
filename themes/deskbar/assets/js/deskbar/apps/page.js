// Pages outside the reader sections (About, tools, anything without its own app): one window per page,
// reader styling without history buttons. Also the fallback for kinds with no app.
import { defineApp } from './registry.js';
import { makeReader } from '../reader.js';

defineApp({
  kind: 'page',
  key: page => 'page:' + page.url,
  // centred on the desk (front matter sizes are applied in registry.js)
  geometry: (d, th) => {
    const w = Math.min(d.w - 20, 680), h = Math.min(680, d.h - 60);
    return { w, h, x: Math.max(10, (d.w - w) / 2), y: Math.max(th + 10, (d.h - h) / 2) };
  },
  create: (key, page) => Object.assign(makeReader(key, page.icon, false), { home: page.url }),
  mount: (v, page, { fresh }) => { if (fresh) v.set(page); },
});
