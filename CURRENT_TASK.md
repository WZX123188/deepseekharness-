# 当前任务断点（CURRENT_TASK.md）

> 维护规则：开始长任务填写；每步更新；完成改状态「无任务 / 已完成」。新会话自动读本文件。

## 状态：无任务 / 已完成（v6.1.0 已打包发布）

### v6.1.0 完成内容
- **扫码直接登录**：电脑端「手机远程」二维码 URL 带 `?code=配对码`；手机端（网页+app）扫码后自动配对登录（免输地址+配对码）。内嵌 jsQR 解码库。
- **语音修复**：
  - 手机 app：WebView 不支持 SpeechRecognition → 改用 Android 原生 SpeechRecognizer（JSBridge），自动申请麦克风+摄像头权限（MainActivity requestPermissions）。
  - 电脑端：SpeechRecognition 在 Electron 里服务不可用（network 错误）→ 加健壮处理，友好提示"请用手机端语音"，避免闪退/报错。
- 版本 6.1.0，打包便携版 182.6MB，exe 图标小蓝鲸（rcedit）。

### 已发布
- commit 4d32c0a + tag v6.1.0 已 push（触发 build-apk.yml 自动出 APK）
- release 保留 6.0.0 / 6.1.0
- APK 待构建完 → 桌面一份 + 上传「dsh手机6.1.0」release

### 关键信息
- Tailscale：电脑 IP 100.120.241.23；手机装同账号
- 手机连电脑：网页 http://<IP>:3191/mobile 或 APK；配对码/二维码在电脑端「手机远程」页（扫码直接登录）
- 手机 RPC 走 3191 /api/rpc（带 token）；3192 仅本机
- 发文件到手机：复制到 $DSH_HOME/phone-inbox/ 并追加 index.json {name,path,ts}
