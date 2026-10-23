const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
let feedbackCollectionReady = false;
const ensureFeedbackCollection = async () => {
  if (feedbackCollectionReady) return;
  try { await db.createCollection('feedback'); }
  catch (error) {
    if (!/exist|already|重复|存在/i.test(String(error?.message || error?.errMsg || ''))) throw error;
  }
  feedbackCollectionReady = true;
};
exports.main = async (event = {}) => {
  const requestId = String(event.requestId || Date.now());
  const content = typeof event.content === 'string' ? event.content.trim() : '';
  if (!content || content.length > 300) return { code: 'VALIDATION_ERROR', message: '反馈需为 1–300 字', data: null, requestId };
  try {
    const { OPENID } = cloud.getWXContext();
    if (!OPENID) return { code: 'UNAUTHENTICATED', message: '暂无法提交，请稍后重试', data: null, requestId };
    await ensureFeedbackCollection();
    const added = await db.collection('feedback').add({ data: { _openid: OPENID, content, status: 'new', createdAt: db.serverDate(), expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000) } });
    return { code: 0, message: 'ok', data: { feedbackId: added._id }, requestId };
  } catch (error) { console.error('submitFeedback failed', { code: error?.code || error?.errCode || 'UNKNOWN' }); return { code: 'DATABASE_ERROR', message: '提交失败，请稍后重试', data: null, requestId }; }
};
