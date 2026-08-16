# 测试环境（test-env/）

用途：**改"自己"（gate 权限门、插件、profile 配置）之前，先在这里验证跑通，再同步到正式实例。**
防止再次出现"改自己把自己改崩"。

## 组成

| 文件 | 作用 |
|---|---|
| `init-home.ps1` | 初始化独立测试 DSH_HOME（`home/`），从正式实例拷入当前 gate/plugin-static |
| `run-test.ps1` | 启动测试实例（端口 **3197**，独立 DSH_HOME），验证 HTTP 200、插件不崩 |
| `test-gate.mjs` | gate 权限门行为单元测试（trust/never/ask/弹窗故障 共 13 项） |
| `home/` | 测试专用 DSH_HOME（可随时删掉重建） |

## 标准流程（改 gate / 插件 / 配置时）

```
1. 改代码（先改 test-env 引用到的源：desktop\gate\index.js 或 plugin\index.js）
2. node G:\dsh客户端\test-env\test-gate.mjs     ← 单测权限门行为，必须全 PASS
3. pwsh -File G:\dsh客户端\test-env\init-home.ps1  ← 重建测试 home（拷入改动）
4. pwsh -File G:\dsh客户端\test-env\run-test.ps1   ← 启动测试实例，HTTP 200 才算过
5. 全过 → 才允许同步到正式实例（desktop\dsh\resources\gate + data\.dsh\... + 安装版数据）
```

## 注意

- 测试实例端口 3197，与正式 3180 隔离；DSH_HOME 完全独立，绝不碰正式数据。
- `home/` 是测试数据，随时可删。
- 单测里 `loadPermissionMode` 读 `process.env.DSH_HOME/dsh-client-config.json`，脚本自动建临时目录。
- 正式实例的 node.exe / dsh-runtime 是只读引用（不复制，省 500MB）。
