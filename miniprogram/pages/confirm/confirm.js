const { createReminder } = require('../../services/reminder');
const { requestNotificationPermission } = require('../../utils/notification');
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const offsetText = (offset) => { const minutes = Number(offset || 0); if (!minutes) return '不提前'; if (minutes % 10080 === 0) return `提前 ${minutes / 10080} 周`; if (minutes % 1440 === 0) return `提前 ${minutes / 1440} 天`; if (minutes % 60 === 0) return `提前 ${minutes / 60} 小时`; return `提前 ${minutes} 分钟`; };
const formatParts = (date, time) => {
  if (!date || !time) return { relativeTime: '', dateDetail: '' };
  const target = new Date(`${date}T${time}:00+08:00`); const today = new Date();
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const days = Math.round((targetDay - todayDay) / 86400000);
  const prefix = days === 0 ? '今天' : days === 1 ? '明天' : `${target.getMonth() + 1}月${target.getDate()}日`;
  return { relativeTime: `${prefix} ${time}`, dateDetail: `${target.getFullYear()}年${target.getMonth() + 1}月${target.getDate()}日 · 周${WEEKDAYS[target.getDay()]}` };
};
Page({
  clientRequestId: '',
  data: { reminder: {}, date: '', time: '', isSaving: false, isComplete: false, warning: '', relativeTime: '', dateDetail: '', offsetLabel: '不提前' },
  onLoad(query) { this.applyReminder(JSON.parse(decodeURIComponent(query.data || '{}'))); },
  applyReminder(reminder, resetRequestId = true) {
    if (resetRequestId) this.clientRequestId = '';
    const parsed = reminder.remindAt ? new Date(reminder.remindAt) : null; const valid = !!parsed && !Number.isNaN(parsed.getTime());
    const date = valid ? `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}` : '';
    const time = valid ? `${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}` : '';
    const offset = Number(reminder.remindOffsetMinutes || 0);
    const future = valid && parsed.getTime() - offset * 60000 > Date.now();
    const complete = !!(reminder.title && future);
    const parseWarnings = Array.isArray(reminder.parseWarnings) ? reminder.parseWarnings.filter(value => typeof value === 'string') : [];
    const warning = valid && !future ? '提醒时间已过，请修改时间或提前量' : parseWarnings.join('\n') || (complete ? '' : '补全事项和时间后即可设提醒');
    this.setData({ reminder: { ...reminder, remindOffsetMinutes: offset }, date, time, isComplete: complete, warning, offsetLabel: offsetText(offset), ...formatParts(date, time) });
  },
  openEditor() { wx.navigateTo({ url: `/pages/reminder-edit/reminder-edit?data=${encodeURIComponent(JSON.stringify({ ...this.data.reminder, remindAt: this.data.date && this.data.time ? new Date(`${this.data.date}T${this.data.time}:00+08:00`).toISOString() : '' }))}`, events: { updated: (reminder) => this.applyReminder(reminder) } }); },
  async onConfirm() {
    if (!this.data.isComplete || this.data.isSaving) return;
    this.applyReminder(this.data.reminder, false);
    if (!this.data.isComplete) return;
    this.setData({ isSaving: true });
    if (!this.clientRequestId) this.clientRequestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      const authorization = await requestNotificationPermission();
      const reminder = { ...this.data.reminder, remindAt: new Date(`${this.data.date}T${this.data.time}:00+08:00`).toISOString(), status: 'pending', sourceType: this.data.reminder.sourceType || 'text', notifyStatus: authorization || 'pending', remindOffsetMinutes: Number(this.data.reminder.remindOffsetMinutes || 0) };
      await createReminder(reminder, this.clientRequestId);
      getApp().globalData.savedComposerText = typeof reminder.text === 'string' ? reminder.text : null;
      getApp().globalData.suppressClipboardOnce = true;
      wx.showToast({ title: authorization === 'denied' ? '提醒已保存，通知未开启' : '提醒已设好', icon: 'none' });
      wx.switchTab({ url: '/pages/index/index', fail: () => { this.setData({ isSaving: false }); wx.showToast({ title: '已保存，请返回首页查看', icon: 'none' }); } });
    } catch (error) { this.setData({ isSaving: false }); wx.showToast({ title: error.message || '保存失败，请重试', icon: 'none' }); }
  }
});
