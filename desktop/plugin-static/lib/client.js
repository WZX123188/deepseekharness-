window.__ModuleLoader__.load({
  id: "dsh-client-static",
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    var React = require("react")

    // 与宿主一致的 17 个 RPC 描述符。客户端 api-gateway 要求 strict 编解码；
    // schema 只需提供 parse()（宽松 JSON：原样透传，不做校验）。
    var JSON_CODEC = { mode: "strict", typeSymbol: "json", schema: { parse: function (v) { return v } } }
    var NS = "dshClientFeatures"
    var PKG = "dsh-client-static"
    function direct(method, params) {
      return { id: PKG + "#" + NS + "/" + method, service: NS, namespace: NS, method: method, invocation: { kind: "direct" }, parameters: params || [], result: JSON_CODEC }
    }
    function argsParam() { return { name: "args", wire: "args", source: "json", codec: JSON_CODEC } }
    var DESCRIPTORS = [
      direct("deepseekBalance"), direct("getUsage"), direct("checkUpdate"), direct("doUpdate"),
      direct("getPermissionMode"), direct("setPermissionMode", [argsParam()]),
      direct("listTools"), direct("installTool", [argsParam()]), direct("setToolEnabled", [argsParam()]), direct("uninstallTool", [argsParam()]),
      direct("listPlugins"), direct("installPlugin", [argsParam()]), direct("setPluginEnabled", [argsParam()]), direct("uninstallPlugin", [argsParam()]),
      direct("listProjects"), direct("createProject", [argsParam()]), direct("openFeedback", [argsParam()]),
      direct("getVisionStatus"), direct("setVisionKey", [argsParam()]), direct("clearVisionKey"), direct("testVision"), direct("seeImage", [argsParam()]), direct("openVisionSite")
    ]

    var BLUE = "#4d6bfe"
    var CSS = [
      ".dsh-page{padding:20px;display:flex;flex-direction:column;gap:16px}",
      ".dsh-head{display:flex;justify-content:space-between;align-items:center}",
      ".dsh-h2{margin:0;font-size:15px;font-weight:600}",
      ".dsh-card{background:rgba(127,127,127,.06);border:1px solid rgba(127,127,127,.16);border-radius:12px;padding:16px}",
      ".dsh-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0}",
      ".dsh-row+.dsh-row{border-top:1px solid rgba(127,127,127,.10)}",
      ".dsh-label{opacity:.62;font-size:13px}",
      ".dsh-value{font-size:15px;font-weight:600;font-variant-numeric:tabular-nums}",
      ".dsh-amount{font-size:24px;font-weight:700;color:" + BLUE + "}",
      ".dsh-btn{background:" + BLUE + ";color:#fff;border:none;border-radius:8px;padding:8px 16px;font-size:14px;cursor:pointer}",
      ".dsh-btn:disabled{opacity:.5;cursor:default}",
      ".dsh-btn.ghost{background:transparent;color:" + BLUE + ";border:1px solid " + BLUE + "}",
      ".dsh-err{color:#e5484d;font-size:13px}",
      ".dsh-ok{color:#30a46c;font-size:13px}",
      ".dsh-link{color:" + BLUE + ";font-size:13px;text-decoration:none}",
      ".dsh-link:hover{text-decoration:underline}",
      ".dsh-muted{opacity:.6;font-size:13px;line-height:1.5}",
      ".dsh-note{opacity:.45;font-size:11px;line-height:1.5;color:inherit}",
      ".dsh-configlink{color:" + BLUE + ";font-size:11px;cursor:pointer;background:none;border:none;padding:0;text-align:left}",
      ".dsh-configlink:hover{text-decoration:underline}",
      ".dsh-configbox{background:rgba(77,107,254,.08);border:1px solid rgba(77,107,254,.25);border-radius:8px;padding:8px 10px;font-size:12px;line-height:1.6;margin-top:6px;color:inherit}",
      ".dsh-input{background:transparent;border:1px solid rgba(127,127,127,.3);border-radius:8px;padding:8px 12px;color:inherit;font-size:13px;width:100%}",
      ".dsh-select{background:transparent;border:1px solid rgba(127,127,127,.3);border-radius:8px;padding:6px 10px;color:inherit;font-size:13px}",
      ".dsh-vision-btn{position:relative;background:transparent;border:none;cursor:pointer;font-size:13px;color:inherit;padding:4px 8px;border-radius:8px;opacity:.82}",
      ".dsh-vision-btn:hover{background:rgba(127,127,127,.14);opacity:1}",
      ".dsh-vision-dot{position:absolute;top:3px;right:3px;width:6px;height:6px;border-radius:50%;background:#30a46c}",
      ".dsh-vision-pop{position:absolute;bottom:44px;left:0;width:340px;max-height:62vh;overflow-y:auto;background:#fff;border:1px solid rgba(127,127,127,.2);border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.25);padding:14px;z-index:1000;color:#333;text-align:left}"
    ].join("\n")

    function el(tag, props) {
      var children = Array.prototype.slice.call(arguments, 2)
      return React.createElement.apply(null, [tag, props].concat(children))
    }

    var remote = null
    async function callHost(method, args) {
      if (!remote) return { ok: false, error: "RPC 未初始化" }
      if (typeof remote[method] !== "function") return { ok: false, error: "方法不存在: " + method }
      try {
        var r = args === undefined ? await remote[method]() : await remote[method](args)
        if (!r || r.ok !== true) return { ok: false, error: (r && r.error && r.error.message) || "调用失败" }
        return r.value || { ok: true }
      } catch (e) { return { ok: false, error: String((e && e.message) || e) } }
    }

    function BalanceSection() {
      var p = React.useState({ status: "idle" })
      var state = p[0]; var setState = p[1]
      var up = React.useState(null); var usage = up[0]; var setUsage = up[1]
      function load() {
        setState({ status: "loading" })
        callHost("deepseekBalance").then(function (res) {
          if (res && res.ok) {
            var balance = null
            try { balance = JSON.parse(res.body) } catch (e) { balance = null }
            setState({ status: "ok", balance: balance })
          } else setState({ status: "error", error: (res && res.error) || "未知错误" })
        }).catch(function (e) { setState({ status: "error", error: String((e && e.message) || e) }) })
        callHost("getUsage").then(function (res) { setUsage((res && res.ok) ? res : null) }).catch(function () { setUsage(null) })
      }
      React.useEffect(function () { load() }, [])
      var body
      if (state.status === "loading") body = el("div", { className: "dsh-muted" }, "正在查询余额…")
      else if (state.status === "error") body = el("div", { className: "dsh-err" }, state.error)
      else if (state.status === "ok" && state.balance) {
        var infos = (state.balance.balance_infos) || []
        if (infos.length === 0) body = el("div", { className: "dsh-muted" }, "未返回余额信息")
        else body = infos.map(function (info) {
          return el("div", { className: "dsh-card", key: info.currency },
            el("div", { className: "dsh-row" }, el("span", { className: "dsh-label" }, "币种"), el("span", { className: "dsh-value" }, info.currency)),
            el("div", { className: "dsh-row" }, el("span", { className: "dsh-label" }, "总余额"), el("span", { className: "dsh-amount" }, info.total_balance)),
            el("div", { className: "dsh-row" }, el("span", { className: "dsh-label" }, "赠送余额"), el("span", { className: "dsh-value" }, info.granted_balance)),
            el("div", { className: "dsh-row" }, el("span", { className: "dsh-label" }, "充值余额"), el("span", { className: "dsh-value" }, info.topped_up_balance)))
        })
      }
      return el("div", { className: "dsh-page" },
        el("div", { className: "dsh-head" }, el("h2", { className: "dsh-h2" }, "DeepSeek 余额"), el("button", { className: "dsh-btn ghost", onClick: load }, "刷新")),
        body,
        el("div", { className: "dsh-card" },
          el("div", { className: "dsh-h2", style: { marginBottom: "8px" } }, "本机 token 用量"),
          usage ? el("div", {},
            el("div", { className: "dsh-row" }, el("span", { className: "dsh-label" }, "本次 token"), el("span", { className: "dsh-value" }, usage.currentTokens)),
            el("div", { className: "dsh-row" }, el("span", { className: "dsh-label" }, "累计 token"), el("span", { className: "dsh-value" }, usage.totalTokens)),
            el("div", { className: "dsh-row" }, el("span", { className: "dsh-label" }, "会话数"), el("span", { className: "dsh-value" }, usage.sessionCount))) : el("div", { className: "dsh-muted" }, "暂无数据"),
          el("div", { className: "dsh-note", style: { marginTop: "8px" } }, "· 用量为本地估算值，仅供参考，非平台账单；以 DeepSeek 开放平台为准。"),
          el("div", { className: "dsh-note" }, "· 累计 token 会按对话持续累加并保存到本机；本次为当前会话。")),
        el("div", { className: "dsh-muted" }, "余额来自 DeepSeek 开放平台 user/balance 接口。"))
    }

    function UpdateSection() {
      var p = React.useState({ status: "idle", res: null, updated: false })
      var state = p[0]; var setState = p[1]
      var up = React.useState(false); var updating = up[0]; var setUpdating = up[1]
      function check() {
        setState({ status: "loading", res: null, updated: false })
        callHost("checkUpdate").then(function (res) {
          if (res && res.ok) setState({ status: "ok", res: res, updated: false })
          else setState({ status: "error", res: null, updated: false, error: (res && res.error) || "未知错误" })
        }).catch(function (e) { setState({ status: "error", res: null, updated: false, error: String((e && e.message) || e) }) })
      }
      function doUpdate() {
        setUpdating(true)
        callHost("doUpdate").then(function (res) {
          setUpdating(false)
          if (res && res.ok) setState({ status: "ok", res: state.res, updated: true })
          else setState({ status: "error", res: state.res, updated: false, error: (res && res.error) || "更新失败" })
        }).catch(function (e) { setUpdating(false); setState({ status: "error", res: state.res, updated: false, error: String((e && e.message) || e) }) })
      }
      React.useEffect(function () { check() }, [])
      var inner = null
      if (state.status === "loading") inner = el("div", { className: "dsh-muted" }, "正在检查更新…")
      else if (state.status === "error") inner = el("div", { className: "dsh-err" }, state.error)
      else if (state.status === "ok" && state.res) {
        var official = state.res.official || {}
        var github = state.res.github || {}
        inner = el("div", {},
          el("div", { className: "dsh-h2", style: { marginBottom: "8px" } }, "官方更新"),
          el("div", { className: "dsh-card", style: { marginBottom: "12px" } },
            el("div", { className: "dsh-row" }, el("span", { className: "dsh-label" }, "当前版本"), el("span", { className: "dsh-value" }, official.current || "-")),
            el("div", { className: "dsh-row" }, el("span", { className: "dsh-label" }, "最新版本"), el("span", { className: "dsh-value" }, official.latest || "-")),
            el("div", { style: { paddingTop: "12px" } }, official.hasUpdate ? el("button", { className: "dsh-btn", onClick: doUpdate, disabled: updating }, updating ? "打开中…" : "去下载新版") : el("div", { className: "dsh-ok" }, "已是最新版本")),
            el("div", { className: "dsh-muted", style: { marginTop: "8px" } }, "独立版已内置核心，更新请到 GitHub 发布页下载新版安装包 / 便携版。")),
          el("div", { className: "dsh-h2", style: { marginBottom: "8px" } }, "GitHub 更新"),
          el("div", { className: "dsh-card" },
            github.ok ? el("div", {},
              el("div", { className: "dsh-row" }, el("span", { className: "dsh-label" }, "最新版本"), el("span", { className: "dsh-value" }, github.tag)),
              el("div", { className: "dsh-row" }, el("span", { className: "dsh-label" }, "说明"), el("span", { className: "dsh-value" }, github.name || "-")),
              github.html ? el("a", { href: github.html, target: "_blank", rel: "noreferrer", className: "dsh-link", style: { display: "inline-block", marginTop: "8px" } }, "前往 GitHub 查看发布") : null)
              : github.noRelease ? el("div", { className: "dsh-muted" }, "GitHub 仓库还没有发布版本（Release）。") : el("div", { className: "dsh-err" }, "无法连接到 GitHub（网络不通）。")),
          state.updated ? el("div", { className: "dsh-ok", style: { paddingTop: "8px" } }, "已打开 GitHub 发布页，请下载新版。") : null)
      }
      return el("div", { className: "dsh-page" },
        el("div", { className: "dsh-head" }, el("h2", { className: "dsh-h2" }, "检查更新"), el("button", { className: "dsh-btn ghost", onClick: check }, "重新检查")),
        el("div", { className: "dsh-card" }, inner))
    }

    function PermissionSection() {
      var p = React.useState({ status: "idle", mode: null, error: null })
      var state = p[0]; var setState = p[1]
      function load() {
        setState({ status: "loading", mode: null, error: null })
        callHost("getPermissionMode").then(function (res) {
          if (res && res.ok) setState({ status: "ok", mode: res.mode, error: null })
          else setState({ status: "error", mode: null, error: (res && res.error) || "未知错误" })
        }).catch(function (e) { setState({ status: "error", mode: null, error: String((e && e.message) || e) }) })
      }
      function setMode(mode) {
        callHost("setPermissionMode", { mode: mode }).then(function (res) {
          if (res && res.ok) setState({ status: "ok", mode: res.mode, error: null })
          else setState({ status: "error", mode: state.mode, error: (res && res.error) || "设置失败" })
        }).catch(function (e) { setState({ status: "error", mode: state.mode, error: String((e && e.message) || e) }) })
      }
      React.useEffect(function () { load() }, [])
      var mode = state.mode
      return el("div", { className: "dsh-page" },
        el("h2", { className: "dsh-h2" }, "权限"),
        el("div", { className: "dsh-card" },
          el("div", { className: "dsh-h2", style: { marginBottom: "8px" } }, "文件操作权限"),
          el("div", { className: "dsh-row", style: { cursor: "pointer" }, onClick: function () { setMode("ask") } },
            el("div", {}, el("div", { className: "dsh-value" }, "敏感操作需用户决策"), el("div", { className: "dsh-muted" }, "修改 / 删除文件时弹窗让你勾选同意（推荐）")),
            mode === "ask" ? el("span", { className: "dsh-ok" }, "✓ 当前") : null),
          el("div", { className: "dsh-row", style: { cursor: "pointer" }, onClick: function () { setMode("trust") } },
            el("div", {}, el("div", { className: "dsh-value" }, "完全放开（信任）"), el("div", { className: "dsh-muted" }, "所有文件操作都不询问，直接放行")),
            mode === "trust" ? el("span", { className: "dsh-ok" }, "✓ 当前") : null),
          state.error ? el("div", { className: "dsh-err", style: { marginTop: "8px" } }, state.error) : null))
    }

    function marketSection(title, listMethod, kind) {
      return function MarketSection() {
        var p = React.useState({ status: "idle", cats: null, error: null })
        var state = p[0]; var setState = p[1]
        var b = React.useState(null); var busy = b[0]; var setBusy = b[1]
        var ex = React.useState(null); var expandedId = ex[0]; var setExpandedId = ex[1]
        function load() {
          setState({ status: "loading", cats: null, error: null })
          callHost(listMethod).then(function (res) {
            if (res && res.ok) setState({ status: "ok", cats: res.categories, error: null })
            else setState({ status: "error", cats: null, error: (res && res.error) || "未知错误" })
          }).catch(function (e) { setState({ status: "error", cats: null, error: String((e && e.message) || e) }) })
        }
        function act(key, args) { setBusy(args.id); callHost(key, args).then(function () { setBusy(null); load() }).catch(function () { setBusy(null); load() }) }
        function toggleExpand(id) { setExpandedId(expandedId === id ? null : id) }
        React.useEffect(function () { load() }, [])
        var body
        if (state.status === "loading") body = el("div", { className: "dsh-muted" }, "正在加载…")
        else if (state.status === "error") body = el("div", { className: "dsh-err" }, state.error)
        else if (state.status === "ok" && state.cats) {
          body = state.cats.map(function (cat) {
            return el("div", { key: cat.name },
              el("div", { className: "dsh-h2", style: { margin: "14px 0 6px" } }, cat.name),
              cat.items.map(function (it) {
                var isBusy = busy === it.id
                return el("div", { className: "dsh-card", key: it.id, style: { padding: "12px", marginBottom: "8px" } },
                  el("div", { className: "dsh-row" },
                    el("div", { style: { flex: 1 } },
                      el("div", { className: "dsh-value" }, it.name),
                      el("div", { className: "dsh-muted" }, it.desc),
                      el("div", { className: "dsh-muted", style: { fontSize: "11px" } }, it.note),
                      el("div", { className: "dsh-muted", style: { fontSize: "11px" } }, it.pkg),
                      it.config ? el("button", { className: "dsh-configlink", onClick: function () { toggleExpand(it.id) } }, expandedId === it.id ? "收起配置说明 ▲" : "⚙ 需配置 · 点击查看详情") : el("span", { className: "dsh-muted", style: { fontSize: "11px" } }, "无需额外配置"),
                      expandedId === it.id && it.config ? el("div", { className: "dsh-configbox" }, it.config) : null),
                    it.installed
                      ? el("div", { style: { display: "flex", flexDirection: "column", gap: "6px", alignItems: "flex-end" } },
                          el("span", { className: it.enabled ? "dsh-ok" : "dsh-muted" }, it.enabled ? "启用中" : "已禁用"),
                          el("div", { style: { display: "flex", gap: "6px" } },
                            el("button", { className: "dsh-btn ghost", onClick: function () { act("set" + kind + "Enabled", { id: it.id, enabled: !it.enabled }) }, disabled: isBusy }, it.enabled ? "禁用" : "启用"),
                            el("button", { className: "dsh-btn ghost", onClick: function () { act("uninstall" + kind, { id: it.id }) }, disabled: isBusy }, "卸载")))
                      : el("button", { className: "dsh-btn", onClick: function () { act("install" + kind, { id: it.id }) }, disabled: isBusy }, isBusy ? "安装中…" : "安装")))
              }))
          })
        }
        return el("div", { className: "dsh-page" },
          el("div", { className: "dsh-head" }, el("h2", { className: "dsh-h2" }, title), el("button", { className: "dsh-btn ghost", onClick: load }, "刷新")),
          body,
          el("div", { className: "dsh-muted" }, "「安装」只是下载到本机；用「启用 / 禁用」控制是否生效，「卸载」彻底移除。部分工具还需在其内部配置（如 API Key）才会真正工作。"))
      }
    }
    var ToolsSection = marketSection("Tool 市场", "listTools", "Tool")
    var PluginsSection = marketSection("Plugin 市场", "listPlugins", "Plugin")

    function GuideSection() {
      return el("div", { className: "dsh-page" },
        el("h2", { className: "dsh-h2" }, "使用指南"),
        el("div", { className: "dsh-card" }, el("div", { className: "dsh-h2", style: { marginBottom: "8px" } }, "第一步：接入 API"), el("div", { className: "dsh-muted" }, "在「设置 → 模型」页配置 DeepSeek API Key（platform.deepseek.com → API Keys 创建）。")),
        el("div", { className: "dsh-card" }, el("div", { className: "dsh-h2", style: { marginBottom: "8px" } }, "第二步：功能介绍"),
          el("div", { className: "dsh-muted" }, "· 权限门：修改 / 删除文件时勾选「同意」并确认后放行；读取默认放行。"),
          el("div", { className: "dsh-muted" }, "· 余额 / 用量：查看 DeepSeek 账户余额。"),
          el("div", { className: "dsh-muted" }, "· 检查更新：一键更新到最新版。"),
          el("div", { className: "dsh-muted" }, "· Tool 市场：一键安装热门工具。"),
          el("div", { className: "dsh-muted" }, "· 神奇小开关：开新会话时，在「模式」里选「神奇小开关」，模型选 DeepSeek-V4-Pro 即可。")),
        el("div", { className: "dsh-card" }, el("div", { className: "dsh-h2", style: { marginBottom: "8px" } }, "快捷操作"),
          el("div", { className: "dsh-muted" }, "· Ctrl+Alt+D：呼出 / 隐藏窗口。"),
          el("div", { className: "dsh-muted" }, "· 右下角托盘：显示 / 退出、窗口置顶、开机自启开关。")))
    }

    function ProjectsSection() {
      var p = React.useState({ status: "idle", items: null, error: null })
      var state = p[0]; var setState = p[1]
      function load() {
        setState({ status: "loading", items: null, error: null })
        callHost("listProjects").then(function (res) {
          if (res && res.ok) setState({ status: "ok", items: res.items, error: null })
          else setState({ status: "error", items: null, error: (res && res.error) || "未知错误" })
        }).catch(function (e) { setState({ status: "error", items: null, error: String((e && e.message) || e) }) })
      }
      React.useEffect(function () { load() }, [])
      var body
      if (state.status === "loading") body = el("div", { className: "dsh-muted" }, "正在加载项目…")
      else if (state.status === "error") body = el("div", { className: "dsh-err" }, state.error)
      else if (state.status === "ok" && state.items) {
        if (state.items.length === 0) body = el("div", { className: "dsh-muted" }, "还没有项目，点「新建项目」选一个文件夹开始。")
        else body = state.items.map(function (item) {
          return el("div", { className: "dsh-card", key: item.id, style: { padding: "12px", marginBottom: "8px" } },
            el("div", { className: "dsh-value" }, item.title), el("div", { className: "dsh-muted", style: { fontSize: "11px" } }, item.path))
        })
      }
      return el("div", { className: "dsh-page" },
        el("div", { className: "dsh-head" }, el("h2", { className: "dsh-h2" }, "项目")),
        body, el("div", { className: "dsh-muted" }, "项目即工作区：一个文件夹对应一个项目，会话与文件按项目隔离。"))
    }

    function FeedbackSection() {
      var t = React.useState("idea"); var type = t[0]; var setType = t[1]
      var ti = React.useState(""); var title = ti[0]; var setTitle = ti[1]
      var b = React.useState(""); var body = b[0]; var setBody = b[1]
      var s = React.useState(""); var status = s[0]; var setStatus = s[1]
      function submit() {
        if (!title.trim()) { setStatus("请先填写标题"); return }
        setStatus("正在打开 GitHub 提交页…")
        callHost("openFeedback", { type: type, title: title, body: body }).then(function (res) {
          if (res && res.ok) setStatus("已在浏览器打开 GitHub 提交页，请在页面上点击「Submit new issue」完成发布。")
          else setStatus((res && res.error) || "打开失败")
        }).catch(function (e) { setStatus(String((e && e.message) || e)) })
      }
      return el("div", { className: "dsh-page" },
        el("div", { className: "dsh-head" }, el("h2", { className: "dsh-h2" }, "意见区")),
        el("div", { className: "dsh-card" },
          el("div", { className: "dsh-row" }, el("span", { className: "dsh-label" }, "类型"),
            el("select", { value: type, onChange: function (e) { setType(e.target.value) }, className: "dsh-select" },
              el("option", { value: "idea" }, "功能建议"), el("option", { value: "bug" }, "问题反馈"), el("option", { value: "other" }, "其他"))),
          el("div", { className: "dsh-row" }, el("span", { className: "dsh-label" }, "标题"),
            el("input", { value: title, onChange: function (e) { setTitle(e.target.value) }, placeholder: "一句话说明", className: "dsh-input", style: { flex: 1 } })),
          el("div", { style: { padding: "8px 0" } }, el("textarea", { value: body, onChange: function (e) { setBody(e.target.value) }, placeholder: "详细描述你的建议或问题…", rows: 6, className: "dsh-input" })),
          el("div", { style: { paddingTop: "8px" } }, el("button", { className: "dsh-btn", onClick: submit }, "提交到 GitHub"), status ? el("div", { className: "dsh-muted", style: { marginTop: "8px" } }, status) : null)),
        el("div", { className: "dsh-muted" }, "提交后会打开 GitHub 的 Issue 提交页，需你登录 GitHub 账号后点确认发布；本机不保存任何账号信息。"))
    }

    function VisionSection() {
      var st = React.useState({ status: "loading", configured: false, model: "" })
      var state = st[0]; var setState = st[1]
      var k = React.useState(""); var key = k[0]; var setKey = k[1]
      var m = React.useState(""); var msg = m[0]; var setMsg = m[1]
      var b = React.useState(false); var busy = b[0]; var setBusy = b[1]
      var im = React.useState(""); var image = im[0]; var setImage = im[1]
      var rs = React.useState(""); var result = rs[0]; var setResult = rs[1]

      function load() {
        setState({ status: "loading", configured: false, model: "" })
        callHost("getVisionStatus").then(function (res) {
          if (res && res.ok) setState({ status: "ok", configured: !!res.configured, model: res.model || "" })
          else setState({ status: "error", configured: false, model: "" })
        }).catch(function () { setState({ status: "error", configured: false, model: "" }) })
      }
      React.useEffect(function () { load() }, [])

      function save() {
        if (!key.trim()) { setMsg("请先粘贴你的智谱 API Key（以 sk- 开头）"); return }
        setBusy(true); setMsg("")
        callHost("setVisionKey", { key: key.trim() }).then(function (res) {
          setBusy(false)
          if (res && res.ok) { setMsg("已保存 ✓"); setKey(""); load() }
          else setMsg((res && res.error) || "保存失败")
        }).catch(function (e) { setBusy(false); setMsg(String((e && e.message) || e)) })
      }
      function test() {
        setBusy(true); setMsg("正在测试连接…")
        callHost("testVision").then(function (res) {
          setBusy(false)
          if (res && res.ok) setMsg("连接成功 ✓ 视图功能已可用")
          else setMsg((res && res.error) || "测试失败")
        }).catch(function (e) { setBusy(false); setMsg(String((e && e.message) || e)) })
      }
      function clearKey() {
        setBusy(true)
        callHost("clearVisionKey").then(function () { setBusy(false); setKey(""); load() }).catch(function () { setBusy(false); load() })
      }
      function goto() { callHost("openVisionSite").then(function () {}) }
      function onFile(e) {
        var f = e.target.files && e.target.files[0]
        if (!f) return
        var rd = new FileReader()
        rd.onload = function () { setImage(rd.result); setResult("") }
        rd.readAsDataURL(f)
      }
      function recognize() {
        if (!image) { setMsg("请先选择一张图片"); return }
        setBusy(true); setResult(""); setMsg("识别中…")
        callHost("seeImage", { image: image }).then(function (res) {
          setBusy(false)
          if (res && res.ok) { setResult(res.text); setMsg("识别完成 ✓") }
          else setMsg((res && res.error) || "识别失败")
        }).catch(function (e) { setBusy(false); setMsg(String((e && e.message) || e)) })
      }

      var configured = state.configured
      var statusBadge = configured ? el("span", { className: "dsh-ok", style: { fontWeight: 600 } }, "● 已启用") : el("span", { className: "dsh-muted" }, "● 未启用")
      var msgOk = msg.indexOf("成功") !== -1 || msg.indexOf("已保存") !== -1

      return el("div", { className: "dsh-page" },
        el("div", { className: "dsh-head" }, el("h2", { className: "dsh-h2" }, "视图模式（识图）"), statusBadge),

        el("div", { className: "dsh-card" },
          el("div", { className: "dsh-h2", style: { marginBottom: "10px" } }, "📖 新手教程：怎么开启识图"),
          el("div", { className: "dsh-muted" }, "视图模式让 DeepSeek「看懂」图片：把图片发给免费的智谱 GLM-4V-Flash 识别，识别出的文字 / 内容再喂给 DeepSeek 一起回答。"),
          el("ol", { style: { margin: "10px 0 0", paddingLeft: "20px", lineHeight: "1.9", fontSize: "13px", opacity: ".85" } },
            el("li", {}, "点下面「去智谱官网申请免费 Key」按钮（会在浏览器打开官网）。"),
            el("li", {}, "用手机号注册 / 登录智谱开放平台（open.bigmodel.cn）。"),
            el("li", {}, "点页面右上角「API 密钥」→「创建 API Key」→ 复制那串以 sk- 开头的 Key。（免费模型，无需充值）"),
            el("li", {}, "把 Key 粘贴到下面输入框 → 点「保存 Key」→ 再点「测试连接」。"),
            el("li", {}, "看到「连接成功」后，下面的识图区就能用了。")),
          el("div", { className: "dsh-note", style: { marginTop: "10px" } }, "· 隐私：Key 只保存在你自己电脑上，不上传、不开源。")),

        el("div", { className: "dsh-card" },
          el("div", { className: "dsh-h2", style: { marginBottom: "10px" } }, "🔑 配置智谱 Key"),
          el("div", { style: { display: "flex", gap: "8px" } },
            el("input", { value: key, onChange: function (e) { setKey(e.target.value) }, placeholder: "粘贴以 sk- 开头的智谱 API Key", className: "dsh-input", style: { flex: 1 } }),
            el("button", { className: "dsh-btn", onClick: save, disabled: busy }, "保存 Key")),
          el("div", { style: { display: "flex", gap: "8px", marginTop: "10px", flexWrap: "wrap" } },
            el("button", { className: "dsh-btn ghost", onClick: goto }, "🌐 去智谱官网申请免费 Key"),
            el("button", { className: "dsh-btn ghost", onClick: test, disabled: busy }, "测试连接"),
            configured ? el("button", { className: "dsh-btn ghost", onClick: clearKey, disabled: busy }, "清除 Key") : null),
          msg ? el("div", { className: msgOk ? "dsh-ok" : "dsh-err", style: { marginTop: "10px" } }, msg) : null),

        el("div", { className: "dsh-card", style: configured ? {} : { opacity: ".55" } },
          el("div", { className: "dsh-head" },
            el("div", { className: "dsh-h2" }, "🖼 识图"),
            configured ? null : el("span", { className: "dsh-muted", style: { fontSize: "12px" } }, "配置 Key 后启用")),
          el("div", { style: { marginTop: "10px" } },
            el("input", { type: "file", accept: "image/*", onChange: onFile, disabled: !configured, className: "dsh-input" })),
          image ? el("img", { src: image, style: { maxWidth: "100%", maxHeight: "240px", borderRadius: "8px", marginTop: "10px", display: "block" } }) : null,
          el("div", { style: { marginTop: "10px" } },
            el("button", { className: "dsh-btn", onClick: recognize, disabled: !configured || busy }, busy ? "识别中…" : "开始识别")),
          result ? el("div", { style: { marginTop: "12px" } },
            el("div", { className: "dsh-muted", style: { marginBottom: "6px" } }, "识别结果（点一下全选，可直接复制到对话框）："),
            el("textarea", { value: result, readOnly: true, rows: 8, className: "dsh-input", onFocus: function (e) { e.target.select() } })) : null))
    }

    function VisionInputButton() {
      var op = React.useState(false); var isOpen = op[0]; var setOpen = op[1]
      var st = React.useState({ configured: false }); var state = st[0]; var setState = st[1]
      var k = React.useState(""); var key = k[0]; var setKey = k[1]
      var m = React.useState(""); var msg = m[0]; var setMsg = m[1]
      var b = React.useState(false); var busy = b[0]; var setBusy = b[1]
      var im = React.useState(""); var image = im[0]; var setImage = im[1]
      var rs = React.useState(""); var result = rs[0]; var setResult = rs[1]

      function load() { callHost("getVisionStatus").then(function (res) { if (res && res.ok) setState({ configured: !!res.configured }) }).catch(function () {}) }
      React.useEffect(function () { load() }, [])
      function toggle() { var next = !isOpen; setOpen(next); if (next) load() }
      function save() {
        if (!key.trim()) { setMsg("请先粘贴智谱 API Key（sk- 开头）"); return }
        setBusy(true)
        callHost("setVisionKey", { key: key.trim() }).then(function (res) {
          setBusy(false)
          if (res && res.ok) { setMsg("已保存 ✓"); setKey(""); load() }
          else setMsg((res && res.error) || "保存失败")
        }).catch(function (e) { setBusy(false); setMsg(String((e && e.message) || e)) })
      }
      function test() {
        setBusy(true); setMsg("测试中…")
        callHost("testVision").then(function (res) {
          setBusy(false); setMsg((res && res.ok) ? "连接成功 ✓" : ((res && res.error) || "测试失败"))
        }).catch(function (e) { setBusy(false); setMsg(String((e && e.message) || e)) })
      }
      function goto() { callHost("openVisionSite").then(function () {}) }
      function onFile(e) {
        var f = e.target.files && e.target.files[0]
        if (!f) return
        var rd = new FileReader()
        rd.onload = function () { setImage(rd.result); setResult("") }
        rd.readAsDataURL(f)
      }
      function recognize() {
        if (!image) { setMsg("请先选择一张图片"); return }
        setBusy(true); setResult(""); setMsg("识别中…")
        callHost("seeImage", { image: image }).then(function (res) {
          setBusy(false)
          if (res && res.ok) { setResult(res.text); setMsg("识别完成 ✓") }
          else setMsg((res && res.error) || "识别失败")
        }).catch(function (e) { setBusy(false); setMsg(String((e && e.message) || e)) })
      }

      var cfg = state.configured
      return el("div", { style: { position: "relative" } },
        el("button", { className: "dsh-vision-btn", onClick: toggle, title: cfg ? "识图（已启用）" : "识图（未配置）" }, "🖼 识图", cfg ? el("span", { className: "dsh-vision-dot" }) : null),
        isOpen ? el("div", { className: "dsh-vision-pop" },
          el("div", { className: "dsh-h2", style: { marginBottom: "8px" } }, "识图（视图模式）", el("span", { className: cfg ? "dsh-ok" : "dsh-muted", style: { marginLeft: "8px", fontSize: "12px" } }, cfg ? "已启用" : "未启用")),
          cfg ? null : el("div", { className: "dsh-muted", style: { marginBottom: "8px" } }, "识别图片需要免费的智谱 GLM-4V-Flash 模型，请先领 Key："),
          cfg ? null : el("button", { className: "dsh-btn ghost", onClick: goto, style: { marginBottom: "8px" } }, "🌐 去智谱官网申请免费 Key"),
          el("div", { style: { display: "flex", gap: "6px", marginBottom: "8px" } },
            el("input", { value: key, onChange: function (e) { setKey(e.target.value) }, placeholder: "粘贴 sk- 开头的 Key", className: "dsh-input", style: { flex: 1 } }),
            el("button", { className: "dsh-btn", onClick: save, disabled: busy }, "保存"),
            el("button", { className: "dsh-btn ghost", onClick: test, disabled: busy }, "测试")),
          el("div", { className: "dsh-muted", style: { fontSize: "12px", marginBottom: "8px" } }, "图片 → 识别 → 结果可复制到对话框。"),
          el("input", { type: "file", accept: "image/*", onChange: onFile, disabled: !cfg, className: "dsh-input", style: { marginBottom: "6px" } }),
          image ? el("img", { src: image, style: { maxWidth: "100%", maxHeight: "160px", borderRadius: "8px", marginBottom: "6px", display: "block" } }) : null,
          el("button", { className: "dsh-btn", onClick: recognize, disabled: !cfg || busy }, busy ? "识别中…" : "开始识别"),
          msg ? el("div", { className: (msg.indexOf("成功") !== -1 || msg.indexOf("已保存") !== -1) ? "dsh-ok" : "dsh-err", style: { marginTop: "6px", fontSize: "12px" } }, msg) : null,
          result ? el("div", { style: { marginTop: "8px" } }, el("textarea", { value: result, readOnly: true, rows: 5, className: "dsh-input", onFocus: function (e) { e.target.select() } })) : null
        ) : null)
    }

    async function apply(ctx) {
      await ctx.remote.$mount({ package: PKG, descriptors: DESCRIPTORS })

      // 刚挂载的命名空间服务需要用子插件注入才能取到引用（自身 apply 里静态注入会死锁）
      var holder = { service: null }
      await ctx.plugin({
        name: "dsh-client-static-ns",
        inject: ["remote.dshClientFeatures"],
        apply: function (c) { holder.service = c.remote.dshClientFeatures }
      })
      remote = holder.service

      // 冒烟测试：主动调用一次 getPermissionMode，验证 RPC 打通（宿主侧会打印日志）
      try { callHost("getPermissionMode").then(function () {}) } catch (e) {}

      if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=dsh-client-static]") === null) {
        var tag = document.createElement("style")
        tag.dataset.pluginCss = "dsh-client-static"
        tag.textContent = CSS
        document.head.appendChild(tag)
      }

      var slots = ctx.slots
      function section(id, order, label, Component) {
        slots.inject("settings.section", function () {
          return slots.register({ name: "settings.section", id: id, order: order, label: function () { return label } }, function () { return React.createElement(Component) })
        })
      }
      section("dsh-balance", 30, "余额 / 用量", BalanceSection)
      section("dsh-update", 40, "检查更新", UpdateSection)
      section("dsh-projects", 2, "项目", ProjectsSection)
      section("dsh-tools", 35, "Tool 市场", ToolsSection)
      section("dsh-plugins", 36, "Plugin 市场", PluginsSection)
      section("dsh-guide", 45, "使用指南", GuideSection)
      section("dsh-feedback", 46, "意见区", FeedbackSection)
      section("dsh-permission", 6, "权限", PermissionSection)
      section("dsh-vision", 25, "视图模式", VisionSection)

      // 视图模式开关：放到首页对话框（输入框工具行左侧）
      ctx.slots.inject("conversation.input.left", function () {
        return ctx.slots.register(
          { name: "conversation.input.left", id: "dsh-vision", order: 100, label: function () { return "识图" } },
          function () { return React.createElement(VisionInputButton) }
        )
      })
    }

    exports.apply = apply
    exports.inject = ["remote", "slots"]
    return module.exports
  }
})
