const cloud = require('wx-server-sdk');
const { parseText } = require('./parser');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event = {}) => {
  const requestId = String(event.requestId || Date.now());
  const text = typeof event.text === 'string' ? event.text.trim() : '';
  if (!text || text.length > 500) return { code: 'VALIDATION_ERROR', message: '文本长度需为 1–500 字', data: null, requestId };
  if (event.timezone && event.timezone !== 'Asia/Shanghai') return { code: 'VALIDATION_ERROR', message: '仅支持 Asia/Shanghai 时区', data: null, requestId };
  if (event.sourceType && !['text', 'clipboard', 'voice', 'image'].includes(event.sourceType)) return { code: 'VALIDATION_ERROR', message: '无效来源', data: null, requestId };
  try {
    if (!cloud.getWXContext().OPENID) return { code: 'UNAUTHENTICATED', message: '暂无法解析，请稍后重试', data: null, requestId };
    const now = event.currentTime ? new Date(event.currentTime) : new Date();
    if (Number.isNaN(now.getTime())) return { code: 'VALIDATION_ERROR', message: 'currentTime 不合法', data: null, requestId };
    const data = parseText(text, now);
    return { code: 0, message: data.remindAt ? 'ok' : '需要手动补全', data: { ...data, needUserConfirm: true, modelVersion: 'rule-fallback-v3' }, requestId };
  } catch (error) {
    console.error('parseReminder failed', error);
    return { code: 'PARSE_FAILED', message: '没能理解这句话，可手动填写', data: null, requestId };
  }
};
