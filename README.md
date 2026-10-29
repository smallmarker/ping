# Ping

一句话，轻轻记住。Ping 是基于微信云开发的自然语言提醒小程序：输入「周六下午三点喝咖啡，提前十分钟提醒」，确认解析结果后保存，让约定有处安放。

## 扫码体验

使用微信扫描下方小程序码，打开 Ping。

<img src="docs/media/ping-miniprogram-code.jpg" alt="Ping 微信小程序码" width="258" height="258" />

## 30 秒宣传视频

<a href="https://github.com/smallmarker/ping/blob/main/docs/media/ping-promo-30s.mp4">
  <img src="docs/media/ping-promo-poster.jpg" alt="点击观看 Ping 30 秒宣传视频" width="360" />
</a>

[▶ 观看完整视频](https://github.com/smallmarker/ping/blob/main/docs/media/ping-promo-30s.mp4) · [下载 MP4](https://github.com/smallmarker/ping/raw/refs/heads/main/docs/media/ping-promo-30s.mp4)

30 秒 · 1080 × 1920 竖屏 · 含音乐与交互音效。视频中的聊天和通知画面为演示；实际接收提醒需允许订阅消息，且由服务端成功发送。

## 功能

- **自然语言创建提醒**：解析时间、事项与提前提醒时间，保存前可核对和修改。
- **提醒管理**：查看、编辑、删除提醒，已通知的事项归入历史记录。
- **微信订阅消息**：授权后，通过云函数定时发送到期提醒。
- **主动读取剪贴板**：点击「使用剪贴板」才读取内容，点击 Ping 后才上传解析。

当前采用确定性规则解析，未接入外部 AI 模型。
