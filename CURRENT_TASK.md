# 当前任务断点（CURRENT_TASK.md）

> 维护规则：开始长任务填写；每步更新；完成改状态「无任务 / 已完成」。新会话自动读本文件。

## 状态：进行中 — 任务二（5.0.0 手机App + 远程通信）

### 任务目标
用户授权自主执行到关机：① 视图+拖拽收尾 → 4.0.0 → GitHub+release；② 手机App（APK云构建+PWA）+远程通信（3191服务+配对码+免费隧道）→ 5.0.0；③ 语音转文字（电脑+手机）→ 5.1.0；最后关机。

### 进度
- [x] 任务一：视图/拖拽实测通过（识图真实key+模型回退+附件缓存）→ 同步 → 4.0.0打包（portable-4.0.0-win-x64.zip）
- [x] 任务一：git commit aedd100 + tag v4.0.0（26文件，大目录已 gitignore 排除）
- [ ] 任务一：GitHub push + release（**网络不可达**，待网络恢复执行 push-release.ps1 -Tag v4.0.0）
- [ ] 任务二：电脑端 3191 通信服务（配对码+加密+聊天SSE+文件浏览/下载）
- [ ] 任务二：手机网页 PWA（聊天界面+文件列表+配对码，本地浏览器可测）
- [ ] 任务二：安卓 WebView 项目 + GitHub Actions 云构建 APK
- [ ] 任务二：免费隧道方案（局域网直连 + Tailscale 说明）
- [ ] 任务二：测试 → 聊天记录 → 5.0.0 → GitHub+release
- [ ] 任务三：语音转文字（电脑+手机+麦克风权限+对话框图标）→ 5.1.0
- [ ] 收尾：最终聊天记录 → 关机

### 下一步
写电脑端 3191 远程通信服务（plugin-static index.js 新增 RemoteControl 服务：配对码生成/验证、token 加密、聊天 SSE、文件浏览/下载 API）。

### 产物路径
- 4.0.0：`G:\dsh客户端\desktop\release\DeepSeekClient-portable-4.0.0-win-x64.zip` ✓
- 手机端项目：`G:\dsh客户端\mobile\`（PWA + 安卓 WebView）
- 推送脚本：`G:\dsh客户端\push-release.ps1`（网络恢复后执行）
- GitHub：`WZX123188/deepseekharness-`（tag v4.0.0 已建，push 待网络）
