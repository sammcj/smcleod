// Enterprise Portal's TrustFall Sentinel workspace (lazy/enterprise.js): endpoint "protection" that counts your keys,
// screenshots your desk, scans node_modules forever, runs a protection stack that protects you from itself, turns down
// your tools and restarts your laptop on its schedule.
import { h } from '../lib/dom.js';

// [software, verdict]
export const REQUESTS = [
  ['vim', 'Denied. Approved alternative: Notepad'],
  ['brew install jq', 'Ticket ENT-REQ-88213 raised. ETA 6 to 8 weeks'],
  ['Docker Desktop', 'Under security review since 2022'],
  ['Firefox', 'Denied. Approved browser: Edge'],
  ['Slack', 'Denied. Use MS Buddies'],
];
export const PENDING = 'Pending: Change Advisory Board (meets fortnightly, last met in 2023)';

// The protection stack: [what, every one of them, what they're up to]
export const STACK = [
  ['endpoint protection daemons', ['trustfalld', 'sentineld', 'edr-agent', 'edr-agent (2)', 'xdr-helper', 'dlp-watcherd', 'av-legacy (2009)'], 'Each one scanning the other six'],
  ['kernel extensions', ['keys', 'screen', 'clipboard', 'usb', 'camera', 'mic', 'dns', 'wifi', 'bluetooth', 'printer', 'vpn', 'mood', 'vibes'].map(k => `com.trustfall.kext.${k}`), '4 of them panic on Tuesdays'],
  ['firewalls', ['Application Firewall', 'pf', 'TrustFall Shield', 'NetGuard Pro', 'LittleWatcher'], 'Blocking each other'],
  ['Zscalers', ['Zscaler', 'Zscaler (the other one)'], 'Melbourne via Virginia via Singapore'],
];
const SCANNING = ['node_modules/left-pad/index.js', 'node_modules/is-odd/node_modules/is-even/index.js', 'node_modules/.cache/.cache/.cache', '~/Pictures/cats/IMG_0042.jpeg', '~/.zsh_history', 'node_modules/is-number/README.md'];

// m:ss of the restart countdown
export const clock = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function render(pane, { every, on, dialog, btn }) {
  const fmt = n => n.toLocaleString('en-AU');
  const stat = (label, value, note) => h('section', { class: 'ts-stat' }, h('h3', {}, label), value, h('p', {}, note));

  let score = 34, keys = 18442, shots = 1204, file = 0, left = 299, snoozed = false;
  const scoreV = h('b', {}, score + '%'), keysV = h('b', {}, fmt(keys)), shotsV = h('b', {}, fmt(shots)), scanV = h('code', {}, SCANNING[0]);
  on(document, 'keydown', () => { keysV.textContent = fmt(++keys); });
  every(15000, () => { if (score) scoreV.textContent = --score + '%'; });
  every(30000, () => { shotsV.textContent = fmt(++shots); });
  every(700, () => { scanV.textContent = SCANNING[++file % SCANNING.length]; });

  const count = h('b', {}, clock(left));
  const restart = h('p', { class: 'ts-restart', role: 'timer' }, 'Your device will restart in ', count, ' to install updates. ',
    btn('Remind me in 1 hour', e => {
      if (snoozed) return dialog('No snoozes left', "You've used this year's snooze.");
      snoozed = true;
      left = 299;
      count.textContent = clock(left);
      e.currentTarget.textContent = 'Remind me in 1 hour (0 left)';
    }));
  every(1000, () => {
    left = left ? left - 1 : 299;
    count.textContent = left ? clock(left) : 'now… just kidding, device in use. Trying again in 5:00';
  });

  const rows = h('tbody', {}, REQUESTS.map(([a, b]) => h('tr', {}, h('td', {}, a), h('td', {}, b))));
  const want = h('input', { placeholder: 'e.g. a text editor', 'aria-label': 'Software to request' });
  const form = h('form', { class: 'ts-req', onsubmit: e => {
    e.preventDefault();
    const name = want.value.trim();
    if (!name) return;
    want.value = '';
    rows.append(h('tr', {}, h('td', {}, name), h('td', {}, PENDING)));
  } }, want, h('button', { type: 'submit', class: 'ent-btn pri' }, 'Request software'));

  pane.append(
    h('header', { class: 'ts-head' }, h('b', {}, 'TrustFall Sentinel'), h('span', {}, 'Your device is protected from you')),
    restart,
    h('div', { class: 'ts-stats' },
      stat('Productivity score', scoreV, 'Down since you opened this app'),
      stat('Keystrokes today', keysV, 'Including this session. Thank you!'),
      stat('Screenshots taken', shotsV, 'One every 30 seconds, for your safety'),
      stat('Scanning', h('b', {}, 'CPU 98%'), h('span', {}, 'Deep-scanning ', scanV))),
    h('h3', {}, 'Protection stack'),
    h('ul', { class: 'ts-stack' }, STACK.map(([what, all, note]) => h('li', {},
      h('details', {}, h('summary', {}, h('b', {}, all.length), ` ${what} running`), h('ul', {}, all.map(n => h('li', {}, h('code', {}, n))))),
      h('p', {}, note)))),
    h('h3', {}, 'Software requests'),
    h('table', { class: 'ts-table' }, h('thead', {}, h('tr', {}, h('th', {}, 'Software'), h('th', {}, 'Status'))), rows),
    form,
    h('p', { class: 'ts-cert' }, 'Every site you visit is secured by TrustFall Root CA. We decrypt it, read it and encrypt it again, for your privacy.'));
}
