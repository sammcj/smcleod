// Renders the bespoke post thumbnails (D21) from assets/thumbnails-src/<bundle>.svg into the post bundle:
//   thumbnail.png       1200x630 cover: the object on its ground (data-ground="top bottom" on the source's root)
//   thumbnail-icon.svg  the bare object for Tracker's list rows (front matter thumbnailIcon)
// Sources are one object on a 64 unit grid in the theme's emblem format (see the theme's data/deskbar/emblems.yaml):
// outline classes o, t, o3, o5 are sized here per output and class d (fine detail) is left out of the icon.
//
// Usage: node scripts/render-thumbs.mjs [bundle...]   (default: every source)
// Env: PLAYWRIGHT (module path, default: the theme's dev dependency), CHROMIUM_PATH (browser binary, optional).
// PNGs are quantised with pngquant when it is installed.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = `${root}/assets/thumbnails-src`;
const pw = process.env.PLAYWRIGHT || resolve(root, 'themes/deskbar/node_modules/playwright/index.mjs');
const { chromium } = await import(pathToFileURL(pw).href);

const W = 1200, H = 630;
// the generated card's layout (theme thumb-art.html, 160x120) scaled to the cover's height
const k = H / 120, scale = 1.42 * k;
const ICON_STYLE = '<style>.o{stroke-width:2}.t{stroke-width:1.2}.o3{stroke-width:7}.o5{stroke-width:9}.d{display:none}</style>';

const parse = (svg, file) => {
  const ground = svg.match(/data-ground="(#\w+) (#\w+)"/);
  const m = svg.match(/<defs>([\s\S]*?)<\/defs>([\s\S]*)<\/svg>/);
  if (!ground || !m) throw new Error(`${file}: expected data-ground="#top #bottom" and a <defs> block`);
  const style = m[1].match(/<style>[\s\S]*?<\/style>/)?.[0] ?? '';
  return { ground: [ground[1], ground[2]], style, defs: m[1].replace(style, '').trim(), body: m[2].trim() };
};
const card = ({ ground, style, defs, body }) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs>${style}${defs}
<linearGradient id="bg" x2="0" y2="1"><stop stop-color="${ground[0]}"/><stop offset="1" stop-color="${ground[1]}"/></linearGradient>
<filter id="sh" x="-20%" y="-100%" width="140%" height="300%"><feGaussianBlur stdDeviation="${3 * k}"/></filter></defs>
<rect width="${W}" height="${H}" fill="url(#bg)"/><ellipse cx="${W / 2}" cy="${98 * k}" rx="${40 * k}" ry="${5.5 * k}" fill="#000" opacity=".3" filter="url(#sh)"/>
<g transform="translate(${(W / 2 - 32 * scale).toFixed(1)} ${(16 * k).toFixed(1)}) scale(${scale.toFixed(3)})">${body}</g></svg>`;
const icon = ({ defs, body }) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs>${ICON_STYLE}${defs}</defs>${body}</svg>\n`
  .replace(/<!--[\s\S]*?-->/g, '').replace(/>\s+</g, '><').replace(/\n(?!$)/g, ' ');

const names = process.argv.slice(2);
const bundles = names.length ? names : readdirSync(srcDir).filter((f) => f.endsWith('.svg')).map((f) => basename(f, '.svg'));
const quant = (() => { try { execFileSync('pngquant', ['--version'], { stdio: 'ignore' }); return true; } catch { return false; } })();
if (!quant) console.warn('pngquant not found: PNGs are written unoptimised');

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
for (const b of bundles) {
  const dir = `${root}/content/posts/${b}`;
  if (!existsSync(`${dir}/index.md`)) throw new Error(`${b}: no post bundle at ${dir}`);
  const src = parse(readFileSync(`${srcDir}/${b}.svg`, 'utf8'), b);
  await page.setContent(`<body style="margin:0">${card(src)}</body>`);
  await page.screenshot({ path: `${dir}/thumbnail.png`, clip: { x: 0, y: 0, width: W, height: H } });
  if (quant) {
    try {
      execFileSync('pngquant', ['--force', '--skip-if-larger', '--strip', '--quality=70-92', '--speed=1', '--output', `${dir}/thumbnail.png`, `${dir}/thumbnail.png`]);
    } catch (e) {
      // 98: quantising would not shrink it; 99: below the quality floor. Either way the lossless PNG stays.
      if (e.status !== 98 && e.status !== 99) throw e;
    }
  }
  writeFileSync(`${dir}/thumbnail-icon.svg`, icon(src));
  console.log(`${b}: thumbnail.png ${(readFileSync(`${dir}/thumbnail.png`).length / 1024).toFixed(0)}KB`);
}
await browser.close();
