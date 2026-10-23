// Books append newly created pages. Scheduled/sent/edited times never move a page.
const createdTime = item => {
  const time = new Date(item.createdAt || '').getTime();
  return Number.isFinite(time) ? time : 0;
};
const orderReminderBook = items => items.filter(item => item.status !== 'deleted').sort((a, b) => {
  const difference = createdTime(a) - createdTime(b);
  if (difference) return difference;
  const left = String(a._id || ''); const right = String(b._id || '');
  return left < right ? -1 : left > right ? 1 : 0;
});
module.exports = { orderReminderBook };
