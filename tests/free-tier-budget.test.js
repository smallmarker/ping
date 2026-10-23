const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture } = require('./lib/cloud-mock');
const timer = { Type: 'timer', TriggerName: 'pingReminderEveryMinute' };
const cleanupTimer = { Type: 'timer', TriggerName: 'pingFeedbackRetentionDaily' };
const due = id => ({ _id: id, _openid: 'owner', title: '吃饭', remindAt: new Date(), notifyAt: new Date(Date.now() - 1000), status: 'pending', notifyStatus: 'authorized', notifyAttemptCount: 0, revision: 0 });
process.env.SUBSCRIBE_TEMPLATE_ID = 'test-only-template';

test('free tier sends at most one item and uses one read/two conditional writes per invocation', async () => {
  const f = fixture(); f.rows.reminders.push(due('first'), due('second'), due('third'));
  const send = f.load('sendReminder');
  assert.equal((await send(timer)).data.sent, 1);
  assert.equal(f.sent.length, 1); assert.equal(f.rows.reminders[1].notifyStatus, 'authorized');
  assert.deepEqual(f.state.calls, { get: 1, update: 2, remove: 0 });
  await send(timer); assert.equal(f.sent.length, 2); assert.equal(f.rows.reminders[2].notifyStatus, 'authorized');
});

test('slow initial read defers without claiming a reminder or requesting a message', async () => {
  const f = fixture(); f.state.now = Date.now(); f.rows.reminders.push(due('slow'));
  f.state.beforeGet = async () => { f.state.now += 1500; };
  const result = await f.load('sendReminder')(timer);
  assert.equal(result.data.deferred, 1); assert.equal(f.sent.length, 0);
  assert.equal(f.rows.reminders[0].notifyStatus, 'authorized'); assert.equal(f.state.calls.update, 0);
});

test('slow claim returns an undispatched item safely to the next tick', async () => {
  const f = fixture(); f.state.now = Date.now(); f.rows.reminders.push(due('slow-claim'));
  f.state.beforeUpdate = async (_, __, patch) => { if (patch.notifyStatus === 'sending') f.state.now += 1500; };
  const result = await f.load('sendReminder')(timer);
  assert.equal(result.data.deferred, 1); assert.equal(f.sent.length, 0);
  assert.equal(f.rows.reminders[0].notifyStatus, 'authorized'); assert.equal(f.rows.reminders[0].notifyLockToken, undefined);
});

test('concurrent timer ticks cannot dispatch the same reminder twice', async () => {
  const f = fixture(); f.rows.reminders.push(due('one'));
  await Promise.all([f.load('sendReminder')(timer), f.load('sendReminder')(timer)]);
  assert.equal(f.sent.length, 1); assert.equal(f.rows.reminders[0].notifyStatus, 'sent');
});

test('deletion before atomic dispatch prevents a stale query from sending a message', async () => {
  const f = fixture(); f.rows.reminders.push(due('deleted-before-claim'));
  f.state.beforeUpdate = async (_, __, patch) => {
    if (patch.notifyStatus === 'sending') await f.load('deleteReminder')({ id: 'deleted-before-claim' });
  };
  const response = await f.load('sendReminder')(timer);
  assert.equal(response.data.skipped, 1); assert.equal(f.sent.length, 0);
  assert.equal(f.rows.reminders[0].status, 'deleted'); assert.equal(f.rows.reminders[0].title, undefined);
});

test('a never-returning message call is recorded as unknown within the soft budget, never resent', async () => {
  const f = fixture(); f.rows.reminders.push(due('timeout')); f.state.send = () => new Promise(() => {});
  const started = Date.now(); const send = f.load('sendReminder'); const result = await send(timer);
  assert.ok(Date.now() - started < 2700, 'leave headroom before platform hard timeout');
  assert.equal(result.data.uncertain, 1); assert.equal(f.rows.reminders[0].notifyStatus, 'unknown');
  await send(timer); assert.equal(f.sent.length, 1);
});

test('cleanup uses two DB operations, removes at most ten expired new rows and retains old history', async () => {
  const f = fixture(); for (let i = 0; i < 25; i++) f.rows.feedback.push({ _id: 'expired-' + i, expiresAt: new Date(0), content: '到期新反馈' });
  f.rows.feedback.push({ _id: 'legacy', content: '保留历史', createdAt: new Date(0) });
  f.rows.feedback.push({ _id: 'future', expiresAt: new Date(Date.now() + 100000), content: '未到期' });
  const result = await f.load('privacyMaintenance')(cleanupTimer);
  assert.equal(result.data.removed, 10); assert.equal(result.data.batchFull, true);
  assert.deepEqual(f.state.calls, { get: 1, update: 0, remove: 1 });
  assert.ok(f.rows.feedback.some(row => row._id === 'legacy')); assert.ok(f.rows.feedback.some(row => row._id === 'future'));
});

test('cleanup respects elapsed budget and rechecks expiry when deleting', async () => {
  const slow = fixture(); slow.state.now = Date.now(); slow.rows.feedback.push({ _id: 'expire', expiresAt: new Date(0) });
  slow.state.beforeGet = async () => { slow.state.now += 1700; };
  assert.equal((await slow.load('privacyMaintenance')(cleanupTimer)).data.deferred, true);
  assert.equal(slow.state.calls.remove, 0); assert.equal(slow.rows.feedback.length, 1);
  const f = fixture(); f.rows.feedback.push({ _id: 'changed', expiresAt: new Date(0) });
  f.state.beforeRemove = async () => { f.rows.feedback[0].expiresAt = new Date(Date.now() + 100000); };
  assert.equal((await f.load('privacyMaintenance')(cleanupTimer)).data.removed, 0);
  assert.equal(f.rows.feedback.length, 1);
});
