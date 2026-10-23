const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const isValidOffset = (value) => Number.isInteger(value) && value >= 0 && value <= 525600;
const trim = (v, max) => typeof v === 'string' && v.trim().length <= max ? v.trim() : null;
exports.main = async (event = {}) => {
  const requestId = String(event.requestId || Date.now());
  if (typeof event.id !== 'string' || !event.id || !event.reminder || typeof event.reminder !== 'object') return { code: 'VALIDATION_ERROR', message: '请求参数不合法', data: null, requestId };
  try {
    const { OPENID } = cloud.getWXContext();
    if (!OPENID) return { code: 'UNAUTHENTICATED', message: '暂无法保存，请稍后重试', data: null, requestId };
    const found = await db.collection('reminders').where({ _id: event.id, _openid: OPENID }).limit(1).get();
    if (!found.data.length || found.data[0].status === 'deleted') return { code: 'NOT_FOUND', message: '提醒不存在', data: null, requestId };
    if (found.data[0].status !== 'pending') return { code: 'INVALID_STATUS', message: '已完成提醒不可编辑', data: null, requestId };
    const previous = found.data[0];
    if (previous.notifyStatus === 'sending') return { code: 'CONFLICT', message: '通知正在发送，请稍后再修改', data: null, requestId };
    const patch = event.reminder; const update = { updatedAt: db.serverDate() };
    if ('title' in patch) { const value = trim(patch.title, 60); if (!value) return { code: 'VALIDATION_ERROR', message: '标题为 1–60 字', data: null, requestId }; update.title = value; }
    if ('location' in patch) { const value = trim(patch.location || '', 100); if (value === null) return { code: 'VALIDATION_ERROR', message: '地点最多 100 字', data: null, requestId }; update.location = value; }
    if ('note' in patch) { const value = trim(patch.note || '', 300); if (value === null) return { code: 'VALIDATION_ERROR', message: '备注最多 300 字', data: null, requestId }; update.note = value; }
    if ('notifyStatus' in patch && !['pending', 'authorized', 'denied'].includes(patch.notifyStatus)) return { code: 'VALIDATION_ERROR', message: '通知状态不合法', data: null, requestId };
    if ('notifyStatus' in patch) update.notifyStatus = patch.notifyStatus;
    const offset = 'remindOffsetMinutes' in patch ? Number(patch.remindOffsetMinutes) : found.data[0].remindOffsetMinutes;
    const remindAt = 'remindAt' in patch ? new Date(patch.remindAt) : new Date(found.data[0].remindAt);
    const notifyAt = new Date(remindAt.getTime() - offset * 60000);
    if (!isValidOffset(offset) || Number.isNaN(remindAt.getTime()) || notifyAt.getTime() < Date.now()) return { code: 'VALIDATION_ERROR', message: '时间或提前提醒不合法', data: null, requestId };
    if ('remindAt' in patch || 'remindOffsetMinutes' in patch) {
      const notifyStatus = 'notifyStatus' in patch ? patch.notifyStatus : (previous.notifyStatus === 'authorized' ? 'authorized' : 'pending');
      Object.assign(update, { remindAt, remindOffsetMinutes: offset, notifyAt, notifyAttemptCount: 0, notifyStatus, notifyLockAt: db.command.remove(), notifyLockToken: db.command.remove(), notifyPhase: db.command.remove(), notifyLastError: db.command.remove() });
    }
    update.revision = Number(previous.revision || 0) + 1;
    const saved = await db.collection('reminders').where({ _id: event.id, _openid: OPENID, status: 'pending', revision: typeof previous.revision === 'number' ? previous.revision : db.command.exists(false), notifyStatus: previous.notifyStatus }).update({ data: update });
    if (!saved.stats.updated) return { code: 'CONFLICT', message: '提醒已在其他操作中更新，请刷新后重试', data: null, requestId };
    return { code: 0, message: 'ok', data: { id: event.id }, requestId };
  } catch (error) { console.error('updateReminder failed', error); return { code: 'DATABASE_ERROR', message: '更新失败，请稍后重试', data: null, requestId }; }
};
