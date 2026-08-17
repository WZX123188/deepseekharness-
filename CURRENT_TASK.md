# 当前任务断点（CURRENT_TASK.md）

> 维护规则：开始长任务填写；每步更新；完成改状态「无任务 / 已完成」。新会话自动读本文件。

## 状态：进行中（v5.4.0 完全态 app —— 待用户重启实测）

### 本次完成（v5.4.0 待办全清）
- **App 图标小蓝鲸**：从 desktop\icon.ico（内嵌 32bpp DIB 225x225）解析 → 双线性缩放生成 mipmap 5 尺寸（48/72/96/144/192），
  AndroidManifest `@mipmap/ic_launcher`，build.gradle versionCode 6 / versionName 5.3.3→(随 v5.4.0 打包)。
- **电脑端二维码**：把 qrcode-terminal 的 vendor（qrcode-generator, MIT）合并成浏览器自包含 `makeQrMatrix`（已与原始 vendor 交叉验证 cells 完全一致），
  RemoteSection「连接网址」每个 IP 显示 canvas 二维码 + URL + 复制按钮。
- **手机端完全态**：tab 从 3 个扩到 5 个（对话/文件/翻译/市场/设置）：
  - 翻译 tab：PDF 翻译（translatePdf）+ Office 翻译（translateOffice/saveOffice，可逐段改译文下载）。
  - 市场 tab：Tool/Plugin 市场（listTools/listPlugins + 安装/启用/禁用/卸载）。
  - 设置页新增：电脑界面背景（getWallpaper/setWallpaper 预设+自定义图）、意见区（openFeedback 返回 url 后 window.open）、使用指南（静态）。
  - 历史持久化：getChatMessages 结果存 localStorage，重开/离线先恢复上次对话。
- **多会话活动会话**：host 加 `ctx.on('agent/status', ({agent,status}) => status==='running' 时 latestAgent=agent)`，
  手机消息发到「最近活动」的会话而非仅最新创建的 agent。
- **openFeedback 改为返回 url**（不再 runCmd 打开电脑浏览器），desktop/手机两端各自 window.open。

### 已改文件（已同步）
- plugin-static/lib/index.js（agent/status 跟踪 + openFeedback 返回 url + /api/status 5.4.0）—— 三处
- plugin-static/lib/client.js（makeQrMatrix + QrBox + RemoteSection 二维码）—— 三处
- mobile/web/index.html（完全态 5 tab）—— mobile\web 源 + resources/desktop/profile 三处 + 安卓 assets
- mobile/android（mipmap 图标 + AndroidManifest + build.gradle）
- desktop/package.json 版本 5.4.0

### 已验证
- 全部 node --check 通过；makeQrMatrix 与 vendor 交叉验证一致；PNG 解码验证（中心色 #4D6BFE 正确）
- test-env：listTools（完整市场分类）、getWallpaper/setWallpaper、openFeedback（返回 url）、getRemoteInfo、listProjects 全通

### 待办（本任务收尾）
- [x] 打包（--win --dir + make-portable，release 保留 5.3.3/5.4.0）
- [ ] git commit + tag v5.4.0 + push
- [ ] 触发 APK 构建（tag v5.4.0 会自动触发 build-apk.yml）
- [ ] 用户重启桌面端 + 手机刷新/装新 APK 实测

### 关键信息
- Tailscale：电脑已登录，IP 100.120.241.23；手机需装 Tailscale 登录同账号
- 手机连电脑：网页 http://<IP>:3191/mobile 或 APK；配对码/二维码在电脑端「手机远程」页
- 手机 RPC 走 3191 /api/rpc（带 token）；3192 仅本机
- 正式实例端口：3180（web）/ 3192（本地RPC）/ 3191（手机远程）
