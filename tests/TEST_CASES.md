# Ping 本地测试用例

执行命令：`node tests/local-cloudfunctions.test.js`

| 编号 | 场景 | 预期 |
| --- | --- | --- |
| PARSE-01 | 相对日期、下午时间解析 | 返回标准 ISO 时间和清理后的标题 |
| PARSE-02 | 缺失时间 | 返回手动补全提示 |
| PARSE-03 | 非上海时区 | 拒绝请求 |
| CREATE-01~03 | 创建、幂等、过期时间 | 仅保存合法未来提醒 |
| GET-01 | 获取提醒 | 仅返回当前用户数据 |
| UPDATE-01~02 | 更新、已完成限制 | 仅待办提醒可编辑 |
| COMPLETE-01~02 | 完成、重复完成 | 完成操作幂等 |
| DELETE-01~02 | 软删除、重复删除 | 不物理删除且操作幂等 |
| EDIT-DELETE-01 | 编辑页删除入口、取消、确认及失败重试 | 新建草稿不能删除；取消不调用接口；成功返回列表；失败保留弹层 |
| HOME-CLIPBOARD-01 | 删除后回首页、再次进入首页、剪贴板变化及延迟回调 | 删除后不读取剪贴板；相同内容不重复提示；新内容可提示；隐藏页不弹提示 |
| FEEDBACK-01~02 | 反馈校验 | 保存有效反馈、拒绝空反馈 |
| SEND-01~02 | 定时任务鉴权、模板配置 | 未配置生产凭据时安全拒绝 |

这些用例通过内存版 CloudBase SDK 运行，不会访问云端数据库、发送订阅消息或需要正式 AppID。
`EDIT-DELETE-01` 由 `node tests/reminder-edit-delete.test.js` 使用模拟页面与接口执行，同样不会删除真实提醒。
`HOME-CLIPBOARD-01` 由 `node tests/index-clipboard-return.test.js` 使用模拟页面执行，不读取真实剪贴板。
