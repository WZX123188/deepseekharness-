// 合并宿主代码（权限门 + 余额 + 更新[官方/GitHub] + 工具市场 + API管理 + 项目区 + 权限设置）
let permissionMode = 'ask'
const CONFIG_PATH = 'C:\\Users\\WZX\\.dsh\\dsh-client-config.json'

async function readConfigFile(subprocess) {
  try {
    const nodePath = await subprocess.resolveExecutable('node')
    const script = "try{console.log(require('fs').readFileSync(process.env.DSH_CFG,'utf8'))}catch(e){console.log('{}')}"
    const handle = subprocess.spawn({ argv: [nodePath, '-e', script], cwd: 'C:\\Users\\WZX', stdio: { stdin: 'ignore', stdout: { maxBytes: 8192 }, stderr: { maxBytes: 8192 } }, graceMs: 8000, env: { DSH_CFG: CONFIG_PATH } })
    await handle.waitForExit()
    const out = handle.collected.stdout ? handle.collected.stdout.readFrom(0).text : ''
    return JSON.parse(out.trim() || '{}')
  } catch (e) { return {} }
}
async function writeConfigFile(subprocess, obj) {
  try {
    const nodePath = await subprocess.resolveExecutable('node')
    const script = "try{require('fs').writeFileSync(process.env.DSH_CFG, process.env.DSH_VAL)}catch(e){console.error(e)}"
    const handle = subprocess.spawn({ argv: [nodePath, '-e', script], cwd: 'C:\\Users\\WZX', stdio: { stdin: 'ignore', stdout: { maxBytes: 8192 }, stderr: { maxBytes: 8192 } }, graceMs: 8000, env: { DSH_CFG: CONFIG_PATH, DSH_VAL: JSON.stringify(obj) } })
    await handle.waitForExit()
  } catch (e) {}
}

// ===== 权限门 =====
const SHELL_MUTATION = new RegExp(
  '\\b(Remove-Item|del|erase|rm|rd|rmdir|Set-Content|Add-Content|Out-File|' +
  'New-Item|mkdir|md|Move-Item|Rename-Item|ren|Copy-Item|copy|ni|ri|' +
  'chmod|chown|tee|attrib|icacls|takeown)\\b|' +
  '>>|>|\\|\\s*Out-File|curl\\s+[^\\r\\n]*-o|wget\\s+[^\\r\\n]*-O',
  'i'
)
function describeOperation(name, args) {
  if (name === 'write') { const p = args && typeof args.file_path === 'string' ? args.file_path : '(未知路径)'; const n = args && typeof args.content === 'string' ? args.content.length : 0; return '写入文件：' + p + '（约 ' + n + ' 字符）' }
  if (name === 'edit') { const p = args && typeof args.file_path === 'string' ? args.file_path : '(未知路径)'; return '修改文件：' + p }
  if (name === 'pwsh' || name === 'bash' || name === 'bash-persistent') { const c = args && typeof args.command === 'string' ? args.command : '(未知命令)'; return '执行命令：' + (c.length > 240 ? c.slice(0, 240) + '…' : c) }
  return '执行操作：' + name
}
async function isNewPath(fs, path) { if (fs === undefined || path === null || path === '') return false; try { const info = await fs.lstat(path); return info === undefined } catch (e) { return false } }
function makeMarkerSignal(subprocess) {
  if (subprocess === undefined) return null
  let cmdPath = null
  return function (pending) {
    try {
      const run = function (resolved) {
        const argv = pending ? [resolved, '/c', 'echo 1 > %TEMP%\\dsh-question-pending'] : [resolved, '/c', 'del %TEMP%\\dsh-question-pending']
        subprocess.spawn({ argv: argv, cwd: 'C:\\Users\\WZX', stdio: { stdin: 'ignore', stdout: 'inherit', stderr: 'inherit' }, graceMs: 5000 })
      }
      if (cmdPath === null) { cmdPath = subprocess.resolveExecutable('cmd.exe'); cmdPath.then(run).catch(function () {}) } else { run(cmdPath) }
    } catch (e) {}
  }
}
async function askForConsent(userQuestions, exec, path, mine, signal) {
  if (userQuestions === undefined) return false
  if (signal) signal(true)
  try {
    const answer = await userQuestions.ask({
      agent: exec.agent,
      signal: exec.signal,
      questions: [{ id: 'file-op-consent', header: '文件操作需要你的同意', question: describeOperation(exec.name, exec.arguments), detail: '勾选「同意」并点击确认以放行；不勾选直接确认将拒绝该操作。', multiSelect: true, options: [{ label: '同意' }] }],
    })
    const approved = answer && Array.isArray(answer.answers) && answer.answers.some(function (a) { return a && Array.isArray(a.selected) && a.selected.indexOf('同意') !== -1 })
    if (approved && path !== null && mine !== undefined) mine.add(path)
    return approved
  } finally { if (signal) signal(false) }
}
function applyGate(ctx) {
  const userQuestions = ctx.get('userQuestions')
  const fs = ctx.get('fs')
  const subprocess = ctx.get('subprocess')
  const mine = new Set()
  const signal = makeMarkerSignal(subprocess)
  ctx.on('tools/pre-execute', async (exec, next) => {
    if (permissionMode === 'trust') return next()
    try {
      const name = exec && exec.name
      const args = (exec && exec.arguments) || {}
      if (name !== 'write' && name !== 'edit' && name !== 'pwsh' && name !== 'bash' && name !== 'bash-persistent') return next()
      if (name === 'pwsh' || name === 'bash' || name === 'bash-persistent') {
        const cmd = typeof args.command === 'string' ? args.command : ''
        if (!SHELL_MUTATION.test(cmd)) return next()
        const ok = await askForConsent(userQuestions, exec, null, mine, signal)
        if (ok) return next()
        return { kind: 'deny', reason: '用户未同意此命令' }
      }
      const path = typeof args.file_path === 'string' ? args.file_path : null
      if (path !== null && mine.has(path)) return next()
      if (path !== null && typeof path === 'string' && path.toUpperCase().indexOf('G:') === 0) { mine.add(path); return next() }
      if (name === 'write' && path !== null && await isNewPath(fs, path)) { mine.add(path); return next() }
      const ok = await askForConsent(userQuestions, exec, path, mine, signal)
      if (ok) return next()
      return { kind: 'deny', reason: '用户未同意此文件操作' }
    } catch (error) { return { kind: 'deny', reason: '权限门询问失败：' + (error && error.message ? error.message : String(error)) } }
  })
}

// ===== 权限设置 =====
function applyPermission(ctx) {
  const subprocess = ctx.get('subprocess')
  if (subprocess === undefined) return
  readConfigFile(subprocess).then(function (cfg) {
    if (cfg && cfg.permissionMode === 'trust') permissionMode = 'trust'
    else permissionMode = 'ask'
  }).catch(function () {})
  harness.handle('get-permission-mode', async () => {
    return { ok: true, mode: permissionMode }
  })
  harness.handle('set-permission-mode', async (args) => {
    const mode = args && args.mode
    if (mode !== 'ask' && mode !== 'trust') return { ok: false, error: '无效模式' }
    permissionMode = mode
    await writeConfigFile(subprocess, { permissionMode: mode })
    return { ok: true, mode: permissionMode }
  })
}

// ===== 余额 =====
const BALANCE_URL = 'https://api.deepseek.com/user/balance'
function balanceScript() { return "(async()=>{try{const r=await fetch('" + BALANCE_URL + "',{headers:{Authorization:'Bearer '+process.env.DSH_BALANCE_KEY,Accept:'application/json'}});const t=await r.text();console.log(JSON.stringify({status:r.status,body:t}))}catch(e){console.error(String((e&&e.stack)||e));process.exit(1)}})()" }
function applyBalance(ctx) {
  const credentials = ctx.get('credentials')
  const subprocess = ctx.get('subprocess')
  if (credentials === undefined || subprocess === undefined) return
  harness.handle('deepseek-balance', async () => {
    try {
      const resolved = await credentials.resolve('DEEPSEEK_API_KEY')
      if (resolved === undefined || typeof resolved.value !== 'string' || resolved.value === '') return { ok: false, error: '未配置 DeepSeek API Key（DEEPSEEK_API_KEY）' }
      const nodePath = await subprocess.resolveExecutable('node')
      const handle = subprocess.spawn({ argv: [nodePath, '-e', balanceScript()], cwd: 'C:\\Users\\WZX', stdio: { stdin: 'ignore', stdout: { maxBytes: 65536 }, stderr: { maxBytes: 65536 } }, graceMs: 15000, env: { DSH_BALANCE_KEY: resolved.value } })
      await handle.waitForExit()
      const stdout = handle.collected.stdout ? handle.collected.stdout.readFrom(0).text : ''
      const stderr = handle.collected.stderr ? handle.collected.stderr.readFrom(0).text : ''
      const last = stdout.trim().split(/\r?\n/).filter(Boolean).pop()
      if (last === undefined) return { ok: false, error: stderr.trim() || '余额请求无输出' }
      const parsed = JSON.parse(last)
      return { ok: true, status: parsed.status, body: parsed.body }
    } catch (error) { return { ok: false, error: String((error && error.message) || error) } }
  })
}

// ===== 更新（官方 npm + GitHub 分开） =====
const PKG = '@deepseek-ai/dsh'
const REGISTRY_LATEST = 'https://registry.npmmirror.com/' + PKG.replace('/', '%2f') + '/latest'
const CURRENT_VERSION = '0.1.0-rc.6'
const GITHUB_RELEASES = 'https://api.github.com/repos/WZX123188/deepseekharness-/releases/latest'
function latestScript() { return "(async()=>{const r=await fetch('" + REGISTRY_LATEST + "');const j=await r.json();console.log(String(j.version||''))})().catch(e=>{console.error(String((e&&e.stack)||e));process.exit(1)})" }
function githubScript() { return "(async()=>{try{const r=await fetch('" + GITHUB_RELEASES + "',{headers:{'User-Agent':'dsh-client'}});if(r.status===404){console.log(JSON.stringify({tag:'',name:'',html:'',status:404}));return}const j=await r.json();console.log(JSON.stringify({tag:(j&&j.tag_name)||'',name:(j&&j.name)||'',html:(j&&j.html_url)||'',status:r.status}))}catch(e){console.log(JSON.stringify({tag:'',name:'',html:'',status:0,error:String((e&&e.message)||e)}))}})()" }
function applyUpdate(ctx) {
  const subprocess = ctx.get('subprocess')
  if (subprocess === undefined) return
  async function collect(handle) {
    await handle.waitForExit()
    const stdout = handle.collected.stdout ? handle.collected.stdout.readFrom(0).text : ''
    const stderr = handle.collected.stderr ? handle.collected.stderr.readFrom(0).text : ''
    return { stdout, stderr }
  }
  harness.handle('check-update', async () => {
    try {
      // 官方
      const nodePath = await subprocess.resolveExecutable('node')
      const h1 = subprocess.spawn({ argv: [nodePath, '-e', latestScript()], cwd: 'C:\\Users\\WZX', stdio: { stdin: 'ignore', stdout: { maxBytes: 16384 }, stderr: { maxBytes: 16384 } }, graceMs: 20000 })
      const { stdout } = await collect(h1)
      const officialLatest = stdout.trim().split(/\r?\n/).filter(Boolean).pop() || ''
      // GitHub
      let github = { tag: '', name: '', html: '', ok: false, noRelease: false, unreachable: false }
      try {
        const h2 = subprocess.spawn({ argv: [nodePath, '-e', githubScript()], cwd: 'C:\\Users\\WZX', stdio: { stdin: 'ignore', stdout: { maxBytes: 16384 }, stderr: { maxBytes: 16384 } }, graceMs: 20000 })
        const g = await collect(h2)
        const glast = g.stdout.trim().split(/\r?\n/).filter(Boolean).pop() || ''
        const parsed = JSON.parse(glast)
        github = { tag: parsed.tag || '', name: parsed.name || '', html: parsed.html || '', ok: parsed.tag !== '', noRelease: parsed.status === 404, unreachable: parsed.status === 0 }
      } catch (e) { github = { tag: '', name: '', html: '', ok: false, noRelease: false, unreachable: true } }
      return {
        ok: true,
        official: { current: CURRENT_VERSION, latest: officialLatest, hasUpdate: officialLatest !== '' && officialLatest !== CURRENT_VERSION },
        github: github,
      }
    } catch (error) { return { ok: false, error: String((error && error.message) || error) } }
  })
  harness.handle('do-update', async (args) => {
    try {
      const cmdPath = await subprocess.resolveExecutable('cmd.exe')
      const handle = subprocess.spawn({ argv: [cmdPath, '/c', 'npm', 'install', '-g', PKG + '@latest'], cwd: 'C:\\Users\\WZX', stdio: { stdin: 'ignore', stdout: { maxBytes: 262144 }, stderr: { maxBytes: 262144 } }, graceMs: 180000 })
      const { stdout, stderr } = await collect(handle)
      return { ok: true, stdout: stdout.slice(-4000), stderr: stderr.slice(-4000) }
    } catch (error) { return { ok: false, error: String((error && error.message) || error) } }
  })
}

// ===== Tool 市场（MCP 服务器；已去掉与内置能力重复的：文件读写/网络搜索/网页抓取/本地git） =====
const TOOLS = [
  { id: 'e2b', name: 'E2B Code Interpreter', category: '代码沙盒', desc: '云端隔离沙盒运行 Python/代码（区别于本地命令）', note: '来自 E2B', pkg: '@e2b/mcp-server' },
  { id: 'puppeteer', name: 'Puppeteer', category: '浏览器自动化', desc: '无头浏览器自动化、网页交互', note: '来自 Anthropic', pkg: '@modelcontextprotocol/server-puppeteer' },
  { id: 'playwright', name: 'Playwright', category: '浏览器自动化', desc: '浏览器自动化与测试', note: '来自 微软', pkg: '@playwright/mcp' },
  { id: 'github', name: 'GitHub', category: '代码与仓库', desc: '操作 GitHub 仓库、Issue、PR', note: '来自 GitHub', pkg: '@modelcontextprotocol/server-github' },
  { id: 'postgres', name: 'PostgreSQL', category: '数据库', desc: '查询 PostgreSQL 数据库', note: '来自 Anthropic', pkg: '@modelcontextprotocol/server-postgres' },
  { id: 'sqlite', name: 'SQLite', category: '数据库', desc: '查询 SQLite 数据库', note: '来自 Anthropic', pkg: '@modelcontextprotocol/server-sqlite' },
  { id: 'memory', name: 'Memory', category: '知识记忆', desc: '持久化知识图谱记忆', note: '来自 Anthropic', pkg: '@modelcontextprotocol/server-memory' },
  { id: 'time', name: 'Time', category: '实用工具', desc: '时间与时区查询', note: '来自 Anthropic', pkg: '@modelcontextprotocol/server-time' },
  { id: 'slack', name: 'Slack', category: '团队协作', desc: '读写 Slack 频道、消息', note: '来自 Anthropic', pkg: '@modelcontextprotocol/server-slack' },
  { id: 'notion', name: 'Notion', category: '知识管理', desc: '读写 Notion 页面与数据库', note: '来自 Notion', pkg: '@notionhq/notion-mcp-server' },
  { id: 'sentry', name: 'Sentry', category: '错误监控', desc: '查询 Sentry 错误与性能数据', note: '来自 Sentry', pkg: '@modelcontextprotocol/server-sentry' },
]

// ===== Plugin 市场（DSH 插件；已去掉与内置重复的：联网搜索/终端/工作流） =====
const PLUGINS = [
  { id: 'plg-mcp', name: 'MCP 客户端', category: '协议接入', desc: '接入 MCP 协议，管理 MCP 服务器', note: '来自 DeepSeek', pkg: '@deepseek-ai/dsh-mcp-client' },
]
function applyTools(ctx) {
  const subprocess = ctx.get('subprocess')
  if (subprocess === undefined) return
  async function runNpm(args, graceMs) {
    const cmdPath = await subprocess.resolveExecutable('cmd.exe')
    const handle = subprocess.spawn({ argv: [cmdPath, '/c', 'npm'].concat(args), cwd: 'C:\\Users\\WZX', stdio: { stdin: 'ignore', stdout: { maxBytes: 262144 }, stderr: { maxBytes: 262144 } }, graceMs: graceMs || 30000 })
    await handle.waitForExit()
    const stdout = handle.collected.stdout ? handle.collected.stdout.readFrom(0).text : ''
    const stderr = handle.collected.stderr ? handle.collected.stderr.readFrom(0).text : ''
    return { stdout, stderr }
  }
  harness.handle('list-tools', async () => {
    try {
      let installed = {}
      try { const { stdout } = await runNpm(['ls', '-g', '--depth=0', '--json'], 30000); installed = (JSON.parse(stdout) && JSON.parse(stdout).dependencies) || {} } catch (e) { installed = {} }
      const list = TOOLS.map(function (t) { return { id: t.id, name: t.name, category: t.category, desc: t.desc, note: t.note, pkg: t.pkg, installed: Object.prototype.hasOwnProperty.call(installed, t.pkg) } })
      const categories = []
      const order = []
      list.forEach(function (t) { if (order.indexOf(t.category) === -1) order.push(t.category) })
      order.forEach(function (cat) { categories.push({ name: cat, items: list.filter(function (t) { return t.category === cat }) }) })
      return { ok: true, categories }
    } catch (error) { return { ok: false, error: String((error && error.message) || error) } }
  })
  harness.handle('install-tool', async (args) => {
    try {
      const pkg = args && args.pkg
      if (typeof pkg !== 'string' || pkg === '') return { ok: false, error: '缺少包名' }
      const { stdout, stderr } = await runNpm(['install', '-g', pkg], 180000)
      return { ok: true, pkg, stdout: stdout.slice(-2000), stderr: stderr.slice(-2000) }
    } catch (error) { return { ok: false, error: String((error && error.message) || error) } }
  })
}

// ===== 插件市场 =====
function applyPlugins(ctx) {
  const subprocess = ctx.get('subprocess')
  if (subprocess === undefined) return
  async function runNpm(args, graceMs) {
    const cmdPath = await subprocess.resolveExecutable('cmd.exe')
    const handle = subprocess.spawn({ argv: [cmdPath, '/c', 'npm'].concat(args), cwd: 'C:\\Users\\WZX', stdio: { stdin: 'ignore', stdout: { maxBytes: 262144 }, stderr: { maxBytes: 262144 } }, graceMs: graceMs || 30000 })
    await handle.waitForExit()
    const stdout = handle.collected.stdout ? handle.collected.stdout.readFrom(0).text : ''
    const stderr = handle.collected.stderr ? handle.collected.stderr.readFrom(0).text : ''
    return { stdout, stderr }
  }
  harness.handle('list-plugins', async () => {
    try {
      let installed = {}
      try { const { stdout } = await runNpm(['ls', '-g', '--depth=0', '--json'], 30000); installed = (JSON.parse(stdout) && JSON.parse(stdout).dependencies) || {} } catch (e) { installed = {} }
      const list = PLUGINS.map(function (t) { return { id: t.id, name: t.name, category: t.category, desc: t.desc, note: t.note, pkg: t.pkg, installed: Object.prototype.hasOwnProperty.call(installed, t.pkg) } })
      const categories = []
      const order = []
      list.forEach(function (t) { if (order.indexOf(t.category) === -1) order.push(t.category) })
      order.forEach(function (cat) { categories.push({ name: cat, items: list.filter(function (t) { return t.category === cat }) }) })
      return { ok: true, categories }
    } catch (error) { return { ok: false, error: String((error && error.message) || error) } }
  })
  harness.handle('install-plugin', async (args) => {
    try {
      const pkg = args && args.pkg
      if (typeof pkg !== 'string' || pkg === '') return { ok: false, error: '缺少包名' }
      const { stdout, stderr } = await runNpm(['install', '-g', pkg], 180000)
      return { ok: true, pkg, stdout: stdout.slice(-2000), stderr: stderr.slice(-2000) }
    } catch (error) { return { ok: false, error: String((error && error.message) || error) } }
  })
}

// ===== 项目区 =====
function applyProjects(ctx) {
  const workspaceRegistry = ctx.get('workspaceRegistry')
  if (workspaceRegistry === undefined) return
  harness.handle('list-projects', async () => {
    try {
      const list = workspaceRegistry.list()
      const items = list.map(function (w) {
        return { id: w.id === undefined ? '' : String(w.id), path: w.path === undefined ? '' : String(w.path), title: (w.title === undefined || w.title === null || w.title === '') ? (w.path === undefined ? '' : String(w.path)) : String(w.title) }
      })
      return { ok: true, items }
    } catch (error) { return { ok: false, error: String((error && error.message) || error) } }
  })
  harness.handle('create-project', async (args) => {
    try {
      const path = args && args.path
      const title = args && args.title
      if (typeof path !== 'string' || path === '') return { ok: false, error: '路径不能为空' }
      const w = await workspaceRegistry.create(path, (typeof title === 'string' && title !== '') ? title : undefined)
      return { ok: true, id: w.id === undefined ? '' : String(w.id), path: w.path === undefined ? '' : String(w.path) }
    } catch (error) { return { ok: false, error: String((error && error.message) || error) } }
  })
}

// ===== 本地 token 用量（持久化累加） =====
const USAGE_PATH = 'C:\\Users\\WZX\\.dsh\\dsh-client-usage.json'

async function readUsageFile(subprocess) {
  try {
    const nodePath = await subprocess.resolveExecutable('node')
    const script = "try{console.log(require('fs').readFileSync(process.env.DSH_U,'utf8'))}catch(e){console.log('{}')}"
    const handle = subprocess.spawn({ argv: [nodePath, '-e', script], cwd: 'C:\\Users\\WZX', stdio: { stdin: 'ignore', stdout: { maxBytes: 131072 }, stderr: { maxBytes: 131072 } }, graceMs: 8000, env: { DSH_U: USAGE_PATH } })
    await handle.waitForExit()
    const out = handle.collected.stdout ? handle.collected.stdout.readFrom(0).text : ''
    return JSON.parse(out.trim() || '{}')
  } catch (e) { return {} }
}

async function writeUsageFile(subprocess, obj) {
  try {
    const nodePath = await subprocess.resolveExecutable('node')
    const script = "try{require('fs').writeFileSync(process.env.DSH_U, process.env.DSH_V)}catch(e){console.error(e)}"
    const handle = subprocess.spawn({ argv: [nodePath, '-e', script], cwd: 'C:\\Users\\WZX', stdio: { stdin: 'ignore', stdout: { maxBytes: 131072 }, stderr: { maxBytes: 131072 } }, graceMs: 8000, env: { DSH_U: USAGE_PATH, DSH_V: JSON.stringify(obj) } })
    await handle.waitForExit()
  } catch (e) {}
}

function applyUsage(ctx) {
  const tokenMeter = ctx.get('tokenMeter')
  const sessions = ctx.get('sessions')
  const subprocess = ctx.get('subprocess')
  if (tokenMeter === undefined || sessions === undefined || subprocess === undefined) return
  harness.handle('get-usage', async () => {
    try {
      const list = sessions.list()
      let currentTotal = 0
      const currentSessions = {}
      for (let i = 0; i < list.length; i++) {
        try {
          const m = tokenMeter.measure(list[i])
          const t = (m && m.totalTokens) || 0
          currentTotal += t
          const sid = (list[i].id !== undefined) ? String(list[i].id) : ('s' + i)
          currentSessions[sid] = t
        } catch (e) {}
      }
      const file = await readUsageFile(subprocess)
      const merged = file.sessions || {}
      for (const sid in currentSessions) {
        merged[sid] = Math.max(merged[sid] || 0, currentSessions[sid])
      }
      await writeUsageFile(subprocess, { sessions: merged })
      let totalTokens = 0
      const sessionIds = Object.keys(merged)
      for (let i = 0; i < sessionIds.length; i++) totalTokens += merged[sessionIds[i]] || 0
      return { ok: true, currentTokens: currentTotal, totalTokens: totalTokens, sessionCount: sessionIds.length }
    } catch (error) {
      return { ok: false, error: String((error && error.message) || error) }
    }
  })
}

// ===== 神奇小开关：DSV4 Pro（满血）+ 极简模式 =====
const MAGIC_PROVIDER = 'deepseek-official'
const MAGIC_MODEL = 'deepseek-v4-pro'
const NORMAL_MODEL = 'deepseek-v4-flash'
function applyMagicSwitch(ctx) {
  const settings = ctx.get('settings')
  const agentDefaultModel = ctx.get('agentDefaultModel')
  if (settings === undefined || agentDefaultModel === undefined) return
  harness.handle('get-magic-switch', async () => {
    try {
      const presetSettings = settings.get('agent-presets')
      const preset = (presetSettings && presetSettings.default) || 'standard'
      const sel = agentDefaultModel.currentSelection()
      const model = (sel && sel.model) || ''
      return { ok: true, preset: preset, model: model, on: (preset === 'minimal' && model === MAGIC_MODEL) }
    } catch (error) { return { ok: false, error: String((error && error.message) || error) } }
  })
  harness.handle('set-magic-switch', async (args) => {
    try {
      const on = args && args.on
      if (on) {
        await settings.update('agent-presets', { default: 'minimal' })
        await agentDefaultModel.saveSelection({ provider: MAGIC_PROVIDER, model: MAGIC_MODEL })
      } else {
        await settings.update('agent-presets', { default: 'standard' })
        await agentDefaultModel.saveSelection({ provider: MAGIC_PROVIDER, model: NORMAL_MODEL })
      }
      return { ok: true }
    } catch (error) { return { ok: false, error: String((error && error.message) || error) } }
  })
}

// ===== 意见区：提交反馈到 GitHub Issue =====
const FEEDBACK_REPO = 'WZX123188/deepseekharness-'
function applyFeedback(ctx) {
  const subprocess = ctx.get('subprocess')
  if (subprocess === undefined) return
  harness.handle('open-feedback', async (args) => {
    try {
      const type = args && args.type
      const title = args && args.title
      const body = args && args.body
      if (typeof title !== 'string' || title.trim() === '') return { ok: false, error: '标题不能为空' }
      const typeLabel = (type === 'bug') ? '问题反馈' : (type === 'idea' ? '功能建议' : '反馈')
      const fullTitle = '[' + typeLabel + '] ' + title.trim()
      const bodyText = (typeof body === 'string' ? body : '') + '\n\n---\n（由 DSH 客户端意见区提交）'
      const url = 'https://github.com/' + FEEDBACK_REPO + '/issues/new?title=' + encodeURIComponent(fullTitle) + '&body=' + encodeURIComponent(bodyText) + '&labels=' + encodeURIComponent('反馈')
      const cmdPath = await subprocess.resolveExecutable('cmd.exe')
      const handle = subprocess.spawn({ argv: [cmdPath, '/c', 'start', '', url], cwd: 'C:\\Users\\WZX', stdio: { stdin: 'ignore', stdout: { maxBytes: 4096 }, stderr: { maxBytes: 4096 } }, graceMs: 8000 })
      await handle.waitForExit()
      return { ok: true }
    } catch (error) { return { ok: false, error: String((error && error.message) || error) } }
  })
}

return {
  apply(ctx) {
    applyGate(ctx)
    applyPermission(ctx)
    applyBalance(ctx)
    applyUsage(ctx)
    applyUpdate(ctx)
    applyTools(ctx)
    applyPlugins(ctx)
    applyProjects(ctx)
    applyMagicSwitch(ctx)
    applyFeedback(ctx)
  },
}
