# 当前任务断点（CURRENT_TASK.md）

> 维护规则：开始长任务填写；每步更新；完成改状态「无任务 / 已完成」。新会话自动读本文件。

## 状态：无任务 / 已完成

### 最近完成（v5.3.2 手机发消息电脑收不到）
- 根因：`ctx.on('agent/created', (carrier, ev) => ...)` 签名写错，实际 cordis 回调只收一个参数 `{ agent }`，
  导致 `latestAgent` 恒 null → 手机消息走「暂存收件箱」分支收不到；另 `inject` 不唤醒 agent，改 `followup`。
- 修复并同步三处 index.js，版本 5.3.2，打包便携 zip，commit + tag v5.3.2 + push。
- **实测通过**：用户重启桌面端后，用手机发「测试」「这里是手机，测试」两条消息，电脑端 agent 成功收到并回复；断点自动汇报（applyCheckpointInjection 同签名 bug）也一并修复生效。

### 后续需求（下次继续，举一反三）
- App 图标换小蓝鲸（ico→png + mipmap）
- 手机端补充：意见区、使用指南、市场、壁纸、PDF/Office 翻译
- 二维码扫码直连
- Tailscale 地址加入「手机远程」页（当前只显示局域网 IP）
- 手机端历史消息持久化（本地 localStorage 保存对话）
- （可选）多会话时让手机消息发到「当前活动会话」而非仅最新创建的 agent

### 关键信息
- Tailscale：电脑已登录，IP 100.120.241.23；手机需装 Tailscale 登录同账号
- 手机连电脑：网页 http://<IP>:3191/mobile 或 APK；配对码在客户端「手机远程」页
- 手机 RPC 走 3191 /api/rpc（带 token）；3192 仅本机
- 正式实例端口：3180（web）/ 3192（本地RPC）/ 3191（手机远程）
