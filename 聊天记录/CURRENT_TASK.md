# 当前任务断点（CURRENT_TASK.md）

> 维护规则：开始长任务填写；每步更新；完成改状态「无任务 / 已完成」。新会话自动读本文件。

## 状态：无任务 / 已完成

### 已完成成果（v5.2.0）
- ① 峰谷定价默认开启（usage-meter peakEnabled:true + 修 readJsonFile/writeJsonFile 用 fs）
- ② Tailscale 引导页（是什么/为什么/5 步，PWA 首次启动显示）
- ③④ 手机独立移动 UI（三 tab：对话/文件/设置，大按钮防误触）+ 上传文件 + 实时同步（轮询）+ 共用电脑后端
- ⑤ 客户端图标换小蓝鲸（deepseek-whale.ico → desktop\icon.ico + resources）
- ⑥ 局域网连不上（中文冒号纠错 normalizeAddr + main.js allowFirewall 放行 3180/3191/3192）+ 网页版无连接页（连接测试失败回配对页 + 切换服务器按钮）
- ⑦ 语音点击开始→再点击结束（toggle + stop + onend）
- 打包 5.2.0 便携版；git commit + tag v5.2.0 + push（main + tag 都上传，5.1.1~5.1.5 改动随 main 一起传）
- 本地 release 只留最新（5.2.0）

### 待办（下次继续）
- App（安卓 APK）图标换小蓝鲸（ico→png + mipmap，AndroidManifest 当前用系统默认图标）
- 手机端多轮对话（当前是单轮指令+回复，历史消息本地维护）
- 移动端剩余设置项（权限模式、市场、壁纸等，按需加）

### 验收要点
- 手机连电脑：电脑客户端「手机远程」看地址+配对码 → 手机装 APK 或开 http://IP:3191/mobile → 输地址+配对码
- 局域网：同 WiFi 直连；跨网：Tailscale（两端装+同账号）
- 语音：点 🎤 开始，再点 ⏹ 结束
- 图标：客户端是小蓝鲸
