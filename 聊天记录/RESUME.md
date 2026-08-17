# RESUME.md — 断点恢复指南（重装 / 新会话第一步读我）

> 本文件是「重装后恢复上下文」的入口。任何新会话、重装客户端后，**先读本文件**，
> 再读 `PROGRESS.md`（详细进度），即可知道项目全貌与所有已解决问题。

## 阅读顺序（G:\dsh客户端\聊天记录\）

1. `RESUME.md` —— 恢复指南（本文件）
2. `PROGRESS.md` —— 功能与修复档案
3. `对话记录.md` —— 每次会话「为什么做/做了什么/怎么做的」+ 关键对话

> 约定：用户说「更新聊天记录」时，向 `对话记录.md` 末尾追加新章节（时间、背景、
> 做了什么/怎么做/为什么、结果、对话摘录），并同步 RESUME.md / PROGRESS.md 到最新。

## 0. 一句话

这是 DeepSeek Harness（DSH）的桌面客户端项目，把网页版 agent 包装成 DeepSeek 风格
Electron 客户端 + 安装器，附带权限门、余额/用量、更新、Tool/Plugin 市场、使用指南、
意见区、PDF/Office 翻译、识图等自定义功能。工程根目录：`G:\dsh客户端`。

## 1. 项目地图（G:\dsh客户端）

| 路径 | 是什么 |
|---|---|
| `desktop/` | Electron 客户端工程（main.js、gate/、plugin-static/、release/ 产物） |
| `desktop/dsh/` | **当前正在运行的便携实例**（带 portable.dat，数据在 `data\`） |
| `desktop/release/` | 打包产物：`DeepSeek-Client-Setup-3.0.1.exe`、portable-3.0.0/3.0.1、win-unpacked |
| `desktop/dsh/resources/` | 运行时的 node.exe + dsh-runtime + gate + plugin-static + presets（只读引用） |
| `plugin/` | gate 权限门插件包源码（ESM） |
| `plugin-static/` | 静态功能插件（余额/更新/市场/使用指南/意见区/识图/翻译等） |
| `presets/` | 「神奇小开关」等 agent 预设配置 |
| `browser-extension/` | 浏览器 PDF 实时翻译扩展（Edge/Chrome 开发者模式加载） |
| `test-env/` | **测试环境**：改自己前先在这里验证（见 §4） |
| `BACKUP/` | **备份**：聊天记录 + 配置 + gate 源码（见 §3） |
| `backup.ps1` | 一键备份脚本（UTF-8 带 BOM，PS 5.1 必需） |
| `PROGRESS.md` | 详细进度与断点记录（权威来源，含全部修复历史） |
| `DESIGN.md` / `README.md` | 设计与说明 |

## 2. 当前状态（2026-08-17 凌晨）

- 最新发布：**v5.1.0**（`DeepSeekClient-portable-5.1.0-win-x64.zip` 便携版）。
- **v5.0.0 手机远程 App**：电脑端 3191 远程服务（配对码+token 认证）；手机网页 PWA（`mobile/web/`）；安卓 APK（GitHub Actions 云构建）；发指令给电脑 agent 执行 + 浏览/下载电脑文件；免费私密（局域网 + Tailscale 跨网）。详见 `mobile/README.md`。
- **v5.1.0 语音转文字**：电脑端 + 手机端麦克风图标（Web Speech API，手机申请麦克风权限）。
- **v4.0.0**：视图/拖拽收尾里程碑。
- **v3.0.4 自动续跑断点**：`CURRENT_TASK.md` + agent/created 自动注入断点提示；watchdog 自愈已实测。
- 权限模式：两个实例 `permissionMode: "trust"`；审批策略 `never`。
- 关键修复（详见 PROGRESS.md）：
  1. 安装版打不开 → `package.json` 带 BOM → 已剥除。
  2. 写入权限"没了" → gate 假开关 → 已加 trust/never/fail-open 三层放行，5 副本同步。
- 使用中的端口：3180（正式实例）、3190（翻译服务）、3197（测试实例）。

## 3. 备份与恢复

备份位置：`G:\dsh客户端\BACKUP\`
- `sessions/`：全部聊天记录（17 个历史会话明文 jsonl + 实时会话 zstd + cdrive 捕获）。
- `config/`：两个实例的 `dsh-client-config.json`、`cordis.patch.yml`。
- `gate/`：修复后的 gate 源码快照。

**一键备份**（建议每次会话结束时跑）：
```
& G:\dsh客户端\backup.ps1
```

**重装后恢复**：
1. 重装/复制客户端后，聊天记录在 `BACKUP\sessions\`（明文 jsonl 可直接读）。
2. 配置：`permissionMode` 写回各实例的 `$DSH_HOME/dsh-client-config.json`。
3. gate：`BACKUP\gate\desktop_gate_index.js` 是最新修复版，覆盖到
   `desktop\gate\index.js` → 重启客户端自动同步到各实例数据目录。

## 4. 测试环境（先测试后改自己）

任何 gate/插件/配置改动，**先测后改**：
```
1. 改代码（desktop\gate\index.js 或 plugin\index.js）
2. node G:\dsh客户端\test-env\test-gate.mjs        ← 单测，必须全 PASS
3. & G:\dsh客户端\test-env\init-home.ps1            ← 重建测试 home
4. & G:\dsh客户端\test-env\run-test.ps1             ← 启动测试实例(3197)，HTTP 200 才算过
5. 全过 → 才同步正式实例（resources\gate + data\.dsh\... + 安装版数据）
```
测试实例端口 3197、DSH_HOME 完全独立，绝不碰正式数据。

## 5. 待办事项（未完成）

1. **视频剪辑**（OBS/达芬奇集成）——方案已给，未开工。
2. **手机远程 App**（PWA：客户端起 0.0.0.0:3191，配对码+聊天 SSE+文件传输）——方案已写，待实现。
3. **多身份模式**（程序员/大众不同页面）——记为 2.0.0 需求，暂缓。
4. **3.0.1 收尾**：识图（智谱 key 非 sk 前缀已修）、PDF/Office 翻译、网页 PDF 实时翻译
   ——PROGRESS.md 记录已跑通；如重装后需重新验证。

## 6. 红线（绝对不碰）

- `desktop/release/DeepSeekClient-portable-3.0.1/`：最后的可用便携版，**任何改动都不允许**。
- `~/.dsh`（用户全局 DSH 数据）：客户端已隔离，绝不写入。
- JSON 文件禁止带 BOM（会导致 DSH 内核 JSON.parse 崩溃）。

## 7. 环境事实

- Windows 11（PS 5.1）；Node v24.19.0；npm 源 npmmirror（国内可达）；github.com 需代理/PAT。
- 当前实例：`G:\dsh客户端\desktop\dsh\`（便携），DSH_HOME=`desktop\dsh\data\.dsh`。
- 安装版数据：`%APPDATA%\DeepSeekClient\`。
- GitHub 仓库：`WZX123188/deepseekharness-`（版本标签 1.0.0~3.0.1）。
