const call = async (name, data = {}) => {
  const result = (await wx.cloud.callFunction({ name, data })).result;
  if (!result || result.code !== 0) throw new Error((result && result.message) || '服务暂不可用');
  return result.data;
};
// 仅记录云端已确认的写入，供所有页面立即同步；读取核对后交还云端数据。
const changes = new Map();
let mutationVersion = 0;
let readVersion = 0;
let appliedReadVersion = 0;
let cachedReminders = null;
const reconcileReminders = (items) => {
  const rows = new Map(items.filter((item) => item.status !== 'deleted').map((item) => [item._id, item]));
  changes.forEach(({ patch }, id) => {
    if (patch.status === 'deleted') rows.delete(id);
    else rows.set(id, { ...(rows.get(id) || (cachedReminders || []).find((item) => item._id === id)), ...patch, _id: id });
  });
  return Array.from(rows.values());
};
const getCachedReminders = () => cachedReminders === null ? null : reconcileReminders(cachedReminders);
const recordChange = (id, patch) => {
  changes.set(id, { version: ++mutationVersion, patch: { ...(changes.get(id) || {}).patch, ...patch } });
};
const syncFields = ['title', 'remindAt', 'remindOffsetMinutes', 'location', 'note', 'status'];
const matchesChange = (row, patch) => syncFields.every((key) => {
  if (!(key in patch)) return true;
  if (key === 'remindAt') return new Date(row[key]).getTime() === new Date(patch[key]).getTime();
  if (key === 'remindOffsetMinutes') return Number(row[key] || 0) === Number(patch[key] || 0);
  return (row[key] || '') === (patch[key] || '');
});
const parseReminder = (text) => call('parseReminder', { text, currentTime: new Date().toISOString(), timezone: 'Asia/Shanghai', locale: 'zh-CN', sourceType: 'text' });
const createReminder = async (reminder, clientRequestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`) => {
  const result = await call('createReminder', { reminder, clientRequestId });
  recordChange(result.reminderId, result.reminder || { ...reminder, status: 'pending', createdAt: new Date().toISOString() });
  return result;
};
const getReminders = async (sort = 'createdAtDesc') => {
  const requestVersion = ++readVersion;
  const startedMutationVersion = mutationVersion;
  const items = []; const seen = new Set(); let cursor = null;
  do {
    const page = await call('getReminders', { group: 'all', pageSize: 50, sort, ...(cursor ? { cursor } : {}) });
    items.push(...page.items);
    cursor = page.nextCursor || null;
    if (cursor && seen.has(cursor)) throw new Error('分页同步未完成，请重试');
    if (cursor) seen.add(cursor);
  } while (cursor);
  const result = { items: Array.from(new Map(items.map(item => [item._id, item])).values()) };
  if (requestVersion < appliedReadVersion) return getCachedReminders() || [];
  const rows = new Map(result.items.map((item) => [item._id, item]));
  changes.forEach((change, id) => {
    const row = rows.get(id);
    if (change.patch.status !== 'deleted' && change.version <= startedMutationVersion && row && matchesChange(row, change.patch)) changes.delete(id);
  });
  appliedReadVersion = requestVersion;
  cachedReminders = reconcileReminders(result.items);
  return cachedReminders;
};
const updateReminder = async (id, reminder) => { const result = await call('updateReminder', { id, reminder }); recordChange(id, reminder); return result; };
const completeReminder = async (id) => { const result = await call('completeReminder', { id }); recordChange(id, { status: 'completed', completedAt: result.completedAt || new Date().toISOString() }); return result; };
const deleteReminder = async (id) => { const result = await call('deleteReminder', { id }); recordChange(id, { status: 'deleted' }); return result; };
const submitFeedback = (content) => call('submitFeedback', { content });
const getReminder = async id => (await call('getReminders', { id })).item;
const getReminderStats = async () => { const stats = await call('getReminders', { mode: 'stats' }); if (!stats || !Number.isInteger(stats.createdCount) || !Number.isInteger(stats.remindedCount)) throw new Error('统计服务尚未就绪'); return stats; };
module.exports = { parseReminder, createReminder, getReminders, getReminder, getReminderStats, updateReminder, completeReminder, deleteReminder, submitFeedback, reconcileReminders, getCachedReminders };
