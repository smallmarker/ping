App({
  globalData: { env: 'ping-dev-d9gv5yyyae82b50bd', lastSeenClipboardText: '', suppressClipboardOnce: false, savedComposerText: null },
  onLaunch() {
    if (!wx.cloud) return console.error('请使用 2.2.3 或以上基础库');
    wx.cloud.init({ env: this.globalData.env || undefined, traceUser: false });
  }
});
