const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
exports.main = async (event = {}) => {
  if (cloud.getWXContext().SOURCE !== 'wx_trigger' || !['timer', 'Timer'].includes(event.Type) || event.TriggerName !== 'pingFeedbackRetentionDaily') {
    return { code: 'FORBIDDEN', message: '仅允许定时任务执行', data: null };
  }
  try {
    // Only feedback explicitly carrying the new retention field can expire.
    // Legacy rows without expiresAt and every reminder are intentionally untouched.
    const started = Date.now(); const cutoff = new Date(started);
    const { data } = await db.collection('feedback').where({ expiresAt: db.command.lte(cutoff) }).limit(10).get();
    if (!data.length) return { code: 0, message: 'ok', data: { removed: 0, deferred: false } };
    if (Date.now() - started > 1600) return { code: 0, message: 'ok', data: { removed: 0, deferred: true } };
    // 一次查询 + 一次条件批量删除，不循环；再次核验到期条件，避免并发更改后误删。
    const result = await db.collection('feedback').where({ _id: db.command.in(data.map(item => item._id)), expiresAt: db.command.lte(cutoff) }).remove();
    console.info('privacyMaintenance result', { removed: result.stats.removed, batchFull: data.length === 10, durationMs: Date.now() - started });
    return { code: 0, message: 'ok', data: { removed: result.stats.removed, deferred: false, batchFull: data.length === 10 } };
  } catch (error) {
    console.error('privacyMaintenance failed', { code: error?.code || error?.errCode || 'UNKNOWN' });
    return { code: 'DATABASE_ERROR', message: '清理失败，请检查任务日志', data: null };
  }
};
