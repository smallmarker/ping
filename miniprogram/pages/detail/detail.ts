import { deleteReminder, getReminders, getReminder } from '../../services/reminder';
import { Reminder } from '../../types/reminder';
import { noticeStatusLabel } from '../../utils/notice-status';
import { reminderState } from '../../utils/reminder-state';
import { orderReminderBook } from '../../utils/reminder-book-order';

const formatDetailTime = (value?: string) => {
  const date = new Date(value || '');
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 · ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const offsetLabel = (value?: number) => {
  const minutes = Number(value || 0);
  if (!minutes) return '不提前';
  if (minutes % 10080 === 0) return `${minutes / 10080} 周前`;
  if (minutes % 1440 === 0) return `${minutes / 1440} 天前`;
  if (minutes % 60 === 0) return `${minutes / 60} 小时前`;
  return `${minutes} 分钟前`;
};


Page({
  requestedId: '',
  data: {
    reminder: {} as Reminder,
    detailLoading: false, detailError: false, browseError: false,
    noticeLabel: '',
    allReminders: [] as Reminder[],
    pageIndex: 0,
    detailTime: '',
    stateLabel: '', stateTone: 'neutral', stateTime: '', stateTimePrefix: '',
    offsetText: '不提前',
    menuOpen: false,
    touchStartX: 0,
    turning: null as null | { reminder: Reminder; detailTime: string; stateLabel: string; stateTone: string; stateTime: string; stateTimePrefix: string; offsetText: string },
    turnDirection: '',
    isTurning: false,
    navTop: 26,
    navHeight: 32,
    navBarHeight: 64,
  },
  async onLoad(query: Record<string, string>) {
    this.requestedId = query.id;
    this.setData({ detailLoading: true, detailError: false, browseError: false });
    try {
      const systemInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      const capsule = wx.getMenuButtonBoundingClientRect();
      const navTop = capsule.top || (systemInfo.statusBarHeight || 20) + 6;
      const navHeight = capsule.height || 32;
      this.setData({ navTop, navHeight, navBarHeight: capsule.bottom || navTop + navHeight + 6 });
      const selected = await getReminder(query.id);
      this.setData({ allReminders: [selected], pageIndex: 0 }); this.applyReminder(selected);
      let items: Reminder[];
      try { items = await getReminders(); }
      catch (_) { this.setData({ browseError: true }); return; }
      // All entry points open the same book; old scope query parameters are ignored.
      const allReminders = orderReminderBook(items);
      const requestedIndex = allReminders.findIndex((item) => item._id === query.id);
      if (requestedIndex < 0) { const latest = items.find(item => item._id === query.id); if (latest) { this.setData({ allReminders: [latest], pageIndex: 0 }); this.applyReminder(latest); } return; }
      const pageIndex = requestedIndex;
      this.setData({ allReminders, pageIndex }, () => this.applyReminder(allReminders[pageIndex]));
    } catch (_) {
      this.setData({ detailError: true });
      wx.showToast({ title: '提醒加载失败或已删除，请返回重试', icon: 'none' });
    }
    finally { this.setData({ detailLoading: false }); }
  },
  onShow() { if (this.data.reminder._id && !this.data.detailLoading) this.onLoad({ id: this.data.reminder._id }); },
  retryLoad() { this.onLoad({ id: this.data.reminder._id || this.requestedId }); },
  applyReminder(reminder: Reminder) {
    const state = reminderState(reminder);
    this.setData({ noticeLabel: reminder.status === 'completed' ? '这是旧版手动完成的记录，不代表通知已发送。' + (reminder.notifyStatus === 'sent' ? noticeStatusLabel('sent') : '') : noticeStatusLabel(reminder.notifyStatus) });
    this.setData({
      reminder,
      stateLabel: state.label, stateTone: state.tone, stateTime: formatDetailTime(state.time), stateTimePrefix: state.timePrefix,
      detailTime: formatDetailTime(reminder.remindAt),
      offsetText: offsetLabel(reminder.remindOffsetMinutes),
      menuOpen: false,
    });
  },
  goBack() { wx.navigateBack(); },
  toggleMenu() { this.setData({ menuOpen: !this.data.menuOpen }); },
  onTouchStart(event: any) {
    const touch = event.touches && event.touches[0];
    this.setData({ touchStartX: touch ? touch.clientX : 0 });
  },
  onTouchEnd(event: any) {
    const touch = event.changedTouches && event.changedTouches[0];
    if (!touch) return;
    const distance = touch.clientX - this.data.touchStartX;
    if (Math.abs(distance) < 56) return;
    this.turnPage(distance < 0 ? 1 : -1);
  },
  turnPage(step: number) {
    if (this.data.isTurning) return;
    const pageIndex = this.data.pageIndex + step;
    if (pageIndex < 0 || pageIndex >= this.data.allReminders.length) return;
    const turning = {
      reminder: this.data.reminder,
      detailTime: this.data.detailTime,
      stateLabel: this.data.stateLabel, stateTone: this.data.stateTone, stateTime: this.data.stateTime, stateTimePrefix: this.data.stateTimePrefix,
      offsetText: this.data.offsetText,
    };
    this.setData({ turning, turnDirection: step > 0 ? 'turn-next' : 'turn-prev', isTurning: true, pageIndex }, () => {
      this.applyReminder(this.data.allReminders[pageIndex]);
      setTimeout(() => this.setData({ turning: null, turnDirection: '', isTurning: false }), 440);
    });
  },
  onEdit() {
    const reminder = this.data.reminder;
    if (!reminder._id) return;
    this.setData({ menuOpen: false });
    wx.navigateTo({
      url: `/pages/reminder-edit/reminder-edit?id=${reminder._id}&data=${encodeURIComponent(JSON.stringify(reminder))}`,
      events: { updated: () => this.onLoad({ id: reminder._id || '' }) },
    });
  },
  onDelete() {
    const id = this.data.reminder._id;
    if (!id) return;
    this.setData({ menuOpen: false });
    wx.showModal({
      title: '删除这条提醒？', content: '删除后将不再显示。', confirmColor: '#d67d76',
      success: async ({ confirm }) => {
        if (!confirm) return;
        try {
          await deleteReminder(id);
          (getApp().globalData as { suppressClipboardOnce: boolean }).suppressClipboardOnce = true;
          wx.showToast({ title: '已删除', icon: 'success' });
          setTimeout(() => wx.navigateBack(), 500);
        } catch (_) {
          wx.showToast({ title: '删除失败，请重试', icon: 'none' });
        }
      },
    });
  },
});
