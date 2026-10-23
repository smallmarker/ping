const labels = {
  pending: '尚未开启通知，可通过编辑重新设置', denied: '通知未开启，可通过编辑重新授权',
  authorized: '已获得本次通知授权，等待到点发送', sending: '通知正在发送', sent: '微信已接受通知，请在微信消息中查看',
  failed: '通知发送失败，请通过编辑重新设置', missed: '已错过通知时间，请通过编辑重新设置',
  unknown: '通知结果未确认，请先查看微信消息；为避免重复未自动重发', cancelled: '通知已取消'
};
exports.noticeStatusLabel = value => labels[value] || '通知状态暂未确认';
