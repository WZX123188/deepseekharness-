# 当前任务断点（CURRENT_TASK.md）

> 维护规则：开始长任务填写；每步更新；完成改状态「无任务 / 已完成」。新会话自动读本文件。

## 状态：无任务 / 已完成（v6.0.0 已打包，待 commit/push + 用户重启实测）

### v5.5.0 + v6.0.0 完成内容
- **agent 发文件到手机**：固定机制 = 复制文件到 `$DSH_HOME/phone-inbox/` + 追加 `index.json` 的 {name,path,ts}；
  手机聊天窗口自动显示可下载文件卡片。systemPrompt 已注入该规则。
- **手机消息隐藏标记**：`/api/chat/send` 与 sendToSession 注入时加「📱」前缀，agent 通过 systemPrompt 识别；
  getChatMessages 返回时去掉前缀（手机端显示干净）。
- **多会话 + 监督/发起项目**：host 新增 listSessions(含 status)/createSession/getSessionMessages/sendToSession/getAgentStatus；
  手机端顶部「🗂」会话侧滑面板：历史列表(🟢运行中/⚪空闲) + 「＋新建对话」，不再挤一个窗口。
- **思考过程同步**：getChatMessages 提取 reasoning 块为 thinking 消息；手机端渲染「💭 思考中」；
  轮询 getAgentStatus 时 agent running 显示思考中提示条。
- **图标**：icon.ico 原为 225x225 DIB 非标准 → 重生成标准 256 多尺寸 ico；electron-builder 不认 → 用 rcedit 手动 set-icon（中心色 #4D6BFE 已验证）；桌面快捷方式 IconLocation 指向 icon.ico。
- **Tailscale 下载**：桌面 APK 已上传 GitHub release v5.4.0（tailscale-android.apk）；
  RemoteSection 加 Tailscale 下载卡片（安卓 APK / 苹果 App Store / 电脑官网）。
- **轻量化**：删 desktop/node/node_modules(npm 11.8MB)、开发脚本(.mjs)、日志、icon.ico.bak、package-lock.json；
  win-unpacked 480.9→468.9MB，便携 zip 186.6→182.5MB；确认聊天记录不在打包范围（files 排除 dsh/**）。

### 待办（本任务收尾，自动续跑）
- [x] 打包 6.0.0（便携 zip + win-unpacked，exe 图标小蓝鲸）
- [x] 清理 release 保留最新两版（5.4.0 / 6.0.0）
- [x] APK 上传 GitHub release + Tailscale 下载链接
- [ ] git commit + tag v6.0.0 + push（tag 触发 build-apk.yml 自动出 DSH APK）
- [ ] 用户重启桌面端 + 手机刷新/装新 APK 实测

### 关键信息
- Tailscale：电脑已登录 IP 100.120.241.23；手机装同账号
- 手机连电脑：网页 http://<IP>:3191/mobile 或 APK；配对码/二维码在电脑端「手机远程」页
- 手机 RPC 走 3191 /api/rpc（带 token）；3192 仅本机
- 正式实例端口：3180（web）/ 3192（本地RPC）/ 3191（手机远程）
- 发文件到手机：复制到 $DSH_HOME/phone-inbox/ 并追加 index.json {name,path,ts}
