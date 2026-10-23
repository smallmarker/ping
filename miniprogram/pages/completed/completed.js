const { getReminders } = require('../../services/reminder');
const { formatDateTime } = require('../../utils/date');
const { isReminderHistory, historyTime, reminderState } = require('../../utils/reminder-state');
Page({
  data: { reminders: [], isLoading: true, hasError: false },
  onShow() { this.loadReminders(); },
  async loadReminders() { this.setData({ isLoading: true, hasError: false }); try { const reminders = await getReminders(); this.setData({ reminders: reminders.filter(isReminderHistory).sort((a, b) => new Date(historyTime(b)) - new Date(historyTime(a))).map(item => ({ ...item, stateLabel: reminderState(item).label, displayTime: formatDateTime(historyTime(item)) })) }); } catch (_) { this.setData({ hasError: true }); } finally { this.setData({ isLoading: false }); } },
  goDetail(e) { wx.navigateTo({ url: `/pages/detail/detail?scope=history&id=${encodeURIComponent(e.currentTarget.dataset.id)}` }); }, formatDateTime
});
