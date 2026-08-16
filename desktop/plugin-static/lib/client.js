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
      direct("getVisionStatus"), direct("setVisionKey", [argsParam()]), direct("clearVisionKey"), direct("testVision"), direct("seeImage", [argsParam()]), direct("openVisionSite"),
      direct("parseAttachment", [argsParam()]),
      direct("translateText", [argsParam()]), direct("translatePdf", [argsParam()]),
      direct("translateOffice", [argsParam()]), direct("saveOffice", [argsParam()]),
      direct("getWallpaper"), direct("setWallpaper", [argsParam()]),
      direct("getRemoteInfo")
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

    // ===== 聊天附件 v3.0.3：图标卡片 + 本地缓存（agent 读本地路径）=====
    var DOC_RE = /\.(docx|xlsx|pptx|pdf|txt|md|csv|json|log|js|ts|py|html|xml)$/i
    function appendToComposer(text) {
      var ta = document.querySelector("[data-composer-seat] textarea")
      if (!ta) return false
      var proto = window.HTMLTextAreaElement.prototype
      var setter = Object.getOwnPropertyDescriptor(proto, "value").set
      var cur = ta.value
      var sep = cur && !/\n$/.test(cur) ? "\n" : ""
      var insert = sep + text + (text.charAt(text.length - 1) === "\n" ? "" : "\n")
      setter.call(ta, cur + insert)
      ta.dispatchEvent(new Event("input", { bubbles: true }))
      ta.focus()
      return true
    }
    // 附件卡片列表（模块级状态，跨组件共享）
    var attachList = []
    var attachListeners = []
    function notifyAttach() { for (var i = 0; i < attachListeners.length; i++) { try { attachListeners[i]() } catch (e) {} } }
    function iconFor(ext) {
      ext = (ext || "").toLowerCase()
      if (ext === "docx" || ext === "doc") return "📄"
      if (ext === "xlsx" || ext === "xls" || ext === "csv") return "📊"
      if (ext === "pptx" || ext === "ppt") return "📽"
      if (ext === "pdf") return "📕"
      if (ext === "txt" || ext === "md" || ext === "log") return "📃"
      return "📁"
    }
    // 后台缓存：读 base64 → host 存本地 → 注入路径文本到输入框
    function cacheToHost(item, file) {
      if (file.size > 100 * 1024 * 1024) { item.status = "error"; item.error = "文件超过 100MB"; notifyAttach(); return }
      var rd = new FileReader()
      rd.onload = function () {
        callHost("cacheAttachment", { filename: item.name, data: rd.result }).then(function (res) {
          if (res && res.ok) {
            item.status = "ready"
            item.path = res.path
            var txt = "\n【附件】" + item.name + "\n路径：" + res.path + "\n"
            appendToComposer(txt)
          } else { item.status = "error"; item.error = (res && res.error) || "缓存失败" }
          notifyAttach()
        })
      }
      rd.onerror = function () { item.status = "error"; item.error = "读取失败"; notifyAttach() }
      rd.readAsDataURL(file)
    }
    function addAttachments(fileList) {
      var files = Array.prototype.slice.call(fileList || [])
      var docs = files.filter(function (f) { return DOC_RE.test(f.name || "") })
      if (docs.length === 0) return 0
      docs.forEach(function (f) {
        var item = {
          id: "att-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
          name: f.name,
          ext: (f.name.split(".").pop() || "").toLowerCase(),
          size: f.size,
          status: "caching",
          path: ""
        }
        attachList.push(item)
        notifyAttach()
        cacheToHost(item, f)
      })
      return docs.length
    }
    // 移除卡片 + 清理输入框里注入的路径文本
    function removeAttachment(id) {
      var idx = -1
      for (var i = 0; i < attachList.length; i++) if (attachList[i].id === id) { idx = i; break }
      if (idx < 0) return
      var item = attachList[idx]
      attachList.splice(idx, 1)
      if (item.path) {
        var ta = document.querySelector("[data-composer-seat] textarea")
        if (ta) {
          var marker = "【附件】" + item.name
          var at = ta.value.indexOf(marker)
          if (at >= 0) {
            var end = ta.value.indexOf("\n\n", at)
            if (end < 0) end = ta.value.length
            var proto = window.HTMLTextAreaElement.prototype
            var setter = Object.getOwnPropertyDescriptor(proto, "value").set
            setter.call(ta, ta.value.slice(0, at) + ta.value.slice(end))
            ta.dispatchEvent(new Event("input", { bubbles: true }))
          }
        }
      }
      notifyAttach()
    }
    // 附件卡片栏（千问样式：图标 + 标题小字 + 右上角叉叉）——挂在输入区上方
    function AttachmentBar() {
      var [, force] = React.useReducer(function (x) { return x + 1 }, 0)
      React.useEffect(function () {
        attachListeners.push(force)
        return function () {
          var i = attachListeners.indexOf(force)
          if (i >= 0) attachListeners.splice(i, 1)
        }
      }, [])
      if (attachList.length === 0) return null
      return el("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap", padding: "4px 0" } },
        attachList.map(function (a) {
          return el("div", { key: a.id, style: { position: "relative", display: "flex", flexDirection: "column", alignItems: "center", width: "74px", background: "rgba(127,127,127,.08)", border: "1px solid rgba(127,127,127,.18)", borderRadius: "10px", padding: "10px 6px 6px", boxSizing: "border-box" } },
            el("div", { style: { fontSize: "26px", lineHeight: "30px" } }, iconFor(a.ext)),
            el("div", { title: a.name, style: { fontSize: "10px", maxWidth: "66px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", opacity: ".75", marginTop: "4px", lineHeight: "14px" } }, a.name),
            el("button", {
              onClick: function () { removeAttachment(a.id) },
              title: "移除",
              style: { position: "absolute", top: "2px", right: "2px", width: "16px", height: "16px", lineHeight: "14px", fontSize: "10px", borderRadius: "50%", border: "none", cursor: "pointer", background: "rgba(127,127,127,.28)", color: "inherit", padding: "0" }
            }, "✕"),
            a.status === "caching" ? el("div", { style: { fontSize: "9px", opacity: ".55", marginTop: "2px" } }, "缓存中…") :
            a.status === "error" ? el("div", { style: { fontSize: "9px", color: "#e5484d", marginTop: "2px" } }, "失败") : null)
        }))
    }
    function FileInputButton() {
      var fileRef = React.useRef(null)
      function pick() { if (fileRef.current) fileRef.current.click() }
      function onChange(e) {
        addAttachments(e.target.files)
        e.target.value = ""
      }
      return el("span", { style: { display: "inline-flex", alignItems: "center" } },
        el("button", { className: "dsh-vision-btn", onClick: pick, title: "附加文件（docx/xlsx/pptx/pdf/txt…）", style: { fontSize: "13px" } }, "📎"),
        el("input", { ref: fileRef, type: "file", multiple: true, accept: ".docx,.xlsx,.pptx,.pdf,.txt,.md,.csv,.json,.log", style: { display: "none" }, onChange: onChange }))
    }

    var remote = null
    // 本地 RPC：直连 host 端 HTTP 服务（绕开 typert/gateway 注册问题）。
    // RPC 端口与 web 端口关联（3180→3192、3197→3193…），多实例互不冲突；host 端用 DSH_LOCAL_RPC_PORT 覆盖时以同规则对齐。
    var webPort = (typeof location !== "undefined" && location.port) ? Number(location.port) : 3180
    var RPC_PORT = 3192 + (webPort - 3180)
    var RPC_ENDPOINT = "http://127.0.0.1:" + RPC_PORT + "/dsh-rpc"
    async function callHost(method, args) {
      try {
        var r = await fetch(RPC_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ method: method, args: args })
        })
        var j = await r.json()
        return j || { ok: false, error: "空响应" }
      } catch (e) { return { ok: false, error: String((e && e.message) || e) } }
    }

    // ===== 手机远程（v5.0.0）：显示配对码 + 地址 + 免费隧道说明 =====
    function RemoteSection() {
      var st = React.useState(null); var info = st[0]; var setInfo = st[1]
      function load() { callHost("getRemoteInfo").then(function (res) { if (res && res.ok) setInfo(res) }).catch(function () {}) }
      React.useEffect(function () { load() }, [])
      return el("div", { className: "dsh-page" },
        el("div", { className: "dsh-head" }, el("h2", { className: "dsh-h2" }, "📱 手机远程"), el("button", { className: "dsh-btn ghost", onClick: load }, "刷新")),
        el("div", { className: "dsh-card" },
          el("div", { className: "dsh-h2", style: { marginBottom: "10px" } }, "🔑 配对码"),
          info && info.code ? el("div", { style: { fontSize: "28px", fontWeight: 700, letterSpacing: "4px", color: "#4d6bfe" } }, info.code) : el("div", { className: "dsh-muted" }, "加载中…"),
          el("div", { className: "dsh-note", style: { marginTop: "8px" } }, "手机端打开网页或 App，输入下方地址 + 这个配对码即可连接。")),
        el("div", { className: "dsh-card" },
          el("div", { className: "dsh-h2", style: { marginBottom: "8px" } }, "🌐 连接地址"),
          info && info.ips && info.ips.length ? info.ips.map(function (ip) { return el("div", { key: ip, className: "dsh-value", style: { fontSize: "14px" } }, ip + ":" + (info.port || 3191)) }) : el("div", { className: "dsh-muted" }, "未检测到局域网地址"),
          el("div", { className: "dsh-note", style: { marginTop: "8px", lineHeight: "1.7" } }, "· 同一 WiFi：手机直接连上面地址（局域网，私密）。" + "\n· 人在外：电脑和手机都装免费 Tailscale（组网即虚拟局域网，WireGuard 加密），连 Tailscale 分配的 IP 即可。")),
        el("div", { className: "dsh-card" },
          el("div", { className: "dsh-h2", style: { marginBottom: "8px" } }, "📥 手机端安装"),
          el("div", { className: "dsh-muted", style: { lineHeight: "1.8" } }, "· 安卓：GitHub Release 下载 APK 安装（或直接用浏览器打开网页）。" + "\n· 苹果：Safari 打开网页 → 分享 → 添加到主屏幕。" + "\n· 网页地址：http://<上面地址>/mobile（电脑端自动提供）。")))
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

    function PdfSection() {
      var s = React.useState(""); var status = s[0]; var setStatus = s[1]
      var p = React.useState(null); var pages = p[0]; var setPages = p[1]
      var b = React.useState(false); var busy = b[0]; var setBusy = b[1]
      var m = React.useState(""); var msg = m[0]; var setMsg = m[1]
      function onFile(e) {
        var f = e.target.files && e.target.files[0]
        if (!f) return
        setStatus("reading"); setPages(null); setMsg("")
        var rd = new FileReader()
        rd.onload = function () {
          setBusy(true); setStatus("translating"); setMsg("")
          callHost("translatePdf", { pdf: rd.result }).then(function (res) {
            setBusy(false)
            if (res && res.ok) { setPages(res.pages); setStatus("done"); setMsg("完成 ✓ 共 " + res.pages.length + " 页 · " + (res.mode === "scan" ? "扫描版（OCR）" : res.mode === "scan-nokey" ? "扫描版需配置视觉Key" : "文字版")) }
            else { setStatus("error"); setMsg((res && res.error) || "翻译失败") }
          }).catch(function (err) { setBusy(false); setStatus("error"); setMsg(String((err && err.message) || err)) })
        }
        rd.readAsDataURL(f)
      }
      return el("div", { className: "dsh-page" },
        el("div", { className: "dsh-head" }, el("h2", { className: "dsh-h2" }, "PDF 翻译")),
        el("div", { className: "dsh-card" },
          el("div", { className: "dsh-muted", style: { marginBottom: "10px" } }, "上传英文 PDF（数据手册 / 文档），自动判断文字版或扫描版并翻译成中文；专业术语、数字、引脚名保持原文。"),
          el("input", { type: "file", accept: ".pdf,application/pdf", onChange: onFile, disabled: busy, className: "dsh-input" }),
          busy ? el("div", { className: "dsh-muted", style: { marginTop: "10px" } }, "翻译中，请耐心等待…") : null,
          msg ? el("div", { className: msg.indexOf("完成") !== -1 ? "dsh-ok" : "dsh-err", style: { marginTop: "10px" } }, msg) : null),
        pages && pages.length ? pages.map(function (pg, idx) {
          return el("div", { className: "dsh-card", key: idx, style: { marginTop: "10px" } },
            el("div", { className: "dsh-h2", style: { marginBottom: "8px" } }, "第 " + pg.page + " 页"),
            el("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" } },
              el("div", {}, el("div", { className: "dsh-muted", style: { marginBottom: "4px" } }, "原文"), el("div", { className: "dsh-muted", style: { whiteSpace: "pre-wrap", fontSize: "12px", lineHeight: "1.7" } }, pg.original)),
              el("div", {}, el("div", { className: "dsh-muted", style: { marginBottom: "4px" } }, "译文"), el("div", { style: { whiteSpace: "pre-wrap", fontSize: "13px", lineHeight: "1.8" } }, pg.translated))))
        }) : null)
    }

    function downloadBase64(b64, filename) {
      try {
        var bin = atob(b64)
        var arr = new Uint8Array(bin.length)
        for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
        var blob = new Blob([arr], { type: "application/octet-stream" })
        var url = URL.createObjectURL(blob)
        var a = document.createElement("a")
        a.href = url; a.download = filename
        document.body.appendChild(a); a.click(); document.body.removeChild(a)
        setTimeout(function () { URL.revokeObjectURL(url) }, 3000)
      } catch (e) {}
    }

    function OfficeSection() {
      var s = React.useState(""); var status = s[0]; var setStatus = s[1]
      var ch = React.useState(null); var chunks = ch[0]; var setChunks = ch[1]
      var fb = React.useState(""); var fileB64 = fb[0]; var setFileB64 = fb[1]
      var fn = React.useState(""); var fileName = fn[0]; var setFileName = fn[1]
      var rb = React.useState(""); var resultB64 = rb[0]; var setResultB64 = rb[1]
      var rn = React.useState(""); var resultName = rn[0]; var setResultName = rn[1]
      var b = React.useState(false); var busy = b[0]; var setBusy = b[1]
      var m = React.useState(""); var msg = m[0]; var setMsg = m[1]

      function onFile(e) {
        var f = e.target.files && e.target.files[0]
        if (!f) return
        var ext = (f.name.toLowerCase().match(/\.(docx|xlsx|pptx)$/) || [])[1]
        if (!ext) { setMsg("只支持 .docx / .xlsx / .pptx（WPS 请另存为这些格式）"); return }
        setFileName(f.name); setChunks(null); setResultB64(""); setMsg("")
        var rd = new FileReader()
        rd.onload = function () {
          setFileB64(rd.result); setBusy(true); setStatus("translating"); setMsg("正在翻译全文，请稍候…")
          callHost("translateOffice", { file: rd.result, filename: f.name }).then(function (res) {
            setBusy(false)
            if (res && res.ok) { setChunks(res.chunks); setResultB64(res.resultBase64); setResultName(res.outFilename); setStatus("done"); setMsg("翻译完成 ✓ 共 " + res.chunks.length + " 段，可逐段修改后再保存。") }
            else { setStatus("error"); setMsg((res && res.error) || "翻译失败") }
          }).catch(function (err) { setBusy(false); setStatus("error"); setMsg(String((err && err.message) || err)) })
        }
        rd.readAsDataURL(f)
      }
      function edit(idx, val) {
        var next = chunks.slice()
        next[idx] = { key: next[idx].key, original: next[idx].original, translated: val }
        setChunks(next)
      }
      function save() {
        if (!resultB64 && !chunks) return
        if (resultB64 && !chunks.some(function (c) { return c._edited })) { downloadBase64(resultB64, resultName); return }
        // 用户改过 → 重新回填
        setBusy(true); setMsg("正在生成译文文件…")
        callHost("saveOffice", { file: fileB64, filename: fileName, chunks: chunks }).then(function (res) {
          setBusy(false)
          if (res && res.ok) { downloadBase64(res.resultBase64, res.outFilename); setMsg("已生成并下载 " + res.outFilename) }
          else setMsg((res && res.error) || "保存失败")
        }).catch(function (err) { setBusy(false); setMsg(String((err && err.message) || err)) })
      }

      return el("div", { className: "dsh-page" },
        el("div", { className: "dsh-head" }, el("h2", { className: "dsh-h2" }, "Office 翻译")),
        el("div", { className: "dsh-card" },
          el("div", { className: "dsh-muted", style: { marginBottom: "10px" } }, "上传 Word（.docx）/ Excel（.xlsx）/ PPT（.pptx）文档，全文翻译成中文；可逐段修改译文，确认后下载译文文件。WPS 请先另存为 .docx/.xlsx/.pptx。"),
          el("input", { type: "file", accept: ".docx,.xlsx,.pptx", onChange: onFile, disabled: busy, className: "dsh-input" }),
          busy ? el("div", { className: "dsh-muted", style: { marginTop: "10px" } }, "翻译中，请耐心等待…") : null,
          msg ? el("div", { className: msg.indexOf("完成") !== -1 || msg.indexOf("已生成") !== -1 ? "dsh-ok" : "dsh-err", style: { marginTop: "10px" } }, msg) : null,
          chunks ? el("div", { style: { marginTop: "12px" } }, el("button", { className: "dsh-btn", onClick: save, disabled: busy }, "💾 保存译文文件")) : null),
        chunks && chunks.length ? chunks.map(function (c, idx) {
          return el("div", { className: "dsh-card", key: idx, style: { marginTop: "10px" } },
            el("div", { className: "dsh-muted", style: { marginBottom: "6px", whiteSpace: "pre-wrap", fontSize: "12px" } }, "原文：" + c.original),
            el("textarea", { value: c.translated, onChange: function (e) { edit(idx, e.target.value) }, rows: 3, className: "dsh-input", onFocus: function (e) { e.target.select() } }))
        }) : null)
    }

    function applyWallpaperCss(mode, value) {
      var id = "dsh-wallpaper-style"
      var tag = document.getElementById(id)
      if (!tag) { tag = document.createElement("style"); tag.id = id; document.head.appendChild(tag) }
      if (!mode || !value) { tag.textContent = ""; return }
      if (mode === "image") {
        tag.textContent = ':root{--dsw-alias-bg-base:transparent!important;--dsw-alias-bg-elevated:rgba(255,255,255,.6)!important;--dsw-specific-input-major:rgba(255,255,255,.85)!important}html,body{background:#1a1a1a url(' + value + ') center/cover fixed no-repeat!important}'
      } else {
        tag.textContent = ':root{--dsw-alias-bg-base:' + value + '!important}html,body{background:' + value + '!important}'
      }
    }

    function WallpaperSection() {
      var st = React.useState({ mode: "", value: "" }); var state = st[0]; var setState = st[1]
      var m = React.useState(""); var msg = m[0]; var setMsg = m[1]
      function load() { callHost("getWallpaper").then(function (res) { if (res && res.ok) { setState({ mode: res.mode, value: res.value }); applyWallpaperCss(res.mode, res.value) } }) }
      React.useEffect(function () { load() }, [])
      function setWp(mode, value, label) {
        callHost("setWallpaper", { mode: mode, value: value }).then(function (res) {
          if (res && res.ok) { setState({ mode: res.mode, value: res.value }); applyWallpaperCss(res.mode, res.value); setMsg("已应用 " + (label || mode) + " ✓") }
          else setMsg((res && res.error) || "设置失败")
        })
      }
      function onImg(e) {
        var f = e.target.files && e.target.files[0]
        if (!f) return
        var rd = new FileReader()
        rd.onload = function () { setWp("image", rd.result, "自定义壁纸") }
        rd.readAsDataURL(f)
      }
      var presets = [
        { label: "默认", mode: "", value: "" },
        { label: "浅灰白", mode: "color", value: "#f5f6f8" },
        { label: "深色", mode: "color", value: "#14161a" },
        { label: "雾蓝", mode: "color", value: "#eef2ff" },
        { label: "蓝紫渐变", mode: "gradient", value: "linear-gradient(135deg,#eef2ff,#dbeafe)" },
        { label: "深海渐变", mode: "gradient", value: "linear-gradient(135deg,#1e293b,#0f172a)" }
      ]
      return el("div", { className: "dsh-page" },
        el("h2", { className: "dsh-h2" }, "界面背景"),
        el("div", { className: "dsh-card" },
          el("div", { className: "dsh-h2", style: { marginBottom: "10px" } }, "预设背景"),
          el("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap" } },
            presets.map(function (p) {
              return el("button", { key: p.label, className: "dsh-btn ghost", style: { background: p.value || "transparent" }, onClick: function () { setWp(p.mode, p.value, p.label) } }, p.label)
            }))),
        el("div", { className: "dsh-card", style: { marginTop: "12px" } },
          el("div", { className: "dsh-h2", style: { marginBottom: "10px" } }, "自定义壁纸（上传图片，整页铺满）"),
          el("input", { type: "file", accept: "image/*", onChange: onImg, className: "dsh-input" }),
          el("div", { className: "dsh-muted", style: { marginTop: "8px" } }, "图片只保存在本机，随数据目录走；点「默认」恢复原始背景。")),
        msg ? el("div", { className: "dsh-ok", style: { marginTop: "10px" } }, msg) : null)
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
        if (!key.trim()) { setMsg("请先粘贴你的智谱 API Key"); return }
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
            el("li", {}, "点下面「去智谱官网申请免费 Key」按钮（会在浏览器打开官网首页）。"),
            el("li", {}, "用手机号注册 / 登录智谱开放平台（open.bigmodel.cn 首页）。"),
            el("li", {}, "登录后进入「控制台」，找「API 密钥」→「创建 API Key」→ 复制那串 Key（开头无固定格式，不是 sk- 开头也正常）。（免费模型，无需充值）"),
            el("li", {}, "把 Key 粘贴到下面输入框 → 点「保存 Key」→ 再点「测试连接」。"),
            el("li", {}, "看到「连接成功」后，下面的识图区就能用了。")),
          el("div", { className: "dsh-note", style: { marginTop: "10px" } }, "· 隐私：Key 只保存在你自己电脑上，不上传、不开源。")),

        el("div", { className: "dsh-card" },
          el("div", { className: "dsh-h2", style: { marginBottom: "10px" } }, "🔑 配置智谱 Key"),
          el("div", { style: { display: "flex", gap: "8px" } },
            el("input", { value: key, onChange: function (e) { setKey(e.target.value) }, placeholder: "粘贴你的智谱 API Key", className: "dsh-input", style: { flex: 1 } }),
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
        if (!key.trim()) { setMsg("请先粘贴智谱 API Key"); return }
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
            el("input", { value: key, onChange: function (e) { setKey(e.target.value) }, placeholder: "粘贴你的智谱 API Key", className: "dsh-input", style: { flex: 1 } }),
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

      // 启动时应用已保存的壁纸
      try { callHost("getWallpaper").then(function (res) { if (res && res.ok) applyWallpaperCss(res.mode, res.value) }).catch(function () {}) } catch (e) {}

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
      section("dsh-pdf", 26, "PDF 翻译", PdfSection)
      section("dsh-office", 27, "Office 翻译", OfficeSection)
      section("dsh-wallpaper", 28, "界面背景", WallpaperSection)
      section("dsh-remote", 29, "手机远程", RemoteSection)

      // 视图模式开关：放到首页对话框（输入框工具行左侧）
      ctx.slots.inject("conversation.input.left", function () {
        return ctx.slots.register(
          { name: "conversation.input.left", id: "dsh-vision", order: 100, label: function () { return "识图" } },
          function () { return React.createElement(VisionInputButton) }
        )
      })

      // 文件附件按钮：拖入/选择 docx/xlsx/pptx/pdf/txt 等 → 图标卡片 + 本地缓存（agent 读本地路径）
      ctx.slots.inject("conversation.input.left", function () {
        return ctx.slots.register(
          { name: "conversation.input.left", id: "dsh-attach", order: 110, label: function () { return "附加文件" } },
          function () { return React.createElement(FileInputButton) }
        )
      })

      // 附件卡片栏：输入区上方显示图标 + 标题 + 叉叉（千问样式）
      ctx.slots.inject("conversation.input.dock", function () {
        return ctx.slots.register(
          { name: "conversation.input.dock", id: "dsh-attach-bar", order: 90, label: function () { return "附件卡片" } },
          function () { return React.createElement(AttachmentBar) }
        )
      })

      // 全局拖拽：仅拦截 docx/xlsx/pptx/pdf/txt 等文档（图标卡片方案，不解析内容）；图片等留给原生聊天框
      if (typeof document !== "undefined") {
        document.addEventListener("dragover", function (e) {
          try {
            var types = e.dataTransfer && e.dataTransfer.types
            if (!types || Array.prototype.indexOf.call(types, "Files") === -1) return
            var items = e.dataTransfer.items
            for (var i = 0; i < items.length; i++) {
              var f = items[i] && items[i].getAsFile && items[i].getAsFile()
              if (f && DOC_RE.test(f.name || "")) { e.preventDefault(); return }
            }
          } catch (e2) {}
        }, true)
        document.addEventListener("drop", function (e) {
          try {
            var files = e.dataTransfer && e.dataTransfer.files
            if (!files || files.length === 0) return
            var docs = Array.prototype.slice.call(files).filter(function (f) { return DOC_RE.test(f.name || "") })
            if (docs.length === 0) return // 图片等 → 原生处理
            e.preventDefault()
            e.stopPropagation()
            addAttachments(docs)
          } catch (e2) {}
        }, true)
      }
    }

    exports.apply = apply
    exports.inject = ["remote", "slots"]
    return module.exports
  }
})
