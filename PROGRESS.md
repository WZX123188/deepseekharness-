# DSH 客户端插件 — 进度与断点记录

## 完整功能清单（v1.x，全部要整合进客户端）

1. 权限门（读放行 / G盘放行 / 写改删需勾选同意）
2. 余额/用量页
3. 检查更新页
4. API 管理页（接/测/清 Key）
5. 工具市场页（tool 合集：分类 + 一键安装）
6. 项目区页（新建/列出项目）
7. 使用指南页
8. 桌面客户端（托盘/自启/Ctrl+Alt+D/弹窗置顶/鲸鱼图标）
9. 安装器（打包成最新完整版，别人装下来就是最新客户端）
10. 多身份/不同页面 → 2.0.0（暂缓）

## 关键缺口（当前最重要）

桌面客户端内部是独立 dsh 实例，6 个页面目前只在开发会话里跑，未持久化。
权限门已做成正式插件包（plugin/）并挂载进 web profile，持久化成功。
**剩余：把余额/更新/API管理/工具市场/项目区/使用指南也持久化。**
方案：boot-loader（启动引导）宿主插件，监听 agent/created，用 dynamicCordisRunner.define()+run() 自动加载全部宿主+客户端代码，复用现有动态格式代码，避免重写 RPC。

---

# DSH 客户端插件 — 进度与断点记录

> 本文件是「断点续做」的唯一权威来源。开工/收工先读它、再更新它。换新会话时让新会话先读本文件即可接手。

## 目标（v1.0.0）

把已安装的 DSH 扩展成 DeepSeek 风格客户端（独立 Cordis 插件包）：

1. 权限门：读取默认放行；修改 / 删除需逐项勾选同意 + 确认。
2. DeepSeek 余额页（user/balance 接口）+ 本地用量（后续）。
3. npm 检查更新 + 一键更新页。
4. 同意弹窗"抢注意"：**结论——纯网页客户端做不到 OS 置顶/系统通知（客户端沙箱无 document/Notification）；需桌面客户端（Electron setAlwaysOnTop）**。

## 关键决策（已定）

- 实现方式：独立 Cordis 插件包；更新走 npm；UI DeepSeek 风格；工程在 G:\dsh客户端。

## 环境事实

- Windows；Node v24.19.0；npm 11.17.0；npm 源 npmmirror（可达）；github.com 不可达。
- **未安装：git / pnpm / gh（需向用户申请安装）**。
- DSH 安装：C:\Users\WZX\AppData\Roaming\npm\node_modules\@deepseek-ai\dsh（v0.1.0-rc.6）。
- 本会话 ID：session-b403070f-1a20-410d-81d0-66bea1c40cd7；目标 ID：goal-dd3e5639-7a22-473b-8227-64ea9a7a7e81

## 已核实的关键结论（避免重复踩坑）

1. **动态插件 `inject:['userQuestions']` 会让 apply 不执行**；必须用 `ctx.get('userQuestions')`（实测 present）。
2. `tools/pre-execute`（waterfall）对 write 工具会触发，返回 `{kind:'deny',reason}` 能拦截（探针已验证）。
3. `PreToolDecision = allow|deny|ask`；`ToolExecution` 含 name/arguments/agent?/signal。
4. `ctx.userQuestions.ask({questions, agent: exec.agent, signal: exec.signal})` 与官方 ask_user_question 工具一致。
5. `ApprovalPolicy = 'ask'|'never'`；approval 与 userQuestions 是两套独立机制。
6. **动态插件无全局 fetch**；余额/更新请求用 `subprocess` 跑 `node -e "fetch(...)"`（Node24 自带 fetch）。
7. `web.fetch` 的 `WebFetchRequest` 只有 `{url}`，**不支持自定义头**，不能带 Bearer。
8. DeepSeek key：`credentials.resolve('DEEPSEEK_API_KEY')` → `{value,source}`；baseURL 默认 https://api.deepseek.com。
9. 客户端沙箱无 document/window/Notification；客户端有 `theme.overrideTokens` 可做全局主题。
10. 插件包格式：npm 包 + `cordis.patch.yml`（`- insert:` 列 row，`name` 指向模块）；客户端包用 package.json 的 `dsh.client` + `exports["./client"]` 声明。动态插件是「函数体」格式，npm 包是 ESM 模块格式——最终打包时客户端半边需从动态格式改写为 ESM（React/host/styles 的获取方式不同，需照抄内置客户端包 lib/client.js 的写法）。

## 项目结构

```
G:\dsh客户端\
  PROGRESS.md / README.md / DESIGN.md
  src/host/permission-gate.js  # 权限门（ctx.get 版）
  src/host/balance.js          # 余额
  src/host/update.js           # 更新
  src/host/index.js            # 合并宿主入口（打包/测试用）
  src/client/ui.js             # 余额/更新两页 + DeepSeek 风格 CSS
  package.json / cordis.patch.yml  # 打包（待建）
```

## 当前状态

- [x] 方案论证、接口调研、全部代码初版
- [x] 全量语法校验通过（5/5）
- [x] 权限门事件/服务接线验证（deny 探针通过）
- [x] 权限门"询问"链路实测（用户在旁勾选，通过）
- [x] 余额/更新/客户端 UI 实测（用户批准 + 查看，通过）
- [ ] 打包成规范插件包（cordis.patch.yml + package.json + ESM/tsdown 构建）
- [x] git 安装（MinGit 2.55.0）+ git init + 提交 + v1.0.0 标签
- [ ] GitHub 推送（用户本人执行）

## 下一步（按序）

1. 研究内置 bundle 的 cordis.patch.yml，确定 out-of-tree 插件包格式。
2. 建 package.json + cordis.patch.yml，把 host/index.js + client/ui.js 打成插件包。
3. 向用户申请安装 git；git init + 提交 + v1.0.0。
4. 用户在旁时：实测权限门询问、余额、更新、客户端页面；写 GitHub 推送步骤。

## 待用户配合

- **安装 git**（我给出 winget / 镜像命令）。
- 用户在场时批准动态 client 包、勾选权限门测试。
- 创建 GitHub 空仓库 + 最终 push。

## 断点日志

- 首轮：需求确认、方案论证、环境核查、迁 G:、接口调研、权限门代码+接线验证（inject→ctx.get 修复）。
- 二轮：余额/更新/客户端 UI 代码 + 全量语法校验通过；确认"置顶"需桌面客户端。

## 最新进度（boot 插件已落地，部署于 plugin/boot/）

boot 插件 = 启动引导宿主插件（plugin/boot/），监听 agent/created，用 dynamicCordisRunner
define+run+runHostHalf(approvalId) 自动加载全部功能（host-body.js + client-body.js）。
已部署到 `C:\Users\WZX\.dsh\profiles\web\node_modules\dsh-client-boot\` 与 `desktop\boot\`。

已完成功能（settings 里可见）：
- 权限门（读放行 / G 盘放行 / 写改删需勾选 + 敏感操作开关）
- 余额 / 用量（本次 / 累计 / 会话数，本地持久化累加，标注估算）
- 检查更新（官方 npm 与 GitHub 分开；GitHub 区分「无发布」与「连不上」；检测到新版出「一键更新」按钮）
- Tool 市场（11 个去重后工具）+ Plugin 市场（MCP 客户端）
- 项目区（工作区列表/新建）
- 使用指南
- 意见区（提交反馈 → 打开 GitHub Issue 预填页）
- 神奇小开关（一键切 DeepSeek-V4-Pro + 极简模式；settings 服务写 agent-presets.default + agentDefaultModel.saveSelection）

桌面客户端（desktop/）：Electron，托盘/自启/Ctrl+Alt+D/弹窗置顶/鲸鱼图标/内置 Node，
installer.nsh 快捷方式勾选页，说明.txt（UTF-8 BOM + 免责声明）。安装器已出 1.0.0（暂缓重打包）。

## 下一步（剩余）

1. 视图模式（vision mode）——用户明确暂缓，下一轮提醒。
2. GitHub 推送：本地 v1.0.0 / v1.0.1 标签已打，远程未推；由用户用 PAT 执行
   `cd G:\dsh客户端; git push -u origin main --tags`。
3. 用户验收各功能后，再重打包安装器（用户要求"先别打包"）。

---

## v2.0.0：完全独立 + 便携版（2026-08-16）

用户朋友反馈「客户端是个套子」——装完后用户原有的网页版 DSH 也被改了。根因（三处全局污染，已修复）：

1. 原来 spawn 的是**用户全局安装的** `%APPDATA%\npm\node_modules\@deepseek-ai\dsh`，没装还 `npm install -g`。
2. 原来把插件写进用户的 `~\.dsh\profiles\web`。
3. 原来直接改用户已装 DSH 内核源码 `dsh-cordis-host-runner/lib/index.js`。

### 修复方案（已验证通过）

- **内置 DSH 运行时**：`desktop/dsh-runtime/`（`npm install @deepseek-ai/dsh@0.1.0-rc.6`，245MB，gitignored 只留 package.json），打包为 extraResource。
- **数据隔离**：spawn 内置 dsh 时设 `DSH_HOME` 环境变量（DSH 内核 `dsh-home-paths` 原生支持，优先级 显式配置 > `$DSH_HOME` > `~/.dsh`），数据全部落客户端自己的目录，绝不碰 `~/.dsh`。
- **便携版**：`desktop/main.js` 探测 exe 同目录 `portable.dat` → 数据放 `<程序目录>\data\`；无标记（安装版）→ `%APPDATA%\DeepSeekClient`。便携模式还 `app.setPath('userData', ...)` 让 cookie/cache 也随便携目录走。
- **权限门挂载修复**：v1.4.0 的 cordis.patch.yml 只挂了 dsh-client-static，漏了 dsh-client-gate（门禁根本没生效）。2.0.0 已把 gate + static 都挂载；`desktop/gate/` = 门禁新副本。
- **置顶信号隔离**：marker 从 `%TEMP%\dsh-question-pending` 改为 `$DSH_HOME\question-pending`（gate 用 `node:fs` 直写，Electron 端轮询同路径，实例隔离）。

### 产物

- `desktop/release/DeepSeek-Client-Setup-2.0.0.exe`（安装版）
- `desktop/release/DeepSeekClient-portable-2.0.0-win-x64.zip`（便携绿色版，`desktop/make-portable.ps1` 用 robocopy+7z 生成，脚本已加 BOM）

### 验证

- 内置 dsh `--version` = 0.1.0-rc.6 ✓
- 隔离 `DSH_HOME` 下 `dsh web` 独立启动（HTTP 200），`~/.dsh` 无污染 ✓
- gate + static 通过 cordis.patch.yml 挂载后无报错加载（进程 fail-loud 未退出）✓
- `dsh-typert-protocol` 在捆绑闭包内，静态插件可解析 ✓

### 下一步（待办）

1. 用户验收（关旧客户端 → 跑新 win-unpacked / 便携 zip / 安装包）。
2. 验收 OK → `git push -u origin main --tags`，发布 v2.0.0 Release（附两个安装包）。
3. 后三个功能（视图模式 / PDF 实时翻译 / Word·PPT 拖拽翻译）——已给方案，待用户确认后开工。

---

## v2.0.1：修复「点快捷方式打不开」（2026-08-16）

- 启动立即弹「正在启动 DeepSeekClient…」加载页，不再黑屏干等（`LOADING_HTML` + `createWindow` 先加载页、后端就绪再 `loadApp()` 切真实界面）。
- 启动前 `freePort()` 清掉残留「孤儿后端」：单实例下 3180 上的 node.exe 必是上次异常退出残留，用 `netstat`+`tasklist` 定位、仅杀 node.exe 再 `taskkill /F`，解决端口占用导致的打不开。
- 版本 2.0.0 → 2.0.1，产物：`DeepSeek-Client-Setup-2.0.1.exe` + `DeepSeekClient-portable-2.0.1-win-x64.zip`。

### 下一步

1. 视图模式 2.1.0（智谱 GLM-4V-Flash，免费国产视觉模型）——待用户填 key。
2. PDF 实时翻译 2.2.0（文字版+扫描版，精准翻数据手册）。
3. Office 全家桶拖拽 2.2.1（Word/PPT/Excel + WPS，预览→审核→保存）。
4. 视频剪辑（OBS/达芬奇）——方案待用户审核。
5. 自定义界面背景。

---

## v2.1.0：视图模式（识图，智谱 GLM-4V-Flash）

- 宿主 `plugin-static/lib/index.js` 新增 RPC：`getVisionStatus` / `setVisionKey` / `clearVisionKey` / `testVision` / `seeImage` / `openVisionSite`；Key 存在 `dsh-client-config.json` 的 `visionKey` 字段（与 permissionMode 合并，`setPermissionMode` 也改成读-改-写，避免互相覆盖）。
- 视觉调用用**宿主直接 `fetch`**（Node24 自带，静态插件是真实 ESM 有全量 Node 权限），端点 `https://open.bigmodel.cn/api/paas/v4/chat/completions`，模型 `glm-4v-flash`；图片用 base64 dataURL 走 `image_url.url`。
- 客户端 `client.js` 新增「视图模式（识图）」settings 页：默认灰态 + 小白五步教程 +「🌐 去智谱官网申请免费 Key」按钮（`openVisionSite` 打开浏览器）+ 保存/测试/清除 Key + 识图区（选图→识别→结果可一键全选复制）。
- 假 key 实测端点返回 401 中文错误，证明端点/模型名/fetch 全通；真 key 待用户填后验证。
- 版本 2.0.1 → 2.1.0，产物：`DeepSeek-Client-Setup-2.1.0.exe` + `DeepSeekClient-portable-2.1.0-win-x64.zip`。

### 下一步

1. 用户填智谱 Key 验收视图。
2. PDF 实时翻译 2.2.0（文字版+扫描版，精准翻数据手册）。
3. Office 全家桶拖拽 2.2.1（Word/PPT/Excel + WPS，预览→审核→保存）。
4. 视频剪辑（OBS/达芬奇）——方案待用户审核。
5. 自定义界面背景。

---

## v2.1.1：体积精简（615MB → 434MB，-181MB）

用户朋友反馈安装后 600+MB（我之前报的 167MB 是**压缩安装包**，不是安装后磁盘占用，是我的表述错误）。

- **根因**：安装后 = Electron 202 + 内置 Node 101 + 内置 DSH 运行时 246 + 其它 66 ≈ 615MB。
- **精简动作**（`desktop/strip-runtime.mjs`，Node 递归删除，处理长路径）：
  1. dsh-runtime 删 `*.map`(36.8) + `*.d.ts`(22.7) + README/CHANGELOG(6.8) + 测试文件(1.4) = -67MB；
  2. node-pty 删 `.pdb` 调试符号(52.8) + 非 win32-x64 预编译 + C++/python 源码 = -60MB；
  3. 删内置 node 里的 npm(12.4，新版已不用 npm install -g)。
  4. `package.json` 加 `electronLanguages: ["zh-CN","en-US"]` → 语言文件 55 个(40.3MB) 减到 2 个(0.9MB)。
- 结果：安装后 434MB，安装包 167→123.9MB，便携 zip 219→169.5MB。
- 已验证：精简后 `dsh web` 端到端启动 HTTP 200、gate+static 无报错加载。
- `make-portable.ps1` 改用 `robocopy /MIR`（镜像，避免长路径残留）。

### 仍可继续压（更激进，需逐项测试）

- 其它 LLM 厂商 SDK（openai/mistralai/anthropic/google/aws ≈37MB）、@opentelemetry(20MB) —— 非 DeepSeek 必需，但需 test-boot 验证移除不破坏 llm 服务。
- 理论上极限：Electron 202 + Node 88 是硬成本，最瘦约 300MB 出头。
