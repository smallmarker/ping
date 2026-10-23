const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const { fixture } = require('./lib/cloud-mock');
const { isActiveReminder, isReminderHistory, reminderState } = require('../miniprogram/utils/reminder-state');
const row = extra => ({ _id: 'r', _openid: 'owner', title: '吃饭', status: 'pending', notifyStatus: 'authorized', notifyAttemptCount: 0, remindAt: new Date(Date.now() - 30000), notifyAt: new Date(Date.now() - 30000), createdAt: new Date(), revision: 0, ...extra });
const timer = { Type: 'timer', TriggerName: 'pingReminderEveryMinute' };

test('only a confirmed send or legacy completion enters history; elapsed time is not success', () => {
  for (const status of ['pending', 'authorized', 'denied', 'sending', 'failed', 'missed', 'unknown', 'cancelled', undefined]) {
    const item = row({ notifyStatus: status });
    assert.equal(isActiveReminder(item), true, status);
    assert.equal(isReminderHistory(item), false, status);
    assert.notEqual(reminderState(item).label, '已提醒', status);
  }
  assert.equal(reminderState(row({ notifyStatus: 'authorized' })).label, '待提醒');
  assert.equal(isReminderHistory(row({ notifyStatus: 'sent' })), true);
  assert.equal(isActiveReminder(row({ notifyStatus: 'sent' })), false);
  const legacy = row({ status: 'completed', notifyStatus: 'denied', completedAt: new Date().toISOString() });
  assert.equal(isReminderHistory(legacy), true);
  assert.equal(reminderState(legacy).label, '历史已完成');
  assert.equal(reminderState(legacy).time, legacy.completedAt);
  for (const status of ['sent', 'authorized']) { assert.equal(isReminderHistory(row({ status: 'deleted', notifyStatus: status })), false); assert.equal(isActiveReminder(row({ status: 'deleted', notifyStatus: status })), false); }
});

test('sending success automatically archives without marking the user task completed', async () => {
  process.env.SUBSCRIBE_TEMPLATE_ID = 'test-template';
  const f = fixture(); f.rows.reminders.push(row());
  assert.equal((await f.load('sendReminder')(timer)).data.sent, 1);
  const saved = (await f.load('getReminders')({ id: 'r' })).data.item;
  assert.equal(saved.status, 'pending');
  assert.equal(saved.notifyStatus, 'sent');
  assert.equal(saved.completedAt, undefined);
  assert.equal(isReminderHistory(saved), true);
  assert.equal(reminderState(saved).label, '已提醒');
  assert.ok(saved.sentAt);
});

test('failed and ambiguous dispatch stay actionable, not archived', async () => {
  process.env.SUBSCRIBE_TEMPLATE_ID = 'test-template';
  for (const error of [{ errCode: 43101 }, { message: 'network timeout' }]) {
    const f = fixture(); f.rows.reminders.push(row()); f.state.send = async () => { throw error; };
    await f.load('sendReminder')(timer);
    assert.equal(isReminderHistory(f.rows.reminders[0]), false);
    assert.equal(isActiveReminder(f.rows.reminders[0]), true);
  }
});

test('notified statistics exclude foreign, deleted, failed and merely completed records', async () => {
  const f = fixture();
  f.rows.reminders.push(row({ _id: 'sent', notifyStatus: 'sent' }), row({ _id: 'legacy', status: 'completed', notifyStatus: 'denied' }), row({ _id: 'failed', notifyStatus: 'failed' }), row({ _id: 'removed', status: 'deleted', notifyStatus: 'sent' }), row({ _id: 'other', _openid: 'other', notifyStatus: 'sent' }));
  const response = await f.load('getReminders')({ mode: 'stats' });
  assert.equal(response.data.remindedCount, 1);
  assert.equal(response.data.completedCount, 1, 'old clients retain their original meaning');
});

const pageContext = (file, items, selected) => {
  const old = { load: Module._load, Page: global.Page, wx: global.wx };
  let page;
  Module._load = function(request, parent, main) {
    if (request === '../../services/reminder') return { getReminders: async () => items, getReminder: async () => selected, reconcileReminders: value => value, getCachedReminders: () => null };
    return old.load.call(this, request, parent, main);
  };
  global.Page = value => { page = value; };
  global.wx = { getWindowInfo: () => ({ statusBarHeight: 20 }), getMenuButtonBoundingClientRect: () => ({ top: 30, height: 32, bottom: 62 }), showToast() {} };
  delete require.cache[require.resolve(file)]; require(file); Module._load = old.load; global.Page = old.Page;
  return { context: { ...page, data: { ...page.data }, setData(value, cb) { Object.assign(this.data, value); if (cb) cb(); } }, restore() { global.wx = old.wx; } };
};

test('home and history show matching counts, exclude failures from history and preserve old rows', async () => {
  const items = [row({ _id: 'sent', notifyStatus: 'sent', sentAt: '2026-10-14T12:00:00Z' }), row({ _id: 'legacy', status: 'completed', completedAt: '2026-10-13T12:00:00Z' }), row({ _id: 'failed', notifyStatus: 'failed' })];
  const home = pageContext('../miniprogram/pages/index/index', items);
  try { home.context.applyReminders(items); assert.equal(home.context.data.historyCount, 2); assert.deepEqual(home.context.data.reminderGroups.flatMap(group => group.reminders.map(item => item._id)), ['failed']); assert.match(home.context.data.reminderGroups[0].reminders[0].displayMeta, /发送失败/); } finally { home.restore(); }
  const history = pageContext('../miniprogram/pages/completed/completed', items);
  try { await history.context.loadReminders(); assert.deepEqual(history.context.data.reminders.map(item => [item._id, item.stateLabel]), [['sent', '已提醒'], ['legacy', '历史已完成']]); } finally { history.restore(); }
});

test('detail refreshes the current page on return and handles a send finishing during list load', async () => {
  const sent = row({ notifyStatus: 'sent' });
  const f = pageContext('../miniprogram/pages/detail/detail', [sent], row());
  try {
    await f.context.onLoad({ scope: 'active', id: 'r' });
    assert.equal(f.context.data.stateLabel, '已提醒', 'latest list result overrides the earlier selected-row snapshot');
    const requested = []; f.context.onLoad = query => requested.push(query.id);
    f.context.data.reminder = row({ _id: 'current-page' });
    f.context.onShow(); assert.deepEqual(requested, ['current-page']);
    assert.equal(f.context.onComplete, undefined);
  } finally { f.restore(); }
});

test('detail status is read-only, and history/mine no longer claim tasks were done', () => {
  const read = file => fs.readFileSync(require.resolve(file), 'utf8');
  const detail = read('../miniprogram/pages/detail/detail.wxml');
  assert.doesNotMatch(detail, /onComplete|complete-button|标记完成/);
  assert.match(detail, /stateLabel/);
  assert.match(read('../miniprogram/pages/completed/completed.wxml'), /提醒记录/);
  assert.match(read('../miniprogram/pages/mine/mine.wxml'), /remindedCount/);
  assert.doesNotMatch(read('../miniprogram/pages/mine/mine.wxml'), /已完成/);
});

test('editing an already notified item resets the draft; legacy completion cannot consume authorization', () => {
  const f = pageContext('../miniprogram/pages/reminder-edit/reminder-edit', []);
  try {
    f.context.data.reminder = row({ notifyStatus: 'sent' });
    f.context.data.date = '2099-01-01'; f.context.data.time = '12:00'; f.context.data.editingId = 'r';
    assert.equal(f.context.buildReminder().notifyStatus, 'pending', 'a past sent flag is not reused as new permission');
    f.context.data.reminder.status = 'completed'; f.context.validate();
    assert.equal(f.context.data.isComplete, false);
    assert.match(f.context.data.warning, /仅供查看或删除/);
  } finally { f.restore(); }
});
