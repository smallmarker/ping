const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

const pagePath = path.join(__dirname, '..', 'miniprogram/pages/index/index.js');
const originalLoad = Module._load;
const originalPage = global.Page;
const originalWx = global.wx;
const originalGetApp = global.getApp;
const app = { globalData: { lastSeenClipboardText: '', suppressClipboardOnce: false } };
const clipboardReads = [];
let page;

Module._load = function (request, parent, isMain) {
  if (parent && parent.filename === pagePath && request === '../../services/reminder') {
    return { getCachedReminders: () => null, getReminders: async () => [], parseReminder: async () => ({}) };
  }
  return originalLoad.call(this, request, parent, isMain);
};
global.Page = (definition) => { page = definition; };
global.wx = { getClipboardData: (options) => clipboardReads.push(options) };
global.getApp = () => app;

try {
  require(pagePath);
} finally {
  Module._load = originalLoad;
  global.Page = originalPage;
}

const context = {
  data: { ...page.data },
  setData(patch) { Object.assign(this.data, patch); },
  loadReminders() {},
  applyReminders() {},
  readClipboard: page.readClipboard
};

try {
  page.onShow.call(context);
  assert.equal(clipboardReads.length, 0, 'opening home must not read clipboard');
  page.readClipboard.call(context);
  clipboardReads.at(-1).success({ data: '旧剪贴板内容' });
  assert.equal(context.data.clipboardVisible, true);
  page.onHide.call(context);
  assert.equal(context.data.clipboardVisible, false);

  page.onShow.call(context);
  assert.equal(clipboardReads.length, 1, 'returning home must not read clipboard');
  assert.equal(context.data.clipboardVisible, false, 'same content must not reappear');

  page.onHide.call(context);
  page.onShow.call(context);
  page.readClipboard.call(context);
  clipboardReads.at(-1).success({ data: '新剪贴板内容' });
  assert.equal(context.data.clipboardVisible, true, 'new content remains discoverable');

  page.onHide.call(context);
  app.globalData.suppressClipboardOnce = true;
  const countBeforeReturn = clipboardReads.length;
  page.onShow.call(context);
  assert.equal(clipboardReads.length, countBeforeReturn, 'return after deletion must not read clipboard');
  assert.equal(context.data.clipboardVisible, false);
  assert.equal(app.globalData.suppressClipboardOnce, false, 'suppression is one-shot');

  page.onHide.call(context);
  page.onShow.call(context);
  page.readClipboard.call(context);
  const pending = clipboardReads.at(-1);
  page.onHide.call(context);
  pending.success({ data: '延迟到达的内容' });
  assert.equal(context.data.clipboardVisible, false, 'hidden page must ignore stale callbacks');
  console.log('PASS home clipboard return flow');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  global.wx = originalWx;
  global.getApp = originalGetApp;
}
