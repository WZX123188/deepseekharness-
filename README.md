# DSH 客户端（DeepSeek 风格 · v1.0.0）

把 DeepSeek Harness（DSH）扩展成 DeepSeek 风格客户端，作为独立 Cordis 插件叠加在已安装的 DSH 上。**保留 DSH 全部原有页面功能**，新增三个能力。

## 功能

1. **文件权限门**：读取默认放行；写 / 改 / 删文件需逐项勾选「同意」并确认后才执行。
2. **余额 / 用量页**：显示 DeepSeek 开放平台账户余额（`user/balance` 接口，API Key 走本地凭据，不暴露给浏览器）。
3. **检查更新页**：查 npm registry 最新版，一键更新。

> 说明：DeepSeek 开放平台无「历史 token 用量」公开接口，故余额页以官方余额为准，本地用量统计待后续版本补充。

## 目录结构

```
dsh客户端/
  README.md / DESIGN.md / PROGRESS.md / .gitignore
  src/host/            # 宿主侧（Node）：权限门、余额、更新
    permission-gate.js
    balance.js
    update.js
    index.js           # 合并宿主入口
  src/client/ui.js     # 浏览器侧：余额/更新两页 + DeepSeek 蓝色风格
```

## 技术要点（已实测验证）

- 权限门：拦截 `tools/pre-execute`（waterfall），写/改/删走 `ctx.userQuestions.ask` 勾选框询问；读默认放行。
  - 动态插件环境必须用 `ctx.get('userQuestions')`，不能用 `inject`（`inject` 会让 `apply` 不执行）。
- 余额/更新：动态插件无全局 `fetch`，用 `subprocess` 跑 `node -e "fetch(...)"` 子进程发 HTTPS；API Key 用 `credentials.resolve('DEEPSEEK_API_KEY')` 取。

## 加载方式

当前为「动态插件」源码形态（已在 DSH 会话中实测跑通）。持久化打包为 npm 插件包（`package.json` + `cordis.patch.yml` + ESM 构建）见 `PROGRESS.md` 的后续计划。

## 状态

三大功能已实测通过；持久化打包 + GitHub 发布进行中。
