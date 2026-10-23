import { Reminder } from '../types/reminder';
// Keep old manual completion separate from notification success. No data migration.
export const isReminderHistory = (item: Reminder) => item.status !== 'deleted' && (item.status === 'completed' || item.notifyStatus === 'sent');
export const isActiveReminder = (item: Reminder) => item.status !== 'deleted' && !isReminderHistory(item);
export const historyTime = (item: Reminder) => item.status === 'completed' ? item.completedAt || item.remindAt : item.sentAt || item.remindAt;
export const reminderState = (item: Reminder) => {
  if (item.status === 'completed') return { label: '历史已完成', tone: 'history', time: item.completedAt, timePrefix: '完成于' };
  const states: Record<string, [string, string]> = {
    authorized: ['待提醒', 'neutral'], sending: ['正在发送', 'neutral'], sent: ['已提醒', 'success'],
    pending: ['通知未开启', 'warning'], denied: ['通知未开启', 'warning'], failed: ['发送失败', 'warning'],
    missed: ['已错过提醒', 'warning'], unknown: ['结果未确认', 'warning'], cancelled: ['通知已取消', 'warning']
  };
  const [label, tone] = states[item.notifyStatus || ''] || ['状态待确认', 'warning'];
  return { label, tone, time: item.notifyStatus === 'sent' ? item.sentAt : undefined, timePrefix: '提醒于' };
};
