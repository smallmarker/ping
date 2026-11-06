const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { fixture } = require('./lib/cloud-mock');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));
const reply = data => ({ result: { code: 0, data } });
const row = id => ({ _id: id, title: id, status: 'pending', remindAt: '2099-01-01T00:00:00Z', createdAt: '2026-01-01T00:00:00Z' });
const stats = (createdCount = 1, remindedCount = 0) => ({ createdCount, remindedCount });
const client = () => {
  const calls = []; const state = { now: Date.parse('2026-11-06T00:00:00Z') };
  class ClockDate extends Date { static now() { return state.now; } }
  const wx = { cloud: { callFunction: args => new Promise((resolve, reject) => calls.push({ ...args, resolve, reject })) } };
  const sandbox = { module: { exports: {} }, wx, Date: ClockDate };
  vm.runInNewContext(read('miniprogram/services/reminder.js'), sandbox);
  return { service: sandbox.module.exports, calls, state };
};

test('identical concurrent full-list loads share all three pages; completed lists are not TTL cached', async () => {
  const f = client(); const items = Array.from({ length: 121 }, (_, i) => row(String(i)));
  const a = f.service.getReminders(); const b = f.service.getReminders();
  assert.equal(f.calls.length, 1);
  for (let offset = 0; offset < 121; offset += 50) {
    f.calls.at(-1).resolve(reply({ items: items.slice(offset, offset + 50), nextCursor: offset + 50 < 121 ? String(offset + 50) : null }));
    await flush();
  }
  assert.equal(f.calls.length, 3);
  assert.equal((await a).length, 121); assert.equal((await b).length, 121);
  const fresh = f.service.getReminders(); assert.equal(f.calls.length, 4);
  f.calls.at(-1).resolve(reply({ items })); await fresh;
});

test('different sorts and forced refreshes do not merge; older results cannot replace newer ones', async () => {
  const f = client(); const old = f.service.getReminders(); const sorted = f.service.getReminders('remindAtAsc');
  const fresh = f.service.getReminders('createdAtDesc', { force: true });
  assert.equal(f.calls.length, 3);
  f.calls[2].resolve(reply({ items: [row('new')] })); await fresh;
  f.calls[0].resolve(reply({ items: [row('old')] })); await old;
  f.calls[1].resolve(reply({ items: [row('older')] })); await sorted;
  assert.equal(f.service.getCachedReminders()[0]._id, 'new');
});

test('writes separate in-flight list generations and confirmed deletions cannot reappear', async () => {
  const f = client(); const old = f.service.getReminders();
  const deletion = f.service.deleteReminder('gone'); f.calls[1].resolve(reply({ id: 'gone' })); await deletion;
  const fresh = f.service.getReminders(); assert.equal(f.calls.length, 3);
  f.calls[2].resolve(reply({ items: [row('kept')] })); await fresh;
  f.calls[0].resolve(reply({ items: [row('gone'), row('kept')] })); await old;
  assert.equal(f.service.getCachedReminders().some(item => item._id === 'gone'), false);
});

test('failed shared pagination preserves the last complete cache and can retry', async () => {
  const f = client(); const initial = f.service.getReminders(); f.calls[0].resolve(reply({ items: [row('kept')] })); await initial;
  const a = f.service.getReminders(); const b = f.service.getReminders();
  const failures = Promise.allSettled([a, b]);
  f.calls[1].resolve(reply({ items: [row('partial')], nextCursor: 'next' })); await flush();
  f.calls[2].reject(new Error('offline'));
  assert.ok((await failures).every(result => result.status === 'rejected'));
  assert.equal(f.service.getCachedReminders()[0]._id, 'kept');
  const retry = f.service.getReminders(); assert.equal(f.calls.length, 4);
  f.calls[3].resolve(reply({ items: [row('recovered')] })); await retry;
});

test('single-record reads merge only the same in-flight ID and do not persist stale records', async () => {
  const f = client(); const a = f.service.getReminder('one'); const b = f.service.getReminder('one'); const c = f.service.getReminder('two');
  assert.equal(f.calls.length, 2);
  f.calls[0].resolve(reply({ item: row('one') })); f.calls[1].resolve(reply({ item: row('two') }));
  await Promise.all([a, b, c]);
  const fresh = f.service.getReminder('one'); assert.equal(f.calls.length, 3);
  f.calls[2].resolve(reply({ item: row('one') })); await fresh;
});

test('stats share pending reads, expire after 30 seconds and allow forced retry', async () => {
  const f = client(); const a = f.service.getReminderStats(); const b = f.service.getReminderStats();
  assert.equal(f.calls.length, 1); assert.equal(f.calls[0].data.includeLegacyCompleted, false);
  f.calls[0].resolve(reply(stats())); await Promise.all([a, b]);
  await f.service.getReminderStats(); assert.equal(f.calls.length, 1);
  f.state.now += 30000;
  const expired = f.service.getReminderStats(); assert.equal(f.calls.length, 2);
  f.calls[1].resolve(reply(stats(2, 1))); await expired;
  const forced = f.service.getReminderStats({ force: true }); assert.equal(f.calls.length, 3);
  f.calls[2].resolve(reply(stats(3, 2))); assert.equal((await forced).createdCount, 3);
});

test('all successful mutations invalidate stats immediately, but failed writes do not', async () => {
  for (const action of ['createReminder', 'updateReminder', 'deleteReminder', 'completeReminder']) {
    const f = client(); const initial = f.service.getReminderStats(); f.calls[0].resolve(reply(stats())); await initial;
    const write = action === 'createReminder' ? f.service[action](row('one')) : f.service[action]('one', { title: 'changed' });
    f.calls[1].resolve(reply({ id: 'one', reminderId: 'one' })); await write;
    const updated = f.service.getReminderStats(); assert.equal(f.calls.length, 3, action);
    f.calls[2].resolve(reply(stats(2, 1))); await updated;
  }
  const f = client(); const initial = f.service.getReminderStats(); f.calls[0].resolve(reply(stats())); await initial;
  const failed = f.service.deleteReminder('one'); const rejection = assert.rejects(failed);
  f.calls[1].reject(new Error('offline')); await rejection;
  await f.service.getReminderStats(); assert.equal(f.calls.length, 2);
});

test('stats from before a confirmed write must join or start a new-generation read', async () => {
  const f = client(); const old = f.service.getReminderStats();
  const write = f.service.createReminder(row('one')); f.calls[1].resolve(reply({ reminderId: 'one' })); await write;
  const fresh = f.service.getReminderStats();
  f.calls[0].resolve(reply(stats(0))); await flush();
  assert.equal(f.calls.length, 3);
  f.calls[2].resolve(reply(stats(1))); assert.equal((await old).createdCount, 1); await fresh;
  await f.service.getReminderStats(); assert.equal(f.calls.length, 3);
});

test('older forced stats cannot overwrite newer results; failures and malformed results are retryable', async () => {
  const f = client(); const old = f.service.getReminderStats(); const fresh = f.service.getReminderStats({ force: true });
  f.calls[1].resolve(reply(stats(2))); await fresh;
  f.calls[0].resolve(reply(stats(1))); assert.equal((await old).createdCount, 2);
  f.state.now += 30000;
  const failed = f.service.getReminderStats(); const rejection = assert.rejects(failed); f.calls[2].reject(new Error('offline')); await rejection;
  const malformed = f.service.getReminderStats(); const invalid = assert.rejects(malformed);
  f.calls[3].resolve(reply({ createdCount: -1, remindedCount: 0 })); await invalid;
  const retry = f.service.getReminderStats(); f.calls[4].resolve(reply(stats(3))); await retry;
});

test('new stats use two counts, while old clients still receive the legacy completed count', async () => {
  const f = fixture();
  f.rows.reminders.push({ ...row('sent'), _openid: 'owner', notifyStatus: 'sent' }, { ...row('legacy'), _openid: 'owner', status: 'completed' }, { ...row('foreign'), _openid: 'other' });
  const get = f.load('getReminders'); const modern = await get({ mode: 'stats', includeLegacyCompleted: false });
  assert.equal(f.state.countCalls, 2); assert.equal(modern.data.createdCount, 2); assert.equal(modern.data.remindedCount, 1);
  assert.equal('completedCount' in modern.data, false);
  const legacy = await get({ mode: 'stats' }); assert.equal(f.state.countCalls, 5); assert.equal(legacy.data.completedCount, 1);
});

test('editing detail does not refresh before return; onShow refreshes exactly once', async () => {
  let definition; let navigation; let reloads = 0;
  const filename = path.join(__dirname, '../miniprogram/pages/detail/detail.js'); const localRequire = createRequire(filename);
  vm.runInNewContext(read('miniprogram/pages/detail/detail.js'), { Page: value => { definition = value; }, require: id => id === '../../services/reminder' ? {} : localRequire(id), wx: { navigateTo: args => { navigation = args; } }, setTimeout });
  const page = { ...definition, data: { reminder: row('one'), detailLoading: false }, setData(patch) { Object.assign(this.data, patch); }, onLoad() { reloads++; } };
  page.onEdit(); assert.ok(navigation.url.includes('id=one')); assert.equal(navigation.events, undefined); assert.equal(reloads, 0);
  page.onShow(); assert.equal(reloads, 1);
  for (const ext of ['js', 'ts']) assert.doesNotMatch(read(`miniprogram/pages/detail/detail.${ext}`), /events:\s*\{\s*updated:/);
});

test('mine manual retry bypasses cache and older responses cannot undo a newer error', async () => {
  let definition; const requests = [];
  vm.runInNewContext(read('miniprogram/pages/mine/mine.js'), { Page: value => { definition = value; }, require: () => ({ getReminderStats: options => new Promise((resolve, reject) => requests.push({ options, resolve, reject })) }) });
  const page = { ...definition, data: { ...definition.data }, setData(patch) { Object.assign(this.data, patch); } };
  const old = page.loadStats(); const retry = page.loadStats({ type: 'tap' });
  assert.equal(requests[0].options.force, false); assert.equal(requests[1].options.force, true);
  requests[1].reject(new Error('offline')); await retry;
  requests[0].resolve(stats()); await old;
  assert.equal(page.data.statsError, true);
});
