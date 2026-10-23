const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const original = { Page: global.Page, wx: global.wx, getApp: global.getApp, load: Module._load };
const lists = [];
const writes = [];
const definitions = [];
const app = { globalData: { suppressClipboardOnce: true } };
const response = (data) => ({ result: { code: 0, data } });
let stoppedRefreshes = 0;
let home;

global.Page = (definition) => definitions.push(definition);
global.getApp = () => app;
global.wx = {
  getClipboardData() {}, showToast() {},
  stopPullDownRefresh() { stoppedRefreshes += 1; },
  switchTab() { home.onShow(); },
  cloud: { callFunction({ name, data }) {
    return new Promise((resolve, reject) => {
      (name === 'getReminders' ? lists : writes).push({ name, data, resolve, reject });
    });
  } },
};
const confirmPath = path.join(__dirname, '..', 'miniprogram/pages/confirm/confirm.js');
Module._load = function (request, parent, isMain) {
  if (parent && parent.filename === confirmPath && request === '../../utils/notification') return { requestNotificationPermission: async () => 'authorized' };
  return original.load.call(this, request, parent, isMain);
};
const service = require('../miniprogram/services/reminder');
require('../miniprogram/pages/index/index');
require(confirmPath);
Module._load = original.load;
const context = (definition) => ({ ...definition, data: { ...definition.data }, setData(patch) { Object.assign(this.data, patch); } });
home = context(definitions[0]);
const confirm = context(definitions[1]);
const flush = () => new Promise((resolve) => setImmediate(resolve));
const old = { _id: 'old', title: '原有提醒', status: 'pending', createdAt: '2020-01-01T00:00:00Z', remindAt: '2099-01-01T12:00:00Z' };

(async () => {
  try {
    const initial = home.loadReminders();
    lists.at(-1).resolve(response({ items: [old] }));
    await initial;
    home.onHide();
    confirm.applyReminder({ title: '刚保存的提醒', remindAt: '2099-01-02T12:00:00Z' });
    const save = confirm.onConfirm();
    await flush();
    await confirm.onConfirm();
    assert.equal(writes.length, 1, 'repeated taps during save must not submit twice');
    assert.equal(service.getCachedReminders().length, 1, 'unconfirmed creation must not appear');
    writes.at(-1).resolve(response({ reminderId: 'new' }));
    await save;
    assert.equal(home.data.reminderGroups[0].reminders[0]._id, 'new', 'successful navigation shows newest reminder before network refresh');
    assert.equal(home.data.listLoading, true);
    lists.at(-1).resolve(response({ items: [old] }));
    await flush();
    assert.equal(home.data.reminderGroups[0].reminders[0]._id, 'new', 'stale read must not hide confirmed creation');

    const edit = service.updateReminder('new', { title: '已修改', remindAt: '2099-01-03T12:00:00Z' });
    writes.at(-1).resolve(response({ id: 'new' }));
    await edit;
    home.onHide(); home.onShow();
    assert.equal(home.data.reminderGroups[0].reminders[0].title, '已修改');
    lists.at(-1).resolve(response({ items: [old] }));
    await flush();
    assert.equal(home.data.reminderGroups[0].reminders[0].title, '已修改', 'stale read must retain confirmed edits');

    const complete = service.completeReminder('new');
    writes.at(-1).resolve(response({ id: 'new' }));
    await complete;
    home.onHide(); home.onShow();
    assert.equal(home.data.historyCount, 1, 'old completion remains in history immediately');
    assert.deepEqual(home.data.reminderGroups.flatMap((group) => group.reminders.map((item) => item._id)), ['old']);
    const canonical = { ...service.getCachedReminders().find((item) => item._id === 'new'), createdAt: '2026-10-08T02:00:00Z' };
    lists.at(-1).resolve(response({ items: [canonical, old] }));
    await flush();

    const older = service.getReminders();
    const olderList = lists.at(-1);
    const newer = service.getReminders();
    lists.at(-1).resolve(response({ items: [{ ...canonical, title: '另一端的最新修改' }, old] }));
    await newer;
    olderList.resolve(response({ items: [canonical, old] }));
    await older;
    assert.equal(service.getCachedReminders().find((item) => item._id === 'new').title, '另一端的最新修改', 'acknowledged changes yield to later server data; older responses cannot overwrite it');

    const deletion = service.deleteReminder('new');
    writes.at(-1).resolve(response({ id: 'new', deleted: true }));
    await deletion;
    home.onHide(); home.onShow();
    assert.equal(home.data.historyCount, 0, 'deleting a historical record updates count');
    lists.at(-1).resolve(response({ items: [canonical, old] }));
    await flush();
    assert.equal(home.data.reminders.some((item) => item._id === 'new'), false);

    const pull = home.onPullDownRefresh();
    lists.at(-1).reject(new Error('offline'));
    await pull;
    assert.equal(stoppedRefreshes, 1);
    assert.equal(home.data.listError, true);
    assert.equal(home.data.listLoading, false);
    assert.deepEqual(home.data.reminders.map((item) => item._id), ['old']);

    const retryConfirm = context(definitions[1]);
    retryConfirm.applyReminder({ title: '失败重试', remindAt: '2099-01-02T12:00:00Z' });
    const firstSave = retryConfirm.onConfirm(); await flush();
    const requestId = writes.at(-1).data.clientRequestId;
    writes.at(-1).reject(new Error('connection lost')); await firstSave;
    assert.equal(retryConfirm.data.isSaving, false);
    const retrySave = retryConfirm.onConfirm(); await flush();
    assert.equal(writes.at(-1).data.clientRequestId, requestId, 'retry preserves idempotency after an uncertain network outcome');
    writes.at(-1).reject(new Error('offline')); await retrySave;
    assert.equal(service.getCachedReminders().some((item) => item.title === '失败重试'), false, 'failed writes must not appear as saved');
    console.log('PASS unified create/edit/complete/delete sync, read races, refresh failures and save retries');
  } catch (error) {
    console.error(error); process.exitCode = 1;
  } finally {
    global.Page = original.Page; global.wx = original.wx; global.getApp = original.getApp; Module._load = original.load;
  }
})();
