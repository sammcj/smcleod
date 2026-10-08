// Enterprise Portal (lazy/enterprise.js and its workspaces): every workspace has its bundle, and the rules behind the jokes
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { WORKSPACES, nextRam, wsOf, wsUrl } from '../assets/js/deskbar/lazy/enterprise.js';
import { transition, COLUMNS, TICKETS, CM, DRAG_FIELDS } from '../assets/js/deskbar/lazy/enterprise-jiro.js';
import { compliance } from '../assets/js/deskbar/lazy/enterprise-buddies.js';
import { titleSize, SLIDES, TOTAL, fontOf, offsetOf } from '../assets/js/deskbar/lazy/enterprise-pointless.js';
import { clock, STACK } from '../assets/js/deskbar/lazy/enterprise-sentinel.js';

const lazy = join(import.meta.dirname, '../assets/js/deskbar/lazy');

test('the rail and the workspace bundles match one to one, and each exports render', async () => {
  const ids = WORKSPACES.map(w => w[0]);
  const files = readdirSync(lazy).filter(f => /^enterprise-.+\.js$/.test(f)).sort();
  assert.deepEqual(files, ids.map(id => `enterprise-${id}.js`).sort());
  for (const id of ids) assert.equal(typeof (await import(`../assets/js/deskbar/lazy/enterprise-${id}.js`)).render, 'function', id);
});

test('each workspace has an address, and an unknown one falls back to the first', () => {
  assert.equal(wsOf('/enterprise/?ws=milo'), 'milo');
  assert.equal(wsOf('/enterprise/?ws=nope'), 'buddies');
  assert.equal(wsOf('/enterprise/'), 'buddies');
  assert.equal(wsUrl('/enterprise/', 'jiro'), '/enterprise/?ws=jiro');
  assert.equal(wsUrl('/enterprise/', 'buddies'), '/enterprise/');
});

test('Jiro: tickets move anywhere but Done, and nothing leaves Change Management', () => {
  assert.deepEqual(transition('To do', 'Blocked'), { col: 'Blocked' });
  assert.deepEqual(transition('To do', CM), { col: CM });
  assert.match(transition(CM, 'In progress').error, /Change Advisory Board/);
  assert.match(transition('In progress', 'Done').error, /Required: Root cause category/);
  assert.match(transition('In progress', 'Done done').error, /nothing is Done/);
  for (const t of TICKETS) assert.ok(COLUMNS.includes(t.col), t.key);
});

test('Jiro: a drag needs 30 or more fields, each with its own label', () => {
  const labels = DRAG_FIELDS.map(([label]) => label);
  assert.ok(labels.length >= 30, `${labels.length} fields`);
  assert.equal(new Set(labels).size, labels.length);
});

test('the RAM meter only climbs, and stops short of 32 GB', () => {
  assert.equal(nextRam(3.2, 0.25), 3.5);
  assert.equal(nextRam(31.8, 0.4), 31.9);
});

test('MS Buddies flags the words compliance cares about', () => {
  assert.match(compliance('my password is hunter2'), /Data Loss Prevention/);
  assert.match(compliance('lunch?'), /retained for 7 years/);
});

test('PowerPointless shrinks a title to 6px, and has fewer slides than it says', () => {
  assert.equal(titleSize(0), 40);
  assert.equal(titleSize(10), 30);
  assert.equal(titleSize(200), 6);
  assert.ok(SLIDES.length < TOTAL);
  assert.equal(SLIDES.filter(([t]) => !t).length, 1, 'one slide to type a title on');
});

test('PowerPointless: no two neighbouring lines share a font, however consistent you make them, and nothing quite lines up', () => {
  for (let round = 0; round < 5; round++) for (let n = 0; n < 6; n++) assert.notDeepEqual(fontOf(1, n, round), fontOf(1, n + 1, round));
  assert.notDeepEqual(fontOf(1, 0, 0), fontOf(1, 0, 1), 'consistency changes the font');
  const offs = Array.from({ length: 5 }, (_, n) => offsetOf(1, n, 0));
  assert.ok(offs.every(o => Math.abs(o) <= 4) && new Set(offs).size > 1);
});

test('Sentinel runs 7 endpoint daemons, 13 kernel extensions, 5 firewalls and 2 Zscalers', () => {
  assert.deepEqual(STACK.map(s => s[1].length), [7, 13, 5, 2]);
});

test('Sentinel counts down in m:ss', () => {
  assert.equal(clock(299), '4:59');
  assert.equal(clock(5), '0:05');
});
