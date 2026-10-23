const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { fixture } = require('./lib/cloud-mock');
const timer = { Type: 'timer', TriggerName: 'pingReminderEveryMinute' };
const draft = () => ({ title: '吃饭', remindAt: new Date(Date.now() + 3600000).toISOString(), remindOffsetMinutes: 0, notifyStatus: 'authorized' });
const due = (extra = {}) => ({ _id: 'due', _openid: 'owner', title: '吃饭', remindAt: new Date(), remindOffsetMinutes: 0, notifyAt: new Date(Date.now() - 30000), status: 'pending', notifyStatus: 'authorized', notifyAttemptCount: 0, revision: 0, ...extra });

test('same request across concurrent instances inserts exactly one record; changed payload conflicts', async () => {
  const f = fixture(); const input = { clientRequestId: 'retry', reminder: draft() };
  const results = await Promise.all([f.load('createReminder')(input), f.load('createReminder')(input)]);
  assert.ok(results.every(result => result.code === 0)); assert.equal(f.rows.reminders.length, 1);
  assert.equal(results[0].data.reminderId, results[1].data.reminderId);
  assert.equal((await f.load('createReminder')({ ...input, reminder: { ...input.reminder, title: '喝水' } })).code, 'IDEMPOTENCY_CONFLICT');
  f.rows.reminders[0].remindAt = new Date(0);
  assert.equal((await f.load('createReminder')(input)).data.reminder.remindAt.getTime(), 0, 'retry returns saved canonical row, not a new draft');
});

test('stable cursor traverses 121 equal-time records, stats are not page-limited, foreign ID blocked', async () => {
  const f = fixture(); const get = f.load('getReminders');
  for (let i = 0; i < 121; i++) f.rows.reminders.push(due({ _id: `r-${String(i).padStart(3, '0')}`, createdAt: new Date('2026-01-01'), status: i === 0 ? 'completed' : 'pending' }));
  f.rows.reminders.push(due({ _id: 'foreign', _openid: 'someone-else' }));
  let cursor; const ids = [];
  do { const response = await get({ sort: 'createdAtDesc', cursor }); assert.equal(response.code, 0); ids.push(...response.data.items.map(item => item._id)); cursor = response.data.nextCursor; } while (cursor);
  assert.equal(ids.length, 121); assert.equal(new Set(ids).size, 121); assert.equal(ids[0], 'r-120');
  assert.equal((await get({ id: 'r-000' })).code, 0); assert.equal((await get({ id: 'foreign' })).code, 'NOT_FOUND');
  assert.deepEqual(JSON.parse(JSON.stringify((await get({ mode: 'stats' })).data)), { createdCount: 121, completedCount: 1, remindedCount: 0 });
  const first = await get({ sort: 'createdAtDesc' }); assert.equal((await get({ cursor: first.data.nextCursor, sort: 'remindAtAsc' })).code, 'VALIDATION_ERROR');
  assert.equal((await get({ cursor: 'bad-cursor' })).code, 'VALIDATION_ERROR');
});

test('delete wins concurrent completion and edit, clears content, and never touches another owner', async () => {
  const f = fixture(); const remove = f.load('deleteReminder'); const complete = f.load('completeReminder'); const update = f.load('updateReminder');
  f.rows.reminders.push(due({ note: '私密备注', location: '私密地址', text: '私密原句', requestFingerprint: 'sensitive-hash' }));
  await Promise.all([remove({ id: 'due' }), complete({ id: 'due' }), update({ id: 'due', reminder: { title: '新标题' } })]);
  const row = f.rows.reminders[0]; assert.equal(row.status, 'deleted');
  for (const key of ['title', 'note', 'location', 'text', 'requestFingerprint']) assert.equal(row[key], undefined);
  assert.equal((await update({ id: 'due', reminder: { title: '复活' } })).code, 'NOT_FOUND');
  f.rows.reminders.push(due({ _id: 'foreign', _openid: 'foreign' }));
  for (const action of [remove, complete, update]) assert.equal((await action({ id: 'foreign', reminder: { title: '不能修改' } })).code, 'NOT_FOUND');
});

test('explicit notification denial overrides previous authorization', async () => {
  const f = fixture(); f.rows.reminders.push(due({ remindAt: new Date(Date.now() + 3600000) }));
  assert.equal((await f.load('updateReminder')({ id: 'due', reminder: { notifyStatus: 'denied' } })).code, 0);
  assert.equal(f.rows.reminders[0].notifyStatus, 'denied');
});

test('lease recovery retries only undispatched claims; ambiguous sends never duplicate', async () => {
  process.env.SUBSCRIBE_TEMPLATE_ID = 'test-template';
  const f = fixture(); const send = f.load('sendReminder');
  f.rows.reminders.push(due({ _id: 'claim', notifyStatus: 'sending', notifyPhase: 'claimed', notifyLockAt: new Date(Date.now() - 180000), notifyLockToken: 'a' }));
  f.rows.reminders.push(due({ _id: 'dispatch', notifyStatus: 'sending', notifyPhase: 'dispatching', notifyLockAt: new Date(Date.now() - 180000), notifyLockToken: 'b' }));
  assert.equal((await send(timer)).data.recovered, 1); assert.equal(f.sent.length, 0);
  assert.equal((await send(timer)).data.sent, 1);
  assert.equal((await send(timer)).data.recovered, 1); assert.equal(f.rows.reminders[1].notifyStatus, 'unknown');
  await send(timer); assert.equal(f.sent.length, 1);
});

test('successful send followed by DB write failure is not blindly resent', async () => {
  process.env.SUBSCRIBE_TEMPLATE_ID = 'test-template'; const f = fixture(); f.rows.reminders.push(due()); const send = f.load('sendReminder');
  f.state.beforeUpdate = async (_, __, patch) => { if (patch.notifyStatus === 'sent') throw new Error('DB unavailable after external success'); };
  assert.equal((await send(timer)).data.uncertain, 1); assert.equal(f.sent.length, 1);
  f.state.beforeUpdate = null; f.rows.reminders[0].notifyLockAt = new Date(Date.now() - 180000);
  await send(timer); assert.equal(f.sent.length, 1); assert.equal(f.rows.reminders[0].notifyStatus, 'unknown');
});

test('explicit rate limits retry; network ambiguity and permanently denied messages do not', async () => {
  process.env.SUBSCRIBE_TEMPLATE_ID = 'test-template';
  for (const [error, expected] of [[{ errCode: 45009 }, 'authorized'], [{ message: 'network timeout' }, 'unknown'], [{ errCode: 43101 }, 'failed']]) {
    const f = fixture(); f.rows.reminders.push(due()); f.state.send = async () => { throw error; };
    const send = f.load('sendReminder'); await send(timer); assert.equal(f.rows.reminders[0].notifyStatus, expected);
    if (expected !== 'authorized') { await send(timer); assert.equal(f.sent.length, 1); }
  }
});

test('feedback retention purges only new expired rows; rejects forged triggers and keeps history', async () => {
  const f = fixture(); const cleanup = f.load('privacyMaintenance'); const submit = f.load('submitFeedback'); const before = Date.now();
  assert.equal((await submit({ content: '建议' })).code, 0);
  assert.ok(f.rows.feedback[0].expiresAt.getTime() >= before + 180 * 86400000);
  f.rows.feedback.push({ _id: 'old-history', content: '不得自动删除', createdAt: new Date(0) });
  f.rows.feedback.push({ _id: 'expired', expiresAt: new Date(0), content: '到期新数据' });
  f.rows.reminders.push(due({ title: '历史事项不清理' }));
  const event = { Type: 'timer', TriggerName: 'pingFeedbackRetentionDaily' };
  f.state.source = 'wx_client'; assert.equal((await cleanup(event)).code, 'FORBIDDEN');
  f.state.source = 'wx_trigger'; const result = await cleanup(event); assert.equal(result.data.removed, 1);
  assert.ok(f.rows.feedback.some(row => row._id === 'old-history')); assert.equal(f.rows.reminders[0].title, '历史事项不清理');
});

test('privacy route and real operator are reachable; optional blank agreement remains removed', () => {
  const read = file => fs.readFileSync(path.join(__dirname, '../', file), 'utf8');
  assert.ok(JSON.parse(read('miniprogram/app.json')).pages.includes('pages/privacy/privacy'));
  assert.match(read('miniprogram/pages/mine/mine.wxml'), /bindtap="goPrivacy"/);
  assert.match(read('miniprogram/pages/privacy/privacy.wxml'), /张龙/); assert.match(read('miniprogram/pages/privacy/privacy.wxml'), /smallmarker/);
  assert.doesNotMatch(read('miniprogram/pages/mine/mine.wxml'), /用户协议/);
  for (const extension of ['js', 'ts']) assert.match(read(`miniprogram/app.${extension}`), /traceUser: false/);
});
