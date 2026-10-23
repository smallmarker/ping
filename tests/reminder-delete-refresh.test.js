const assert = require('node:assert/strict');
const path = require('node:path');
const originalPage = global.Page;
const originalWx = global.wx;
const originalGetApp = global.getApp;
const pendingLists = [];
let deleteFails = false;
let page;
const app = { globalData: { suppressClipboardOnce: true } };
global.Page = (definition) => { page = definition; };
global.getApp = () => app;
global.wx = {
  getClipboardData() {},
  cloud: { callFunction({ name, data }) {
    if (name === 'getReminders') return new Promise((resolve, reject) => pendingLists.push({ resolve, reject }));
    if (name === 'deleteReminder') return Promise.resolve({ result: deleteFails
      ? { code: 'DATABASE_ERROR', message: '删除失败' }
      : { code: 0, data: { id: data.id, deleted: true } } });
    throw new Error(`Unexpected function: ${name}`);
  } },
};
const service = require('../miniprogram/services/reminder');
require(path.join(__dirname, '..', 'miniprogram/pages/index/index.js'));
const item = (id) => ({ _id: id, title: id, remindAt: '2099-01-01T15:00:00+08:00', createdAt: '2026-10-08T10:00:00+08:00', status: 'pending' });
const deleted = item('deleted');
const kept = item('kept');
const home = { ...page, data: { ...page.data }, setData(patch) { Object.assign(this.data, patch); } };
const reply = (items) => ({ result: { code: 0, data: { items } } });

(async () => {
  try {
    home.applyReminders([deleted, kept]);
    const oldRequest = home.loadReminders();
    await service.deleteReminder(deleted._id);
    home.onHide();
    home.onShow();
    assert.deepEqual(home.data.reminders.map((row) => row._id), ['kept'], 'return must remove deleted item before refresh resolves');
    assert.equal(home.data.reminderGroups[0].reminders.length, 1, 'group count updates immediately');
    pendingLists[0].resolve(reply([deleted, kept]));
    await oldRequest;
    assert.deepEqual(home.data.reminders.map((row) => row._id), ['kept'], 'older in-flight response must not restore deleted item');
    pendingLists[1].resolve(reply([deleted, kept]));
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(home.data.reminders.map((row) => row._id), ['kept'], 'even a stale server response excludes confirmed deletions');

    deleteFails = true;
    await assert.rejects(service.deleteReminder(kept._id));
    assert.deepEqual(service.reconcileReminders([kept]), [kept], 'failed deletion must keep item visible');
    const failedRefresh = home.loadReminders();
    pendingLists[2].reject(new Error('network'));
    await failedRefresh;
    assert.equal(home.data.listError, true);
    assert.deepEqual(home.data.reminders.map((row) => row._id), ['kept'], 'refresh error preserves valid data');
    console.log('PASS deletion return refresh, stale responses and failure handling');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    global.Page = originalPage;
    global.wx = originalWx;
    global.getApp = originalGetApp;
  }
})();
