const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const reply = (code, message, data, requestId) => ({ code, message, data, requestId });
exports.main = async (event = {}) => {
  const requestId = String(event.requestId || Date.now());
  if (typeof event.id !== 'string' || !event.id) return reply('VALIDATION_ERROR', '无效的提醒 ID', null, requestId);
  try {
    const { OPENID } = cloud.getWXContext();
    if (!OPENID) return reply('UNAUTHENTICATED', '暂无法操作，请稍后重试', null, requestId);
    for (let attempt = 0; attempt < 3; attempt++) {
      const found = await db.collection('reminders').where({ _id: event.id, _openid: OPENID }).limit(1).get();
      if (!found.data.length) return reply('NOT_FOUND', '提醒不存在', null, requestId);
      const previous = found.data[0];
      if (previous.status === 'deleted') return reply(0, 'ok', { deleted: true, id: event.id }, requestId);
      const saved = await db.collection('reminders').where({ _id: event.id, _openid: OPENID, status: previous.status, revision: typeof previous.revision === 'number' ? previous.revision : db.command.exists(false) }).update({ data: {
        status: 'deleted', deletedAt: db.serverDate(), updatedAt: db.serverDate(), revision: Number(previous.revision || 0) + 1,
        title: db.command.remove(), location: db.command.remove(), note: db.command.remove(), sourceText: db.command.remove(), text: db.command.remove(), notifyLastError: db.command.remove(), requestFingerprint: db.command.remove(),
        notifyStatus: 'cancelled', notifyLockAt: db.command.remove(), notifyLockToken: db.command.remove(), notifyPhase: db.command.remove()
      } });
      if (saved.stats.updated) return reply(0, 'ok', { deleted: true, id: event.id }, requestId);
    }
    return reply('CONFLICT', '提醒状态正在更新，请重试删除', null, requestId);
  } catch (error) { console.error('deleteReminder failed', error); return reply('DATABASE_ERROR', '删除失败，请稍后重试', null, requestId); }
};
