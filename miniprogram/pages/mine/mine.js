const { getReminderStats } = require('../../services/reminder');
Page({
  data: { version: 'V1.0.0', createdCount: 0, remindedCount: 0, statsError: false },
  onShow() { this.loadStats(); },
  async loadStats() { try { const stats = await getReminderStats(); this.setData({ ...stats, statsError: false }); } catch (_) { this.setData({ statsError: true }); } },
  goPrivacy() { wx.navigateTo({ url: '/pages/privacy/privacy' }); },
  goAbout() { wx.navigateTo({ url: '/pages/about/about' }); }
});
