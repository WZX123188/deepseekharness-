# DSH 客户端 — 设计文档

## 1. 目标

把已安装的 DeepSeek Harness（DSH）扩展成一个 DeepSeek 风格客户端，作为**独立 Cordis 插件包（v1.0.0）**叠加在现有 DSH 上：

1. **权限门**：读取默认放行；写 / 改 / 删需逐项勾选同意 + 确认。
2. **余额 / 用量页**：DeepSeek 开放平台余额 + 本地 token 用量。
3. **更新页**：npm 检查更新 + 一键更新。

保留现有页面；UI 走 DeepSeek 官方风格。

## 2. 架构事实（已核实）

- DSH = npm CLI（`@deepseek-ai/dsh`，v0.1.0-rc.6）+ Node 宿主 + React/Vite 浏览器 SPA（localhost:3080）。
- 扩展机制 = 插件包，通过 profile 的 `dsh.profile.bundles` / `dsh plugin` 挂载（`@deepseek-ai/dsh-base`、`dsh-web-app`、`dsh-headless` 为内置 bundle）。
- 宿主侧是 Cordis 插件树（`ctx`），浏览器侧是 Slot 系统（`ctx.get('slots')`）。

### 2.1 宿主内建符号（Builtin）

`ctx`（get/on/provide/effect）、`harness`（handle/defineTool/registerTool）、`console`、`btoa/atob`、`TextEncoder/TextDecoder`。
**没有全局 `fetch`** —— 宿主发 HTTP 需用 `web` 服务或 `subprocess`。

### 2.2 关键宿主服务（Service）

| 服务 | 用途 | 关键方法 |
|---|---|---|
| `tools` | 工具注册与执行管线 | `guard(guard)`, `register`, `execute(exec)` |
| `approval` | 审批服务（ask/never 策略） | `setPolicy(agent, policy)`, `request(req)` |
| `userQuestions` | "勾选 + 确认"提问 UI | `ask(request)`, `registerProvider(provider)` |
| `credentials` | 凭据（API key） | `resolve(ref)`, `describe(ref)` |
| `web` | 网络访问 | `search(req)`, `fetch(req)` |
| `llm` | 模型适配注册表 | `listProviders()`, `resolveCallConfig()` |
| `tokenMeter` | 本地 token 计量 | `measure(session)`, `estimateMessage(msg)` |
| `webServer` | HTTP 路由 | `register(route)` |
| `fs` | 抽象文件系统 | `writeText`, `editText`（含 sandboxPolicy 参数） |
| `sessionQuery` | 会话查询/统计 | `searchSessions`, `listSessions`, `searchEvents` |

### 2.3 关键宿主事件（Event）

| 事件 | 模式 | 作用 |
|---|---|---|
| `tools/pre-execute` | waterfall | **Allow / deny / ask before dispatch**（权限门接线点） |
| `tools/execute` | waterfall | around-dispatch |
| `tools/post-execute` | waterfall | 结果替换 |
| `approval/request` | waterfall | 审批决策链 |
| `fs/write-intent` / `fs/edit-intent` | waterfall | 文件写/改版本意图 |
| `fs/observed` | emit | 文件观察记录 |
| `llm/stream` | waterfall | 每次模型流式调用 |

### 2.4 关键客户端 Slot

- `settings.section`（list）：完整设置页 —— 余额/用量页、更新页挂这里。
- `sidebar.footer.action`（list）：侧边栏底部的动作按钮。
- `shell.overlay`（list）：全局浮层。
- `tool.view.cordis`（keyed，key=`self`）：插件 Run 卡片内的交互区。

## 3. 权限门设计（核心）

### 3.1 结论（已核实类型）

```ts
// @deepseek-ai/dsh-tools
type PreToolDecision =
  | { kind: 'allow' }
  | { kind: 'deny'; reason: string }
  | { kind: 'ask'; reason?: string };   // ask → 走 approval 服务
interface ToolExecution {
  readonly name: string;
  readonly arguments: unknown;         // 已解析的 JSON 参数
  readonly agent?: Agent;              // 发起调用的 agent
  readonly signal: AbortSignal;
  readonly callId: CallId;
}

// @deepseek-ai/dsh-user-approval
type ApprovalPolicy = 'ask' | 'never';
type ApprovalOutcome = 'allowed-once' | 'rejected' | 'cancelled' | 'unavailable';
interface ApprovalRequest { agent, toolName, callId?, reason?, signal? }

// @deepseek-ai/dsh-user-questions
interface AskUserQuestionRequest { questions: AskUserQuestionItem[]; agent?; signal? }
interface AskUserQuestionItem { id, question, detail?, header?, options?, multiSelect? }
interface AskUserQuestionOption { label, description? }
interface AskUserQuestionAnswer { answers: { id, selected: string[], custom? }[] }
```

### 3.2 实现方式

拦截 `tools/pre-execute`（waterfall），在**不依赖 approval 策略**的前提下自己完成询问（用 `userQuestions.ask` 拿勾选框 UI，返回 allow/deny）：

- **默认放行**：读类工具（`read`/`glob`/`grep` 等）与所有未命中规则的调用 → `return next()`。
- **需同意**：`write`、`edit`（文件写/改）一律询问；`pwsh`/`bash` 仅在命令含删除/写文件等变更信号时询问（正则匹配 `Remove-Item`/`rm`/`>`/`Out-File` 等）。
- **询问**：`userQuestions.ask`，单题、`multiSelect:true`、选项 `同意`。勾选并确认 → allow；否则 deny。
- **失败关闭**：询问异常 → deny（宁可误拦，不可漏放）。

> 说明：读取"默认同意"即不做询问；如需"读取记录"可在后续加一个只读的活动日志（非阻断）。

## 4. 余额 / 用量页设计

- **余额**：宿主侧调用 DeepSeek 官方 `GET https://api.deepseek.com/user/balance`（`Authorization: Bearer <key>`），返回 `balance_infos[]`（`currency` / `total_balance` / `granted_balance` / `topped_up_balance`）。
  - API key 从 `credentials.resolve` 或 `llm` 的 DeepSeek 适配器配置取，**不暴露给浏览器**。
  - 宿主用 `web.fetch`（需查其 WebFetchRequest 契约）或 `subprocess` 发 HTTPS。
- **本地用量**：`tokenMeter.measure(session)` + `sessionQuery` 聚合各会话用量，展示本机消耗。
- **UI**：`settings.section` 注册一页，通过 `harness.handle('balance', ...)` + Client `host.call` 取数。

## 5. 更新页设计

- 宿主 `harness.handle('check-update', ...)` 查 npm registry（本机已配 npmmirror，可达）最新版 `@deepseek-ai/dsh` 及本插件包版本，对比当前安装版本。
- 一键更新：宿主调用 `subprocess` 执行 `npm install -g <pkg>@latest`（或插件包更新），失败回滚。
- **UI**：`settings.section` 一页，显示当前版 / 最新版 + 更新按钮 + 结果/回滚。

## 6. DeepSeek 风格主题

- 用 `Theme.listTokens` 查现有 token，`ctx.get('theme')` 覆盖关键色（主蓝 + 简洁留白），或仅对本插件 UI 用 `styles.insert(css)` + 主题 CSS 变量。

## 7. 待查（写代码前）

1. `web` 服务的 `WebFetchRequest` 契约（能否直连 api.deepseek.com）。
2. DeepSeek 适配器的 API key / baseURL 从哪取（`llm.listProviders()` 或 `settings`）。
3. 插件包（out-of-tree）的 package.json / cordis.patch.yml 精确格式。
4. `Theme.listTokens` + 客户端 `theme` 服务契约。

## 8. 断点

详见 `PROGRESS.md`。
