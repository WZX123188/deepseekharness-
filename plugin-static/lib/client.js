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
      direct("listProjects"), direct("createProject", [argsParam()]), direct("openFeedback", [argsParam()])
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
      ".dsh-select{background:transparent;border:1px solid rgba(127,127,127,.3);border-radius:8px;padding:6px 10px;color:inherit;font-size:13px}"
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
            el("div", { style: { paddingTop: "12px" } }, official.hasUpdate ? el("button", { className: "dsh-btn", onClick: doUpdate, disabled: updating }, updating ? "更新中…" : "一键更新") : el("div", { className: "dsh-ok" }, "已是最新版本")),
            el("div", { className: "dsh-muted", style: { marginTop: "8px" } }, "官方更新只更新核心程序，不影响你额外添加的功能。")),
          el("div", { className: "dsh-h2", style: { marginBottom: "8px" } }, "GitHub 更新"),
          el("div", { className: "dsh-card" },
            github.ok ? el("div", {},
              el("div", { className: "dsh-row" }, el("span", { className: "dsh-label" }, "最新版本"), el("span", { className: "dsh-value" }, github.tag)),
              el("div", { className: "dsh-row" }, el("span", { className: "dsh-label" }, "说明"), el("span", { className: "dsh-value" }, github.name || "-")),
              github.html ? el("a", { href: github.html, target: "_blank", rel: "noreferrer", className: "dsh-link", style: { display: "inline-block", marginTop: "8px" } }, "前往 GitHub 查看发布") : null)
              : github.noRelease ? el("div", { className: "dsh-muted" }, "GitHub 仓库还没有发布版本（Release）。") : el("div", { className: "dsh-err" }, "无法连接到 GitHub（网络不通）。")),
          state.updated ? el("div", { className: "dsh-ok", style: { paddingTop: "8px" } }, "更新完成，请重启生效。") : null)
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
    }

    exports.apply = apply
    exports.inject = ["remote", "slots"]
    return module.exports
  }
})
