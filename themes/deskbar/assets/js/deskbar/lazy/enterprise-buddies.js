// Enterprise Portal's MS Buddies workspace (lazy/enterprise.js): written communication at its worst, laid out like the
// real thing. Channel replies that land in the wrong thread or get posted twice, group chats with no threads at all
// where nobody knows which "yes" answered what, people complaining about both, a calendar of meetings about meetings,
// a status that goes Away while you read, and every message you send retained for compliance.
import { h } from '../lib/dom.js';

// [name, unread, kind]: 'chat' and 'meeting' have no threads, 'channel' has threads nobody uses right, 'announce' is
// read-only and 'locked' has no access
export const ROOMS = [
  ['General', 0, 'channel'],
  ['Announcements', 41, 'announce'],
  ['Sync about the sync', 7, 'locked'],
  ['Team (New) (Final)', 36, 'locked'],
  ['Project Phoenix (7)', 23, 'chat'],
  ['Darren Pike', 4, 'chat'],
  ['Quick catch-up', 9, 'meeting'],
];

// Presence by person. Nobody is ever Available, apart from the bots.
const PRESENCE = { 'Darren Pike': 'busy', 'Priya Shah': 'busy', 'Kev Moss': 'away', 'Jo Ellis': 'ooo', Leadership: 'busy' };

// Links that unfurl into a preview card: url -> [title, description]
const LINKS = { 'https://nohello.net': ['no hello', "Please don't just say hello in chat. Ask your question."] };

// A chat: [who, text, quoted text]. Everything lands in one stream, so every topic interleaves.
const CHATS = {
  'Project Phoenix (7)': [
    ['Darren Pike', 'Can we get the deploy out today?'],
    ['Priya Shah', "Re the budget, I think we're over"],
    ['Kev Moss', 'Yes'],
    ['Darren Pike', 'Yes to which?'],
    ['Kev Moss', 'The one before the one before'],
    ['Priya Shah', 'This is why we need threads in chats'],
    ['Darren Pike', 'Great, deploying now', 'Yes'],
    ['Kev Moss', 'NO not that yes'],
    ['Jo Ellis', 'The feedback item asking for threads in chats has been "under review" since 2019'],
    ['Priya Shah', "I've started a new chat for the budget. And one for the deploy. And one for this."],
    ['Darren Pike', 'Which chat are we using?'],
  ],
  'Darren Pike': [
    ['Darren Pike', 'Hello'],
    ['Darren Pike', 'Quick chat?'],
    ['You', 'https://nohello.net'],
    ['Darren Pike', 'Never mind, sorted'],
    ['Darren Pike', 'Actually not sorted'],
    ['Darren Pike', 'Replying to your message from Tuesday: yes', 'Should we cancel the stand-up?'],
  ],
  'Quick catch-up': [
    ['MS Buddies', 'Meeting started'],
    ['Darren Pike', 'Can everyone see my screen?'],
    ['MS Buddies', 'Recording has started. Everything you say can now be quoted forever.'],
    ['Priya Shah', 'Sorry, have to drop, back-to-back'],
    ['MS Buddies', 'Recording stopped. It was saved to the OneDrive of someone who has since left.'],
    ['Kev Moss', 'Can someone send the notes?'],
    ['CopePilot', 'Meeting recap: there was a meeting.'],
  ],
};

// A channel post: [who, time, text, replies, reactions, the post it "replied in thread" to]. A null text was deleted.
const POSTS = [
  ['Darren Pike', '09:02', 'Can everyone see my screen?', [['Priya Shah', "You're on mute"], ['Darren Pike', "I'm not in a call"], ['Kev Moss', 'Wrong thread, sorry, this was for the offsite post']], ['👍 2']],
  ['Kev Moss', '09:10', 'Offsite is Thursday', [], ['👍 4', '❤️ 1']],
  ['Kev Moss', '09:11', 'Wrong thread, sorry, this was for the offsite post', [], [], 'Can everyone see my screen?'],
  ['Jo Ellis', '09:30', 'PSA: the box at the bottom starts a new post. To reply, use the small Reply link under a post.', [['Priya Shah', 'Thank you!!']], ['😂 3']],
  ['Darren Pike', '09:31', 'got it', [], []],
  ['Kev Moss', '09:40', null, [], []],
  ['Priya Shah', '10:05', 'Which post is the offsite one? Scrolled up for 10 minutes and gave up', [], ['👍 6']],
];
const ANNOUNCE = ['Leadership', '08:00', 'Exciting news! To boost collaboration, the office now has 40% fewer desks. Replies are turned off.', [], ['❤️ 1']];

// The chat list's quick views: [name, what opening one says]
const VIEWS = [
  ['Mentions', '@channel, 214 times this week. All from Leadership.'],
  ['Followed threads', "You follow 12 threads. Following a thread doesn't notify you when it gets a reply."],
  ['Drafts', '1 draft: "Per my last message,"'],
  ['Saved', 'Saved messages are kept for 30 days, or until the retention policy changes, whichever comes first.'],
];

export const MEETINGS = [
  ['9:00', 'Stand-up', '45 min'],
  ['9:45', 'Sync about the sync', '30 min'],
  ['10:30', 'Quick catch-up', '2 h'],
  ['12:30', 'Lunch and learn: our new expense tool', '1 h'],
  ['13:30', 'Pre-meeting for the 14:00', '30 min'],
  ['14:00', 'Meeting', '1 h'],
  ['15:00', 'Post-meeting debrief', '1 h'],
  ['16:00', 'Focus time (declined by your manager)', '2 h'],
];

// Advanced Enterprise Security: [protection, the add-on it needs]
export const SECURITY = [
  ['Encrypt messages', 'E7 Security add-on'],
  ['Keep guests out of private channels', 'E7 Security add-on'],
  ['Stop forwarding to personal email', 'Defender for Buddies Plus'],
  ['See who opened your files', 'Compliance Suite Premium'],
  ['Basic security', 'Contact sales'],
];

// Compliance Bot's reply to a message you send
export const compliance = text => /password|salary|union|resign/i.test(text)
  ? 'This message was flagged by Data Loss Prevention and forwarded to your manager, HR and Legal.'
  : 'This message has been retained for 7 years for compliance purposes.';

// Avatar initials: "Darren Pike" is DP, "Leadership" is LE
const initials = name => (name.includes(' ') ? name.split(' ').map(w => w[0]).join('').slice(0, 2) : name.slice(0, 2)).toUpperCase();

// The app bar's icons (24px SVG markup)
const S = 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
const APPS = {
  Activity: `<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5h4" ${S}/>`,
  Chat: `<path d="M4 18.5V7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H8z" ${S}/><path d="M8.5 9h7M8.5 12h4" ${S}/>`,
  Calendar: `<rect x="4" y="5" width="16" height="15" rx="2.5" ${S}/><path d="M4 9.5h16M9 13h.01M12 13h.01M15 13h.01M9 16h.01M12 16h.01" ${S} stroke-width="2.2"/>`,
  Calls: `<path d="M8 4l2 4.5-2 1.5a10 10 0 0 0 6 6l1.5-2L20 16l-1 3c-8 0-15-7-15-15z" ${S}/>`,
};

export function render(pane, { after, every, on, dialog, btn }) {
  const av = (who, cls = 'mb-av') => h('span', { class: cls, 'data-p': PRESENCE[who] || 'available', 'aria-hidden': 'true' }, initials(who));
  const msg = (who, text, quote, time) => h('li', { class: 'mb-msg' + (text == null ? ' gone' : '') },
    av(who),
    h('div', {}, h('p', { class: 'mb-by' }, h('b', {}, who), time && h('time', {}, time)), quote && h('blockquote', {}, quote),
      LINKS[text] ? unfurl(text) : h('p', {}, text ?? 'This message was deleted.')));
  // a link on its own gets a preview card under it
  const unfurl = url => [h('p', {}, h('a', { href: url, target: '_blank', rel: 'noopener' }, url)),
    h('div', { class: 'mb-card' }, h('small', {}, new URL(url).host), h('b', {}, LINKS[url][0]), h('span', {}, LINKS[url][1]))];

  // replies sit behind their count, collapsed, as they do in the real thing
  const post = ([who, time, text, replies, reacts, inThread]) => {
    const li = msg(who, text, null, time), body = li.lastChild;
    li.classList.add('mb-post');
    if (inThread) body.firstChild.after(h('p', { class: 'mb-inthread' }, 'Replied in thread: ', h('span', {}, inThread)));
    const pills = h('div', { class: 'mb-reacts' }, reacts.map(r => h('span', { class: 'mb-react' }, r)),
      h('button', { type: 'button', class: 'mb-react mb-add', 'aria-label': 'Add reaction', onclick: () => dialog('Add reaction', 'Reactions are reviewed by Internal Communications before they appear.') }, '☺+'));
    body.append(pills);
    if (replies.length) {
      const n = `${replies.length} ${replies.length > 1 ? 'replies' : 'reply'}`;
      const list = h('ol', { class: 'mb-replies', hidden: true }, replies.map(([w, t]) => msg(w, t)));
      const toggle = btn(n, () => {
        list.hidden = !list.hidden;
        toggle.textContent = list.hidden ? n : 'Collapse';
        toggle.setAttribute('aria-expanded', !list.hidden);
      }, 'mb-more');
      toggle.setAttribute('aria-expanded', 'false');
      body.append(h('div', { class: 'mb-thread' }, h('span', { class: 'mb-faces' }, replies.slice(0, 3).map(([w]) => av(w, 'mb-av mb-face'))),
        toggle, h('small', {}, 'Last reply yesterday')), list);
    }
    body.append(btn('Reply', () => dialog('Reply', 'Your reply was posted as a new conversation.'), 'mb-reply'));
    return li;
  };

  // it scrolls, so keyboard users need to be able to focus it
  const log = h('ol', { class: 'mb-log', tabindex: 0, 'aria-label': 'Messages' });
  const typing = h('p', { class: 'mb-typing' }, 'Darren is typing…');
  const heard = h('p', { class: 'ent-sr', role: 'status' });
  const input = h('input', { class: 'mb-in', 'aria-label': 'Message' });
  const composer = h('form', { class: 'mb-compose', onsubmit: e => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    log.append(msg('You', text, null, 'Now'));
    // the reply goes to the room it was sent in, and is read out from a status line that is always there
    const where = title.textContent;
    after(1200, () => {
      if (title.textContent !== where) return;
      const reply = msg('Compliance Bot', compliance(text), null, 'Now');
      log.append(reply);
      heard.textContent = `Compliance Bot: ${compliance(text)}`;
      reply.scrollIntoView({ block: 'nearest' });
    });
  } }, input, h('button', { type: 'submit', class: 'ent-btn pri' }, 'Send'));

  const crest = h('span', { class: 'mb-crest', 'aria-hidden': 'true' });
  const title = h('h2', {});
  const tools = h('div', { class: 'mb-tools' });
  const tabs = h('div', { class: 'mb-tabs' }, h('span', { class: 'mb-tab on' }, 'Conversation'),
    btn('Shared', () => dialog('Shared', ['Files shared here are in SharePoint.', 'Which SharePoint? Yes.']), 'mb-tab'));
  const body = h('div', { class: 'mb-body' });
  const side = h('ul', { class: 'mb-side' });
  const pick = (name, fill) => {
    title.textContent = name;
    crest.textContent = initials(name);
    for (const b of side.querySelectorAll('button[data-name]')) b.setAttribute('aria-current', b.dataset.name === name);
    for (const [k, b] of Object.entries(apps)) b.setAttribute('aria-current', k === (name === 'Calendar' ? 'Calendar' : 'Chat'));
    tools.replaceChildren();
    tabs.hidden = name === 'Calendar';
    fill();
  };
  const room = (name, kind) => () => {
    let foot = composer;
    if (kind === 'chat' || kind === 'meeting') {
      log.replaceChildren(...CHATS[name].map(([w, t, q], i) => msg(w, t, q, `9:${String(10 + i * 3).padStart(2, '0')}`)));
      input.placeholder = 'Type a message';
      tools.append(btn('Reply in thread', () => dialog('Threads aren\'t available in chats', 'Try quoting the message instead, or start another group chat.')));
    } else if (kind === 'channel') {
      log.replaceChildren(...POSTS.map(post));
      input.placeholder = `Message in ${name} (this starts a new post)`;
    } else if (kind === 'announce') {
      log.replaceChildren(post(ANNOUNCE));
      foot = h('p', { class: 'mb-note' }, 'Only admins can post here.');
    } else {
      log.replaceChildren(h('li', { class: 'mb-note' }, "You don't have access to this channel's history. Request it from the channel owner, Former Employee."));
    }
    body.replaceChildren(log, typing, heard, foot);
  };
  const calendar = () => body.replaceChildren(h('ol', { class: 'mb-cal' }, MEETINGS.map(([t, what, long]) =>
    h('li', {}, h('time', {}, t), h('b', {}, what), h('small', {}, long)))));

  const item = (name, n, kind, fill, cls = '') => h('li', { 'data-kind': kind, 'data-n': n },
    h('button', { type: 'button', class: cls, 'data-name': name, 'aria-label': n ? `${name}, ${n} unread` : null, onclick: () => pick(name, fill) },
      h('span', {}, name), n ? h('span', { class: 'ent-badge', 'aria-hidden': 'true' }, n) : null));
  const group = label => h('li', { class: 'mb-group' }, label);
  const view = ([name, said]) => h('li', { 'data-kind': 'view', 'data-n': 0 }, btn(name, () => dialog(name, said), ''));
  side.append(
    group('Quick views'), ...VIEWS.map(view),
    group('Teams and channels'),
    h('li', { class: 'mb-team' }, h('span', { class: 'mb-crest', 'aria-hidden': 'true' }, 'PP'), 'Project Phoenix'),
    ...ROOMS.filter(r => !/chat|meeting/.test(r[2])).map(([name, n, kind]) => item(name, n, kind, room(name, kind), 'mb-chan' + (n ? ' mb-unread' : ''))),
    h('li', {}, btn('See all channels', () => dialog('See all channels', "These are all the channels, apart from the ones you can't see."), 'mb-link')),
    group('Chats'),
    ...ROOMS.filter(r => /chat|meeting/.test(r[2])).map(([name, n, kind]) => item(name, n, kind, room(name, kind), n ? 'mb-unread' : '')));

  // Filter pills: each shows only its kind of room, and pressing it again shows everything
  const FILTERS = [['Unread', (_, n) => n > 0], ['Channels', k => /channel|announce|locked/.test(k)], ['Chats', k => k === 'chat'], ['Meeting chats', k => k === 'meeting']];
  let only = null;
  const pills = FILTERS.map(([label, test]) => {
    const b = btn(label, () => {
      only = only === test ? null : test;
      for (const p of pills) p.setAttribute('aria-pressed', p === b && only !== null);
      for (const li of side.querySelectorAll('li[data-kind]')) li.hidden = !!only && !only(li.dataset.kind, +li.dataset.n);
    }, 'mb-pill');
    b.setAttribute('aria-pressed', 'false');
    return b;
  });

  // The app bar down the left: Chat and Calendar work, the rest have opinions
  const app = (name, onclick, badge) => {
    const b = h('button', { type: 'button', class: 'mb-app', onclick, 'aria-label': badge ? `${name}, ${badge} new` : name }, h('span', { class: 'mb-ico', 'aria-hidden': 'true' }),
      h('small', { 'aria-hidden': 'true' }, name), badge && h('span', { class: 'ent-badge', 'aria-hidden': 'true' }, badge));
    b.firstChild.innerHTML = `<svg viewBox="0 0 24 24">${APPS[name]}</svg>`;
    return b;
  };
  const apps = {
    Activity: app('Activity', () => dialog('Activity', 'Someone reacted to a message. We can\'t say which one.'), 1),
    Chat: app('Chat', () => pick('Project Phoenix (7)', room('Project Phoenix (7)', 'chat'))),
    Calendar: app('Calendar', () => pick('Calendar', calendar)),
    Calls: app('Calls', () => dialog('Calls', 'Calling is turned off by your organisation. Try a meeting instead.')),
  };

  // Away after a minute without the pointer over the workspace
  const status = h('span', { class: 'mb-status', role: 'status' });
  let moved = Date.now();
  const set = s => { if (status.dataset.on !== s) { status.dataset.on = s; status.textContent = s === 'away' ? 'Away' : 'Available'; } };
  set('available');
  on(pane, 'pointermove', () => { moved = Date.now(); set('available'); });
  every(5000, () => { if (Date.now() - moved > 60000) set('away'); });

  const search = h('input', { type: 'search', class: 'mb-search', placeholder: 'Search', 'aria-label': 'Search MS Buddies' });
  const find = h('form', { role: 'search', onsubmit: e => {
    e.preventDefault();
    if (search.value.trim()) dialog('No results', `Nothing matched "${search.value.trim()}". Try the same words in a different order.`);
  } }, search);

  const join = btn('Join meeting', async () => {
    const a = await dialog('Sync about the sync', ['Waiting for the host. Darren is presenting "Q3 Alignment FINAL v7 (2).pptx".', "You're on mute. Your camera is off."], ['Unmute', 'Leave']);
    if (a === 'Unmute') await dialog('Microphone blocked', 'Your microphone is managed by your organisation.');
  });

  const security = btn('Security', async () => {
    const list = h('ul', { class: 'mb-sec' }, SECURITY.map(([what, tier]) => h('li', {}, h('span', {}, what), h('b', {}, tier))));
    const a = await dialog('Advanced Enterprise Security', ['Your plan includes a padlock icon.', list], ['Upgrade', 'Stay insecure']);
    if (a === 'Upgrade') await dialog('Upgrade requested', ['Your request has gone to Procurement.', 'Until then your messages are protected by the honour system.']);
  });

  pane.append(
    h('header', { class: 'mb-head' }, h('b', {}, 'MS Buddies'), find, status, h('span', { class: 'mb-hacts' }, security, join)),
    h('div', { class: 'mb-wrap' },
      h('nav', { class: 'mb-apps', 'aria-label': 'Apps' }, Object.values(apps)),
      h('nav', { class: 'mb-list', 'aria-label': 'Chats and channels' },
        h('h3', {}, 'Chat'), h('div', { class: 'mb-pills', role: 'group', 'aria-label': 'Filter' }, pills), side),
      h('div', { class: 'mb-main' }, h('div', { class: 'mb-top' }, crest, title, tabs, tools), body)));
  // the frame's toast asks for a chat by name (pane.dataset.open, then an ent-open event once this has rendered)
  const open = () => {
    // a filter could be hiding the chat asked for
    only = null;
    for (const p of pills) p.setAttribute('aria-pressed', 'false');
    for (const li of side.querySelectorAll('li[data-kind]')) li.hidden = false;
    const name = pane.dataset.open || 'Project Phoenix (7)';
    pick(name, room(name, ROOMS.find(r => r[0] === name)[2]));
  };
  on(pane, 'ent-open', open);
  open();
}
