/* Local contract tests for CloudBase functions. No cloud environment or AppID required. */
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

const records = { reminders: [], feedback: [] };
let id = 0;
const serverDate = () => new Date('2099-01-01T00:00:00.000Z');
const command = {
  and: (conditions) => ({ op: 'and', conditions }),
  or: (conditions) => ({ op: 'or', conditions }),
  gte: (value) => ({ op: 'gte', value }),
  neq: (value) => ({ op: 'neq', value }),
  lte: (value) => ({ op: 'lte', value }),
  lt: (value) => ({ op: 'lt', value }),
  exists: (value) => ({ op: 'exists', value }),
  remove: () => ({ op: 'remove' })
};
const matchesCondition = (actual, expected) => {
  if (!expected || !expected.op) return actual === expected;
  if (expected.op === 'and') return expected.conditions.every((condition) => matchesCondition(actual, condition));
  if (expected.op === 'neq') return actual !== expected.value;
  if (expected.op === 'exists') return (actual !== undefined) === expected.value;
  if (expected.op === 'gte') return new Date(actual).getTime() >= new Date(expected.value).getTime();
  if (expected.op === 'lte') return new Date(actual).getTime() <= new Date(expected.value).getTime();
  if (expected.op === 'lt') return Number(actual) < Number(expected.value);
  return false;
};
const matches = (record, query) => query.op === 'or' ? query.conditions.some(item => matches(record, item)) : Object.entries(query).every(([key, expected]) => matchesCondition(record[key], expected));
const apply = (record, patch) => Object.entries(patch).forEach(([key, value]) => {
  if (value?.op === 'remove') delete record[key]; else record[key] = value;
});
const collection = (name) => ({
  where(query) {
    let list = records[name].filter((item) => matches(item, query));
    const chain = {
      limit(count) { list = list.slice(0, count); return chain; },
      orderBy(field, direction) { list.sort((a, b) => (new Date(a[field]).getTime() - new Date(b[field]).getTime()) * (direction === 'desc' ? -1 : 1)); return chain; },
      async get() { return { data: list.map((item) => ({ ...item })) }; },
      async update({ data }) { const current = records[name].filter((item) => matches(item, query)); current.forEach((item) => apply(item, data)); return { stats: { updated: current.length } }; }
    };
    return chain;
  },
  async add({ data }) { const _id = data._id || `id-${++id}`; if (records[name].some(row => row._id === _id)) throw new Error('duplicate document ID'); records[name].push({ ...data, _id }); return { _id }; },
  doc(_id) { return { async update({ data }) { const item = records[name].find((row) => row._id === _id); if (!item) throw new Error('not found'); apply(item, data); return { stats: { updated: 1 } }; } }; }
});
const sentMessages = [];
const cloud = {
  DYNAMIC_CURRENT_ENV: 'local', init() {}, database: () => ({ collection, createCollection: async () => ({}), serverDate, command }),
  getWXContext: () => ({ OPENID: 'local-openid', SOURCE: process.env.TEST_WX_SOURCE }),
  openapi: { subscribeMessage: { send: async (message) => { sentMessages.push(message); } } }
};
const originalLoad = Module._load;
Module._load = (request, parent, isMain) => request === 'wx-server-sdk' ? cloud : originalLoad(request, parent, isMain);
const load = (name) => {
  const filename = path.join(__dirname, '..', 'cloudfunctions', name, 'index.js');
  delete require.cache[require.resolve(filename)];
  return require(filename).main;
};
const future = '2099-12-31T09:00:00.000Z';
const run = async (name, fn) => {
  try { await fn(); console.log(`PASS ${name}`); return true; }
  catch (error) { console.error(`FAIL ${name}: ${error.stack}`); return false; }
};

(async () => {
  const parse = load('parseReminder');
  const create = load('createReminder'); const get = load('getReminders'); const update = load('updateReminder');
  const complete = load('completeReminder'); const remove = load('deleteReminder'); const feedback = load('submitFeedback'); const send = load('sendReminder');
  const cases = [
    ['PARSE-01 recognises relative date and afternoon time', async () => {
      const value = await parse({ text: '明天下午3点提醒我去拿快递', currentTime: '2026-09-08T02:00:00.000Z', timezone: 'Asia/Shanghai', sourceType: 'text' });
      assert.equal(value.code, 0); assert.equal(value.data.title, '去拿快递'); assert.equal(value.data.remindAt, '2026-09-09T07:00:00.000Z');
    }],
    ['PARSE-02 asks for manual completion without time', async () => { const value = await parse({ text: '明天去拿快递' }); assert.equal(value.code, 0); assert.deepEqual(value.data.missingFields, ['date', 'time']); }],
    ['PARSE-03 rejects unsupported timezone', async () => { const value = await parse({ text: '明天3点提醒我', timezone: 'UTC' }); assert.equal(value.code, 'VALIDATION_ERROR'); }],
    ['PARSE-04 recognises 24-hour colon times and removes time from title', async () => {
      for (const text of ['17:20 提醒我吃饭', '17：20 提醒我吃饭', '提醒我17:20吃饭']) {
        const value = await parse({ text, currentTime: '2026-10-12T02:00:00Z' });
        assert.equal(value.data.remindAt, '2026-10-12T09:20:00.000Z');
        assert.equal(value.data.title, '吃饭');
        assert.equal(value.data.timePrecision, 'minute');
      }
    }],
    ['PARSE-05 preserves explicit tomorrow for colon times', async () => {
      const value = await parse({ text: '明天 03:00 提醒我吃饭', currentTime: '2026-10-12T02:00:00Z' });
      assert.equal(value.data.remindAt, '2026-10-12T19:00:00.000Z');
    }],
    ['PARSE-06 rejects invalid clock values and partial digit matches', async () => {
      for (const text of ['25:20 提醒我吃饭', '17:60 提醒我吃饭', '117:20 提醒我吃饭', '17:200 提醒我吃饭']) {
        assert.equal((await parse({ text })).data.remindAt, null);
      }
    }],
    ['PARSE-07 uses tomorrow for a past clock time without a date', async () => {
      const value = await parse({ text: '17:20 提醒我吃饭', currentTime: '2026-10-12T10:00:00Z' });
      assert.equal(value.data.remindAt, '2026-10-13T09:20:00.000Z');
      assert.ok(value.data.parseWarnings.some(warning => warning.includes('明天')));
    }],
    ['PARSE-08 chooses the nearest future spoken time', async () => {
      const examples = [
        ['等会三点55提醒我吃饭', '2026-10-12T07:50:00Z', '2026-10-12T07:55:00.000Z'],
        ['一会儿三点五十五分提醒我吃饭', '2026-10-12T07:50:00Z', '2026-10-12T07:55:00.000Z'],
        ['待会三点55提醒我吃饭', '2026-10-11T19:50:00Z', '2026-10-11T19:55:00.000Z'],
        ['三点55提醒我吃饭', '2026-10-12T08:00:00Z', '2026-10-12T19:55:00.000Z'],
        ['十二点提醒我吃饭', '2026-10-12T15:50:00Z', '2026-10-12T16:00:00.000Z'],
        ['两点提醒我吃饭', '2026-10-12T05:50:00Z', '2026-10-12T06:00:00.000Z'],
        ['三点半提醒我吃饭', '2026-10-12T07:20:00Z', '2026-10-12T07:30:00.000Z'],
        ['三点一刻提醒我吃饭', '2026-10-12T07:10:00Z', '2026-10-12T07:15:00.000Z'],
        ['三点三刻提醒我吃饭', '2026-10-12T07:40:00Z', '2026-10-12T07:45:00.000Z'],
        ['三点55提醒我吃饭', '2026-10-12T07:55:00Z', '2026-10-12T19:55:00.000Z'],
        ['三点55提醒我吃饭', '2026-12-31T15:59:00Z', '2026-12-31T19:55:00.000Z']
      ];
      for (const [text, currentTime, expected] of examples) {
        const value = await parse({ text, currentTime });
        assert.equal(value.data.remindAt, expected, text);
        assert.equal(value.data.title, '吃饭', text);
        assert.ok(new Date(value.data.remindAt) > new Date(currentTime));
      }
    }],
    ['PARSE-09 respects explicit dates and periods, never returning an expired draft', async () => {
      for (const text of ['今天凌晨三点55提醒我吃饭', '今天17:20提醒我吃饭', '今天上午三点提醒我吃饭']) {
        const value = await parse({ text, currentTime: '2026-10-12T10:00:00Z' });
        assert.equal(value.data.remindAt, null, text);
        assert.ok(value.data.parseWarnings.some(warning => warning.includes('已过去')));
      }
      for (const [text, expected] of [
        ['今天三点55提醒我吃饭', '2026-10-12T07:55:00.000Z'],
        ['明天下午三点55提醒我吃饭', '2026-10-13T07:55:00.000Z'],
        ['明天凌晨三点55提醒我吃饭', '2026-10-12T19:55:00.000Z'],
        ['明早三点55提醒我吃饭', '2026-10-12T19:55:00.000Z'],
        ['今晚八点提醒我吃饭', '2026-10-12T12:00:00.000Z'],
        ['下午3:55提醒我吃饭', '2026-10-12T07:55:00.000Z'],
        ['03:55提醒我吃饭', '2026-10-12T19:55:00.000Z']
      ]) {
        assert.equal((await parse({ text, currentTime: '2026-10-12T07:50:00Z' })).data.remindAt, expected, text);
      }
    }],
    ['PARSE-10 understands relative durations', async () => {
      for (const [text, expected] of [
        ['五分钟后提醒我吃饭', '2026-10-12T07:55:00.000Z'],
        ['两小时后提醒我吃饭', '2026-10-12T09:50:00.000Z'],
        ['半小时后提醒我吃饭', '2026-10-12T08:20:00.000Z'],
        ['过十分钟以后提醒我吃饭', '2026-10-12T08:00:00.000Z']
      ]) {
        const value = await parse({ text, currentTime: '2026-10-12T07:50:00Z' });
        assert.equal(value.data.remindAt, expected, text); assert.equal(value.data.title, '吃饭');
      }
      assert.equal((await parse({ text: '零分钟后提醒我吃饭' })).data.remindAt, null);
      assert.equal((await parse({ text: '2月30日三点提醒我吃饭', currentTime: '2026-10-12T07:50:00Z' })).data.remindAt, null);
    }],
    ['PARSE-11 does not discard unsupported or explicit past dates', async () => {
      for (const text of ['下周三点提醒我吃饭', '每天三点提醒我吃饭', '2025年10月12日三点提醒我吃饭']) {
        assert.equal((await parse({ text, currentTime: '2026-10-12T07:50:00Z' })).data.remindAt, null, text);
      }
      const value = await parse({ text: '2027年10月12日下午三点提醒我吃饭', currentTime: '2026-10-12T07:50:00Z' });
      assert.equal(value.data.remindAt, '2027-10-12T07:00:00.000Z');
      assert.equal(value.data.title, '吃饭');
    }],
    ['CREATE-01 creates a valid future reminder', async () => {
      const value = await create({ clientRequestId: 'request-1', reminder: { title: '拿快递', remindAt: future, remindOffsetMinutes: 15, sourceType: 'text', notifyStatus: 'pending' } });
      assert.equal(value.code, 0); assert.equal(value.data.duplicated, false); assert.equal(records.reminders.length, 1);
    }],
    ['CREATE-02 is idempotent for an unchanged client request ID', async () => { const value = await create({ clientRequestId: 'request-1', reminder: { title: '拿快递', remindAt: future, remindOffsetMinutes: 15, sourceType: 'text', notifyStatus: 'pending' } }); assert.equal(value.code, 0); assert.equal(value.data.duplicated, true); assert.equal(records.reminders.length, 1); }],
    ['CREATE-03 rejects a past notification time', async () => { const value = await create({ reminder: { title: '过期', remindAt: '2020-01-01T00:00:00.000Z' } }); assert.equal(value.code, 'PAST_NOTIFY_AT'); }],
    ['CREATE-04 accepts the 10-minute option from the reminder editor', async () => { const value = await create({ reminder: { title: '十分钟提醒', remindAt: future, remindOffsetMinutes: 10, sourceType: 'text', notifyStatus: 'pending' } }); assert.equal(value.code, 0); assert.equal(records.reminders.at(-1).remindOffsetMinutes, 10); }],
    ['CREATE-05 accepts a 2-hour custom advance reminder', async () => { const value = await create({ reminder: { title: '两小时提醒', remindAt: future, remindOffsetMinutes: 120, sourceType: 'text', notifyStatus: 'pending' } }); assert.equal(value.code, 0); assert.equal(records.reminders.at(-1).remindOffsetMinutes, 120); }],
    ['GET-01 returns the current user records', async () => { const value = await get({ group: 'all', pageSize: 50 }); assert.equal(value.code, 0); assert.equal(value.data.items.length, 3); }],
    ['GET-02 returns newest created reminders before applying the page limit', async () => {
      records.reminders.forEach((item, index) => { item.createdAt = new Date(`2099-01-0${index + 1}T00:00:00.000Z`); });
      const value = await get({ group: 'all', pageSize: 2, sort: 'createdAtDesc' });
      assert.equal(value.code, 0);
      assert.deepEqual(value.data.items.map((item) => item._id), [records.reminders[2]._id, records.reminders[1]._id]);
    }],
    ['UPDATE-01 updates title and offset', async () => { const target = records.reminders[0]; const value = await update({ id: target._id, reminder: { title: '取快递', remindOffsetMinutes: 30 } }); assert.equal(value.code, 0); assert.equal(target.title, '取快递'); assert.equal(target.remindOffsetMinutes, 30); }],
    ['COMPLETE-01 completes a pending reminder', async () => { const target = records.reminders[0]; const value = await complete({ id: target._id }); assert.equal(value.code, 0); assert.equal(value.data.alreadyCompleted, false); assert.equal(target.status, 'completed'); }],
    ['COMPLETE-02 is idempotent', async () => { const value = await complete({ id: records.reminders[0]._id }); assert.equal(value.code, 0); assert.equal(value.data.alreadyCompleted, true); }],
    ['UPDATE-02 rejects edits to completed reminders', async () => { const value = await update({ id: records.reminders[0]._id, reminder: { title: '不应修改' } }); assert.equal(value.code, 'INVALID_STATUS'); }],
    ['DELETE-01 soft-deletes a reminder', async () => { const value = await remove({ id: records.reminders[0]._id }); assert.equal(value.code, 0); assert.equal(records.reminders[0].status, 'deleted'); }],
    ['DELETE-02 is idempotent', async () => { const value = await remove({ id: records.reminders[0]._id }); assert.equal(value.code, 0); assert.equal(value.data.deleted, true); }],
    ['FEEDBACK-01 stores valid feedback', async () => { const value = await feedback({ content: '本地调试测试反馈' }); assert.equal(value.code, 0); assert.equal(records.feedback.length, 1); }],
    ['FEEDBACK-02 rejects empty feedback', async () => { const value = await feedback({ content: ' ' }); assert.equal(value.code, 'VALIDATION_ERROR'); }],
    ['SEND-01 rejects calls without a timer source', async () => { const value = await send({ Type: 'Timer', TriggerName: 'pingReminderEveryMinute' }); assert.equal(value.code, 'FORBIDDEN'); }],
    ['SEND-01b rejects SCF timers and forged client source', async () => { process.env.TRIGGER_SRC = 'timer'; process.env.TEST_WX_SOURCE = 'wx_client'; const value = await send({ Type: 'Timer', TriggerName: 'pingReminderEveryMinute', SOURCE: 'wx_trigger' }); assert.equal(value.code, 'FORBIDDEN'); delete process.env.TRIGGER_SRC; }],
    ['SEND-02 reports missing template configuration', async () => { process.env.TEST_WX_SOURCE = 'wx_trigger'; delete process.env.SUBSCRIBE_TEMPLATE_ID; const value = await send({ Type: 'Timer', TriggerName: 'pingReminderEveryMinute' }); assert.equal(value.code, 'CONFIG_ERROR'); }],
    ['SEND-03 rejects forged trigger names', async () => { process.env.SUBSCRIBE_TEMPLATE_ID = 'local-template-id'; const value = await send({ Type: 'Timer', TriggerName: 'unknown' }); assert.equal(value.code, 'FORBIDDEN'); }],
    ['SEND-03b rejects non-timer events from a trigger', async () => { const value = await send({ Type: 'http', TriggerName: 'pingReminderEveryMinute' }); assert.equal(value.code, 'FORBIDDEN'); }],
    ['SEND-04 sends the approved template fields from a lowercase WeChat timer event', async () => {
      records.reminders.push({ _id: 'stale-reminder', _openid: 'local-openid', title: '过期提醒', remindAt: new Date('2020-01-01T00:00:00.000Z'), notifyAt: new Date('2020-01-01T00:00:00.000Z'), status: 'pending', notifyStatus: 'authorized', notifyAttemptCount: 0 });
      records.reminders.push({ _id: 'due-reminder', _openid: 'local-openid', title: '去医院复查', remindAt: new Date('2026-09-28T07:00:00.000Z'), notifyAt: new Date(Date.now() - 30_000), status: 'pending', notifyStatus: 'authorized', notifyAttemptCount: 0 });
      const value = await send({ Type: 'timer', TriggerName: 'pingReminderEveryMinute' });
      assert.equal(value.code, 0);
      assert.equal(value.data.sent, 1);
      assert.deepEqual(sentMessages.at(-1).data, { thing5: { value: '去医院复查' }, date4: { value: '2026-09-28 15:00' } });
      assert.equal(records.reminders.at(-1).notifyStatus, 'sent');
      assert.equal(records.reminders.at(-2).notifyStatus, 'authorized', 'sending has priority over idle housekeeping');
      const idle = await send({ Type: 'timer', TriggerName: 'pingReminderEveryMinute' });
      assert.equal(records.reminders.at(-2).notifyStatus, 'missed');
      assert.equal(idle.data.missed, 1);
    }]
  ];
  let passed = 0;
  for (const [name, fn] of cases) if (await run(name, fn)) passed += 1;
  console.log(`RESULT ${passed}/${cases.length} passed`);
  if (passed !== cases.length) process.exitCode = 1;
})();
