const { getReminderStats } = require('../../services/reminder');
Page({
  statsLoadVersion: 0,
  data: { version: 'V1.0.0', createdCount: 0, remindedCount: 0, statsError: false },
  onShow() { this.loadStats(); },
  async loadStats(event) { const version = ++this.statsLoadVersion; try { const stats = await getReminderStats({ force: !!event }); if (version === this.statsLoadVersion) this.setData({ ...stats, statsError: false }); } catch (_) { if (version === this.statsLoadVersion) this.setData({ statsError: true }); } },
  goPrivacy() { wx.navigateTo({ url: '/pages/privacy/privacy' }); },
  goAbout() { wx.navigateTo({ url: '/pages/about/about' }); }
});
