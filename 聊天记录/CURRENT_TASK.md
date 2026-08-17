# 当前任务断点（CURRENT_TASK.md）

> 维护规则：开始长任务填写；每步更新；完成改状态「无任务 / 已完成」。新会话自动读本文件。

## 状态：进行中（v5.3.3 手机收不到回复 + 布局固定 + 完全态增强）

### 本次修复（v5.3.3）
- **手机收不到回复**：根因 `getChatMessages` 解析 `assistant/message` 事件时用 `ev.data.content`，但该事件的
  data 是 `{ message: {...} }` 包裹（dsh-session 里 `user/message` 用 `record`、其余用 `record.message`），
  导致 assistant 文本取不到被过滤。改为 `rec.message || rec`，且只取 `type==='text'` 块（过滤 reasoning 思考/tool-call）。
- **手机端布局固定**：顶部 tab（对话/文件/设置）+ 底部输入框固定，长文本只在中间内容区滚动。
  改法：`html,body{overflow:hidden}` + `body{height:100vh;100dvh}` + 各 flex 容器 `min-height:0` + `main` 滚动。
- **完全态增强**：手机设置页「🔌 连接」卡片显示电脑地址列表（Tailscale 100.x / 局域网 IP，点一下复制），
  用 `getRemoteInfo` 的 ips + port。

### 已改文件（已同步）
- plugin-static/lib/index.js（getChatMessages 解析 + /api/status 5.3.3）—— resources / desktop\plugin-static / 正式 profile 三处
- mobile/web/index.html（CSS 布局 + 电脑地址）—— mobile\web 源 / resources\plugin-static\mobile\web / desktop\plugin-static\mobile\web / 正式 profile 四处
- desktop/package.json 版本 5.3.3

### 已验证
- node --check 通过；解析单测 PASS（assistant data.message 包裹 + reasoning 过滤 + 旧结构兼容 + tool/result 忽略）
- test-env（3197/3193/3195）：插件加载正常、/mobile 含新标记(100dvh/loadRemoteInfo/addrList)、getChatMessages/getRemoteInfo 端点正常

### 待办（本任务收尾）
- [ ] 打包（已 done：--win --dir + make-portable，release 保留 5.3.2/5.3.3）
- [ ] git commit + tag v5.3.3 + push
- [ ] 用户重启桌面端后实测：手机能收到回复、顶部/底部固定、设置页能看到电脑地址

### 后续需求（下次继续，举一反三）
- App 图标换小蓝鲸（ico→png + mipmap）
- 手机端补充：意见区、使用指南、市场、壁纸、PDF/Office 翻译
- 二维码扫码直连
- 手机端历史消息持久化（本地 localStorage 保存对话）
- （可选）多会话时让手机消息发到「当前活动会话」而非仅最新创建的 agent

### 关键信息
- Tailscale：电脑已登录，IP 100.120.241.23；手机需装 Tailscale 登录同账号
- 手机连电脑：网页 http://<IP>:3191/mobile 或 APK；配对码在客户端「手机远程」页
- 手机 RPC 走 3191 /api/rpc（带 token）；3192 仅本机
- 正式实例端口：3180（web）/ 3192（本地RPC）/ 3191（手机远程）
