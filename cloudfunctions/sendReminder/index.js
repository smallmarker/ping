const moduleStarted = Date.now();
const cloud = require('wx-server-sdk');
const { randomUUID } = require('node:crypto');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const MAX_ATTEMPTS = 3;
const MAX_LATENESS = 5 * 60 * 1000;
const LEASE_MS = 2 * 60 * 1000;
const WORK_BUDGET_MS = 2200;
const SEND_RESERVE_MS = 900;
const TIMER = 'pingReminderEveryMinute';
const formatTime = value => new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(value).replace(/\//g, '-');
const revision = row => typeof row.revision === 'number' ? row.revision : db.command.exists(false);
const release = () => ({ notifyLockAt: db.command.remove(), notifyLockToken: db.command.remove(), notifyPhase: db.command.remove(), updatedAt: db.serverDate() });
const moduleLoadMs = Date.now() - moduleStarted;
let firstInvocation = true;
exports.main = async (event = {}) => {
  const started = Date.now();
  const budget = Math.max(0, WORK_BUDGET_MS - (firstInvocation ? moduleLoadMs : 0));
  firstInvocation = false;
  const requestId = String(event.requestId || 'cron-' + started);
  if (cloud.getWXContext().SOURCE !== 'wx_trigger' || !['timer', 'Timer'].includes(event.Type) || event.TriggerName !== TIMER) return { code: 'FORBIDDEN', message: '仅允许微信定时任务调用', data: null, requestId };
  const templateId = process.env.SUBSCRIBE_TEMPLATE_ID;
  if (!templateId) return { code: 'CONFIG_ERROR', message: '未配置订阅消息模板', data: null, requestId };
  const now = new Date(started); const oldest = new Date(started - MAX_LATENESS);
  const remaining = () => budget - (Date.now() - started);
  const summary = { scanned: 0, sent: 0, failed: 0, skipped: 0, recovered: 0, uncertain: 0, missed: 0, deferred: 0 };
  try {
    // 免费版每次至多发送一条。空闲轮次才维护过期状态/旧租约，不让维护扫描拖慢发送。
    const due = await db.collection('reminders').where({ status: 'pending', notifyStatus: 'authorized', notifyAt: db.command.and([db.command.gte(oldest), db.command.lte(now)]), notifyAttemptCount: db.command.lt(MAX_ATTEMPTS) }).orderBy('notifyAt', 'asc').limit(1).get();
    summary.scanned = due.data.length;
    const row = due.data[0];
    if (!row) {
      if (remaining() < SEND_RESERVE_MS) { summary.deferred++; return { code: 0, message: 'ok', data: summary, requestId }; }
      const stale = await db.collection('reminders').where(db.command.or([
        { notifyStatus: 'sending', notifyLockAt: db.command.lte(new Date(started - LEASE_MS)) },
        { status: 'pending', notifyStatus: 'authorized', notifyAt: db.command.lt(oldest) },
        { status: 'pending', notifyStatus: 'authorized', notifyAttemptCount: db.command.gte(MAX_ATTEMPTS) }
      ])).limit(1).get();
      const item = stale.data[0];
      if (item && remaining() > 300) {
        let status; let error;
        if (item.notifyStatus === 'sending') {
          const safeToRetry = item.notifyPhase === 'claimed';
          status = safeToRetry ? (item.status !== 'pending' ? 'cancelled' : new Date(item.notifyAt) < oldest ? 'missed' : 'authorized') : 'unknown';
          error = safeToRetry ? '发送任务中断，已恢复状态' : '发送结果未确认，请查看微信消息；为避免重复通知未自动重发';
        } else {
          status = new Date(item.notifyAt) < oldest ? 'missed' : 'failed';
          error = status === 'missed' ? '通知时间已错过，请重新设置提醒' : '通知重试次数已用完，请重新设置提醒';
        }
        const condition = { _id: item._id, status: item.status, revision: revision(item), notifyStatus: item.notifyStatus };
        if (item.notifyStatus === 'sending') Object.assign(condition, { notifyLockAt: item.notifyLockAt, notifyLockToken: item.notifyLockToken || db.command.exists(false) });
        const saved = await db.collection('reminders').where(condition).update({ data: { ...release(), notifyStatus: status, notifyLastError: error } });
        if (saved.stats.updated) { if (item.notifyStatus === 'sending') summary.recovered++; if (status === 'missed') summary.missed++; }
      } else if (item) summary.deferred++;
    } else if (remaining() < SEND_RESERVE_MS + 300) {
      summary.deferred++;
    } else {
      const lockToken = randomUUID();
      // 原子领取即进入结果可能未知的发送阶段，省去一轮数据库往返。
      // 从这里起若进程被硬终止，不证明微信未收到请求，不能自动重发。
      const lock = await db.collection('reminders').where({ _id: row._id, status: 'pending', notifyStatus: 'authorized', revision: revision(row) }).update({ data: { notifyStatus: 'sending', notifyPhase: 'dispatching', notifyLockToken: lockToken, notifyLockAt: db.serverDate(), updatedAt: db.serverDate() } });
      if (!lock.stats.updated) summary.skipped++;
      else if (remaining() < SEND_RESERVE_MS) {
        // 尚未调用微信，明确安全地让给下一轮；回写失败仍按未知租约处理。
        await db.collection('reminders').where({ _id: row._id, notifyStatus: 'sending', notifyLockToken: lockToken }).update({ data: { ...release(), notifyStatus: 'authorized' } });
        summary.deferred++;
      } else {
        let sendError; let timeout;
        try {
          const available = Math.max(1, remaining() - 400);
          await Promise.race([
            cloud.openapi.subscribeMessage.send({ touser: row._openid, templateId, page: 'pages/detail/detail?id=' + row._id, data: { thing5: { value: row.title.slice(0, 20) }, date4: { value: formatTime(row.remindAt).slice(0, 16) } } }),
            new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('network timeout: delivery result unknown')), available); })
          ]);
        } catch (error) { sendError = error; }
        finally { if (timeout) clearTimeout(timeout); }
        // Promise 超时不取消网络请求，也不证明未送达；以 unknown 记录，不再尝试第二次。
        const attempts = Number(row.notifyAttemptCount || 0) + 1;
        let patch;
        if (!sendError) patch = { notifyStatus: 'sent', sentAt: db.serverDate(), notifyAttemptCount: attempts, notifyLastError: db.command.remove() };
        else {
          const code = Number(sendError.errCode);
          const uncertain = /timeout|network/i.test(String(sendError.errMsg || sendError.message || '')) || !Number.isFinite(code);
          patch = { notifyStatus: uncertain ? 'unknown' : code === 45009 && attempts < MAX_ATTEMPTS ? 'authorized' : 'failed', notifyAttemptCount: attempts, notifyLastError: uncertain ? '发送结果未确认，请查看微信消息；为避免重复通知未自动重发' : '通知未发送成功（' + code + '），请重新设置提醒' };
          console.error('sendReminder delivery failed', { requestId, reminderId: row._id, errCode: Number.isFinite(code) ? code : 'unknown' });
        }
        try {
          await db.collection('reminders').where({ _id: row._id, notifyStatus: 'sending', notifyLockToken: lockToken }).update({ data: { ...release(), ...patch } });
          if (!sendError) summary.sent++; else if (patch.notifyStatus === 'unknown') summary.uncertain++; else summary.failed++;
        } catch (_) { summary.uncertain++; console.error('sendReminder result write failed', { requestId, reminderId: row._id }); }
      }
    }
    console.info('sendReminder result', { requestId, ...summary, durationMs: Date.now() - started });
    return { code: 0, message: 'ok', data: summary, requestId };
  } catch (error) {
    console.error('sendReminder failed', { requestId, errCode: error.errCode || 'unknown' });
    return { code: 'DATABASE_ERROR', message: '发送任务失败', data: summary, requestId };
  }
};
