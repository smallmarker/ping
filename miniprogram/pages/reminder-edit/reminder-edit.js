const { updateReminder, deleteReminder } = require('../../services/reminder');
const { requestNotificationPermission } = require('../../utils/notification');
const pad = (value) => String(value).padStart(2, '0');
const UNITS = [{ label: '分钟', minutes: 1 }, { label: '小时', minutes: 60 }, { label: '天', minutes: 1440 }, { label: '周', minutes: 10080 }];
const FIXED_OFFSETS = new Set([0, 5, 10, 30]);
const toParts = (remindAt) => { const parsed = remindAt ? new Date(remindAt) : null; const valid = !!parsed && !Number.isNaN(parsed.getTime()); return { date: valid ? `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}` : '', time: valid ? `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}` : '' }; };
const dateLabel = (date) => date ? `${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日` : '请选择日期';
const offsetLabel = (minutes) => { if (!minutes) return ''; if (minutes % 10080 === 0) return `提前 ${minutes / 10080} 周`; if (minutes % 1440 === 0) return `提前 ${minutes / 1440} 天`; if (minutes % 60 === 0) return `提前 ${minutes / 60} 小时`; return `提前 ${minutes} 分钟`; };
const relativeTime = (date, time, offset) => {
  if (!date || !time) return '所选时间'; const target = new Date(`${date}T${time}:00+08:00`); const notified = new Date(target.getTime() - offset * 60000); const now = new Date(); const days = Math.round((new Date(notified.getFullYear(), notified.getMonth(), notified.getDate()).getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86400000); const prefix = days === 0 ? '今天' : days === 1 ? '明天' : `${notified.getMonth() + 1}月${notified.getDate()}日`; return `${prefix} ${pad(notified.getHours())}:${pad(notified.getMinutes())}`;
};
Page({
  data: { reminder: {}, date: '', time: '', dateLabel: '请选择日期', editingId: '', returnToConfirm: false, isSaving: false, isDeleting: false, deleteConfirmVisible: false, isComplete: false, warning: '', offsetOptions: [{ value: 0, label: '不提前' }, { value: 5, label: '提前 5 分钟' }, { value: 10, label: '提前 10 分钟' }, { value: 30, label: '提前 30 分钟' }], customOffsetText: '', customSheetVisible: false, customAmounts: Array.from({ length: 24 }, (_, index) => index + 1), customUnits: UNITS, customPickerValue: [1, 1], customAmount: 2, customUnitIndex: 1, customUnitLabel: '小时', hasReminderTime: false, reminderTimeText: '请先设置', customNotifyText: '' },
  onLoad(query) { const reminder = JSON.parse(decodeURIComponent(query.data || '{}')); const { date, time } = toParts(reminder.remindAt); const offset = Number(reminder.remindOffsetMinutes || 0); this.setData({ reminder: { ...reminder, remindOffsetMinutes: offset }, date, time, dateLabel: dateLabel(date), editingId: query.id || '', returnToConfirm: query.mode === 'confirm', customOffsetText: FIXED_OFFSETS.has(offset) ? '' : offsetLabel(offset) }, () => { this.validate(); this.refreshCustomPreview(); }); },
  onTitle(e) { this.setData({ 'reminder.title': e.detail.value }, () => this.validate()); }, clearTitle() { this.setData({ 'reminder.title': '' }, () => this.validate()); }, onDate(e) { this.setData({ date: e.detail.value, dateLabel: dateLabel(e.detail.value) }, () => { this.validate(); this.refreshCustomPreview(); }); }, onTime(e) { this.setData({ time: e.detail.value }, () => { this.validate(); this.refreshCustomPreview(); }); }, onOffset(e) { this.setData({ 'reminder.remindOffsetMinutes': Number(e.currentTarget.dataset.value), customOffsetText: '' }, () => this.validate()); },
  openCustomOffset() { const offset = Number(this.data.reminder.remindOffsetMinutes || 120); let amount = 2; let unitIndex = 1; for (let index = UNITS.length - 1; index >= 0; index -= 1) if (offset % UNITS[index].minutes === 0 && offset / UNITS[index].minutes >= 1 && offset / UNITS[index].minutes <= 24) { amount = offset / UNITS[index].minutes; unitIndex = index; break; } this.setData({ customSheetVisible: true, customAmount: amount, customUnitIndex: unitIndex, customUnitLabel: UNITS[unitIndex].label, customPickerValue: [amount - 1, unitIndex] }, () => this.refreshCustomPreview()); },
  closeCustomOffset() { this.setData({ customSheetVisible: false }, () => this.validate()); }, noop() {},
  onCustomPickerChange(e) { const [amountIndex, unitIndex] = e.detail.value; this.setData({ customPickerValue: [amountIndex, unitIndex], customAmount: this.data.customAmounts[amountIndex], customUnitIndex: unitIndex, customUnitLabel: this.data.customUnits[unitIndex].label }, () => this.refreshCustomPreview()); },
  refreshCustomPreview() { const hasReminderTime = !!(this.data.date && this.data.time); const offset = this.data.customAmount * this.data.customUnits[this.data.customUnitIndex].minutes; this.setData({ hasReminderTime, reminderTimeText: hasReminderTime ? relativeTime(this.data.date, this.data.time, 0) : '请先设置', customNotifyText: hasReminderTime ? relativeTime(this.data.date, this.data.time, offset) : '' }); },
  confirmCustomOffset() { const offset = this.data.customAmount * this.data.customUnits[this.data.customUnitIndex].minutes; this.setData({ 'reminder.remindOffsetMinutes': offset, customOffsetText: offsetLabel(offset), customSheetVisible: false }); },
  validate() { if (this.data.editingId && this.data.reminder.status === 'completed') { this.setData({ isComplete: false, warning: '这是旧版已完成记录，仅供查看或删除；如需再次提醒，请在首页新建。' }); return; } const complete = !!(String(this.data.reminder.title || '').trim() && this.data.date && this.data.time); const offset = Number(this.data.reminder.remindOffsetMinutes || 0); const notifyAt = new Date(`${this.data.date}T${this.data.time}:00+08:00`).getTime() - offset * 60000; const future = complete && Number.isFinite(notifyAt) && notifyAt > Date.now(); this.setData({ isComplete: future, warning: !complete ? '请补全事项、日期和时间' : !future ? '实际通知时间已过，请调整时间或提前量' : '' }); },
  buildReminder() { return { ...this.data.reminder, notifyStatus: 'pending', parseWarnings: [], title: String(this.data.reminder.title || '').trim(), remindAt: new Date(`${this.data.date}T${this.data.time}:00+08:00`).toISOString(), remindOffsetMinutes: Number(this.data.reminder.remindOffsetMinutes || 0), status: 'pending', sourceType: this.data.reminder.sourceType || 'text' }; },
  async save() { this.validate(); if (!this.data.isComplete || this.data.isSaving || this.data.isDeleting) return; const reminder = this.buildReminder(); this.setData({ isSaving: true }); try { if (this.data.editingId) { const authorization = await requestNotificationPermission(); await updateReminder(this.data.editingId, { ...reminder, ...(authorization ? { notifyStatus: authorization } : {}) }); wx.showToast({ title: authorization === 'denied' ? '已更新，通知未开启' : '提醒已更新', icon: 'none' }); this.getOpenerEventChannel().emit('updated', reminder); wx.navigateBack(); return; } if (this.data.returnToConfirm) { wx.redirectTo({ url: `/pages/confirm/confirm?data=${encodeURIComponent(JSON.stringify(reminder))}` }); return; } this.getOpenerEventChannel().emit('updated', reminder); wx.navigateBack(); } catch (_) { wx.showToast({ title: '保存失败，请重试', icon: 'none' }); } finally { this.setData({ isSaving: false }); } },
  showDeleteConfirm() { if (!this.data.editingId || this.data.isSaving || this.data.isDeleting) return; this.setData({ deleteConfirmVisible: true }); },
  hideDeleteConfirm() { if (this.data.isDeleting) return; this.setData({ deleteConfirmVisible: false }); },
  async confirmDelete() {
    const id = this.data.editingId;
    if (!id || !this.data.deleteConfirmVisible || this.data.isDeleting) return;
    this.setData({ isDeleting: true });
    try {
      await deleteReminder(id);
      getApp().globalData.suppressClipboardOnce = true;
      wx.showToast({ title: '已删除', icon: 'success' });
      const pages = getCurrentPages();
      const previous = pages[pages.length - 2];
      if (previous && previous.route === 'pages/detail/detail' && pages.length > 2) wx.navigateBack({ delta: 2 });
      else if (previous && previous.route !== 'pages/detail/detail') wx.navigateBack();
      else wx.reLaunch({ url: '/pages/index/index' });
    } catch (_) {
      this.setData({ isDeleting: false });
      wx.showToast({ title: '删除失败，请重试', icon: 'none' });
    }
  }
});
