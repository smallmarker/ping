const cloud = require('wx-server-sdk');
const { createHash } = require('node:crypto');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const isValidOffset = (value) => Number.isInteger(value) && value >= 0 && value <= 525600;
const SOURCE_TYPES = new Set(['text', 'clipboard', 'voice', 'image']);
const NOTIFY_STATUSES = new Set(['pending', 'authorized', 'denied']);
const reply = (code, message, data, requestId) => ({ code, message, data, requestId });
const safeText = (value, max) => typeof value === 'string' && value.trim().length <= max ? value.trim() : null;
let remindersCollectionReady = false;

// 新环境首次写入前没有集合时，CloudBase 会拒绝 add。创建操作幂等：
// 多个冷启动实例并发创建时，已存在错误可安全忽略。
const ensureRemindersCollection = async () => {
  if (remindersCollectionReady) return;
  try { await db.createCollection('reminders'); }
  catch (error) {
    if (!/exist|already|重复|存在/i.test(String(error?.message || error?.errMsg || ''))) throw error;
  }
  remindersCollectionReady = true;
};

exports.main = async (event = {}) => {
  const requestId = String(event.requestId || event.clientRequestId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`).slice(0, 80);
  try {
    const { OPENID } = cloud.getWXContext();
    if (!OPENID) return reply('UNAUTHENTICATED', '暂无法保存，请稍后重试', null, requestId);
    const clientRequestId = typeof event.clientRequestId === 'string' ? event.clientRequestId : '';
    if (clientRequestId.length > 80) return reply('VALIDATION_ERROR', '请求标识过长', null, requestId);
    await ensureRemindersCollection();
    const fingerprint = createHash('sha256').update(JSON.stringify(['title', 'remindAt', 'remindOffsetMinutes', 'location', 'note', 'sourceType'].map(key => [key, event.reminder?.[key] ?? null]))).digest('hex');
    const duplicate = async () => {
      if (!clientRequestId) return null;
      const existing = await db.collection('reminders').where({ _openid: OPENID, clientRequestId }).limit(1).get();
      if (!existing.data.length) return null;
      const row = existing.data[0];
      if (row.status === 'deleted') return reply('REQUEST_ALREADY_DELETED', '该请求对应的提醒已删除，请重新创建', null, requestId);
      if (row.requestFingerprint && row.requestFingerprint !== fingerprint) return reply('IDEMPOTENCY_CONFLICT', '请求内容已变化，请重新提交', null, requestId);
      return reply(0, 'ok', { reminderId: row._id, duplicated: true, reminder: row }, requestId);
    };
    // 先查幂等结果；已经保存但响应丢失的请求，时间过期后重试仍返回原记录。
    const existing = await duplicate();
    if (existing) return existing;
    const reminder = event.reminder || {};
    const title = safeText(reminder.title, 60);
    const location = reminder.location == null ? '' : safeText(reminder.location, 100);
    const note = reminder.note == null ? '' : safeText(reminder.note, 300);
    const offset = Number(reminder.remindOffsetMinutes ?? 0);
    const remindAt = new Date(reminder.remindAt);
    const sourceType = reminder.sourceType || 'text';
    const notifyStatus = reminder.notifyStatus || 'pending';
    if (!title || location === null || note === null || !isValidOffset(offset) || !SOURCE_TYPES.has(sourceType) || !NOTIFY_STATUSES.has(notifyStatus)) return reply('VALIDATION_ERROR', '提醒字段不合法', null, requestId);
    if (Number.isNaN(remindAt.getTime())) return reply('INVALID_REMIND_AT', '提醒时间不合法', null, requestId);
    const notifyAt = new Date(remindAt.getTime() - offset * 60000);
    if (notifyAt.getTime() < Date.now()) return reply('PAST_NOTIFY_AT', '提醒时间不能早于当前时间', null, requestId);
    // 文档ID在数据库层唯一；跨冷启动、跨实例并发也不能插入第二条。
    const documentId = clientRequestId ? createHash('sha256').update(`${OPENID}\0${clientRequestId}`).digest('hex').slice(0, 32) : undefined;
    let result;
    try { result = await db.collection('reminders').add({ data: {
      ...(documentId ? { _id: documentId } : {}), revision: 0, requestFingerprint: fingerprint,
      _openid: OPENID, title, remindAt, remindOffsetMinutes: offset, notifyAt, location, note, status: 'pending', sourceType, notifyStatus, notifyAttemptCount: 0,
      aiConfidence: typeof reminder.aiConfidence === 'number' && reminder.aiConfidence >= 0 && reminder.aiConfidence <= 1 ? reminder.aiConfidence : null,
      clientRequestId: clientRequestId || undefined, createdAt: db.serverDate(), updatedAt: db.serverDate()
    }}); } catch (error) {
      const saved = await duplicate();
      if (saved) return saved;
      throw error;
    }
    return reply(0, 'ok', { reminderId: result._id, duplicated: false }, requestId);
  } catch (error) { console.error('createReminder failed', error); return reply('DATABASE_ERROR', '保存失败，请稍后重试', null, requestId); }
};
