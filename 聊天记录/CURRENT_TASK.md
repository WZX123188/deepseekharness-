# 当前任务断点（CURRENT_TASK.md）

> 维护规则：开始长任务填写；每步更新；完成改状态「无任务 / 已完成」。新会话自动读本文件。

## 状态：已完成代码与发布，待用户重启桌面端实测

### 本次修复根因（v5.3.2 手机发消息电脑收不到）
- `/api/chat/send` 依赖 `latestAgent`，但 `ctx.on('agent/created', (carrier, ev) => ...)` 监听签名写错。
  实际 cordis 事件回调只收到一个参数 `{ agent }`（不是 `(carrier, ev)`），导致 `ev.agent` 恒为 undefined，
  `latestAgent` 永远为 null → 手机消息一直走「暂存收件箱」分支（delivered:false），电脑 agent 收不到。
  （已用真实 cordis 跑单测证实；dsh 全家桶 8+ 处插件均用 `({ agent })` 签名）
- 另一隐患：旧代码 `agent.inject()` 只是塞进 next-step 队列且【不唤醒】agent；
  改 `agent.followup()`（= next-turn + wakeDriver 真正启动新一轮）。与 dsh-headless 用法一致。
- 顺手修好 `applyCheckpointInjection` 的同样签名 bug（断点自动汇报之前从未生效）+ inject→followup。

### 已改文件
- desktop\dsh\resources\plugin-static\lib\index.js（源，gitignore 内）
- desktop\plugin-static\lib\index.js（打包源，已提交）
- desktop\dsh\data\.dsh\profiles\web\node_modules\dsh-client-static\lib\index.js（正式实例下次启动生效）
- desktop\package.json 版本 5.3.2

### 已发布
- electron-builder --win --dir + make-portable（便携 zip 186.6MB）
- release 保留最新两版：5.3.1 / 5.3.2
- git commit aacfb44 + tag v5.3.2 + push origin main --tags（已确认远端有 v5.3.2）

### 用户下一步（我无法代做，重启会杀掉本会话）
- 关闭并重开桌面客户端（让 5.3.2 的 plugin-static 生效）
- 手机重新打开 http://<IP>:3191/mobile 或 APK → 发一条消息 → 确认电脑端 agent 收到并回复

### 后续需求（下次继续）
- App 图标换小蓝鲸（ico→png + mipmap）
- 手机端补充：意见区、使用指南、市场、壁纸、PDF/Office 翻译
- 二维码扫码直连
- Tailscale 地址加入「手机远程」页（当前只显示局域网 IP）

### 关键信息
- Tailscale：电脑已登录，IP 100.120.241.23；手机需装 Tailscale 登录同账号
- 手机连电脑：网页 http://<IP>:3191/mobile 或 APK；配对码在客户端「手机远程」页
- 手机 RPC 走 3191 /api/rpc（带 token）；3192 仅本机
