// dmesg (lazy/terminal.js): this page load told as a kernel ring buffer. Navigation, Paint and Resource Timing entries,
// plus a few facts from the shell, become util-linux style lines. The caller passes plain objects, so this runs in Node.

// "[    1.234567]": seconds since the navigation started, right aligned as the kernel prints them
export const stamp = ms => `[${(Math.max(0, ms) / 1000).toFixed(6).padStart(12)}]`;

export const bytes = n => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KiB` : `${(n / 1048576).toFixed(1)} MiB`);
const took = n => `${Math.max(0, n).toFixed(1)} ms`;

// A URL relative to this site, with the host kept for another site's. Hugo's 64 character fingerprints are cut to
// 8, as git abbreviates a hash.
export function shortPath(url, origin) {
  let u;
  try { u = new URL(url, origin); } catch { return String(url); }
  return ((u.origin === origin ? '' : u.host) + u.pathname).replace(/\b([\da-f]{8})[\da-f]{8,}\b/g, '$1');
}

// Body size as it arrived. A transfer of nothing came from the HTTP cache, and one smaller than its body was a 304.
// Another site's resource without Timing-Allow-Origin reports no sizes at all.
function sizeOf(r, cross) {
  const body = r.encodedBodySize || 0, sent = r.transferSize || 0;
  if (!body) return sent ? bytes(sent) : cross ? 'size hidden' : '0 B';
  return bytes(body) + (!sent ? ' cached' : sent < body ? ' revalidated' : '');
}

function resource(r, origin) {
  const path = shortPath(r.name, origin), type = r.initiatorType || 'other', bad = r.responseStatus >= 400;
  const sys = type === 'link' && /\.css$/.test(path) ? 'css' : type === 'xmlhttprequest' ? 'xhr' : type;
  return {
    t: r.responseEnd || r.startTime, sys, err: bad,
    msg: `${path} ${sizeOf(r, !path.startsWith('/'))} in ${took(r.duration)}${bad ? `, HTTP ${r.responseStatus}` : ''}`,
  };
}

function navigation(n, { host, generator, origin }) {
  const out = [{ t: 0, sys: '', msg: `Booting ${host}${generator ? ` (built by ${generator})` : ''}` },
    { t: 0, sys: '', msg: `Command line: ${n.type || 'navigate'} ${shortPath(n.name, origin)}` }];
  const at = (t, sys, msg) => t > 0 && out.push({ t, sys, msg });
  if (n.redirectCount) at(n.fetchStart, 'http', `followed ${n.redirectCount} redirect${n.redirectCount === 1 ? '' : 's'}`);
  const dns = n.domainLookupEnd - n.domainLookupStart, tcp = n.connectEnd - n.connectStart;
  at(n.domainLookupEnd, 'dns', dns > 0 ? `${host} resolved in ${took(dns)}` : `${host} already resolved`);
  at(n.connectEnd, 'tcp', tcp > 0 ? `connected in ${took(tcp)}` : 'connection reused');
  if (n.secureConnectionStart > 0) at(n.connectEnd, 'tls', `handshake done in ${took(n.connectEnd - n.secureConnectionStart)}`);
  at(n.responseStart, 'http', `first byte${n.nextHopProtocol ? ` over ${n.nextHopProtocol}` : ''}, TTFB ${took(n.responseStart)}`);
  at(n.responseEnd, 'http', `document received, ${sizeOf(n, false)}`);
  at(n.domInteractive, 'dom', 'interactive, parsing done');
  at(n.domContentLoadedEventEnd, 'dom', 'DOMContentLoaded');
  at(n.loadEventEnd, 'dom', 'load event done');
  return out;
}

// d: { origin, host, generator, now, nav, paints, resources, cpus, memory, screen: { w, h, dpr }, look, bundles, windows }.
// Hardware is logged at 0, as a kernel logs it at boot; the shell's state at now, when dmesg ran. At most max
// resources are listed, the earliest, and a count of the rest. Returns [{ t, sys, msg, err }] in time order.
export function bootLog(d, max = 40) {
  const lines = d.nav ? navigation(d.nav, d) : [];
  if (d.cpus) lines.push({ t: 0, sys: 'smp', msg: `${d.cpus} logical CPUs available` });
  if (d.memory) lines.push({ t: 0, sys: 'mem', msg: `${d.memory} GiB, as the browser rounds it` });
  if (d.screen) lines.push({ t: 0, sys: 'fb0', msg: `${d.screen.w}x${d.screen.h} screen at ${d.screen.dpr}x pixel ratio` });
  for (const p of d.paints || []) lines.push({ t: p.startTime, sys: 'paint', msg: p.name.replace(/-/g, ' ') });
  const res = (d.resources || []).map(r => resource(r, d.origin)).sort((a, b) => a.t - b.t);
  lines.push(...res.slice(0, max));
  if (res.length > max) lines.push({ t: res.at(-1).t, sys: 'dmesg', msg: `${res.length - max} more resources not shown` });
  if (d.look) lines.push({ t: d.now, sys: 'deskbar', msg: d.look });
  if (d.bundles?.length) lines.push({ t: d.now, sys: 'deskbar', msg: `on-demand bundles loaded: ${d.bundles.join(', ')}` });
  if (d.windows?.length) lines.push({ t: d.now, sys: 'wm', msg: `${d.windows.length} window${d.windows.length === 1 ? '' : 's'} open: ${d.windows.join(', ')}` });
  // sort is stable, so lines logged at the same moment keep their order
  return lines.sort((a, b) => a.t - b.t).map(l => ({ err: false, ...l }));
}
