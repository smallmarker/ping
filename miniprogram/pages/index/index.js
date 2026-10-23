const { reconcileReminders, getCachedReminders, getReminders, parseReminder } = require('../../services/reminder');
const { formatDateTime } = require('../../utils/date');
const { isActiveReminder, isReminderHistory, reminderState } = require('../../utils/reminder-state');
let isHomeVisible = false;
let clipboardReadVersion = 0;
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const HOME_PREVIEW_LIMIT = 3;
const formatTime = (value) => { const date = new Date(value); return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`; };
const offsetLabel = (value) => { const minutes = Number(value || 0); if (!minutes) return '准时提醒'; if (minutes % 10080 === 0) return `提前 ${minutes / 10080} 周`; if (minutes % 1440 === 0) return `提前 ${minutes / 1440} 天`; if (minutes % 60 === 0) return `提前 ${minutes / 60} 小时`; return `提前 ${minutes} 分钟`; };
const displayReminder = (item) => ({ ...item, displayTime: formatTime(item.remindAt), displayMeta: [item.location, !item.notifyStatus || item.notifyStatus === 'authorized' ? offsetLabel(item.remindOffsetMinutes) : reminderState(item).label].filter(Boolean).join(' · ') });
const dateKey = (value) => { const date = new Date(value); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };
const dateLabel = (value) => { const date = new Date(value); const prefix = date.getFullYear() === new Date().getFullYear() ? '' : `${date.getFullYear()}年`; return `${prefix}${date.getMonth() + 1}月${date.getDate()}日 · 周${WEEKDAYS[date.getDay()]}`; };
const createdTime = (item) => { const time = new Date(item.createdAt || '').getTime(); return Number.isFinite(time) ? time : 0; };
const groupDatedReminders = (reminders) => {
  const today = dateKey(new Date().toISOString());
  const groups = new Map();
  reminders.forEach((reminder) => { const key = dateKey(reminder.remindAt); if (!groups.has(key)) groups.set(key, { dateKey: key, label: key === today ? '今天' : dateLabel(reminder.remindAt), isOverdue: key < today, reminders: [] }); groups.get(key).reminders.push(displayReminder(reminder)); });
  return Array.from(groups.values());
};
Page({
  reminderLoadVersion: 0,
  data: { text: '', reminders: [], reminderGroups: [], moreReminderId: '', historyCount: 0, isLoading: false, listLoading: false, listError: false, parseError: '', clipboardText: '', clipboardFullText: '', clipboardVisible: false },
  onShow() {
    isHomeVisible = true;
    this.applyReminders(getCachedReminders() || this.data.reminders);
    this.loadReminders();
    const app = getApp();
    if (typeof app.globalData.savedComposerText === 'string') {
      if (this.data.text.trim() === app.globalData.savedComposerText.trim()) {
        clipboardReadVersion += 1;
        this.setData({ text: '', parseError: '', clipboardText: '', clipboardFullText: '', clipboardVisible: false });
      }
      app.globalData.savedComposerText = null;
    }
    if (app.globalData.suppressClipboardOnce) {
      app.globalData.suppressClipboardOnce = false;
      clipboardReadVersion += 1;
      this.setData({ clipboardVisible: false });
      return;
    }
    // Clipboard access is only initiated by the explicit paste action.
  },
  onHide() {
    isHomeVisible = false;
    this.reminderLoadVersion += 1;
    clipboardReadVersion += 1;
    if (this.data.clipboardVisible) this.setData({ clipboardVisible: false });
  },
  onUnload() { isHomeVisible = false; this.reminderLoadVersion += 1; clipboardReadVersion += 1; },
  async onPullDownRefresh() { try { await this.loadReminders(); } finally { wx.stopPullDownRefresh(); } },
  applyReminders(items) {
      const reminders = reconcileReminders(items);
      const active = reminders.filter(isActiveReminder)
        .sort((a, b) => createdTime(b) - createdTime(a) || new Date(b.remindAt) - new Date(a.remindAt));
      const counts = new Map(groupDatedReminders(active).map(group => [group.dateKey, group.reminders.length]));
      const reminderGroups = groupDatedReminders(active.slice(0, HOME_PREVIEW_LIMIT)).map(group => ({ ...group, count: counts.get(group.dateKey) }));
      this.setData({ reminders, reminderGroups, moreReminderId: active[HOME_PREVIEW_LIMIT] ? active[HOME_PREVIEW_LIMIT]._id : '', historyCount: reminders.filter(isReminderHistory).length });
  },
  async loadReminders() {
    const version = this.reminderLoadVersion = (this.reminderLoadVersion || 0) + 1;
    this.setData({ listError: false, listLoading: true });
    try {
      const reminders = await getReminders('createdAtDesc');
      if (version !== this.reminderLoadVersion) return;
      this.applyReminders(reminders);
    } catch (_) { if (version === this.reminderLoadVersion) this.setData({ listError: true }); }
    finally { if (version === this.reminderLoadVersion) this.setData({ listLoading: false }); }
  },
  readClipboard() {
    const version = ++clipboardReadVersion;
    wx.getClipboardData({ success: ({ data }) => {
      if (!isHomeVisible || version !== clipboardReadVersion) return;
      const text = (data || '').trim();
      const app = getApp();
      if (!text) { wx.showToast({ title: '剪贴板暂无内容', icon: 'none' }); return; }
      if (text.length > 500) { wx.showToast({ title: '内容超过 500 字，请手动粘贴并精简', icon: 'none' }); return; }
      app.globalData.lastSeenClipboardText = text;
      if (text.length <= 500 && text !== this.data.text) this.setData({ clipboardText: text.slice(0, 80), clipboardFullText: text, clipboardVisible: true });
    }, fail: () => { if (isHomeVisible && version === clipboardReadVersion) wx.showToast({ title: '未能读取，请手动粘贴或输入', icon: 'none' }); } });
  },
  useClipboard() { this.setData({ text: this.data.clipboardFullText, clipboardVisible: false, parseError: '' }); }, dismissClipboard() { this.setData({ clipboardVisible: false }); }, onInput(e) { this.setData({ text: e.detail.value, parseError: '' }); },
  async onCreate() { const text = this.data.text.trim(); if (!text || this.data.isLoading) return; this.setData({ isLoading: true, parseError: '' }); try { const reminder = await parseReminder(text); wx.navigateTo({ url: `/pages/confirm/confirm?data=${encodeURIComponent(JSON.stringify({ ...reminder, text }))}` }); } catch (_) { this.setData({ parseError: 'unresolved' }); } finally { this.setData({ isLoading: false }); } },
  goManual() { const draft = { text: this.data.text.trim(), title: this.data.text.trim().slice(0, 60), remindAt: '', status: 'pending' }; wx.navigateTo({ url: `/pages/reminder-edit/reminder-edit?mode=confirm&data=${encodeURIComponent(JSON.stringify(draft))}` }); }, goDetail(e) { wx.navigateTo({ url: `/pages/detail/detail?scope=active&id=${encodeURIComponent(e.currentTarget.dataset.id)}` }); },
  goMore() { if (this.data.moreReminderId) wx.navigateTo({ url: `/pages/detail/detail?scope=active&id=${encodeURIComponent(this.data.moreReminderId)}` }); },
  goCompleted() { wx.navigateTo({ url: '/pages/completed/completed' }); }, formatDateTime
});
