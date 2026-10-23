import { Reminder } from '../types/reminder';

interface ApiResponse<T> { code: number | string; message: string; data: T; requestId: string; }
const changes = new Map<string, { version: number; patch: Partial<Reminder> }>();
let mutationVersion = 0;
let readVersion = 0;
let appliedReadVersion = 0;
let cachedReminders: Reminder[] | null = null;
export const reconcileReminders = (items: Reminder[]): Reminder[] => {
  const rows = new Map(items.filter(item => item.status !== 'deleted').map(item => [item._id, item]));
  changes.forEach(({ patch }, id) => {
    if (patch.status === 'deleted') rows.delete(id);
    else rows.set(id, { ...(rows.get(id) || (cachedReminders || []).find(item => item._id === id)), ...patch, _id: id } as Reminder);
  });
  return Array.from(rows.values());
};
export const getCachedReminders = () => cachedReminders === null ? null : reconcileReminders(cachedReminders);
const recordChange = (id: string, patch: Partial<Reminder>) => { changes.set(id, { version: ++mutationVersion, patch: { ...changes.get(id)?.patch, ...patch } }); };
const syncFields = ['title', 'remindAt', 'remindOffsetMinutes', 'location', 'note', 'status'] as const;
const matchesChange = (row: Reminder, patch: Partial<Reminder>) => syncFields.every(key => {
  if (!(key in patch)) return true;
  if (key === 'remindAt') return new Date(row[key]).getTime() === new Date(patch[key] || '').getTime();
  if (key === 'remindOffsetMinutes') return Number(row[key] || 0) === Number(patch[key] || 0);
  return (row[key] || '') === (patch[key] || '');
});
const call = async <T>(name: string, data = {}): Promise<T> => {
  const result = (await wx.cloud.callFunction({ name, data })).result as ApiResponse<T>;
  if (!result || result.code !== 0) throw new Error(result?.message || '服务暂不可用');
  return result.data;
};

export type ParsedReminder = Pick<Reminder, 'title' | 'remindAt' | 'location' | 'note'> & { confidence: number; missingFields: Array<'title' | 'date' | 'time'>; parseWarnings: string[]; rawTimeText: string; timePrecision: 'date' | 'hour' | 'minute' | 'unknown'; };
export const parseReminder = (text: string) => call<ParsedReminder>('parseReminder', { text, currentTime: new Date().toISOString(), timezone: 'Asia/Shanghai', locale: 'zh-CN', sourceType: 'text' });
export const createReminder = async (reminder: Reminder, clientRequestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`) => { const result = await call<{ reminderId: string; reminder?: Reminder }>('createReminder', { reminder, clientRequestId }); recordChange(result.reminderId, result.reminder || { ...reminder, status: 'pending', createdAt: new Date().toISOString() }); return result; };
export const getReminders = async (sort: 'remindAtAsc' | 'createdAtDesc' = 'createdAtDesc') => {
  const requestVersion = ++readVersion;
  const startedMutationVersion = mutationVersion;
  const items: Reminder[] = []; const seen = new Set<string>(); let cursor: string | null = null;
  do {
    const page: { items: Reminder[]; nextCursor?: string | null } = await call('getReminders', { group: 'all', pageSize: 50, sort, ...(cursor ? { cursor } : {}) });
    items.push(...page.items); cursor = page.nextCursor || null;
    if (cursor && seen.has(cursor)) throw new Error('分页同步未完成，请重试');
    if (cursor) seen.add(cursor);
  } while (cursor);
  const result = { items: Array.from(new Map(items.map(item => [item._id, item])).values()) };
  if (requestVersion < appliedReadVersion) return getCachedReminders() || [];
  const rows = new Map(result.items.map(item => [item._id, item]));
  changes.forEach((change, id) => { const row = rows.get(id); if (change.patch.status !== 'deleted' && change.version <= startedMutationVersion && row && matchesChange(row, change.patch)) changes.delete(id); });
  appliedReadVersion = requestVersion;
  cachedReminders = reconcileReminders(result.items);
  return cachedReminders;
};
export const updateReminder = async (id: string, reminder: Partial<Reminder>) => { const result = await call<{ id: string }>('updateReminder', { id, reminder }); recordChange(id, reminder); return result; };
export const completeReminder = async (id: string) => { const result = await call<{ id: string; completedAt?: string }>('completeReminder', { id }); recordChange(id, { status: 'completed', completedAt: result.completedAt || new Date().toISOString() }); return result; };
export const deleteReminder = async (id: string) => { const result = await call<{ id: string }>('deleteReminder', { id }); recordChange(id, { status: 'deleted' }); return result; };
export const submitFeedback = (content: string) => call<{ feedbackId: string }>('submitFeedback', { content });
export const getReminder = async (id: string) => (await call<{ item: Reminder }>('getReminders', { id })).item;
export const getReminderStats = async () => { const stats = await call<{ createdCount: number; completedCount: number; remindedCount: number }>('getReminders', { mode: 'stats' }); if (!stats || !Number.isInteger(stats.createdCount) || !Number.isInteger(stats.remindedCount)) throw new Error('统计服务尚未就绪'); return stats; };
