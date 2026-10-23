const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const publicReminder = row => { const { _openid, requestFingerprint, clientRequestId, notifyLockToken, notifyPhase, ...item } = row; return item; };
exports.main = async (event = {}) => {
  const requestId = String(event.requestId || Date.now());
  const pageSize = Number(event.pageSize || 50);
  const group = event.group || 'all';
  const sort = event.sort || 'remindAtAsc';
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50 || !['all', 'pending', 'completed'].includes(group) || !['remindAtAsc', 'createdAtDesc'].includes(sort)) return { code: 'VALIDATION_ERROR', message: '请求参数不合法', data: null, requestId };
  try {
    const { OPENID } = cloud.getWXContext();
    if (!OPENID) return { code: 'UNAUTHENTICATED', message: '暂无法加载，请稍后重试', data: null, requestId };
    if (event.id !== undefined) {
      if (typeof event.id !== 'string' || !event.id || event.id.length > 128) return { code: 'VALIDATION_ERROR', message: '无效提醒标识', data: null, requestId };
      const found = await db.collection('reminders').where({ _id: event.id, _openid: OPENID, status: db.command.neq('deleted') }).limit(1).get();
      if (!found.data.length) return { code: 'NOT_FOUND', message: '提醒不存在或已删除', data: null, requestId };
      return { code: 0, message: 'ok', data: { item: publicReminder(found.data[0]) }, requestId };
    }
    if (event.mode === 'stats') {
      const [created, completed, reminded] = await Promise.all([db.collection('reminders').where({ _openid: OPENID }).count(), db.collection('reminders').where({ _openid: OPENID, status: 'completed' }).count(), db.collection('reminders').where({ _openid: OPENID, status: db.command.neq('deleted'), notifyStatus: 'sent' }).count()]);
      // completedCount remains for old clients; it must never imply notification success.
      return { code: 0, message: 'ok', data: { createdCount: created.total, completedCount: completed.total, remindedCount: reminded.total }, requestId };
    }
    const status = group === 'all' ? db.command.neq('deleted') : group;
    const field = group === 'completed' ? 'completedAt' : sort === 'createdAtDesc' ? 'createdAt' : 'remindAt';
    const direction = group === 'completed' || sort === 'createdAtDesc' ? 'desc' : 'asc';
    let query = { _openid: OPENID, status };
    if (event.cursor) {
      if (typeof event.cursor !== 'string' || event.cursor.length > 1024) return { code: 'VALIDATION_ERROR', message: '分页标识不合法', data: null, requestId };
      let cursor;
      try { cursor = JSON.parse(Buffer.from(event.cursor, 'base64url').toString('utf8')); } catch (_) {}
      if (!cursor || cursor.field !== field || cursor.direction !== direction || cursor.group !== group || typeof cursor.id !== 'string' || cursor.id.length > 128 || Number.isNaN(new Date(cursor.time).getTime())) return { code: 'VALIDATION_ERROR', message: '分页标识不合法', data: null, requestId };
      const compare = value => direction === 'desc' ? db.command.lt(value) : db.command.gt(value);
      query = db.command.and([query, db.command.or([{ [field]: compare(new Date(cursor.time)) }, { [field]: new Date(cursor.time), _id: compare(cursor.id) }])]);
    }
    const { data } = await db.collection('reminders').where(query).orderBy(field, direction).orderBy('_id', direction).limit(pageSize + 1).get();
    const items = data.slice(0, pageSize);
    const last = items.at(-1);
    const nextCursor = data.length > pageSize && last ? Buffer.from(JSON.stringify({ field, direction, group, id: last._id, time: new Date(last[field]).toISOString() })).toString('base64url') : null;
    return { code: 0, message: 'ok', data: { items: items.map(publicReminder), nextCursor }, requestId };
  } catch (error) { console.error('getReminders failed', error); return { code: 'DATABASE_ERROR', message: '加载失败，请稍后重试', data: null, requestId }; }
};
