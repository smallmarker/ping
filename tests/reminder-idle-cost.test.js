const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture } = require('./lib/cloud-mock');
const timer = { Type: 'timer', TriggerName: 'pingReminderEveryMinute' };
const start = Date.parse('2026-11-06T00:00:00Z');
process.env.SUBSCRIBE_TEMPLATE_ID = 'test-only-template';
const pending = (id, now, extra = {}) => ({ _id: id, _openid: 'owner', title: '测试事项', remindAt: new Date(now), notifyAt: new Date(now - 1000), status: 'pending', notifyStatus: 'authorized', notifyAttemptCount: 0, revision: 0, ...extra });

test('24 hours of idle cold starts use 1728 reads and only 24 application health logs', async () => {
  const f = fixture();
  for (let minute = 0; minute < 1440; minute++) {
    // 每次重新加载函数，证明优化不是只对热实例有效。
    f.state.now = start + minute * 60000 + 1200;
    const result = await f.load('sendReminder')(timer);
    assert.equal(result.code, 0);
    assert.equal(result.data.sent, 0);
  }
  assert.equal(f.state.calls.get, 1440 + 288);
  assert.equal(f.state.calls.update, 0);
  assert.equal(f.sent.length, 0);
  assert.equal(f.state.logs.length, 24);
  assert.ok(f.state.logs.every(log => log.level === 'info'));
});

test('a newly created reminder is sent on the next ordinary minute without idle caching', async () => {
  const f = fixture(); f.state.now = start + 60000; const send = f.load('sendReminder');
  await send(timer);
  assert.equal(f.state.calls.get, 1);
  f.state.now += 60000;
  f.rows.reminders.push(pending('new', f.state.now));
  assert.equal((await send(timer)).data.sent, 1);
  assert.equal(f.sent.length, 1);
  assert.equal(f.state.calls.get, 2);
  assert.equal(f.state.calls.update, 2);
  assert.equal(f.state.logs.length, 1);
  assert.ok(!JSON.stringify(f.state.logs).includes('测试事项'));
});

test('maintenance waits for its slot, expires missed rows and never blindly retries dispatches', async () => {
  const f = fixture(); f.state.now = start + 4 * 60000; const send = f.load('sendReminder');
  f.rows.reminders.push(pending('uncertain', f.state.now, { notifyStatus: 'sending', notifyPhase: 'dispatching', notifyLockAt: new Date(start), notifyLockToken: 'lease' }));
  f.rows.reminders.push(pending('expired', start - 600000));
  await send(timer);
  assert.equal(f.rows.reminders[0].notifyStatus, 'sending');
  assert.equal(f.state.calls.get, 1);
  f.state.now += 60000;
  assert.equal((await send(timer)).data.recovered, 1);
  assert.equal(f.rows.reminders[0].notifyStatus, 'unknown');
  f.state.now += 5 * 60000;
  assert.equal((await send(timer)).data.missed, 1);
  assert.equal(f.rows.reminders[1].notifyStatus, 'missed');
  assert.equal(f.sent.length, 0);
  assert.equal(f.state.logs.length, 2);
});

test('due reminders take precedence over maintenance even on a maintenance minute', async () => {
  const f = fixture(); f.state.now = start;
  f.rows.reminders.push(pending('due', start), pending('stale', start - 600000));
  assert.equal((await f.load('sendReminder')(timer)).data.sent, 1);
  assert.equal(f.state.calls.get, 1);
  assert.equal(f.rows.reminders[1].notifyStatus, 'authorized');
});

test('slow idle maintenance is deferred and database failures remain logged', async () => {
  const slow = fixture(); slow.state.now = start;
  slow.state.beforeGet = async () => { slow.state.now += 1500; };
  assert.equal((await slow.load('sendReminder')(timer)).data.deferred, 1);
  assert.equal(slow.state.calls.get, 1);
  assert.equal(slow.state.logs.length, 1);
  const failed = fixture(); failed.state.now = start + 60000;
  failed.state.beforeGet = async () => { throw { errCode: 'DB_UNAVAILABLE' }; };
  assert.equal((await failed.load('sendReminder')(timer)).code, 'DATABASE_ERROR');
  assert.equal(failed.state.logs[0].level, 'error');
});

test('delayed recovery cannot revive expired legacy claims or resend deleted/ambiguous rows', async () => {
  const f = fixture(); f.state.now = start + 10 * 60000;
  f.rows.reminders.push(pending('legacy', start, { notifyStatus: 'sending', notifyPhase: 'claimed', notifyLockAt: new Date(start), notifyLockToken: 'old' }));
  f.rows.reminders.push(pending('deleted', start, { status: 'deleted', notifyStatus: 'cancelled' }));
  const send = f.load('sendReminder');
  assert.equal((await send(timer)).data.missed, 1);
  assert.equal(f.rows.reminders[0].notifyStatus, 'missed');
  f.state.now += 60000;
  await send(timer);
  assert.equal(f.sent.length, 0);
  assert.equal(f.rows.reminders[1].notifyStatus, 'cancelled');
});
