const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
exports.main = async (event = {}) => {
  const requestId = String(event.requestId || Date.now());
  if (typeof event.id !== 'string' || !event.id) return { code: 'VALIDATION_ERROR', message: '无效的提醒 ID', data: null, requestId };
  try {
    const { OPENID } = cloud.getWXContext();
    if (!OPENID) return { code: 'UNAUTHENTICATED', message: '暂无法操作，请稍后重试', data: null, requestId };
    const found = await db.collection('reminders').where({ _id: event.id, _openid: OPENID }).limit(1).get();
    if (!found.data.length || found.data[0].status === 'deleted') return { code: 'NOT_FOUND', message: '提醒不存在', data: null, requestId };
    if (found.data[0].status === 'completed') return { code: 0, message: 'ok', data: { id: event.id, completedAt: found.data[0].completedAt, alreadyCompleted: true }, requestId };
    const previous = found.data[0];
    const saved = await db.collection('reminders').where({ _id: event.id, _openid: OPENID, status: 'pending', revision: typeof previous.revision === 'number' ? previous.revision : db.command.exists(false) }).update({ data: { status: 'completed', completedAt: db.serverDate(), updatedAt: db.serverDate(), revision: Number(previous.revision || 0) + 1 } });
    if (!saved.stats.updated) return { code: 'CONFLICT', message: '提醒状态已变化，请刷新后重试', data: null, requestId };
    return { code: 0, message: 'ok', data: { id: event.id, alreadyCompleted: false }, requestId };
  } catch (error) { console.error('completeReminder failed', error); return { code: 'DATABASE_ERROR', message: '操作失败，请稍后重试', data: null, requestId }; }
};
