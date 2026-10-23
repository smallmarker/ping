const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

const pagePath = path.join(__dirname, '..', 'miniprogram/pages/reminder-edit/reminder-edit.js');
const calls = { deleted: [], navigation: [], toasts: [] };
let deleteError = null;
const originalLoad = Module._load;
const originalPage = global.Page;
const originalWx = global.wx;
const originalGetCurrentPages = global.getCurrentPages;
const originalGetApp = global.getApp;
const app = { globalData: { suppressClipboardOnce: false } };
let page;

Module._load = function (request, parent, isMain) {
  if (parent && parent.filename === pagePath && request === '../../services/reminder') {
    return {
      updateReminder: async () => {},
      deleteReminder: async (id) => { calls.deleted.push(id); if (deleteError) throw deleteError; }
    };
  }
  if (parent && parent.filename === pagePath && request === '../../utils/notification') {
    return { requestNotificationPermission: async () => null };
  }
  return originalLoad.call(this, request, parent, isMain);
};
global.Page = (definition) => { page = definition; };
global.wx = {
  showToast: (options) => calls.toasts.push(options.title),
  navigateBack: (options) => calls.navigation.push({ type: 'back', ...options }),
  reLaunch: (options) => calls.navigation.push({ type: 'reLaunch', ...options })
};
global.getCurrentPages = () => [
  { route: 'pages/index/index' },
  { route: 'pages/detail/detail' },
  { route: 'pages/reminder-edit/reminder-edit' }
];
global.getApp = () => app;

try {
  require(pagePath);
} finally {
  Module._load = originalLoad;
  global.Page = originalPage;
}

const makeContext = (editingId) => ({
  data: { ...page.data, editingId },
  setData(patch) { Object.assign(this.data, patch); }
});

(async () => {
  try {
    const draft = makeContext('');
    page.showDeleteConfirm.call(draft);
    assert.equal(draft.data.deleteConfirmVisible, false, 'drafts must not offer deletion');

    const cancelled = makeContext('reminder-1');
    page.showDeleteConfirm.call(cancelled);
    assert.equal(cancelled.data.deleteConfirmVisible, true);
    page.hideDeleteConfirm.call(cancelled);
    assert.equal(cancelled.data.deleteConfirmVisible, false);
    assert.equal(calls.deleted.length, 0, 'cancel must not call the service');

    const confirmed = makeContext('reminder-1');
    page.showDeleteConfirm.call(confirmed);
    await page.confirmDelete.call(confirmed);
    assert.deepEqual(calls.deleted, ['reminder-1']);
    assert.deepEqual(calls.navigation, [{ type: 'back', delta: 2 }]);
    assert.equal(app.globalData.suppressClipboardOnce, true);

    const failed = makeContext('reminder-2');
    deleteError = new Error('network');
    page.showDeleteConfirm.call(failed);
    await page.confirmDelete.call(failed);
    assert.equal(failed.data.isDeleting, false);
    assert.equal(failed.data.deleteConfirmVisible, true, 'failure keeps confirmation open for retry');
    assert.equal(calls.navigation.length, 1, 'failure must not navigate away');
    assert.equal(calls.toasts.at(-1), '删除失败，请重试');
    console.log('PASS reminder editor delete flow');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    global.wx = originalWx;
    global.getCurrentPages = originalGetCurrentPages;
    global.getApp = originalGetApp;
  }
})();
