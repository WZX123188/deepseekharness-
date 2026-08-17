# 当前任务断点（CURRENT_TASK.md）

> 维护规则：开始长任务填写；每步更新；完成改状态「无任务 / 已完成」。新会话自动读本文件。

## 状态：进行中 — v5.2.0 大改

### 任务目标
完成 v5.2.0：① 峰谷定价默认开；② Tailscale 引导页；③ 手机独立移动 UI（防误触，类似微信手机版，App+网页共用，与电脑共用后端实时同步+双向传文件）；④ 手机电脑同时用+同步+传文件；⑤ 图标全换小蓝鲸（C:\Users\WZX\.dsh\deepseek-whale.ico）；⑥ 修复局域网连不上（中文冒号纠错+防火墙放行）+网页版无连接页；⑦ 语音点击开始→再点击结束。全部做完打包 5.2.0，之前未上传版本全部上传 GitHub。

### 进度
- [ ] 查 git 状态（哪些版本没上传）
- [ ] ⑦ 语音开始/结束（改 plugin-static VoiceInputButton）
- [ ] ① 峰谷默认开（改 usage-meter host.js）
- [ ] ⑤ 图标换小蓝鲸（客户端 icon.ico + App + PWA + 托盘）
- [ ] ⑥ 局域网连不上：中文冒号纠错 + Windows 防火墙放行；网页版无连接页修复
- [ ] ② Tailscale 引导页（什么是/为什么/一步步）
- [ ] ③④ 手机独立移动 UI（聊天+文件+设置+上传）+ 实时同步 + 双向传文件
- [ ] test-env 验证 + 同步
- [ ] 打包 5.2.0（本地 release 只留最新两个）
- [ ] 上传 GitHub（补传未上传版本 + 5.2.0）

### 下一步
先查 git 状态，然后做快的（语音/峰谷/图标/防火墙/中文冒号），再做移动端大改。

### 产物路径
- 5.2.0：`G:\dsh客户端\desktop\release\DeepSeekClient-portable-5.2.0-win-x64.zip`
- 手机端：`G:\dsh客户端\mobile\`（移动 UI + 安卓 + PWA）
- GitHub：`WZX123188/deepseekharness-`
