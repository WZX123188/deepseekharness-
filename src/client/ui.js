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
    inner = el('div', {},
      el('div', { className: 'dsh-row' }, el('span', { className: 'dsh-label' }, '当前版本'), el('span', { className: 'dsh-value' }, state.res.current)),
      el('div', { className: 'dsh-row' }, el('span', { className: 'dsh-label' }, '最新版本'), el('span', { className: 'dsh-value' }, state.res.latest)),
      el('div', { style: { paddingTop: '12px' } },
        state.res.hasUpdate
          ? el('button', { className: 'dsh-btn', onClick: doUpdate, disabled: updating }, updating ? '更新中…' : '一键更新')
          : el('div', { className: 'dsh-ok' }, '已是最新版本')
      ),
      state.updated ? el('div', { className: 'dsh-ok', style: { paddingTop: '8px' } }, '更新完成，请重启 dsh web 生效。') : null
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
  },
}
