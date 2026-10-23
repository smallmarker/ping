const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const source = fs.readFileSync(path.join(__dirname, '../miniprogram/pages/confirm/confirm.js'), 'utf8');
function setup() {
  let page; let now = new Date('2026-10-12T07:50:00Z').getTime(); let authorizations = 0;
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
  vm.runInNewContext(source, {
    Page(value) { page = value; }, Date: Clock,
    require(name) { return name.includes('notification') ? { requestNotificationPermission: async () => { authorizations++; } } : { createReminder: async () => {} }; },
    wx: { showToast() {}, switchTab() {} }, getApp: () => ({ globalData: {} })
  });
  page.setData = value => Object.assign(page.data, value);
  return { page, setNow(value) { now = new Date(value).getTime(); }, authorizations: () => authorizations };
}
test('confirmation displays parser warnings, actual fallback reason and parsed offset', () => {
  const { page } = setup();
  page.applyReminder({ title: '吃饭', remindAt: '2026-10-13T07:00:00Z', remindOffsetMinutes: 90, parseWarnings: ['已按下午理解，请确认', '已按明天理解，请确认'] });
  assert.equal(page.data.isComplete, true);
  assert.equal(page.data.offsetLabel, '提前 90 分钟');
  assert.equal(page.data.warning, '已按下午理解，请确认\n已按明天理解，请确认');
  page.applyReminder({ title: '原句', remindAt: null, parseWarnings: ['这句有多个时间，请手动选择'] });
  assert.equal(page.data.isComplete, false);
  assert.equal(page.data.warning, '这句有多个时间，请手动选择');
});
test('passed notification time disables confirmation before authorization', async () => {
  const state = setup(); const { page } = state;
  page.applyReminder({ title: '吃饭', remindAt: '2026-10-12T07:55:00Z', remindOffsetMinutes: 10 });
  assert.equal(page.data.isComplete, false);
  assert.match(page.data.warning, /时间已过/);
  await page.onConfirm();
  assert.equal(state.authorizations(), 0);
  page.applyReminder({ title: '吃饭', remindAt: '2026-10-12T07:55:00Z' });
  assert.equal(page.data.isComplete, true);
  state.setNow('2026-10-12T07:56:00Z');
  await page.onConfirm();
  assert.equal(page.data.isComplete, false);
  assert.equal(state.authorizations(), 0);
});
test('save-time revalidation retains the same idempotency key', () => {
  const { page } = setup();
  const reminder = { title: '吃饭', remindAt: '2026-10-13T07:00:00Z' };
  page.applyReminder(reminder);
  page.clientRequestId = 'existing-request';
  page.applyReminder(reminder, false);
  assert.equal(page.clientRequestId, 'existing-request');
  page.applyReminder({ ...reminder, parseWarnings: [] });
  assert.equal(page.clientRequestId, '');
  assert.equal(page.data.warning, '');
  const editSource = fs.readFileSync(path.join(__dirname, '../miniprogram/pages/reminder-edit/reminder-edit.js'), 'utf8');
  assert.match(editSource, /buildReminder\(\).*parseWarnings: \[\]/);
});
