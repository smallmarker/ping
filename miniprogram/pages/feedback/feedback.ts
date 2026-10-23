import { submitFeedback } from '../../services/reminder';

Page({
  data: { feedback: '', isSubmitting: false },
  onFeedback(e: WechatMiniprogram.Input) { this.setData({ feedback: e.detail.value }); },
  async submitFeedback() {
    const content = this.data.feedback.trim();
    if (!content || this.data.isSubmitting) return;
    this.setData({ isSubmitting: true });
    try {
      await submitFeedback(content);
      wx.showToast({ title: '感谢你的反馈', icon: 'success' });
      this.setData({ feedback: '' });
    } catch (_) { wx.showToast({ title: '没有发送成功，请稍后重试', icon: 'none' }); }
    finally { this.setData({ isSubmitting: false }); }
  }
});
