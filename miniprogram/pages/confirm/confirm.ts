import { createReminder } from '../../services/reminder';
import { requestNotificationPermission } from '../../utils/notification';
import { Reminder } from '../../types/reminder';
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const offsetText = (offset?: number) => { const minutes = Number(offset || 0); if (!minutes) return '不提前'; if (minutes % 10080 === 0) return `提前 ${minutes / 10080} 周`; if (minutes % 1440 === 0) return `提前 ${minutes / 1440} 天`; if (minutes % 60 === 0) return `提前 ${minutes / 60} 小时`; return `提前 ${minutes} 分钟`; };
Page({
  clientRequestId: '',
  data: { reminder: {} as Reminder, date: '', time: '', isSaving: false, isComplete: false, warning: '', relativeTime: '', dateDetail: '', offsetLabel: '不提前' },
  onLoad(query) { this.applyReminder(JSON.parse(decodeURIComponent(query.data || '{}')) as Reminder); },
  applyReminder(reminder: Reminder, resetRequestId = true) {
    if (resetRequestId) this.clientRequestId = '';
    const parsed = reminder.remindAt ? new Date(reminder.remindAt) : null; const valid = !!parsed && !Number.isNaN(parsed.getTime());
    const date = valid ? `${parsed!.getFullYear()}-${String(parsed!.getMonth() + 1).padStart(2, '0')}-${String(parsed!.getDate()).padStart(2, '0')}` : ''; const time = valid ? `${String(parsed!.getHours()).padStart(2, '0')}:${String(parsed!.getMinutes()).padStart(2, '0')}` : ''; const complete = !!(reminder.title && valid); const target = valid ? new Date(`${date}T${time}:00+08:00`) : null; const now = new Date(); const days = target ? Math.round((new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86400000) : 0; const prefix = days === 0 ? '今天' : days === 1 ? '明天' : target ? `${target.getMonth() + 1}月${target.getDate()}日` : '';
    const offset = Number(reminder.remindOffsetMinutes || 0);
    const future = valid && parsed!.getTime() - offset * 60000 > Date.now();
    const parseWarnings = Array.isArray(reminder.parseWarnings) ? reminder.parseWarnings.filter(value => typeof value === 'string') : [];
    const warning = valid && !future ? '提醒时间已过，请修改时间或提前量' : parseWarnings.join('\n') || (complete ? '' : '补全事项和时间后即可设提醒');
    this.setData({ reminder: { ...reminder, remindOffsetMinutes: offset }, date, time, isComplete: !!(reminder.title && future), warning, offsetLabel: offsetText(offset), relativeTime: target ? `${prefix} ${time}` : '', dateDetail: target ? `${target.getFullYear()}年${target.getMonth() + 1}月${target.getDate()}日 · 周${WEEKDAYS[target.getDay()]}` : '' });
  },
  openEditor() { wx.navigateTo({ url: `/pages/reminder-edit/reminder-edit?data=${encodeURIComponent(JSON.stringify({ ...this.data.reminder, remindAt: this.data.date && this.data.time ? new Date(`${this.data.date}T${this.data.time}:00+08:00`).toISOString() : '' }))}`, events: { updated: (reminder: Reminder) => this.applyReminder(reminder) } }); },
  async onConfirm() {
    if (!this.data.isComplete || this.data.isSaving) return;
    this.applyReminder(this.data.reminder, false);
    if (!this.data.isComplete) return;
    this.setData({ isSaving: true });
    if (!this.clientRequestId) this.clientRequestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      const authorization = await requestNotificationPermission();
      const reminder: Reminder = { ...this.data.reminder, remindAt: new Date(`${this.data.date}T${this.data.time}:00+08:00`).toISOString(), status: 'pending', sourceType: this.data.reminder.sourceType || 'text', notifyStatus: authorization || 'pending', remindOffsetMinutes: Number(this.data.reminder.remindOffsetMinutes || 0) };
      await createReminder(reminder, this.clientRequestId);
      (getApp().globalData as { savedComposerText: string | null }).savedComposerText = typeof reminder.text === 'string' ? reminder.text : null;
      (getApp().globalData as { suppressClipboardOnce: boolean }).suppressClipboardOnce = true;
      wx.showToast({ title: authorization === 'denied' ? '提醒已保存，通知未开启' : '提醒已设好', icon: 'none' });
      wx.switchTab({ url: '/pages/index/index', fail: () => { this.setData({ isSaving: false }); wx.showToast({ title: '已保存，请返回首页查看', icon: 'none' }); } });
    } catch (error) { this.setData({ isSaving: false }); wx.showToast({ title: (error as Error).message || '保存失败，请重试', icon: 'none' }); }
  }
});
