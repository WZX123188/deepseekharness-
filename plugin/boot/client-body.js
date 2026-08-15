// 客户端 UI：余额/用量页 + 检查更新页 + DeepSeek 风格
function el(tag, props) {
  var children = Array.prototype.slice.call(arguments, 2)
  return React.createElement.apply(null, [tag, props].concat(children))
}

var BLUE = '#4d6bfe'
var CSS = [
  '.dsh-page{padding:20px;display:flex;flex-direction:column;gap:16px}',
  '.dsh-head{display:flex;justify-content:space-between;align-items:center}',
  '.dsh-h2{margin:0;font-size:15px;font-weight:600}',
  '.dsh-card{background:rgba(127,127,127,.06);border:1px solid rgba(127,127,127,.16);border-radius:12px;padding:16px}',
  '.dsh-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0}',
  '.dsh-row+.dsh-row{border-top:1px solid rgba(127,127,127,.10)}',
  '.dsh-label{opacity:.62;font-size:13px}',
  '.dsh-value{font-size:15px;font-weight:600;font-variant-numeric:tabular-nums}',
  '.dsh-amount{font-size:24px;font-weight:700;color:' + BLUE + '}',
  '.dsh-btn{background:' + BLUE + ';color:#fff;border:none;border-radius:8px;padding:8px 16px;font-size:14px;cursor:pointer}',
  '.dsh-btn:disabled{opacity:.5;cursor:default}',
  '.dsh-btn.ghost{background:transparent;color:' + BLUE + ';border:1px solid ' + BLUE + '}',
  '.dsh-err{color:#e5484d;font-size:13px}',
  '.dsh-ok{color:#30a46c;font-size:13px}',
  '.dsh-muted{opacity:.6;font-size:13px;line-height:1.5}',
  '.dsh-search{width:100%;padding:8px 12px;border-radius:8px;border:1px solid rgba(127,127,127,.3);background:transparent;color:inherit;margin-bottom:10px}',
  '.dsh-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}',
  '.dsh-tab{padding:6px 14px;border-radius:16px;border:1px solid rgba(127,127,127,.25);cursor:pointer;font-size:13px;background:transparent;color:inherit}',
  '.dsh-tab.active{background:' + BLUE + ';color:#fff;border-color:' + BLUE + '}',
  '.dsh-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}',
  '.dsh-toolcard{border:1px solid rgba(127,127,127,.16);border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:6px}',
  '.dsh-toolname{font-weight:600;font-size:14px}',
].join('\n')

function BalanceSection() {
  var p = React.useState({ status: 'idle' })
  var state = p[0]
  var setState = p[1]
  function load() {
    setState({ status: 'loading' })
    host.call('deepseek-balance').then(function (res) {
      if (res && res.ok) {
        var balance = null
        try { balance = JSON.parse(res.body) } catch (e) { balance = null }
        setState({ status: 'ok', balance: balance })
      } else {
        setState({ status: 'error', error: (res && res.error) || '未知错误' })
      }
    }).catch(function (e) {
      setState({ status: 'error', error: String((e && e.message) || e) })
    })
  }
  React.useEffect(function () { load() }, [])

  var body
  if (state.status === 'loading') {
    body = el('div', { className: 'dsh-muted' }, '正在查询余额…')
  } else if (state.status === 'error') {
    body = el('div', { className: 'dsh-err' }, state.error)
  } else if (state.status === 'ok' && state.balance) {
    var infos = (state.balance.balance_infos) || []
    if (infos.length === 0) {
      body = el('div', { className: 'dsh-muted' }, '未返回余额信息')
    } else {
      body = infos.map(function (info) {
        return el('div', { className: 'dsh-card', key: info.currency },
          el('div', { className: 'dsh-row' }, el('span', { className: 'dsh-label' }, '币种'), el('span', { className: 'dsh-value' }, info.currency)),
          el('div', { className: 'dsh-row' }, el('span', { className: 'dsh-label' }, '总余额'), el('span', { className: 'dsh-amount' }, info.total_balance)),
          el('div', { className: 'dsh-row' }, el('span', { className: 'dsh-label' }, '赠送余额'), el('span', { className: 'dsh-value' }, info.granted_balance)),
          el('div', { className: 'dsh-row' }, el('span', { className: 'dsh-label' }, '充值余额'), el('span', { className: 'dsh-value' }, info.topped_up_balance))
        )
      })
    }
  }

  return el('div', { className: 'dsh-page' },
    el('div', { className: 'dsh-head' },
      el('h2', { className: 'dsh-h2' }, 'DeepSeek 余额'),
      el('button', { className: 'dsh-btn ghost', onClick: load }, '刷新')
    ),
    body,
    el('div', { className: 'dsh-muted' }, '余额来自 DeepSeek 开放平台 user/balance 接口。token 用量无官方 API，本地用量统计将在后续版本提供。')
  )
}

function UpdateSection() {
  var p = React.useState({ status: 'idle', res: null, updated: false })
  var state = p[0]
  var setState = p[1]
  var up = React.useState(false)
  var updating = up[0]
  var setUpdating = up[1]
  function check() {
    setState({ status: 'loading', res: null, updated: false })
    host.call('check-update').then(function (res) {
      if (res && res.ok) setState({ status: 'ok', res: res, updated: false })
      else setState({ status: 'error', res: null, updated: false, error: (res && res.error) || '未知错误' })
    }).catch(function (e) {
      setState({ status: 'error', res: null, updated: false, error: String((e && e.message) || e) })
    })
  }
  function doUpdate() {
    setUpdating(true)
    host.call('do-update').then(function (res) {
      setUpdating(false)
      if (res && res.ok) setState({ status: 'ok', res: state.res, updated: true })
      else setState({ status: 'error', res: state.res, updated: false, error: (res && res.error) || '更新失败' })
    }).catch(function (e) {
      setUpdating(false)
      setState({ status: 'error', res: state.res, updated: false, error: String((e && e.message) || e) })
    })
  }
  React.useEffect(function () { check() }, [])

  var inner = null
  if (state.status === 'loading') inner = el('div', { className: 'dsh-muted' }, '正在检查更新…')
  else if (state.status === 'error') inner = el('div', { className: 'dsh-err' }, state.error)
  else if (state.status === 'ok' && state.res) {
    var official = state.res.official || {}
    var github = state.res.github || {}
    inner = el('div', {},
      el('div', { className: 'dsh-h2', style: { marginBottom: '8px' } }, '官方更新'),
      el('div', { className: 'dsh-card', style: { marginBottom: '12px' } },
        el('div', { className: 'dsh-row' }, el('span', { className: 'dsh-label' }, '当前版本'), el('span', { className: 'dsh-value' }, official.current || '-')),
        el('div', { className: 'dsh-row' }, el('span', { className: 'dsh-label' }, '最新版本'), el('span', { className: 'dsh-value' }, official.latest || '-')),
        el('div', { style: { paddingTop: '12px' } },
          official.hasUpdate
            ? el('button', { className: 'dsh-btn', onClick: doUpdate, disabled: updating }, updating ? '更新中…' : '一键更新')
            : el('div', { className: 'dsh-ok' }, '已是最新版本')),
        el('div', { className: 'dsh-muted', style: { marginTop: '8px' } }, '官方更新只更新核心程序，不影响你额外添加的功能。')),
      el('div', { className: 'dsh-h2', style: { marginBottom: '8px' } }, 'GitHub 更新'),
      el('div', { className: 'dsh-card' },
        github.ok
          ? el('div', {},
              el('div', { className: 'dsh-row' }, el('span', { className: 'dsh-label' }, '最新版本'), el('span', { className: 'dsh-value' }, github.tag)),
              el('div', { className: 'dsh-row' }, el('span', { className: 'dsh-label' }, '说明'), el('span', { className: 'dsh-value' }, github.name || '-')))
          : el('div', { className: 'dsh-muted' }, '暂无 GitHub 发布，或无法连接 GitHub。')),
      state.updated ? el('div', { className: 'dsh-ok', style: { paddingTop: '8px' } }, '更新完成，请重启生效。') : null
    )
  }

  return el('div', { className: 'dsh-page' },
    el('div', { className: 'dsh-head' },
      el('h2', { className: 'dsh-h2' }, '检查更新'),
      el('button', { className: 'dsh-btn ghost', onClick: check }, '重新检查')
    ),
    el('div', { className: 'dsh-card' }, inner)
  )
}

function PermissionSection() {
  var p = React.useState({ status: 'idle', mode: null, error: null })
  var state = p[0]
  var setState = p[1]
  function load() {
    setState({ status: 'loading', mode: null, error: null })
    host.call('get-permission-mode').then(function (res) {
      if (res && res.ok) setState({ status: 'ok', mode: res.mode, error: null })
      else setState({ status: 'error', mode: null, error: (res && res.error) || '未知错误' })
    }).catch(function (e) { setState({ status: 'error', mode: null, error: String((e && e.message) || e) }) })
  }
  function setMode(mode) {
    host.call('set-permission-mode', { mode: mode }).then(function (res) {
      if (res && res.ok) setState({ status: 'ok', mode: res.mode, error: null })
      else setState({ status: 'error', mode: state.mode, error: (res && res.error) || '设置失败' })
    }).catch(function (e) { setState({ status: 'error', mode: state.mode, error: String((e && e.message) || e) }) })
  }
  React.useEffect(function () { load() }, [])

  var mode = state.mode
  return el('div', { className: 'dsh-page' },
    el('h2', { className: 'dsh-h2' }, '权限'),
    el('div', { className: 'dsh-card' },
      el('div', { className: 'dsh-h2', style: { marginBottom: '8px' } }, '文件操作权限'),
      el('div', { className: 'dsh-row', style: { cursor: 'pointer' }, onClick: function () { setMode('ask') } },
        el('div', {},
          el('div', { className: 'dsh-value' }, '敏感操作需用户决策'),
          el('div', { className: 'dsh-muted' }, '修改 / 删除文件时弹窗让你勾选同意（推荐）')),
        mode === 'ask' ? el('span', { className: 'dsh-ok' }, '✓ 当前') : null),
      el('div', { className: 'dsh-row', style: { cursor: 'pointer' }, onClick: function () { setMode('trust') } },
        el('div', {},
          el('div', { className: 'dsh-value' }, '完全放开（信任）'),
          el('div', { className: 'dsh-muted' }, '所有文件操作都不询问，直接放行')),
        mode === 'trust' ? el('span', { className: 'dsh-ok' }, '✓ 当前') : null),
      state.error ? el('div', { className: 'dsh-err', style: { marginTop: '8px' } }, state.error) : null))
}

function ToolsSection() {
  var p = React.useState({ status: 'idle', cats: null, error: null })
  var state = p[0]
  var setState = p[1]
  var ip = React.useState(null)
  var installingPkg = ip[0]
  var setInstallingPkg = ip[1]
  function load() {
    setState({ status: 'loading', cats: null, error: null })
    host.call('list-tools').then(function (res) {
      if (res && res.ok) setState({ status: 'ok', cats: res.categories, error: null })
      else setState({ status: 'error', cats: null, error: (res && res.error) || '未知错误' })
    }).catch(function (e) {
      setState({ status: 'error', cats: null, error: String((e && e.message) || e) })
    })
  }
  function install(tool) {
    setInstallingPkg(tool.pkg)
    host.call('install-tool', { pkg: tool.pkg }).then(function () {
      setInstallingPkg(null)
      load()
    }).catch(function () {
      setInstallingPkg(null)
      load()
    })
  }
  React.useEffect(function () { load() }, [])

  var body
  if (state.status === 'loading') body = el('div', { className: 'dsh-muted' }, '正在加载工具列表…')
  else if (state.status === 'error') body = el('div', { className: 'dsh-err' }, state.error)
  else if (state.status === 'ok' && state.cats) {
    body = state.cats.map(function (cat) {
      return el('div', { key: cat.name },
        el('div', { className: 'dsh-h2', style: { margin: '14px 0 6px' } }, cat.name),
        cat.items.map(function (tool) {
          return el('div', { className: 'dsh-card', key: tool.id, style: { padding: '12px', marginBottom: '8px' } },
            el('div', { className: 'dsh-row' },
              el('div', { style: { flex: 1 } },
                el('div', { className: 'dsh-value' }, tool.name),
                el('div', { className: 'dsh-muted' }, tool.desc),
                el('div', { className: 'dsh-muted', style: { fontSize: '11px' } }, tool.note),
                el('div', { className: 'dsh-muted', style: { fontSize: '11px' } }, tool.pkg)),
              tool.installed
                ? el('span', { className: 'dsh-ok' }, '已安装')
                : el('button', { className: 'dsh-btn', onClick: function () { install(tool) }, disabled: installingPkg === tool.pkg }, installingPkg === tool.pkg ? '安装中…' : '安装')))
        })
      )
    })
  }

  return el('div', { className: 'dsh-page' },
    el('div', { className: 'dsh-head' },
      el('h2', { className: 'dsh-h2' }, 'Tool 市场'),
      el('button', { className: 'dsh-btn ghost', onClick: load }, '刷新')),
    body,
    el('div', { className: 'dsh-muted' }, '点击「安装」即可一键安装，来源标注见每条工具。'))
}

function PluginsSection() {
  var p = React.useState({ status: 'idle', cats: null, error: null })
  var state = p[0]
  var setState = p[1]
  var ip = React.useState(null)
  var installingPkg = ip[0]
  var setInstallingPkg = ip[1]
  function load() {
    setState({ status: 'loading', cats: null, error: null })
    host.call('list-plugins').then(function (res) {
      if (res && res.ok) setState({ status: 'ok', cats: res.categories, error: null })
      else setState({ status: 'error', cats: null, error: (res && res.error) || '未知错误' })
    }).catch(function (e) {
      setState({ status: 'error', cats: null, error: String((e && e.message) || e) })
    })
  }
  function install(plug) {
    setInstallingPkg(plug.pkg)
    host.call('install-plugin', { pkg: plug.pkg }).then(function () {
      setInstallingPkg(null)
      load()
    }).catch(function () {
      setInstallingPkg(null)
      load()
    })
  }
  React.useEffect(function () { load() }, [])

  var body
  if (state.status === 'loading') body = el('div', { className: 'dsh-muted' }, '正在加载插件列表…')
  else if (state.status === 'error') body = el('div', { className: 'dsh-err' }, state.error)
  else if (state.status === 'ok' && state.cats) {
    body = state.cats.map(function (cat) {
      return el('div', { key: cat.name },
        el('div', { className: 'dsh-h2', style: { margin: '14px 0 6px' } }, cat.name),
        cat.items.map(function (plug) {
          return el('div', { className: 'dsh-card', key: plug.id, style: { padding: '12px', marginBottom: '8px' } },
            el('div', { className: 'dsh-row' },
              el('div', { style: { flex: 1 } },
                el('div', { className: 'dsh-value' }, plug.name),
                el('div', { className: 'dsh-muted' }, plug.desc),
                el('div', { className: 'dsh-muted', style: { fontSize: '11px' } }, plug.note),
                el('div', { className: 'dsh-muted', style: { fontSize: '11px' } }, plug.pkg)),
              plug.installed
                ? el('span', { className: 'dsh-ok' }, '已安装')
                : el('button', { className: 'dsh-btn', onClick: function () { install(plug) }, disabled: installingPkg === plug.pkg }, installingPkg === plug.pkg ? '安装中…' : '安装')))
        })
      )
    })
  }

  return el('div', { className: 'dsh-page' },
    el('div', { className: 'dsh-head' },
      el('h2', { className: 'dsh-h2' }, 'Plugin 市场'),
      el('button', { className: 'dsh-btn ghost', onClick: load }, '刷新')),
    body,
    el('div', { className: 'dsh-muted' }, '插件 = 扩展 harness 本身的能力（区别于工具）；均为官方可信来源。'))
}

function GuideSection() {
  return el('div', { className: 'dsh-page' },
    el('h2', { className: 'dsh-h2' }, '使用指南'),
    el('div', { className: 'dsh-card' },
      el('div', { className: 'dsh-h2', style: { marginBottom: '8px' } }, '第一步：接入 API'),
      el('div', { className: 'dsh-muted' }, '在「设置 → 模型」页配置 DeepSeek API Key（platform.deepseek.com → API Keys 创建）。')),
    el('div', { className: 'dsh-card' },
      el('div', { className: 'dsh-h2', style: { marginBottom: '8px' } }, '第二步：功能介绍'),
      el('div', { className: 'dsh-muted' }, '· 权限门：修改 / 删除文件时勾选「同意」并确认后放行；读取默认放行。'),
      el('div', { className: 'dsh-muted' }, '· 余额 / 用量：查看 DeepSeek 账户余额。'),
      el('div', { className: 'dsh-muted' }, '· 检查更新：一键更新到最新版。'),
      el('div', { className: 'dsh-muted' }, '· Tool 市场：一键安装热门工具。')),
    el('div', { className: 'dsh-card' },
      el('div', { className: 'dsh-h2', style: { marginBottom: '8px' } }, '快捷操作'),
      el('div', { className: 'dsh-muted' }, '· Ctrl+Alt+D：呼出 / 隐藏窗口。'),
      el('div', { className: 'dsh-muted' }, '· 右下角托盘：显示 / 退出、窗口置顶、开机自启开关。')))
}

function ProjectsSection() {
  var p = React.useState({ status: 'idle', items: null, error: null })
  var state = p[0]
  var setState = p[1]
  function load() {
    setState({ status: 'loading', items: null, error: null })
    host.call('list-projects').then(function (res) {
      if (res && res.ok) setState({ status: 'ok', items: res.items, error: null })
      else setState({ status: 'error', items: null, error: (res && res.error) || '未知错误' })
    }).catch(function (e) { setState({ status: 'error', items: null, error: String((e && e.message) || e) }) })
  }
  function create() {
    var workspaces = ctx.get('workspaces')
    if (workspaces === undefined || typeof workspaces.pickDirectory !== 'function') {
      setState({ status: 'error', items: state.items, error: '缺少目录选择服务' })
      return
    }
    workspaces.pickDirectory().then(function (dir) {
      if (dir === null || dir === undefined || dir === '') return
      host.call('create-project', { path: dir }).then(function (res) {
        if (res && res.ok) load()
        else setState({ status: 'error', items: state.items, error: (res && res.error) || '创建失败' })
      }).catch(function (e) { setState({ status: 'error', items: state.items, error: String((e && e.message) || e) }) })
    }).catch(function (e) { setState({ status: 'error', items: state.items, error: String((e && e.message) || e) }) })
  }
  React.useEffect(function () { load() }, [])

  var body
  if (state.status === 'loading') body = el('div', { className: 'dsh-muted' }, '正在加载项目…')
  else if (state.status === 'error') body = el('div', { className: 'dsh-err' }, state.error)
  else if (state.status === 'ok' && state.items) {
    if (state.items.length === 0) body = el('div', { className: 'dsh-muted' }, '还没有项目，点「新建项目」选一个文件夹开始。')
    else body = state.items.map(function (item) {
      return el('div', { className: 'dsh-card', key: item.id, style: { padding: '12px', marginBottom: '8px' } },
        el('div', { className: 'dsh-value' }, item.title),
        el('div', { className: 'dsh-muted', style: { fontSize: '11px' } }, item.path))
    })
  }

  return el('div', { className: 'dsh-page' },
    el('div', { className: 'dsh-head' },
      el('h2', { className: 'dsh-h2' }, '项目'),
      el('button', { className: 'dsh-btn', onClick: create }, '新建项目')),
    body,
    el('div', { className: 'dsh-muted' }, '项目即工作区：一个文件夹对应一个项目，会话与文件按项目隔离。'))
}

return {
  apply(ctx) {
    var slots = ctx.get('slots')
    if (slots === undefined) return
    styles.insert(CSS)
    slots.inject('settings.section', function () {
      return slots.register(
        { name: 'settings.section', id: 'dsh-balance', order: 30, label: '余额 / 用量' },
        function () { return React.createElement(BalanceSection) }
      )
    })
    slots.inject('settings.section', function () {
      return slots.register(
        { name: 'settings.section', id: 'dsh-update', order: 40, label: '检查更新' },
        function () { return React.createElement(UpdateSection) }
      )
    })
    slots.inject('settings.section', function () {
      return slots.register(
        { name: 'settings.section', id: 'dsh-projects', order: 2, label: '项目' },
        function () { return React.createElement(ProjectsSection) }
      )
    })
    slots.inject('settings.section', function () {
      return slots.register(
        { name: 'settings.section', id: 'dsh-tools', order: 35, label: 'Tool 市场' },
        function () { return React.createElement(ToolsSection) }
      )
    })
    slots.inject('settings.section', function () {
      return slots.register(
        { name: 'settings.section', id: 'dsh-plugins', order: 36, label: 'Plugin 市场' },
        function () { return React.createElement(PluginsSection) }
      )
    })
    slots.inject('settings.section', function () {
      return slots.register(
        { name: 'settings.section', id: 'dsh-guide', order: 45, label: '使用指南' },
        function () { return React.createElement(GuideSection) }
      )
    })
    slots.inject('settings.section', function () {
      return slots.register(
        { name: 'settings.section', id: 'dsh-permission', order: 6, label: '权限' },
        function () { return React.createElement(PermissionSection) }
      )
    })
    // 侧边栏底部的「功能」入口，提示功能在设置中
    slots.inject('sidebar.footer.action', function () {
      return slots.register(
        { name: 'sidebar.footer.action', id: 'dsh-features', order: 5, label: '功能' },
        function () {
          return el('button', { title: '功能都在 设置 里：项目 / 权限 / 余额 / Tool 市场 / Plugin 市场 / 检查更新 / 使用指南', style: { background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px 10px', borderRadius: '8px', fontSize: '13px', color: 'inherit' } }, '功能')
        }
      )
    })
  },
}
