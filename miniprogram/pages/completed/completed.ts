import { getReminders } from '../../services/reminder';
import { Reminder } from '../../types/reminder';
import { formatDateTime } from '../../utils/date';
import { isReminderHistory, historyTime, reminderState } from '../../utils/reminder-state';

Page({
  data: { reminders: [] as (Reminder & { stateLabel: string; displayTime: string })[], isLoading: true, hasError: false },
  onShow() { this.loadReminders(); },
  async loadReminders() {
    this.setData({ isLoading: true, hasError: false });
    try {
      const reminders = await getReminders();
      const completed = reminders
        .filter(isReminderHistory)
        .sort((a, b) => new Date(historyTime(b)).getTime() - new Date(historyTime(a)).getTime())
        .map(item => ({ ...item, stateLabel: reminderState(item).label, displayTime: formatDateTime(historyTime(item)) }));
      this.setData({ reminders: completed });
    } catch (_) { this.setData({ hasError: true }); }
    finally { this.setData({ isLoading: false }); }
  },
  goDetail(e: WechatMiniprogram.BaseEvent) { wx.navigateTo({ url: `/pages/detail/detail?scope=history&id=${encodeURIComponent(e.currentTarget.dataset.id)}` }); },
  formatDateTime
});
