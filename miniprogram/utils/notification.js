// Ping 提醒的一次性订阅消息模板；云端 sendReminder 的模板 ID 需保持一致。
const SUBSCRIBE_TEMPLATE_ID = 'HtgkJMyjVsj_7LwYSBDY5KtpseqrA8hh5cTBHuEojTI';
const requestNotificationPermission = () => new Promise((resolve) => {
  if (!SUBSCRIBE_TEMPLATE_ID || !wx.requestSubscribeMessage) return resolve(null);
  wx.requestSubscribeMessage({
    tmplIds: [SUBSCRIBE_TEMPLATE_ID],
    success: (result) => resolve(result[SUBSCRIBE_TEMPLATE_ID] === 'accept' ? 'authorized' : 'denied'),
    fail: () => resolve('denied')
  });
});
module.exports = { requestNotificationPermission };
