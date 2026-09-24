// MathJax, pinned to an exact version. It comes from jsDelivr with Subresource Integrity, and fetches its own
// extensions and fonts from beside the pinned entry, at the same version. Mermaid is self-hosted (lazy/mermaid.js).
// A site can move MathJax by setting window.deskbarCDN = { mathjax: { src, integrity } } before the shell loads;
// tests use this to serve stubs.

export const CDN = {
  mathjax: {
    src: 'https://cdn.jsdelivr.net/npm/mathjax@4.1.3/tex-mml-chtml.js',
    integrity: 'sha384-OrHfGTnIbkl0do3N76qW/uWr38o91N05sbSPuYBPLH+hG8X/dNSrjZf3AGjzrCwC',
  },
};

// Resolves once the script has run; rejects if it fails to load or its hash does not match
export function loadScript(name) {
  const { src, integrity } = { ...CDN[name], ...globalThis.deskbarCDN?.[name] };
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    // SRI on a cross-origin script needs a CORS request
    s.crossOrigin = 'anonymous';
    if (integrity) s.integrity = integrity;
    s.onload = resolve;
    s.onerror = () => { s.remove(); reject(new Error(`${name} failed to load`)); };
    document.head.append(s);
  });
}
