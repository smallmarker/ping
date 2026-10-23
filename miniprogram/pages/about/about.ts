Page({
  data: { navTop: 26, navHeight: 32, navBarHeight: 64 },
  onLoad() {
    const systemInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const capsule = wx.getMenuButtonBoundingClientRect();
    const navTop = capsule.top || (systemInfo.statusBarHeight || 20) + 6;
    const navHeight = capsule.height || 32;
    this.setData({ navTop, navHeight, navBarHeight: capsule.bottom || navTop + navHeight + 6 });
  },
  goBack() { wx.navigateBack(); }
});
