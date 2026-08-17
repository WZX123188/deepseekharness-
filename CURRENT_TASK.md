# 当前任务断点（CURRENT_TASK.md）

> 维护规则：开始长任务填写；每步更新；完成改状态「无任务 / 已完成」。新会话自动读本文件。

## 状态：进行中（v5.3.2 修复手机发消息电脑收不到）

### 本次修复根因
- `/api/chat/send` 依赖 `latestAgent`，但 `ctx.on('agent/created', (carrier, ev) => ...)` 监听签名写错了。
  实际 cordis 事件回调只收到一个参数 `{ agent }`（不是 `(carrier, ev)`），导致 `ev.agent` 恒为 undefined，
  `latestAgent` 永远为 null → 手机消息一直走「暂存收件箱」分支（delivered:false），电脑 agent 收不到。
  （已用真实 cordis 跑单测证实：旧签名 carrier={agent} 且 ev=undefined；新签名 `({agent})` 正确取到 agent.id）
- 另一个隐患：旧代码用 `agent.inject()` 注入，而 inject 只是把消息塞进 next-step 队列且【不唤醒】agent；
  改为 `agent.followup()`（= next-turn + wakeDriver 真正启动新一轮处理）。与 dsh-headless/dsh-host-apiproxy 用法一致。
- 同时修好了 `applyCheckpointInjection`（同样的签名 bug，之前断点自动汇报从未生效）。

### 已改文件
- desktop\dsh\resources\plugin-static\lib\index.js（源）
- desktop\plugin-static\lib\index.js（打包源）
- desktop\dsh\data\.dsh\profiles\web\node_modules\dsh-client-static\lib\index.js（正式实例下次启动生效）
- desktop\package.json 版本 5.3.2

### 已验证
- node --check 通过；test-env（3197/3193/3195）插件正常加载、/api/status、/api/rpc getRemoteInfo/getChatMessages、/api/chat/send 均正常响应
- cordis 单测证实 agent/created 回调签名

### 待办（本任务收尾）
- [ ] 打包（electron-builder --win --dir + make-portable）→ 清理旧 release 只留最新两个
- [ ] git add/commit/tag v5.3.2/push
- [ ] 用户重启桌面端后用手机实测发消息

### 后续需求（下次继续）
- App 图标换小蓝鲸（ico→png + mipmap）
- 手机端补充：意见区、使用指南、市场、壁纸、PDF/Office 翻译
- 二维码扫码直连
- Tailscale 地址加入「手机远程」页（当前只显示局域网 IP）

### 关键信息
- Tailscale：电脑已登录，IP 100.120.241.23；手机需装 Tailscale 登录同账号
- 手机连电脑：网页 http://<IP>:3191/mobile 或 APK；配对码在客户端「手机远程」页
- 手机 RPC 走 3191 /api/rpc（带 token）；3192 仅本机
