// Enterprise Portal (`window: enterprise`): a parody of enterprise software. A Slack-style rail of workspaces, each a
// bundle of its own (lazy/enterprise-<id>.js, exporting render(pane, ctx)) loaded on first visit, so the frame stays
// small. Around them: a Sign in button with seven factors, banners that won't go, an NPS survey, a RAM meter that only
// climbs, an AI sidekick, and one toast that escapes onto the desktop.
// Lazy bundles can't import each other (tests/lazy.test.mjs), so workspaces get their shared helpers through ctx.
import { h } from '../lib/dom.js';

// [id, name, rail icon (24px SVG markup, after the logo it mocks), unread badge]
const S = 'fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"';
export const WORKSPACES = [
  ['buddies', 'MS Buddies', `<circle cx="15" cy="7" r="3" fill="currentColor"/><circle cx="7.5" cy="9" r="2.4" fill="currentColor" opacity=".7"/><path d="M9.5 21v-4a5.5 5.5 0 0 1 11 0v4z" fill="currentColor"/><path d="M3 20v-3a4.5 4.5 0 0 1 6-4.2" ${S} opacity=".7"/>`, '99+'],
  ['milo', 'Milo', `<path d="M6 21l5-17M11 21l5-17M16 21l5-17M4 7l2.5-3L9 7M9 7l2.5-3L14 7M14 7l2.5-3L19 7" ${S}/>`, '3'],
  ['jiro', 'Jiro', `<path d="M12 3l9 9-9 9-9-9z" ${S}/><path d="M12 8l4 4-4 4-4-4z" fill="currentColor"/>`, '12'],
  ['effluence', 'Effluence', `<path d="M3 17c3-4 6-5 9-3s6 1 9-3M3 9c3 4 6 5 9 3s6-1 9 3" ${S}/>`, ''],
  ['pointless', 'PowerPointless', `<rect x="2.5" y="4" width="19" height="14" rx="1.5" ${S}/><path d="M12 7.5a3.5 3.5 0 1 0 3.5 3.5H12z" fill="currentColor"/><path d="M13.2 6.3a3.5 3.5 0 0 1 3.5 3.5h-3.5z" fill="currentColor"/><path d="M8 21h8" ${S}/>`, '1'],
  ['sentinel', 'TrustFall Sentinel', `<path d="M12 2.5l8 3v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10v-6z" ${S}/><path d="M7 12s2-3 5-3 5 3 5 3-2 3-5 3-5-3-5-3z" ${S} stroke-width="1.6"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/>`, '!'],
];
// Slack's four-colour hash, as a pinwheel of pills and dots
const SLACK = [['#36c5f0', 'M4.5 9.5H10', 9.5, 4.5], ['#2eb67d', 'M14.5 4.5V10', 19.5, 9.5], ['#ecb22e', 'M14 14.5h5.5', 14.5, 19.5], ['#e01e5a', 'M9.5 14v5.5', 4.5, 14.5]]
  .map(([c, d, x, y]) => `<path d="${d}" stroke="${c}" stroke-width="3.6" stroke-linecap="round"/><circle cx="${x}" cy="${y}" r="1.9" fill="${c}"/>`).join('');

const BOOT = ['Optimising your experience', 'Loading 214 plugins', 'Checking device compliance', 'Applying a 1.4 GB update'];

export const ANSWERS = [
  "Here's a summary: there was content.",
  "I can't help with that, but here are 3 related Effluence pages from 2017.",
  "Great question! I've booked a one-hour meeting with 14 people to discuss it.",
  "I've rewritten your question to be more aligned with our values.",
  'That information is restricted. Please ask your manager to ask me.',
  "I've raised 4 Jiro tickets to track this.",
  'As an AI assistant, I recommend upgrading to CopePilot Pro.',
];

// The RAM meter's next reading in GB: it only ever climbs, and stops just short of the whole machine
export const nextRam = (gb, step) => Math.min(31.9, Math.round((gb + step) * 10) / 10);

// Each workspace has an address, ?ws=<id> (none for the first), which the window's route follows, so a link opens it
export const wsOf = url => (WORKSPACES.find(w => w[0] === new URL(url, 'http://x').searchParams.get('ws')) || WORKSPACES[0])[0];
export const wsUrl = (base, id) => (id === WORKSPACES[0][0] ? base : `${base}?ws=${id}`);

// The Sign in button's factors, in order: [title, prompt]
export const MFA = [
  ['Enter your password', 'Your password expired 3 minutes ago, so we filled in a new one for you.'],
  ['Approve the sign-in request', 'Open the authenticator on your registered device and enter 42.'],
  ['Enter the code we texted you', "We sent a 6-digit code to +61 4•• ••• ••7. It's 314159."],
  ['Check your email', 'We sent you a magic link. Your mail filter quarantined it, so we let you through anyway.'],
  ['Touch your security key', 'Any key will do. That one is your house key, which is fine.'],
  ['Answer your security question', "What was your first manager's first manager's favourite KPI?"],
  ['Verify that you are human', 'Select every square that contains synergy. It is all of them.'],
];

export function mount(v, page, { fresh }) {
  if (!fresh) return v.showWs(wsOf(page.url));
  const base = new URL(page.url, location.href).pathname;
  let want = wsOf(page.url), started = false;
  v.showWs = id => (started ? show(id) : (want = id));
  // the portal takes over the desk: the Posts window closes when it opens
  const posts = window.deskbar.wm.findView('tracker');
  if (posts) window.deskbar.wm.closeView(posts);
  const stops = [];
  // a timer that has fired lets go of its stop, as some run for every keypress or click
  const after = (ms, fn) => {
    const stop = () => clearTimeout(t);
    const t = setTimeout(() => { stops.splice(stops.indexOf(stop), 1); fn(); }, ms);
    stops.push(stop);
  };
  const every = (ms, fn) => { const t = setInterval(fn, ms); stops.push(() => clearInterval(t)); };
  const on = (target, type, fn) => { target.addEventListener(type, fn); stops.push(() => target.removeEventListener(type, fn)); };
  const btn = (label, onclick, cls = 'ent-btn') => h('button', { type: 'button', class: cls, onclick }, label);

  const root = h('div', { class: 'ent' });
  v.el.append(root);

  // An in-window dialog (a page-wide one would lock the rest of the desktop too), with the rest of the app inert
  // behind it. Resolves to the pressed label; its close(label) shuts it from code. Focus goes back where it was, or to
  // the rail if that has gone.
  const dialog = (title, body, actions = ['OK']) => {
    let close;
    const p = new Promise(done => {
      const back = document.activeElement, behind = [...root.children];
      close = label => {
        if (!box.isConnected) return;
        box.remove();
        behind.forEach(c => { c.inert = false; });
        (back?.isConnected && !back.disabled && back.checkVisibility() ? back : tabs[current])?.focus();
        done(label);
      };
      behind.forEach(c => { c.inert = true; });
      const box = h('div', { class: 'ent-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
        h('div', { class: 'ent-card' },
          h('h2', {}, title),
          [body].flat().map(p => (p?.nodeType ? p : h('p', {}, p))),
          h('div', { class: 'ent-acts' }, actions.map((a, i) => btn(a, () => close(a), i ? 'ent-btn' : 'ent-btn pri')))));
      box.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(null); } });
      root.append(box);
      box.querySelector('button').focus();
    });
    p.close = close;
    return p;
  };

  // what each workspace's render(pane, ctx) gets: timers and listeners that stop when the window closes
  const ctx = { after, every, on, dialog, btn };

  // Frame
  const panes = {}, tabs = {};
  let current = null;
  const mono = icon => {
    const tile = h('span', { class: 'ent-mono', 'aria-hidden': 'true' });
    tile.innerHTML = `<svg viewBox="0 0 24 24">${icon}</svg>`;
    return tile;
  };
  // Slack sits on the rail like a workspace, but TechOps blocks it and sends you to MS Buddies
  const slack = h('button', { type: 'button', class: 'ent-tab', 'data-ws': 'slack', title: 'Slack', 'aria-label': 'Slack', onclick: async () => {
    await dialog('Blocked by TechOps', ["Slack isn't on the approved software list, so you've been redirected to MS Buddies.", "To request an exception, post in the TechOps channel. It's in MS Buddies."]);
    show('buddies');
  } }, mono(SLACK));
  const rail = h('nav', { class: 'ent-rail', 'aria-label': 'Workspaces' }, WORKSPACES.map(([id, name, icon, badge]) =>
    (tabs[id] = h('button', { type: 'button', class: 'ent-tab', 'data-ws': id, title: name, 'aria-label': badge ? `${name}, ${badge} unread` : name, onclick: () => show(id) },
      mono(icon), badge && h('span', { class: 'ent-badge', 'aria-hidden': 'true' }, badge)))));
  // the spyware stays last, watching from the bottom
  rail.insertBefore(slack, tabs.sentinel);
  const main = h('div', { class: 'ent-main' });

  const orgBtn = btn('Dismiss', async () => {
    await dialog('Approval required', ['Dismissing this banner needs approval from your IT administrator.', 'A request has been sent. Requests are reviewed quarterly.']);
    orgBtn.textContent = 'Dismissal pending';
    orgBtn.disabled = true;
  }, 'ent-link');
  // Sign in: every factor there is, one after another, each offering to remember you and none of them doing so.
  // Continue has the focus, so Enter walks straight through.
  const signBtn = btn('Sign in', async () => {
    let ticked = false;
    for (const [i, [title, text]] of MFA.entries()) {
      const remember = h('input', { type: 'checkbox' });
      const body = [ticked && "We tried to remember you. We couldn't.", text, h('label', { class: 'ent-remember' }, remember, 'Remember me on this device for 30 days')];
      if (await dialog(`${title} (${i + 1} of ${MFA.length})`, body.filter(Boolean), ['Continue', 'Cancel']) !== 'Continue') return;
      ticked = remember.checked;
    }
    signBtn.textContent = 'Signed in';
    out.hidden = true;
    outSaid.textContent = '';
    await dialog('Signed in', 'Welcome back! For your security, this session lasts one minute.');
    after(60000, () => { signBtn.textContent = 'Sign in'; });
    survey('How would you rate your sign-in experience?');
  }, 'ent-signin');
  const org = h('div', { class: 'ent-org', role: 'note' }, h('span', {}, 'Your organisation manages this app. Some settings are hidden for your convenience.'), orgBtn, signBtn);

  // Every 20 seconds you're signed out for our convenience. Signing back in runs itself: a password, three codes and a
  // CAPTCHA fill in, then the dialog closes and you're back where you were.
  const reSign = () => {
    out.hidden = true;
    outSaid.textContent = '';
    const pw = h('input', { type: 'password', readonly: true });
    const codes = ['Authenticator', 'SMS', 'Email'].map(l => h('input', { readonly: true, class: 'ent-code', 'aria-label': `${l} code` }));
    const squares = Array.from({ length: 9 }, () => h('span', {}, 'synergy'));
    const robot = h('input', { type: 'checkbox', disabled: true });
    const verdict = h('p', { role: 'status' });
    const d = dialog('Signing you back in', [
      h('label', { class: 'ent-field' }, 'Password', pw),
      h('div', { class: 'ent-codes' }, codes),
      h('p', {}, 'Select every square that contains synergy'),
      h('div', { class: 'ent-grid', 'aria-hidden': 'true' }, squares),
      h('label', { class: 'ent-remember' }, robot, "I'm not a robot"),
      verdict], ['Skip']);
    // [ms before it, step]: typing is quick, the CAPTCHA takes its time
    const steps = [
      ...Array.from({ length: 12 }, (_, i) => [25, () => { pw.value = 'x'.repeat(i + 1); }]),
      ...codes.flatMap(c => Array.from({ length: 6 }, () => [20, () => { c.value += Math.floor(Math.random() * 10); }])),
      ...squares.map(s => [90, () => s.classList.add('on')]),
      [200, () => { robot.checked = true; }],
      [300, () => { verdict.textContent = 'Robot detected. Signing you in anyway.'; }],
      [900, () => d.close('Signed in')],
    ];
    let at = 0;
    for (const [ms, step] of steps) after((at += ms), step);
  };
  // the message is written each time it shows, so screen readers hear it
  const outSaid = h('span', {});
  const out = h('div', { class: 'ent-out', role: 'status', hidden: true }, outSaid, btn('Sign in again', reSign, 'ent-btn pri'));
  every(20000, () => {
    if (root.querySelector('.ent-modal')) return;
    out.hidden = false;
    outSaid.textContent = 'You have been signed out for our convenience.';
  });

  let gb = 3.2;
  const ram = h('span', { class: 'ent-ram' });
  const showRam = () => { ram.textContent = gb >= 31.9 ? 'RAM 31.9 GB of 32 GB. Laptop replacement ticket raised.' : `RAM ${gb.toFixed(1)} GB`; };
  showRam();
  every(2000, () => { gb = nextRam(gb, 0.1 + Math.random() * 0.3); showRam(); });

  const darkBtn = btn('Dark mode', async () => {
    const a = await dialog('Upgrade to Enterprise Plus', ['Dark mode is an Enterprise Plus feature.', 'AUD $42 per user per month, minimum 500 seats, billed three years in advance.'], ['Contact sales', 'Maybe later']);
    if (a === 'Contact sales') await dialog('Thanks!', 'A sales representative will call you every day until you buy.');
  }, 'ent-link');

  const said = h('div', { class: 'ent-ai-log', 'aria-live': 'polite' });
  const ask = h('input', { class: 'ent-ai-in', placeholder: 'Ask anything', 'aria-label': 'Ask CopePilot' });
  let answer = 0;
  const aiPanel = h('form', { class: 'ent-ai', hidden: true, 'aria-label': 'CopePilot', onsubmit: e => {
    e.preventDefault();
    const q = ask.value.trim();
    if (!q) return;
    ask.value = '';
    said.append(h('p', { class: 'me' }, q));
    const thinking = h('p', {}, 'Thinking…');
    said.append(thinking);
    after(900, () => { thinking.textContent = ANSWERS[answer++ % ANSWERS.length]; said.scrollTop = said.scrollHeight; });
  } }, h('h2', {}, 'CopePilot ', h('small', {}, 'Preview')), said, ask, h('p', { class: 'ent-fine' }, 'CopePilot can make mistakes. So can you.'));
  said.append(h('p', {}, 'Hi! I can summarise things you already read. What would you like to know?'));
  const aiBtn = btn('Ask CopePilot', () => { aiPanel.hidden = !aiPanel.hidden; aiBtn.setAttribute('aria-expanded', !aiPanel.hidden); if (!aiPanel.hidden) ask.focus(); }, 'ent-link ent-ai-btn');
  aiBtn.setAttribute('aria-expanded', 'false');

  const status = h('footer', { class: 'ent-status' }, ram, h('span', {}, 'VPN: Melbourne via Virginia'), darkBtn, aiBtn);

  // NPS survey: whatever you pick is rounded up to 10, and the follow-up asks about surveys. Once per open: whichever
  // asks first, dismissing it is final.
  const nps = h('section', { class: 'ent-nps', 'aria-label': 'Survey', hidden: true });
  const scale = (question, pick) => [
    h('p', {}, h('b', {}, question)),
    h('div', { class: 'ent-scale', role: 'group', 'aria-label': question }, Array.from({ length: 11 }, (_, n) => btn(String(n), () => pick(n), 'ent-n'))),
    h('p', { class: 'ent-fine ent-ends' }, h('span', {}, 'Not at all likely'), h('span', {}, 'Extremely likely')),
  ];
  let surveyed = false;
  const survey = question => {
    if (surveyed) return;
    surveyed = true;
    nps.replaceChildren(...scale(question, n => nps.replaceChildren(
      h('p', {}, `Thanks! We've rounded your ${n} up to a 10.`),
      ...scale('How likely are you to fill in another survey?', () => nps.replaceChildren(
        h('p', {}, 'Thanks for your feedback. Your next survey is in 5 minutes.'),
        h('div', { class: 'ent-acts' }, btn('Close', () => { nps.hidden = true; }, 'ent-btn pri')))))),
      h('div', { class: 'ent-acts' }, btn('Not now', () => { nps.hidden = true; })));
    nps.hidden = false;
  };
  after(20000, () => survey('How likely are you to recommend Enterprise Portal to a friend or colleague?'));

  // Cookie banner, once per open
  const cookie = h('div', { class: 'ent-cookie', role: 'region', 'aria-label': 'Cookie consent', hidden: true });
  const askCookies = () => {
    cookie.replaceChildren(
      h('p', {}, 'We value your privacy. We and our 1,412 partners use cookies to improve your experience, measure your productivity and share both.'),
      h('div', { class: 'ent-acts' },
        btn('Accept all', () => { cookie.hidden = true; }, 'ent-btn pri'),
        btn('Manage preferences', async () => {
          await dialog('Cookie preferences', ['Strictly necessary: always on', 'Performance: always on (legitimate interest)', 'Productivity monitoring: always on (legitimate interest)', 'Advertising: always on (legitimate interest)'], ['Save preferences']);
          cookie.hidden = true;
        })));
    cookie.hidden = false;
  };

  function show(id) {
    if (current === id || !tabs[id]) return;
    current = id;
    // the window's route names the workspace; the address bar follows when it names this window
    const was = v.url, url = wsUrl(base, id);
    v.url = url;
    if (url !== was && location.pathname + location.search === was) window.deskbar.router.replace(url);
    for (const [k, t] of Object.entries(tabs)) t.setAttribute('aria-current', k === id ? 'page' : 'false');
    for (const p of Object.values(panes)) p.hidden = true;
    if (panes[id]) { panes[id].hidden = false; return; }
    const pane = panes[id] = h('section', { class: `ent-pane ent-${id}`, 'aria-label': WORKSPACES.find(w => w[0] === id)[1] },
      h('p', { class: 'ent-wait', role: 'status' }, 'Loading workspace… This may take a few minutes.'));
    main.append(pane);
    window.deskbar.loadLazy('enterprise-' + id)
      .then(m => { if (!root.isConnected) return; pane.replaceChildren(); m.render(pane, ctx); })
      .catch(err => { console.error(err); pane.replaceChildren(h('p', { class: 'ent-wait', role: 'alert' }, "This workspace couldn't load. Have you tried turning it off and on again?")); });
  }

  // The toast that gets out of the window, once per open: a bare hello, and the follow-up a little later
  let toast = null;
  after(30000, () => {
    const lines = h('div', { class: 'ent-said' }, h('p', {}, 'Hello'));
    toast = h('div', { class: 'ent-toast', role: 'status' },
      h('b', {}, 'Darren (MS Buddies)'), lines,
      h('div', { class: 'ent-acts' },
        btn('Open', () => {
          toast.remove();
          window.deskbar.focusView(v);
          show('buddies');
          // MS Buddies opens the chat on render, or on this event if it already has
          panes.buddies.dataset.open = 'Darren Pike';
          panes.buddies.dispatchEvent(new Event('ent-open'));
          tabs.buddies.focus();
        }, 'ent-btn pri'),
        btn('Dismiss', () => toast.remove())));
    document.body.append(toast);
    after(4000, () => lines.append(h('p', {}, 'Quick chat?')));
  });

  v.teardown = () => { stops.forEach(f => f()); toast?.remove(); };

  // Start-up: the update's progress, then straight in
  const boot = h('div', { class: 'ent-boot' });
  const bar = h('div', { class: 'ent-prog', role: 'progressbar', 'aria-label': 'Starting', 'aria-valuemin': 0, 'aria-valuemax': 100 }, h('i'));
  const step = h('p', { role: 'status' });
  boot.append(h('div', { class: 'ent-card ent-sign' }, h('p', { class: 'ent-logo' }, 'Enterprise Portal'), step, bar));
  root.append(boot);
  BOOT.forEach((s, i) => after(i * 450, () => {
    step.textContent = s + '…';
    const pc = Math.round(((i + 1) / BOOT.length) * 99);
    bar.setAttribute('aria-valuenow', pc);
    bar.style.setProperty('--p', pc + '%');
  }));
  after(BOOT.length * 450 + 300, () => {
    boot.remove();
    root.append(org, out, h('div', { class: 'ent-body' }, rail, main, aiPanel, nps), status, cookie);
    started = true;
    show(want);
    askCookies();
  });
}
