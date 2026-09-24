#!/usr/bin/env node
// Parity checker for a built site. Asserts posts, aliases, RSS, internal links and key pages survived the build.
// Usage: node scripts/check-site.mjs [--strict] [publicDir]   (HUGO_BIN overrides the hugo binary used for `hugo list`)
// Missing link targets listed in scripts/known-broken-links.txt are pre-existing content problems and don't fail the
// check; --strict ignores that baseline.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const strict = args.includes('--strict');
const pub = path.resolve(args.find((a) => !a.startsWith('--')) || path.join(root, 'public'));
const BASELINE = path.join(root, 'scripts/known-broken-links.txt');
const KEY_PAGES = ['about', 'cv', 'contact', 'favourites', 'links', 'youtube', 'podcasts', 'hardware', 'gigs', 'cars', 'quotes', 'llm-faq', 'feeds'];
const OPTIONAL_PAGES = ['search', 'tools', 'photos'];
// CHECK_LINK_LIMIT=0 lists every missing link target instead of the first 20.
const LINK_LIMIT = Number(process.env.CHECK_LINK_LIMIT || 20) || Infinity;
const failures = [];

const fail = (section, msg) => failures.push(`[${section}] ${msg}`);
const report = (section, ok, detail) => console.log(`${ok ? 'PASS' : 'FAIL'}  ${section}: ${detail}`);

if (!fs.existsSync(path.join(pub, 'index.html'))) {
  console.error(`No built site at ${pub}. Run hugo first.`);
  process.exit(2);
}

// hugo list is the source of truth for which pages exist and where, so permalink rules aren't reimplemented here.
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

const hugo = process.env.HUGO_BIN || 'hugo';
// listing writes nothing, and without --noBuildLock it waits forever while a `hugo server` holds the lock
const pages = parseCsv(execFileSync(hugo, ['list', 'published', '--noBuildLock'], { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20 }));
const urlPath = (u) => decodeURI(new URL(u, 'https://x.invalid').pathname);

// Map a site path to the file Hugo would have written for it, or null if nothing is there.
function resolveFile(p) {
  const rel = p.replace(/^\/+/, '');
  const candidates = p.endsWith('/') ? [path.join(rel, 'index.html')] : [rel, path.join(rel, 'index.html'), `${rel}.html`];
  for (const c of candidates) {
    const f = path.join(pub, c);
    if (f.startsWith(pub) && fs.existsSync(f) && fs.statSync(f).isFile()) return f;
  }
  return null;
}

function frontMatter(file) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return { aliases: [], norss: false };
  const fm = m[1];
  const unquote = (s) => s.trim().replace(/^["']|["']$/g, '');
  let aliases = [];
  // YAML allows a trailing "# comment" after the value or on the key line
  const inline = fm.match(/^aliases:\s*\[(.*?)\]\s*(?:#.*)?$/m);
  const block = fm.match(/^aliases:[ \t]*(?:#.*)?\r?\n((?:[ \t]*-.*\r?\n?)+)/m);
  const dropComment = (s) => s.replace(/\s+#.*$/, '');
  if (inline) aliases = inline[1].split(',').map(unquote).filter(Boolean);
  else if (block) aliases = block[1].split(/\r?\n/).map((l) => dropComment(l.replace(/^\s*-\s*/, ''))).map(unquote).filter(Boolean);
  return { aliases, norss: /^norss:\s*true\s*(?:#.*)?$/m.test(fm) };
}

// 1. Posts
{
  const posts = pages.filter((p) => p.kind === 'page' && p.path.startsWith('content/posts/'));
  const missing = posts.filter((p) => !resolveFile(urlPath(p.permalink)));
  missing.forEach((p) => fail('posts', `${p.path} -> ${urlPath(p.permalink)} not built`));
  report('posts', !missing.length, `${posts.length - missing.length}/${posts.length} non-draft posts built at their permalink`);

  // The reader's "Copy as markdown" fetches index.md beside each post. Raw shortcode calls, scripts, or the HTML of
  // citation and wide-content shortcodes mean a shortcode lacks its .markdown.md variant (layouts/shortcodes).
  // Author notes in HTML comments stay out, though a comment inside fenced code is part of its example.
  const outsideCode = (md) => md.split('```').filter((_, i) => i % 2 === 0).join('');
  let bad = 0;
  for (const p of posts) {
    const f = path.join(pub, urlPath(p.permalink).replace(/^\/+/, ''), 'index.md');
    const md = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
    const why = !md ? 'missing' : !md.startsWith('# ') ? 'no title heading'
      : /\{\{[<%]|<script|class="(?:citation|bib|wide-)/i.test(md) ? 'unrendered shortcode or script'
      : outsideCode(md).includes('<!--') ? 'HTML comment outside code' : '';
    if (why) { bad++; fail('markdown', `${urlPath(p.permalink)}index.md ${why}`); }
  }
  report('markdown', !bad, `${posts.length - bad}/${posts.length} posts publish readable markdown at index.md`);
}

// 2. Aliases: every declared alias has a stub that redirects to a page that exists.
{
  let total = 0, bad = 0, withAliases = 0;
  for (const p of pages) {
    const { aliases } = frontMatter(p.path);
    if (aliases.length) withAliases++;
    const own = urlPath(p.permalink);
    for (const a of aliases) {
      total++;
      // Hugo resolves relative aliases against the page's content directory (the bundle's parent for index.md).
      const rel = path.posix.relative('content', p.path);
      const dir = path.posix.dirname(/(^|\/)_?index\.\w+$/.test(rel) ? path.posix.dirname(rel) : rel);
      const base = dir === '.' ? '/' : `/${dir}/`;
      const ap = urlPath(new URL(a, `https://x.invalid${base}`).href);
      const f = resolveFile(ap.endsWith('/') || path.extname(ap) ? ap : `${ap}/`);
      if (!f) { bad++; fail('aliases', `${p.path}: alias ${a} has no stub`); continue; }
      const html = fs.readFileSync(f, 'utf8');
      const target = html.match(/http-equiv=["']?refresh["']?\s+content=["']?\d+;\s*url=([^"'\s>]+)/i);
      if (!target) {
        if (ap.replace(/\/?$/, '/') !== own) { bad++; fail('aliases', `${p.path}: alias ${a} is shadowed by another page`); }
        continue;
      }
      const dest = urlPath(target[1]);
      if (dest !== own) { bad++; fail('aliases', `${p.path}: alias ${a} redirects to ${dest}, expected ${own}`); }
      else if (!resolveFile(dest)) { bad++; fail('aliases', `${p.path}: alias ${a} redirects to missing ${dest}`); }
    }
  }
  report('aliases', !bad, `${total - bad}/${total} aliases across ${withAliases} pages redirect to an existing page`);
}

// 2b. Live URLs: every path in the pre-redesign sitemap (scripts/live-urls.txt) still resolves to a page or stub.
// This catches permalink drift that hugo list can't, e.g. Hugo changing how :title slugs are made.
{
  const f = path.join(root, 'scripts', 'live-urls.txt');
  if (fs.existsSync(f)) {
    const urls = fs.readFileSync(f, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
    const missing = urls.filter((u) => !resolveFile(urlPath(u)));
    missing.forEach((u) => fail('live-urls', `${u} no longer resolves`));
    report('live-urls', !missing.length, `${urls.length - missing.length}/${urls.length} URLs from the live sitemap still resolve`);
  }
}

// 3. RSS: well-formed, items carry a description, norss pages excluded.
function xmlWellFormed(xml) {
  const stack = [];
  const re = /<!\[CDATA\[[\s\S]*?\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<(\/?)([A-Za-z_][\w:.-]*)((?:\s+[\w:.-]+\s*=\s*(?:"[^"<]*"|'[^'<]*'))*)\s*(\/?)>|<|&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g;
  let m;
  while ((m = re.exec(xml))) {
    const tok = m[0];
    if (tok === '<') return `stray "<" at offset ${m.index}`;
    if (tok === '&') return `unescaped "&" at offset ${m.index}`;
    if (!m[2]) continue;
    if (m[1]) { if (stack.pop() !== m[2]) return `mismatched </${m[2]}> at offset ${m.index}`; }
    else if (!m[4]) stack.push(m[2]);
  }
  return stack.length ? `unclosed <${stack.at(-1)}>` : null;
}
{
  const f = path.join(pub, 'index.xml');
  if (!fs.existsSync(f)) { fail('rss', 'index.xml missing'); report('rss', false, 'index.xml missing'); }
  else {
    const xml = fs.readFileSync(f, 'utf8');
    const err = xmlWellFormed(xml);
    if (err) fail('rss', `index.xml not well-formed: ${err}`);
    const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
    // Full text (content:encoded) is opt-in through params.ShowFullTextinRSS, as on the live site, so only the
    // summary is required.
    const noDesc = items.filter((i) => !/<description>[^<]/.test(i));
    const full = items.filter((i) => i.includes('<content:encoded>')).length;
    if (!items.length) fail('rss', 'index.xml has no items');
    noDesc.forEach((i) => fail('rss', `item without description: ${(i.match(/<link>([^<]*)/) || [])[1]}`));
    const links = new Set(items.map((i) => (i.match(/<link>([^<]*)/) || [])[1]).filter(Boolean).map(urlPath));
    const leaked = pages.filter((p) => frontMatter(p.path).norss && links.has(urlPath(p.permalink)));
    leaked.forEach((p) => fail('rss', `norss page in index.xml: ${p.path}`));
    const ok = !err && items.length && !noDesc.length && !leaked.length;
    report('rss', ok, `${err ? 'malformed' : 'well-formed'}, ${items.length} items, ${full} with content:encoded, ${leaked.length} norss leaks`);
  }
}

// 4. Internal links: every href/src/srcset that stays on this site resolves to a built file.
{
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  const htmlFiles = walk(pub).filter((f) => f.endsWith('.html'));
  const host = new URL(pages[0]?.permalink || 'https://smcleod.net/').host;
  const attr = /\s(href|src|srcset)=(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi;
  const broken = new Map();
  let checked = 0;
  for (const f of htmlFiles) {
    // Script and code bodies contain HTML-looking strings that aren't real links.
    const html = fs.readFileSync(f, 'utf8').replace(/<(script|code|pre)\b[\s\S]*?<\/\1>/gi, '');
    const pageUrl = `https://${host}/${path.relative(pub, f).split(path.sep).join('/')}`;
    for (const m of html.matchAll(attr)) {
      const raw = (m[2] ?? m[3] ?? m[4] ?? '').trim();
      const refs = m[1].toLowerCase() === 'srcset' ? raw.split(',').map((s) => s.trim().split(/\s+/)[0]) : [raw];
      for (const ref of refs) {
        if (!ref || /^(#|mailto:|tel:|javascript:|data:|blob:)/i.test(ref) || ref.includes('{{')) continue;
        let u;
        try { u = new URL(ref.replace(/&amp;/g, '&'), pageUrl); } catch { continue; }
        if (u.host !== host) continue;
        checked++;
        let p;
        try { p = decodeURIComponent(u.pathname); } catch { p = u.pathname; }
        if (resolveFile(p)) continue;
        const src = `/${path.relative(pub, f).split(path.sep).join('/')}`;
        if (!broken.has(p)) broken.set(p, new Set());
        broken.get(p).add(src);
      }
    }
  }
  // one missing target path per line; # starts a comment
  const known = new Set(strict || !fs.existsSync(BASELINE) ? [] : fs.readFileSync(BASELINE, 'utf8').split('\n').map((l) => l.replace(/#.*/, '').trim()).filter(Boolean));
  const list = [...broken.entries()].filter(([p]) => !known.has(p));
  const fixed = [...known].filter((p) => !broken.has(p));
  list.slice(0, LINK_LIMIT).forEach(([p, srcs]) => fail('links', `${p} (from ${[...srcs].slice(0, 2).join(', ')}${srcs.size > 2 ? ` +${srcs.size - 2}` : ''})`));
  if (list.length > LINK_LIMIT) fail('links', `... and ${list.length - LINK_LIMIT} more missing targets`);
  const baseline = known.size ? ` (${known.size - fixed.length} more known, in ${path.relative(root, BASELINE)})` : '';
  report('links', !list.length, `${list.length} ${known.size ? 'new ' : ''}missing targets across ${checked} internal references in ${htmlFiles.length} HTML files${baseline}`);
  if (fixed.length) console.log(`NOTE  links: ${fixed.length} known broken link(s) now resolve; remove from ${path.relative(root, BASELINE)}:\n${fixed.map((p) => `        ${p}`).join('\n')}`);
}

// 5. Key pages
{
  const missing = KEY_PAGES.filter((k) => !resolveFile(`/${k}/`));
  // Optional pages only count when content or the theme declares them.
  const declared = OPTIONAL_PAGES.filter((k) => pages.some((p) => urlPath(p.permalink) === `/${k}/`));
  missing.push(...declared.filter((k) => !resolveFile(`/${k}/`)));
  if (!fs.existsSync(path.join(pub, '404.html'))) missing.push('404.html');
  missing.forEach((k) => fail('pages', `${k} not built`));
  const skipped = OPTIONAL_PAGES.filter((k) => !declared.includes(k));
  report('pages', !missing.length, `${KEY_PAGES.length + declared.length + 1 - missing.length}/${KEY_PAGES.length + declared.length + 1} key pages${skipped.length ? ` (not declared: ${skipped.join(', ')})` : ''}`);
}

if (failures.length) {
  console.log(`\n${failures.length} problem(s):`);
  failures.forEach((f) => console.log(`  ${f}`));
  process.exit(1);
}
