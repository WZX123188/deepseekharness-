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
- [ ] 权限门"询问"链路实测（需用户在旁勾选）
- [ ] 余额/更新/客户端 UI 实测（需用户批准 client 包 + 在场）
- [ ] 打包成规范插件包（cordis.patch.yml + package.json）
- [ ] git init + 1.0.0 tag + GitHub 推送步骤

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
