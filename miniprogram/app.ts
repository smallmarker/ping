App({
  globalData: { env: 'ping-dev-d9gv5yyyae82b50bd', lastSeenClipboardText: '', suppressClipboardOnce: false, savedComposerText: null as string | null },
  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上基础库');
      return;
    }
    wx.cloud.init({ env: this.globalData.env || undefined, traceUser: false });
  }
});
