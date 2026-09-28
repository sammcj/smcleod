// Terminal's dmesg (lib/dmesg.js), built from fake timing entries, and cowsay (lib/cowsay.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootLog, stamp, shortPath, bytes } from '../assets/js/deskbar/lib/dmesg.js';
import { cowsay, fill } from '../assets/js/deskbar/lib/cowsay.js';

const origin = 'https://example.com';
const hash = 'a'.repeat(64);
const nav = {
  name: origin + '/terminal/', type: 'navigate', nextHopProtocol: 'h2', redirectCount: 0, fetchStart: 2,
  domainLookupStart: 3, domainLookupEnd: 15.5, connectStart: 15.5, secureConnectionStart: 20, connectEnd: 40,
  responseStart: 90, responseEnd: 120, transferSize: 9000, encodedBodySize: 8700, domInteractive: 300,
  domContentLoadedEventEnd: 350, loadEventEnd: 800,
};
const res = (name, initiatorType, responseEnd, sizes = {}) => ({
  name, initiatorType, startTime: responseEnd - 10, responseEnd, duration: 10, transferSize: 2048, encodedBodySize: 1900, ...sizes,
});

test('timestamps are seconds since navigation, six decimals, right aligned in twelve columns', () => {
  assert.equal(stamp(0), '[    0.000000]');
  assert.equal(stamp(123.4567), '[    0.123457]');
  assert.equal(stamp(98765432.1), '[98765.432100]');
  assert.equal(stamp(-5), '[    0.000000]', 'nothing before the navigation');
});

test('paths are site relative, keep another host, and cut fingerprints to 8 characters', () => {
  assert.equal(shortPath(`${origin}/js/deskbar.min.${hash}.js?v=2`, origin), '/js/deskbar.min.aaaaaaaa.js');
  assert.equal(shortPath('https://cdn.example.net/font.woff2', origin), 'cdn.example.net/font.woff2');
  assert.equal(shortPath(`${origin}/2024/03/deadbeef-notes/`, origin), '/2024/03/deadbeef-notes/', 'short hex words stay');
  assert.equal(bytes(512), '512 B');
  assert.equal(bytes(1536), '1.5 KiB');
  assert.equal(bytes(3 * 1048576), '3.0 MiB');
});

test('a page load becomes boot lines, in time order, with every resource and its size', () => {
  const lines = bootLog({
    origin, host: 'example.com', generator: 'Hugo 0.150.0', now: 2500, nav,
    paints: [{ name: 'first-contentful-paint', startTime: 210 }, { name: 'first-paint', startTime: 200 }],
    resources: [
      res(`${origin}/css/deskbar.min.${hash}.css`, 'link', 180),
      res(`${origin}/js/deskbar.${hash}.js`, 'script', 250, { transferSize: 0, encodedBodySize: 30000 }),
      res(`${origin}/fonts/mono.woff2`, 'css', 260, { transferSize: 300, encodedBodySize: 20000 }),
      res(`${origin}/home.deskbar.json`, 'fetch', 400, { responseStatus: 404 }),
      res('https://cdn.example.net/x.png', 'img', 500, { transferSize: 0, encodedBodySize: 0 }),
    ],
    cpus: 10, memory: 8, screen: { w: 1728, h: 1117, dpr: 2 },
    look: 'haiku window style, haiku colours, dark theme', bundles: ['terminal'], windows: ['Posts', 'Terminal'],
  });
  const text = lines.map(l => `${stamp(l.t)} ${l.sys ? l.sys + ': ' : ''}${l.msg}`);
  const has = re => assert.ok(text.some(t => re.test(t)), `no line matches ${re}\n${text.join('\n')}`);
  assert.deepEqual(lines.map(l => l.t), lines.map(l => l.t).slice().sort((a, b) => a - b), 'sorted by time');
  assert.equal(text[0], '[    0.000000] Booting example.com (built by Hugo 0.150.0)');
  has(/^\[ {4}0\.000000\] Command line: navigate \/terminal\/$/);
  has(/^\[ {4}0\.000000\] smp: 10 logical CPUs available$/);
  has(/^\[ {4}0\.000000\] fb0: 1728x1117 screen at 2x pixel ratio$/);
  has(/^\[ {4}0\.015500\] dns: example\.com resolved in 12\.5 ms$/);
  has(/^\[ {4}0\.040000\] tls: handshake done in 20\.0 ms$/);
  has(/^\[ {4}0\.090000\] http: first byte over h2, TTFB 90\.0 ms$/);
  has(/^\[ {4}0\.180000\] css: \/css\/deskbar\.min\.aaaaaaaa\.css 1\.9 KiB in 10\.0 ms$/);
  has(/^\[ {4}0\.200000\] paint: first paint$/);
  has(/script: \/js\/deskbar\.aaaaaaaa\.js 29\.3 KiB cached/);
  has(/css: \/fonts\/mono\.woff2 19\.5 KiB revalidated/);
  has(/img: cdn\.example\.net\/x\.png size hidden/);
  has(/^\[ {4}0\.800000\] dom: load event done$/);
  has(/^\[ {4}2\.500000\] wm: 2 windows open: Posts, Terminal$/);
  assert.deepEqual(lines.filter(l => l.err).map(l => l.msg), ['/home.deskbar.json 1.9 KiB in 10.0 ms, HTTP 404']);
  has(/mem: 8 GiB/);
  assert.ok(!text.some(t => /redirect/.test(t)), 'no redirect line without one');
});

test('resources past the cap are counted, and missing timing data leaves its lines out', () => {
  const many = Array.from({ length: 45 }, (_, i) => res(`${origin}/img/${i}.png`, 'img', 100 + i));
  const lines = bootLog({ origin, host: 'example.com', now: 1000, resources: many }, 40);
  assert.equal(lines.filter(l => l.sys === 'img').length, 40);
  assert.equal(lines.at(-1).msg, '5 more resources not shown');
  assert.ok(lines.some(l => l.msg.startsWith('/img/39.png')) && !lines.some(l => l.msg.startsWith('/img/40.png')), 'the earliest are kept');
  assert.deepEqual(bootLog({ origin, now: 5 }), [], 'a browser without timing entries logs nothing');
});

test('cowsay fills text under 40 columns and draws the bubble the way the original does', () => {
  assert.equal(cowsay('hello'), [
    ' _______',
    '< hello >',
    ' -------',
    '        \\   ^__^',
    '         \\  (oo)\\_______',
    '            (__)\\       )\\/\\',
    '                ||----w |',
    '                ||     ||',
  ].join('\n'));
  const two = cowsay('The quick brown fox jumps over the lazy dog and runs').split('\n');
  assert.deepEqual(two.slice(0, 4), [
    ' ' + '_'.repeat(41),
    '/ The quick brown fox jumps over the lazy \\',
    '\\ ' + 'dog and runs'.padEnd(39) + ' /',
    ' ' + '-'.repeat(41),
  ]);
  const three = cowsay('one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen').split('\n');
  assert.deepEqual(three.slice(1, 4).map(l => l[0] + l.at(-1)), ['/\\', '||', '\\/']);
  assert.deepEqual(fill('x'.repeat(45)), ['x'.repeat(39), 'x'.repeat(6)], 'a long word breaks, as Text::Wrap does');
  assert.equal(cowsay('').split('\n').slice(0, 3).join('\n'), ' __\n<  >\n --', 'empty text still gets a bubble');
});
