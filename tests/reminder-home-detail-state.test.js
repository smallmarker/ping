const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');

const indexPath = path.join(__dirname, '..', 'miniprogram/pages/index/index.js');
const detailPath = path.join(__dirname, '..', 'miniprogram/pages/detail/detail.js');
const originalLoad = Module._load;
const originalPage = global.Page;
const originalWx = global.wx;
const originalGetApp = global.getApp;
const pages = {};
const toasts = [];
const navigations = [];
let reminders = [];
let currentPage = 'index';
const requestedSorts = [];

Module._load = function (request, parent, isMain) {
  if (parent && [indexPath, detailPath].includes(parent.filename) && request === '../../services/reminder') {
    return { reconcileReminders: (items) => items, getCachedReminders: () => null, getReminder: async id => { const item = reminders.find(row => row._id === id); if (!item) throw new Error('NOT_FOUND'); return item; }, getReminders: async (sort) => { requestedSorts.push(sort); return reminders; } };
  }
  return originalLoad.call(this, request, parent, isMain);
};
global.Page = (definition) => { pages[currentPage] = definition; };
global.wx = {
  getWindowInfo: () => ({ statusBarHeight: 20 }),
  getMenuButtonBoundingClientRect: () => ({ top: 30, height: 32, bottom: 62 }),
  showToast: ({ title }) => toasts.push(title),
  navigateTo: ({ url }) => navigations.push(url),
};
global.getApp = () => ({ globalData: {} });

try {
  require(indexPath);
  currentPage = 'detail';
  require(detailPath);
} finally {
  Module._load = originalLoad;
  global.Page = originalPage;
}

const context = (page) => ({
  data: { ...page.data },
  setData(patch, callback) { Object.assign(this.data, patch); if (callback) callback(); },
  applyReminder: page.applyReminder,
  applyReminders: page.applyReminders,
});
const atLocalTime = (dayOffset, hour) => {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  date.setDate(date.getDate() + dayOffset);
  return date.toISOString();
};

(async () => {
  try {
    reminders = [
      { _id: 'yesterday', title: '昨天的事', remindAt: atLocalTime(-1, 15), createdAt: atLocalTime(-2, 10), status: 'pending' },
      { _id: 'today', title: '今天的事', remindAt: atLocalTime(0, 23), createdAt: atLocalTime(-1, 10), status: 'pending' },
      { _id: 'tomorrow', title: '明天的事', remindAt: atLocalTime(1, 15), createdAt: atLocalTime(-1, 11), status: 'pending' },
      { _id: 'today-new', title: '刚新增的事', remindAt: atLocalTime(0, 18), createdAt: atLocalTime(0, 10), status: 'pending' },
      { _id: 'done', title: '已完成的事', remindAt: atLocalTime(0, 12), status: 'completed' },
    ];
    const home = context(pages.index);
    await pages.index.loadReminders.call(home);
    assert.equal(requestedSorts[0], 'createdAtDesc', 'home must query recent records before the server limit');
    assert.deepEqual(home.data.reminderGroups.map((group) => group.reminders[0]._id), ['today-new', 'tomorrow']);
    assert.equal(home.data.reminderGroups[0].label, '今天');
    assert.deepEqual(home.data.reminderGroups[0].reminders.map((item) => item._id), ['today-new', 'today'], 'same-date records use creation time, not scheduled time');
    assert.equal(home.data.reminderGroups.flatMap(group => group.reminders).length, 3, 'home previews only three active records');
    assert.equal(home.data.moreReminderId, 'yesterday');
    pages.index.goMore.call(home);
    assert.match(navigations.at(-1), /scope=active&id=yesterday$/);
    assert.equal(home.data.historyCount, 1);

    const detail = context(pages.detail);
    await pages.detail.onLoad.call(detail, { id: 'today' });
    assert.equal(detail.data.reminder._id, 'today');
    assert.equal(detail.data.stateLabel, '状态待确认', 'missing notification result must not imply completion');
    await pages.detail.onLoad.call(detail, { id: 'done' });
    assert.equal(detail.data.stateLabel, '历史已完成', 'old manual completion must not imply notification success');

    const missing = context(pages.detail);
    await pages.detail.onLoad.call(missing, { id: 'missing' });
    assert.equal(missing.data.reminder._id, undefined, 'missing id must not fall back to another reminder');
    assert.match(toasts.at(-1), /已删除/);
    assert.equal(missing.data.detailError, true, 'missing records have a persistent recoverable state');

    const browse = { ...pages.detail, ...context(pages.detail) };
    await browse.onLoad({ scope: 'active', id: home.data.moreReminderId });
    assert.deepEqual(browse.data.allReminders.map(item => item._id), ['done', 'yesterday', 'today', 'tomorrow', 'today-new']);
    assert.equal(browse.data.pageIndex, 1, 'more locates its target within the full book');
    assert.equal(browse.data.reminder._id, 'yesterday');
    await browse.onLoad({ id: 'done' });
    browse.turnPage(-1);
    assert.equal(browse.data.pageIndex, 0, 'first page cannot turn beyond range');
    browse.onTouchStart({ touches: [{ clientX: 150 }] });
    browse.onTouchEnd({ changedTouches: [{ clientX: 50 }] });
    assert.equal(browse.data.reminder._id, 'yesterday', 'left swipe previews a newer reminder');
    await new Promise(resolve => setTimeout(resolve, 450));
    browse.onTouchStart({ touches: [{ clientX: 50 }] });
    browse.onTouchEnd({ changedTouches: [{ clientX: 150 }] });
    assert.equal(browse.data.reminder._id, 'done', 'right swipe previews an older reminder across notification states');
    await browse.onLoad({ id: 'today' });
    assert.equal(browse.data.allReminders.length, 5, 'editor reload preserves the unified book');
    await browse.onLoad({ scope: 'active', id: 'today-new' });
    assert.equal(browse.data.pageIndex, 4, 'newest home card opens the last book page');
    browse.setData({ isTurning: false }); browse.turnPage(1);
    assert.equal(browse.data.pageIndex, 4, 'last page cannot turn beyond range');

    const originalReminders = reminders;
    reminders = [
      { _id: 'history-new', title: '新建历史', createdAt: atLocalTime(0, 12), remindAt: atLocalTime(1, 10), sentAt: atLocalTime(-1, 10), notifyStatus: 'sent', status: 'pending' },
      { _id: 'active', title: '待提醒', createdAt: atLocalTime(0, 13), remindAt: atLocalTime(1, 10), status: 'pending' },
      { _id: 'history-old', title: '更早创建', createdAt: atLocalTime(-1, 12), remindAt: atLocalTime(1, 10), sentAt: atLocalTime(0, 10), notifyStatus: 'sent', status: 'pending' }
    ];
    const history = { ...pages.detail, ...context(pages.detail) };
    await history.onLoad({ scope: 'history', id: 'history-new' });
    assert.deepEqual(history.data.allReminders.map(item => item._id), ['history-old', 'history-new', 'active'], 'history entry includes active pages in creation order');
    assert.equal(history.data.pageIndex, 1);
    const linked = { ...pages.detail, ...context(pages.detail) };
    await linked.onLoad({ id: 'active' });
    assert.deepEqual(linked.data.allReminders.map(item => item._id), ['history-old', 'history-new', 'active'], 'notification/direct entry uses the same page order');
    assert.equal(linked.data.pageIndex, 2);
    reminders = originalReminders;

    home.applyReminders(reminders.filter(item => item._id === 'yesterday'));
    assert.equal(home.data.moreReminderId, '', 'no more action for short lists');
    assert.equal(home.data.reminderGroups[0].isOverdue, true);
    home.applyReminders(Array.from({ length: 6 }, (_, i) => ({ _id: `same-day-${i}`, title: '同一天', remindAt: atLocalTime(0, 23), createdAt: atLocalTime(0, i), status: 'pending' })));
    assert.equal(home.data.reminderGroups[0].reminders.length, 3);
    assert.equal(home.data.reminderGroups[0].count, 6, 'group count stays accurate when preview is truncated');
    home.applyReminders([]);
    assert.equal(home.data.moreReminderId, '');
    console.log('PASS reminder home date grouping and detail status');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    global.wx = originalWx;
    global.getApp = originalGetApp;
  }
})();
