import { Reminder } from '../types/reminder';
// Books append newly created pages. Scheduled/sent/edited times never move a page.
const createdTime = (item: Reminder) => {
  const time = new Date(item.createdAt || '').getTime();
  return Number.isFinite(time) ? time : 0;
};
export const orderReminderBook = (items: Reminder[]) => items.filter(item => item.status !== 'deleted').sort((a, b) => {
  const difference = createdTime(a) - createdTime(b);
  if (difference) return difference;
  const left = String(a._id || ''); const right = String(b._id || '');
  return left < right ? -1 : left > right ? 1 : 0;
});
