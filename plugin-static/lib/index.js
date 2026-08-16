// 静态宿主插件：把原 host-body.js 的 RPC 方法迁到 TypertRemoteService，
// 用 src-json 宽松编解码，免编译器。权限门仍由 dsh-client-gate 提供，这里不含。
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { fileURLToPath } from 'node:url'
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs'
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'

// 本插件所在目录（用于定位 office.mjs 辅助脚本）
const PLUGIN_DIR = path.dirname(fileURLToPath(import.meta.url))
const OFFICE_MJS = path.join(PLUGIN_DIR, 'office.mjs')
const JSZIP_ENTRY = () => path.join(pdfToolsNodeModules(), 'jszip', 'lib', 'index.js')

// 数据落点：优先 DSH_HOME（客户端隔离），否则回退 ~/.dsh
const HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
const CONFIG_PATH = path.join(HOME, 'dsh-client-config.json')
const MARKET_PATH = path.join(HOME, 'dsh-market.json')
const USAGE_PATH = path.join(HOME, 'dsh-client-usage.json')
const MCP_DIR = path.join(HOME, 'mcp-tools')                       // 市场工具隔离安装目录（不碰全局 npm）
const PROFILE_PATCH = path.join(HOME, 'profiles', 'web', 'cordis.patch.yml')

// 视图模式：智谱免费视觉模型（OpenAI 兼容接口）。
// 注意：智谱 API Key 不以 sk- 开头，前缀/格式不固定（常见形如「32位十六进制.32位十六进制」两段式），
// 保存时只去空白与误贴的引号，不做任何前缀限制。
const VISION_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
const VISION_MODELS = ['glm-4.6v-flash', 'glm-4v-flash']
const VISION_MODEL = VISION_MODELS[0]
const VISION_SITE = 'https://open.bigmodel.cn/'

const BALANCE_URL = 'https://api.deepseek.com/user/balance'
const PKG = '@deepseek-ai/dsh'
const REGISTRY_LATEST = 'https://registry.npmmirror.com/' + PKG.replace('/', '%2f') + '/latest'
const CURRENT_VERSION = '0.1.0-rc.6'
const GITHUB_RELEASES = 'https://api.github.com/repos/WZX123188/deepseekharness-/releases/latest'
const FEEDBACK_REPO = 'WZX123188/deepseekharness-'

const TOOLS = [
  { id: 'e2b', name: 'E2B Code Interpreter', category: '代码沙盒', desc: '云端隔离沙盒运行 Python/代码（区别于本地命令）', note: '来自 E2B', pkg: '@e2b/mcp-server', config: '需在 e2b.dev 注册并生成 API Key，设为环境变量 E2B_API_KEY 后，代码才能在云端沙盒里跑。' },
  { id: 'puppeteer', name: 'Puppeteer', category: '浏览器自动化', desc: '无头浏览器自动化、网页交互', note: '来自 Anthropic', pkg: '@modelcontextprotocol/server-puppeteer', config: '' },
  { id: 'playwright', name: 'Playwright', category: '浏览器自动化', desc: '浏览器自动化与测试', note: '来自 微软', pkg: '@playwright/mcp', config: '' },
  { id: 'github', name: 'GitHub', category: '代码与仓库', desc: '操作 GitHub 仓库、Issue、PR', note: '来自 GitHub', pkg: '@modelcontextprotocol/server-github', config: '需在 GitHub → Settings → Developer settings → Personal access tokens 生成令牌，设为环境变量 GITHUB_PERSONAL_ACCESS_TOKEN。' },
  { id: 'postgres', name: 'PostgreSQL', category: '数据库', desc: '查询 PostgreSQL 数据库', note: '来自 Anthropic', pkg: '@modelcontextprotocol/server-postgres', config: '需数据库连接串：设为环境变量 DATABASE_URL（形如 postgresql://用户名:密码@主机:端口/库名）。' },
  { id: 'sqlite', name: 'SQLite', category: '数据库', desc: '查询 SQLite 数据库', note: '来自 Anthropic', pkg: '@modelcontextprotocol/server-sqlite', config: '需指定本地数据库文件路径：启动时通过 --db-path 传入，或设置 SQLITE_PATH 环境变量。' },
  { id: 'memory', name: 'Memory', category: '知识记忆', desc: '持久化知识图谱记忆', note: '来自 Anthropic', pkg: '@modelcontextprotocol/server-memory', config: '需指定记忆存储文件路径：启动时通过 --path 传入；不指定则用默认 ~/.memory.json。' },
  { id: 'time', name: 'Time', category: '实用工具', desc: '时间与时区查询', note: '来自 Anthropic', pkg: '@modelcontextprotocol/server-time', config: '' },
  { id: 'slack', name: 'Slack', category: '团队协作', desc: '读写 Slack 频道、消息', note: '来自 Anthropic', pkg: '@modelcontextprotocol/server-slack', config: '需 Slack 机器人 Token：设为环境变量 SLACK_BOT_TOKEN（配合 SLACK_TEAM_ID）。' },
  { id: 'notion', name: 'Notion', category: '知识管理', desc: '读写 Notion 页面与数据库', note: '来自 Notion', pkg: '@notionhq/notion-mcp-server', config: '需 Notion 集成 Token：在 notion.so/my-integrations 创建集成，把 Token 通过 OPENAPI_MCP_HEADERS 传入。' },
  { id: 'sentry', name: 'Sentry', category: '错误监控', desc: '查询 Sentry 错误与性能数据', note: '来自 Sentry', pkg: '@modelcontextprotocol/server-sentry', config: '需 Sentry Auth Token：在 sentry.io 生成，设为环境变量 SENTRY_TOKEN。' },
]
const PLUGINS = [
  { id: 'plg-mcp', name: 'MCP 客户端', category: '协议接入', desc: '接入 MCP 协议，管理 MCP 服务器', note: '来自 DeepSeek', pkg: '@deepseek-ai/dsh-mcp-client' },
]

let permissionMode = 'ask'
let visionKey = ''

// ---- 智谱视觉请求：模型不可用（404 / 400 且错误信息提到模型不存在）时自动换下一个模型重试；
//      鉴权/网络类错误直接返回，不做无谓重试 ----
function visionModelGone(status, text) {
  if (status === 404) return true
  if (status !== 400) return false
  return /model|not\s*exist|不存在|无此|not\s*found/i.test(text)
}
function visionErrorMessage(status, text) {
  let msg = '连接失败（HTTP ' + status + '）'
  try { const b = JSON.parse(text); if (b && b.error && b.error.message) msg = String(b.error.message) } catch (e) {}
  return msg
}
async function visionRequest(body) {
  let last = { status: 0, text: '' }
  for (let i = 0; i < VISION_MODELS.length; i++) {
    let res, text
    try {
      res = await fetch(VISION_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + visionKey }, body: JSON.stringify(Object.assign({}, body, { model: VISION_MODELS[i] })) })
      text = await res.text()
    } catch (e) {
      return { ok: false, error: String((e && e.message) || e) }
    }
    if (res.status === 200) return { ok: true, text, model: VISION_MODELS[i] }
    if (!visionModelGone(res.status, text)) return { ok: false, error: visionErrorMessage(res.status, text) }
    last = { status: res.status, text }
  }
  return { ok: false, error: visionErrorMessage(last.status, last.text) }
}

function balanceScript() { return "(async()=>{try{const r=await fetch('" + BALANCE_URL + "',{headers:{Authorization:'Bearer '+process.env.DSH_BALANCE_KEY,Accept:'application/json'}});const t=await r.text();console.log(JSON.stringify({status:r.status,body:t}))}catch(e){console.error(String((e&&e.stack)||e));process.exit(1)}})()" }
function latestScript() { return "(async()=>{const r=await fetch('" + REGISTRY_LATEST + "');const j=await r.json();console.log(String(j.version||''))})().catch(e=>{console.error(String((e&&e.stack)||e));process.exit(1)})" }
function githubScript() { return "(async()=>{try{const r=await fetch('" + GITHUB_RELEASES + "',{headers:{'User-Agent':'dsh-client'}});if(r.status===404){console.log(JSON.stringify({tag:'',name:'',html:'',status:404}));return}const j=await r.json();console.log(JSON.stringify({tag:(j&&j.tag_name)||'',name:(j&&j.name)||'',html:(j&&j.html_url)||'',status:r.status}))}catch(e){console.log(JSON.stringify({tag:'',name:'',html:'',status:0,error:String((e&&e.message)||e)}))}})()" }

// ---- PDF 翻译工具（pdfjs-dist 提取文字 + @napi-rs/canvas 渲染扫描页）----
function pdfToolsNodeModules() {
  const candidates = [
    path.join(path.dirname(process.execPath), '..', 'dsh-runtime', 'node_modules', 'pdf-tools', 'node_modules'),
    path.join(path.dirname(process.execPath), 'node_modules', 'pdf-tools', 'node_modules'),
    path.join(HOME, 'pdf-tools', 'node_modules')
  ]
  for (const c of candidates) { try { if (existsSync(c)) return c } catch (e) {} }
  return candidates[0]
}
function pdfjsLegacyPath() { return path.join(pdfToolsNodeModules(), 'pdfjs-dist', 'legacy', 'build', 'pdf.mjs').replace(/\\/g, '/') }
function canvasEsmPath() { return path.join(pdfToolsNodeModules(), '@napi-rs', 'canvas', 'index.js').replace(/\\/g, '/') }
function extractPdfScript() { return "(async()=>{try{const fs=require('fs');const buf=fs.readFileSync(process.env.DSH_F);const pdfjs=await import('file:///" + pdfjsLegacyPath() + "');const doc=await pdfjs.getDocument({data:new Uint8Array(buf),useWorkerFetch:false,isEvalSupported:false,disableFontFace:true}).promise;const pages=[];for(let i=1;i<=doc.numPages;i++){const pg=await doc.getPage(i);const tc=await pg.getTextContent();pages.push({page:i,text:tc.items.map(function(x){return x.str}).join(' ')});}console.log(JSON.stringify({pages:pages}));}catch(e){console.error(String((e&&e.stack)||e));process.exit(1)}})()" }
function renderPdfScript() { return "(async()=>{try{const fs=require('fs');const path=require('path');const buf=fs.readFileSync(process.env.DSH_F);const out=process.env.DSH_OUT;fs.mkdirSync(out,{recursive:true});const pdfjs=await import('file:///" + pdfjsLegacyPath() + "');const cvmod=await import('file:///" + canvasEsmPath() + "');const createCanvas=cvmod.createCanvas;const doc=await pdfjs.getDocument({data:new Uint8Array(buf),useWorkerFetch:false,isEvalSupported:false,disableFontFace:true}).promise;let n=0;for(let i=1;i<=doc.numPages;i++){const pg=await doc.getPage(i);const vp=pg.getViewport({scale:2});const cv=createCanvas(vp.width,vp.height);const c2=cv.getContext('2d');await pg.render({canvasContext:c2,viewport:vp}).promise;fs.writeFileSync(path.join(out,String(i)+'.png'),cv.toBuffer('image/png'));n++;}console.log(JSON.stringify({count:n}));}catch(e){console.error(String((e&&e.stack)||e));process.exit(1)}})()" }

export class DshClientFeaturesService extends TypertRemoteService {
  constructor(ctx) {
    super(ctx, 'dshClientFeatures')
    this.ctx = ctx
    this.loadPermissionMode()
  }

  async loadPermissionMode() {
    try {
      const cfg = await this.readJsonFile(CONFIG_PATH)
      permissionMode = (cfg && cfg.permissionMode === 'trust') ? 'trust' : 'ask'
      visionKey = (cfg && typeof cfg.visionKey === 'string') ? cfg.visionKey : ''
    } catch (e) {}
  }

  async runNode(script, env, graceMs) {
    const subprocess = this.ctx.get('subprocess')
    if (!subprocess) return { stdout: '', stderr: 'subprocess 不可用' }
    const nodePath = await subprocess.resolveExecutable('node')
    const handle = subprocess.spawn({ argv: [nodePath, '-e', script], cwd: HOME, stdio: { stdin: 'ignore', stdout: { maxBytes: 262144 }, stderr: { maxBytes: 262144 } }, graceMs: graceMs || 15000, env: env || {} })
    await handle.waitForExit()
    const stdout = handle.collected.stdout ? handle.collected.stdout.readFrom(0).text : ''
    const stderr = handle.collected.stderr ? handle.collected.stderr.readFrom(0).text : ''
    return { stdout, stderr }
  }

  async runCmd(args, graceMs) {
    const subprocess = this.ctx.get('subprocess')
    if (!subprocess) return { stdout: '', stderr: 'subprocess 不可用' }
    const cmdPath = await subprocess.resolveExecutable('cmd.exe')
    const handle = subprocess.spawn({ argv: [cmdPath, '/c'].concat(args), cwd: HOME, stdio: { stdin: 'ignore', stdout: { maxBytes: 262144 }, stderr: { maxBytes: 262144 } }, graceMs: graceMs || 30000 })
    await handle.waitForExit()
    const stdout = handle.collected.stdout ? handle.collected.stdout.readFrom(0).text : ''
    const stderr = handle.collected.stderr ? handle.collected.stderr.readFrom(0).text : ''
    return { stdout, stderr }
  }

  // 用内置 Node + 内置 npm 装到隔离目录（不依赖系统全局 npm）
  async runNpm(args, graceMs) {
    const subprocess = this.ctx.get('subprocess')
    if (!subprocess) return { stdout: '', stderr: 'subprocess 不可用' }
    const node = process.execPath
    const npmCli = path.join(path.dirname(node), 'node_modules', 'npm', 'bin', 'npm-cli.js')
    if (existsSync(npmCli)) {
      const handle = subprocess.spawn({ argv: [node, npmCli].concat(args), cwd: HOME, stdio: { stdin: 'ignore', stdout: { maxBytes: 524288 }, stderr: { maxBytes: 524288 } }, graceMs: graceMs || 240000, env: {} })
      await handle.waitForExit()
      const stdout = handle.collected.stdout ? handle.collected.stdout.readFrom(0).text : ''
      const stderr = handle.collected.stderr ? handle.collected.stderr.readFrom(0).text : ''
      return { stdout, stderr }
    }
    return this.runCmd(['npm'].concat(args), graceMs)
  }

  // 解析已安装 MCP 包的可执行入口（package.json 的 bin 字段）
  resolveMcpBin(pkg) {
    try {
      const pj = path.join(MCP_DIR, 'node_modules', ...pkg.split('/'), 'package.json')
      const manifest = JSON.parse(readFileSync(pj, 'utf8'))
      const bin = manifest.bin
      let rel = null
      if (typeof bin === 'string') rel = bin
      else if (bin && typeof bin === 'object') rel = bin[manifest.name] || Object.values(bin)[0]
      if (!rel) return null
      const abs = path.join(path.dirname(pj), rel)
      return existsSync(abs) ? abs : null
    } catch (e) { return null }
  }

  // 重建 cordis.patch.yml：权限门 + 静态插件 + 已启用的 mcp-client 条目（HMR 自动生效）
  async rebuildMcpPatch() {
    const market = await this.readJsonFile(MARKET_PATH)
    const entries = []
    const collect = (map, items) => {
      for (const id of Object.keys(map || {})) {
        if (!map[id]) continue
        const item = this.findById(items, id)
        if (!item) continue
        const bin = this.resolveMcpBin(item.pkg)
        if (!bin) continue
        entries.push({ serverName: 'mcp-' + id, command: process.execPath, args: [bin] })
      }
    }
    collect(market.tools, TOOLS)
    collect(market.plugins, PLUGINS)
    let y = '- insert:\n    - id: dsh-client-gate\n      name: dsh-client-gate\n    - id: dsh-client-static\n      name: dsh-client-static\n'
    if (entries.length > 0) {
      y += '- insert:\n'
      for (const e of entries) {
        y += '    - name: mcp-client\n      config:\n        transport: stdio\n        serverName: ' + e.serverName + '\n        command: ' + JSON.stringify(e.command) + '\n        args:\n          - ' + JSON.stringify(e.args[0]) + '\n        failOnStartupError: false\n'
      }
    }
    writeFileSync(PROFILE_PATCH, y)
  }

  async readJsonFile(p) {
    const { stdout } = await this.runNode("try{console.log(require('fs').readFileSync(process.env.DSH_F,'utf8'))}catch(e){console.log('{}')}", { DSH_F: p }, 8000)
    try { return JSON.parse(stdout.trim() || '{}') } catch (e) { return {} }
  }

  async writeJsonFile(p, obj) {
    await this.runNode("try{require('fs').writeFileSync(process.env.DSH_F, process.env.DSH_V)}catch(e){console.error(e)}", { DSH_F: p, DSH_V: JSON.stringify(obj) }, 8000)
  }

  async getPermissionMode() {
    console.log('[dsh-static] getPermissionMode called, mode=' + permissionMode)
    return { ok: true, mode: permissionMode }
  }

  async setPermissionMode(args) {
    const mode = args && args.mode
    if (mode !== 'ask' && mode !== 'trust') return { ok: false, error: '无效模式' }
    permissionMode = mode
    const cfg = await this.readJsonFile(CONFIG_PATH)
    cfg.permissionMode = mode
    await this.writeJsonFile(CONFIG_PATH, cfg)
    return { ok: true, mode: permissionMode }
  }

  async deepseekBalance() {
    try {
      const credentials = this.ctx.get('credentials')
      if (!credentials) return { ok: false, error: '凭据服务不可用' }
      const resolved = await credentials.resolve('DEEPSEEK_API_KEY')
      if (!resolved || typeof resolved.value !== 'string' || resolved.value === '') return { ok: false, error: '未配置 DeepSeek API Key（DEEPSEEK_API_KEY）' }
      const { stdout, stderr } = await this.runNode(balanceScript(), { DSH_BALANCE_KEY: resolved.value }, 15000)
      const last = stdout.trim().split(/\r?\n/).filter(Boolean).pop()
      if (last === undefined) return { ok: false, error: stderr.trim() || '余额请求无输出' }
      const parsed = JSON.parse(last)
      return { ok: true, status: parsed.status, body: parsed.body }
    } catch (e) { return { ok: false, error: String((e && e.message) || e) } }
  }

  async getUsage() {
    try {
      const tokenMeter = this.ctx.get('tokenMeter')
      const sessions = this.ctx.get('sessions')
      if (!tokenMeter || !sessions) return { ok: false, error: '用量服务不可用' }
      const list = sessions.list()
      let currentTotal = 0
      const currentSessions = {}
      for (let i = 0; i < list.length; i++) {
        try {
          const m = tokenMeter.measure(list[i])
          const t = (m && m.totalTokens) || 0
          currentTotal += t
          currentSessions[String(list[i].id || ('s' + i))] = t
        } catch (e) {}
      }
      const file = await this.readJsonFile(USAGE_PATH)
      const merged = file.sessions || {}
      for (const sid in currentSessions) merged[sid] = Math.max(merged[sid] || 0, currentSessions[sid])
      await this.writeJsonFile(USAGE_PATH, { sessions: merged })
      let totalTokens = 0
      const ids = Object.keys(merged)
      for (let i = 0; i < ids.length; i++) totalTokens += merged[ids[i]] || 0
      return { ok: true, currentTokens: currentTotal, totalTokens, sessionCount: ids.length }
    } catch (e) { return { ok: false, error: String((e && e.message) || e) } }
  }

  async checkUpdate() {
    try {
      const h1 = await this.runNode(latestScript(), {}, 20000)
      const officialLatest = h1.stdout.trim().split(/\r?\n/).filter(Boolean).pop() || ''
      let github = { tag: '', name: '', html: '', ok: false, noRelease: false, unreachable: false }
      try {
        const h2 = await this.runNode(githubScript(), {}, 20000)
        const glast = h2.stdout.trim().split(/\r?\n/).filter(Boolean).pop() || ''
        const parsed = JSON.parse(glast)
        github = { tag: parsed.tag || '', name: parsed.name || '', html: parsed.html || '', ok: parsed.tag !== '', noRelease: parsed.status === 404, unreachable: parsed.status === 0 }
      } catch (e) { github = { tag: '', name: '', html: '', ok: false, noRelease: false, unreachable: true } }
      return { ok: true, official: { current: CURRENT_VERSION, latest: officialLatest, hasUpdate: officialLatest !== '' && officialLatest !== CURRENT_VERSION }, github }
    } catch (e) { return { ok: false, error: String((e && e.message) || e) } }
  }

  async doUpdate() {
    try {
      // 独立客户端：不再 npm install -g（会污染全局）。打开 GitHub 发布页让用户下载新版安装包/便携版。
      let url = 'https://github.com/' + FEEDBACK_REPO + '/releases'
      try {
        const h2 = await this.runNode(githubScript(), {}, 20000)
        const glast = h2.stdout.trim().split(/\r?\n/).filter(Boolean).pop() || ''
        const parsed = JSON.parse(glast)
        if (parsed && parsed.html) url = parsed.html
      } catch (e) {}
      await this.runCmd(['start', '', url], 8000)
      return { ok: true, stdout: '已在浏览器打开 GitHub 发布页，请下载新版安装包或便携版。', stderr: '' }
    } catch (e) { return { ok: false, error: String((e && e.message) || e) } }
  }

  async listMarket(kind, items) {
    try {
      const installed = {}
      for (let i = 0; i < items.length; i++) {
        if (existsSync(path.join(MCP_DIR, 'node_modules', ...items[i].pkg.split('/')))) installed[items[i].pkg] = true
      }
      const market = await this.readJsonFile(MARKET_PATH)
      const plural = kind + 's'
      const stateMap = market[plural] || {}
      const list = items.map((t) => {
        const isInst = !!installed[t.pkg]
        return { id: t.id, name: t.name, category: t.category, desc: t.desc, note: t.note, pkg: t.pkg, config: t.config || '', installed: isInst, enabled: isInst && stateMap[t.id] !== false }
      })
      const order = []
      list.forEach((t) => { if (order.indexOf(t.category) === -1) order.push(t.category) })
      const categories = order.map((cat) => ({ name: cat, items: list.filter((t) => t.category === cat) }))
      return { ok: true, categories }
    } catch (e) { return { ok: false, error: String((e && e.message) || e) } }
  }

  listTools() { return this.listMarket('tool', TOOLS) }
  listPlugins() { return this.listMarket('plugin', PLUGINS) }

  findById(items, id) { for (let i = 0; i < items.length; i++) if (items[i].id === id) return items[i]; return null }
  findByPkg(items, pkg) { for (let i = 0; i < items.length; i++) if (items[i].pkg === pkg) return items[i]; return null }

  async marketAct(kind, items, action, args) {
    const plural = kind + 's'
    const item = this.findById(items, args && args.id) || this.findByPkg(items, args && args.pkg)
    if (item === null) return { ok: false, error: '未知条目' }
    if (action === 'install') {
      const { stdout, stderr } = await this.runNpm(['install', '--prefix', MCP_DIR, '--registry', 'https://registry.npmmirror.com', '--no-audit', '--no-fund', item.pkg], 300000)
      const market = await this.readJsonFile(MARKET_PATH)
      const map = market[plural] || {}
      map[item.id] = true
      market[plural] = map
      await this.writeJsonFile(MARKET_PATH, market)
      await this.rebuildMcpPatch()
      return { ok: true, pkg: item.pkg, stdout: stdout.slice(-2000), stderr: stderr.slice(-2000) }
    }
    if (action === 'uninstall') {
      const { stdout, stderr } = await this.runNpm(['uninstall', '--prefix', MCP_DIR, item.pkg], 180000)
      const market = await this.readJsonFile(MARKET_PATH)
      const map = market[plural] || {}
      delete map[item.id]
      market[plural] = map
      await this.writeJsonFile(MARKET_PATH, market)
      await this.rebuildMcpPatch()
      return { ok: true, id: item.id, stdout: stdout.slice(-2000), stderr: stderr.slice(-2000) }
    }
    // set-enabled：真正挂载 / 卸载 MCP 服务器（写 cordis.patch.yml，HMR 自动生效）
    const enabled = !!(args && args.enabled)
    const market = await this.readJsonFile(MARKET_PATH)
    const map = market[plural] || {}
    map[item.id] = enabled
    market[plural] = map
    await this.writeJsonFile(MARKET_PATH, market)
    await this.rebuildMcpPatch()
    return { ok: true, id: item.id, enabled }
  }

  installTool(args) { return this.marketAct('tool', TOOLS, 'install', args) }
  uninstallTool(args) { return this.marketAct('tool', TOOLS, 'uninstall', args) }
  setToolEnabled(args) { return this.marketAct('tool', TOOLS, 'set-enabled', args) }
  installPlugin(args) { return this.marketAct('plugin', PLUGINS, 'install', args) }
  uninstallPlugin(args) { return this.marketAct('plugin', PLUGINS, 'uninstall', args) }
  setPluginEnabled(args) { return this.marketAct('plugin', PLUGINS, 'set-enabled', args) }

  async listProjects() {
    try {
      const workspaceRegistry = this.ctx.get('workspaceRegistry')
      if (!workspaceRegistry) return { ok: false, error: '工作区服务不可用' }
      const list = workspaceRegistry.list()
      const items = list.map((w) => ({ id: w.id === undefined ? '' : String(w.id), path: w.path === undefined ? '' : String(w.path), title: (w.title === undefined || w.title === null || w.title === '') ? (w.path === undefined ? '' : String(w.path)) : String(w.title) }))
      return { ok: true, items }
    } catch (e) { return { ok: false, error: String((e && e.message) || e) } }
  }

  async createProject(args) {
    try {
      const workspaceRegistry = this.ctx.get('workspaceRegistry')
      if (!workspaceRegistry) return { ok: false, error: '工作区服务不可用' }
      const p = args && args.path
      const title = args && args.title
      if (typeof p !== 'string' || p === '') return { ok: false, error: '路径不能为空' }
      const w = await workspaceRegistry.create(p, (typeof title === 'string' && title !== '') ? title : undefined)
      return { ok: true, id: w.id === undefined ? '' : String(w.id), path: w.path === undefined ? '' : String(w.path) }
    } catch (e) { return { ok: false, error: String((e && e.message) || e) } }
  }

  async openFeedback(args) {
    try {
      const type = args && args.type
      const title = args && args.title
      const body = args && args.body
      if (typeof title !== 'string' || title.trim() === '') return { ok: false, error: '标题不能为空' }
      const typeLabel = (type === 'bug') ? '问题反馈' : (type === 'idea' ? '功能建议' : '反馈')
      const fullTitle = '[' + typeLabel + '] ' + title.trim()
      const bodyText = (typeof body === 'string' ? body : '') + '\n\n---\n（由 DSH 客户端意见区提交）'
      const url = 'https://github.com/' + FEEDBACK_REPO + '/issues/new?title=' + encodeURIComponent(fullTitle) + '&body=' + encodeURIComponent(bodyText) + '&labels=' + encodeURIComponent('反馈')
      await this.runCmd(['start', '', url], 8000)
      return { ok: true }
    } catch (e) { return { ok: false, error: String((e && e.message) || e) } }
  }

  async getVisionStatus() {
    return { ok: true, configured: visionKey !== '', model: VISION_MODEL, site: VISION_SITE }
  }

  async setVisionKey(args) {
    let k = args && args.key
    if (typeof k !== 'string') return { ok: false, error: '无效的 Key' }
    k = k.trim()
    // 粘贴时常带成对引号，顺手去掉；智谱 Key 不以 sk- 开头、格式不固定，这里不做任何前缀/格式限制
    if (k.length > 1 && (k[0] === '"' || k[0] === "'" || k[0] === '`') && k.endsWith(k[0])) k = k.slice(1, -1).trim()
    if (k.length === 0) return { ok: false, error: 'Key 不能为空' }
    visionKey = k
    const cfg = await this.readJsonFile(CONFIG_PATH)
    cfg.visionKey = visionKey
    await this.writeJsonFile(CONFIG_PATH, cfg)
    return { ok: true, configured: visionKey !== '' }
  }

  async clearVisionKey() {
    visionKey = ''
    const cfg = await this.readJsonFile(CONFIG_PATH)
    cfg.visionKey = ''
    await this.writeJsonFile(CONFIG_PATH, cfg)
    return { ok: true, configured: false }
  }

  async testVision() {
    try {
      if (!visionKey) return { ok: false, error: '请先填写并保存智谱 API Key（不以 sk- 开头，格式不固定，直接粘贴官网复制的完整 Key 即可）' }
      const r = await visionRequest({ messages: [{ role: 'user', content: 'ping' }] })
      if (!r.ok) return { ok: false, error: r.error }
      return { ok: true }
    } catch (e) { return { ok: false, error: String((e && e.message) || e) } }
  }

  async seeImage(args) {
    try {
      if (!visionKey) return { ok: false, error: '未配置智谱视觉 API Key：请先在「视图模式」页点「去官网申请」领免费 Key 并保存（智谱 Key 不带 sk- 前缀，格式不固定）。' }
      const image = args && args.image
      if (typeof image !== 'string' || image === '') return { ok: false, error: '没有图片数据' }
      const prompt = (args && args.prompt) || '请详细、准确地描述这张图片里的全部内容，包括文字、数字、图表和结构。'
      const r = await visionRequest({ messages: [{ role: 'user', content: [{ type: 'image_url', image_url: { url: image } }, { type: 'text', text: prompt }] }] })
      if (!r.ok) return { ok: false, error: r.error }
      let content = ''
      try { const b = JSON.parse(r.text); content = (b.choices && b.choices[0] && b.choices[0].message && b.choices[0].message.content) || '' } catch (e) {}
      if (typeof content !== 'string') content = JSON.stringify(content)
      return { ok: true, text: content, model: r.model }
    } catch (e) { return { ok: false, error: String((e && e.message) || e) } }
  }

  // 把拖入对话框的文档（pdf/docx/xlsx/pptx）保存到本机 <DSH_HOME>/uploads/，
  // 返回绝对路径；客户端把它以「[📎 已附加文档: 路径]」文本插入输入框，
  // agent 收到后可直接 read 文件来翻译 / 回答。
  async saveDraftFile(args) {
    try {
      const name = args && args.name
      const data = args && args.data
      if (typeof name !== 'string' || name === '' || typeof data !== 'string' || data === '') return { ok: false, error: '无效文件数据' }
      const safe = path.basename(name).replace(/[\\/:*?"<>|]/g, '_')
      const dir = path.join(HOME, 'uploads')
      mkdirSync(dir, { recursive: true })
      const raw = String(data).replace(/^data:[^;]*;base64,/, '')
      const file = path.join(dir, Date.now() + '-' + safe)
      writeFileSync(file, Buffer.from(raw, 'base64'))
      return { ok: true, path: file, name: safe }
    } catch (e) { return { ok: false, error: String((e && e.message) || e) } }
  }

  async openVisionSite() {
    try {
      await this.runCmd(['start', '', VISION_SITE], 8000)
      return { ok: true }
    } catch (e) { return { ok: false, error: String((e && e.message) || e) } }
  }

  // 本地翻译服务（供浏览器 PDF 翻译扩展调用，端口 3190，仅本机）：
  //   POST /translate { text, target? }            -> { text }
  //   POST /pdf-probe { pdf: base64/dataURL }      -> pdfProbe 结果（文字版每页文本 / 扫描版每页图片）
  //   POST /ocr { image, prompt? }                 -> seeImage 结果（扫描版 OCR）
  // CORS 全放行；Key 不出本机：扩展只把数据发到 127.0.0.1:3190，翻译/识别全用本机已配置的 Key。
  async startTranslateServer() {
    try {
      if (this._translateSrv) return
      const srv = http.createServer((req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
        if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }
        const route = req.url || ''
        if (req.method !== 'POST' || (route.indexOf('/translate') !== 0 && route.indexOf('/pdf-probe') !== 0 && route.indexOf('/ocr') !== 0)) {
          res.writeHead(404); res.end(JSON.stringify({ error: 'not found' })); return
        }
        let body = ''
        req.on('data', (c) => { body += c })
        req.on('end', async () => {
          try {
            const parsed = JSON.parse(body || '{}')
            if (route.indexOf('/translate') === 0) {
              const text = parsed && parsed.text
              if (typeof text !== 'string' || text.trim() === '') { res.writeHead(400); res.end(JSON.stringify({ error: 'no text' })); return }
              const target = (parsed && parsed.target) || '中文'
              const out = await this.translateText({ text, target })
              res.writeHead(out.ok ? 200 : 502)
              res.end(JSON.stringify(out.ok ? { text: out.text } : { error: out.error }))
            } else if (route.indexOf('/pdf-probe') === 0) {
              const out = await this.pdfProbe({ pdf: parsed && parsed.pdf })
              res.writeHead(out.ok ? 200 : 502)
              res.end(JSON.stringify(out))
            } else {
              const out = await this.seeImage({ image: parsed && parsed.image, prompt: parsed && parsed.prompt })
              res.writeHead(out.ok ? 200 : 502)
              res.end(JSON.stringify(out))
            }
          } catch (e) {
            res.writeHead(500)
            res.end(JSON.stringify({ error: String((e && e.message) || e) }))
          }
        })
      })
      srv.on('error', (e) => { console.log('[dsh-static] 3190 翻译服务: ' + ((e && e.message) || e)) })
      srv.listen(3190, '127.0.0.1')
      this._translateSrv = srv
      console.log('[dsh-static] 本地翻译服务已启动 http://127.0.0.1:3190/translate')
    } catch (e) {
      console.log('[dsh-static] 翻译服务启动失败（忽略）: ' + ((e && e.message) || e))
    }
  }

  async getWallpaper() {
    const cfg = await this.readJsonFile(CONFIG_PATH)
    const w = cfg.wallpaper || {}
    return { ok: true, mode: w.mode || '', value: w.value || '' }
  }

  async setWallpaper(args) {
    const mode = args && args.mode
    const value = args && args.value
    if (mode !== 'color' && mode !== 'gradient' && mode !== 'image' && mode !== '') return { ok: false, error: '无效模式' }
    const cfg = await this.readJsonFile(CONFIG_PATH)
    if (mode === '') delete cfg.wallpaper
    else cfg.wallpaper = { mode: mode, value: value || '' }
    await this.writeJsonFile(CONFIG_PATH, cfg)
    return { ok: true, mode: mode, value: value || '' }
  }

  // DeepSeek 翻译（技术文档向，专业术语/引脚名保持原文）
  async translateText(args) {
    try {
      const credentials = this.ctx.get('credentials')
      if (!credentials) return { ok: false, error: '凭据服务不可用' }
      const resolved = await credentials.resolve('DEEPSEEK_API_KEY')
      if (!resolved || typeof resolved.value !== 'string' || resolved.value === '') return { ok: false, error: '未配置 DeepSeek API Key' }
      const text = args && args.text
      if (typeof text !== 'string' || text.trim() === '') return { ok: false, error: '没有待翻译文本' }
      const target = (args && args.target) || '中文'
      const sys = '你是专业技术文档翻译引擎。把用户给出的英文技术资料精确翻译成' + target + '：专业术语、数字、单位、型号、寄存器名、引脚名（如 VCC、GND、I2C、SCL、SDA、UART、SPI、GPIO、PWM）保持原文不译；保留段落与编号；只输出译文，不要任何解释或前缀。'
      const res = await fetch('https://api.deepseek.com/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + resolved.value }, body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'system', content: sys }, { role: 'user', content: text }], temperature: 0.2 }) })
      const t = await res.text()
      if (res.status !== 200) {
        let msg = '翻译失败（HTTP ' + res.status + '）'
        try { const b = JSON.parse(t); if (b && b.error && b.error.message) msg = String(b.error.message) } catch (e) {}
        return { ok: false, error: msg }
      }
      let content = ''
      try { const b = JSON.parse(t); content = (b.choices && b.choices[0] && b.choices[0].message && b.choices[0].message.content) || '' } catch (e) {}
      if (typeof content !== 'string') content = JSON.stringify(content)
      return { ok: true, text: content }
    } catch (e) { return { ok: false, error: String((e && e.message) || e) } }
  }

  // PDF 全文翻译：文字版直接抽文字翻；扫描版渲染每页→GLM OCR→翻
  async translatePdf(args) {
    try {
      const b64 = args && args.pdf
      if (typeof b64 !== 'string' || b64 === '') return { ok: false, error: '没有 PDF 数据' }
      const credentials = this.ctx.get('credentials')
      if (!credentials) return { ok: false, error: '凭据服务不可用' }
      const dsk = await credentials.resolve('DEEPSEEK_API_KEY')
      if (!dsk || typeof dsk.value !== 'string' || dsk.value === '') return { ok: false, error: '未配置 DeepSeek API Key' }
      const raw = String(b64).replace(/^data:[^;]*;base64,/, '')
      const buf = Buffer.from(raw, 'base64')
      const tmp = path.join(os.tmpdir(), 'dsh-pdf-' + Date.now() + '-' + Math.floor(Math.random() * 1e6) + '.pdf')
      writeFileSync(tmp, buf)
      try {
        const ext = await this.runNode(extractPdfScript(), { DSH_F: tmp }, 120000)
        let pages = []
        try { pages = (JSON.parse((ext.stdout || '').trim().split(/\r?\n/).filter(Boolean).pop() || '{"pages":[]}')).pages || [] } catch (e) {}
        const hasText = pages.some((p) => (p.text || '').trim().length > 20)
        const result = []
        if (hasText) {
          for (const p of pages) {
            const txt = (p.text || '').trim()
            if (!txt) continue
            const tr = await this.translateText({ text: txt })
            result.push({ page: p.page, original: txt, translated: tr.ok ? tr.text : '[翻译失败] ' + (tr.error || '') })
          }
          return { ok: true, pages: result, mode: 'text' }
        }
        if (!visionKey) return { ok: true, pages: [{ page: 0, original: '这是扫描版 PDF（无文字层）。', translated: '识别扫描件需要配置智谱视觉 Key（设置→视图模式）。' }], mode: 'scan-nokey' }
        const outDir = path.join(os.tmpdir(), 'dsh-pdf-out-' + Date.now())
        const rnd = await this.runNode(renderPdfScript(), { DSH_F: tmp, DSH_OUT: outDir }, 240000)
        let count = 0
        try { count = (JSON.parse((rnd.stdout || '').trim().split(/\r?\n/).filter(Boolean).pop() || '{"count":0}')).count || 0 } catch (e) {}
        for (let i = 1; i <= count; i++) {
          const png = path.join(outDir, String(i) + '.png')
          let dataUrl = ''
          try { dataUrl = 'data:image/png;base64,' + readFileSync(png).toString('base64') } catch (e) {}
          if (!dataUrl) continue
          const ocr = await this.seeImage({ image: dataUrl, prompt: '请原样、完整地识别这张数据手册页面里的所有英文与数字，不要翻译、不要遗漏、保持段落顺序。' })
          const original = ocr.ok ? ocr.text : '[OCR失败] ' + (ocr.error || '')
          const tr = ocr.ok ? await this.translateText({ text: original }) : { ok: false, error: 'OCR失败' }
          result.push({ page: i, original: original, translated: (tr && tr.ok) ? tr.text : '[翻译失败]' })
        }
        try { for (let i = 1; i <= count; i++) unlinkSync(path.join(outDir, String(i) + '.png')) } catch (e) {}
        return { ok: true, pages: result, mode: 'scan' }
      } finally {
        try { unlinkSync(tmp) } catch (e) {}
      }
    } catch (e) { return { ok: false, error: String((e && e.message) || e) } }
  }

  // 网页 PDF 实时翻译第一步：只解析不翻译，返回每页原文（文字版）或每页图片（扫描版），
  // 客户端再逐页调 translateText / seeImage，翻完一页立刻显示一页。
  async pdfProbe(args) {
    try {
      const b64 = args && args.pdf
      if (typeof b64 !== 'string' || b64 === '') return { ok: false, error: '没有 PDF 数据' }
      const raw = String(b64).replace(/^data:[^;]*;base64,/, '')
      const buf = Buffer.from(raw, 'base64')
      const tmp = path.join(os.tmpdir(), 'dsh-pdf-' + Date.now() + '-' + Math.floor(Math.random() * 1e6) + '.pdf')
      writeFileSync(tmp, buf)
      try {
        const ext = await this.runNode(extractPdfScript(), { DSH_F: tmp }, 120000)
        let pages = []
        try { pages = (JSON.parse((ext.stdout || '').trim().split(/\r?\n/).filter(Boolean).pop() || '{"pages":[]}')).pages || [] } catch (e) {}
        const hasText = pages.some((p) => (p.text || '').trim().length > 20)
        if (hasText) {
          return { ok: true, mode: 'text', pages: pages.map((p) => ({ page: p.page, text: (p.text || '').trim() })) }
        }
        if (!visionKey) return { ok: true, mode: 'scan-nokey', pages: [] }
        const outDir = path.join(os.tmpdir(), 'dsh-pdf-out-' + Date.now())
        const rnd = await this.runNode(renderPdfScript(), { DSH_F: tmp, DSH_OUT: outDir }, 240000)
        let count = 0
        try { count = (JSON.parse((rnd.stdout || '').trim().split(/\r?\n/).filter(Boolean).pop() || '{"count":0}')).count || 0 } catch (e) {}
        const imgs = []
        for (let i = 1; i <= count; i++) {
          const png = path.join(outDir, String(i) + '.png')
          let dataUrl = ''
          try { dataUrl = 'data:image/png;base64,' + readFileSync(png).toString('base64') } catch (e) {}
          if (dataUrl) imgs.push({ page: i, image: dataUrl })
        }
        try { for (let i = 1; i <= count; i++) unlinkSync(path.join(outDir, String(i) + '.png')) } catch (e) {}
        return { ok: true, mode: 'scan', pages: imgs }
      } finally {
        try { unlinkSync(tmp) } catch (e) {}
      }
    } catch (e) { return { ok: false, error: String((e && e.message) || e) } }
  }

  // 网页 Office 实时翻译第一步：只提取不翻译，返回逐段原文，客户端逐段翻译实时显示
  async officeProbe(args) {
    try {
      const b64 = args && args.file
      const filename = (args && args.filename) || 'document.docx'
      if (typeof b64 !== 'string' || b64 === '') return { ok: false, error: '没有文件数据' }
      const raw = String(b64).replace(/^data:[^;]*;base64,/, '')
      const tmp = path.join(os.tmpdir(), 'dsh-office-' + Date.now() + '-' + Math.floor(Math.random() * 1e6) + (path.extname(filename) || '.docx'))
      writeFileSync(tmp, Buffer.from(raw, 'base64'))
      try {
        const jz = JSZIP_ENTRY()
        const ext = await this.runNodeFile(OFFICE_MJS, ['extract', tmp, jz], {}, 120000)
        const parsed = JSON.parse((ext.stdout || '').trim().split(/\r?\n/).filter(Boolean).pop() || '{"chunks":[]}')
        const chunks = parsed.chunks || []
        if (chunks.length === 0) return { ok: false, error: '未能从文档中提取到文本（可能是纯图片或空文档）' }
        return { ok: true, type: parsed.type || 'docx', chunks }
      } finally {
        try { unlinkSync(tmp) } catch (e) {}
      }
    } catch (e) { return { ok: false, error: String((e && e.message) || e) } }
  }

  // 运行一个脚本文件（用于 office.mjs 等需要较大逻辑的辅助脚本）
  async runNodeFile(file, args, env, graceMs) {
    const subprocess = this.ctx.get('subprocess')
    if (!subprocess) return { stdout: '', stderr: 'subprocess 不可用' }
    const node = process.execPath
    const handle = subprocess.spawn({ argv: [node, file].concat(args), cwd: HOME, stdio: { stdin: 'ignore', stdout: { maxBytes: 1048576 }, stderr: { maxBytes: 262144 } }, graceMs: graceMs || 120000, env: env || {} })
    await handle.waitForExit()
    const stdout = handle.collected.stdout ? handle.collected.stdout.readFrom(0).text : ''
    const stderr = handle.collected.stderr ? handle.collected.stderr.readFrom(0).text : ''
    return { stdout, stderr }
  }

  // Office 文档（docx/xlsx/pptx）全文翻译：提取→翻译→回填，返回预览块+译文文件 base64
  async translateOffice(args) {
    try {
      const b64 = args && args.file
      const filename = (args && args.filename) || 'document.docx'
      if (typeof b64 !== 'string' || b64 === '') return { ok: false, error: '没有文件数据' }
      const credentials = this.ctx.get('credentials')
      const dsk = credentials ? await credentials.resolve('DEEPSEEK_API_KEY') : null
      if (!dsk || typeof dsk.value !== 'string' || dsk.value === '') return { ok: false, error: '未配置 DeepSeek API Key' }
      const raw = String(b64).replace(/^data:[^;]*;base64,/, '')
      const tmp = path.join(os.tmpdir(), 'dsh-office-' + Date.now() + '-' + Math.floor(Math.random() * 1e6) + (path.extname(filename) || '.docx'))
      writeFileSync(tmp, Buffer.from(raw, 'base64'))
      try {
        const jz = JSZIP_ENTRY()
        const ext = await this.runNodeFile(OFFICE_MJS, ['extract', tmp, jz], {}, 120000)
        const parsed = JSON.parse((ext.stdout || '').trim().split(/\r?\n/).filter(Boolean).pop() || '{"chunks":[]}')
        const chunks = parsed.chunks || []
        if (chunks.length === 0) return { ok: false, error: '未能从文档中提取到文本（可能是纯图片或空文档）' }
        const translated = []
        for (const c of chunks) {
          const tr = await this.translateText({ text: c.text })
          translated.push({ key: c.key, original: c.text, translated: tr.ok ? tr.text : '[翻译失败] ' + (tr.error || '') })
        }
        const chunksFile = tmp + '.chunks.json'
        writeFileSync(chunksFile, JSON.stringify(translated))
        const outName = '译文_' + path.basename(filename)
        const pkg = await this.runNodeFile(OFFICE_MJS, ['package', tmp, jz, chunksFile, outName], {}, 180000)
        const pkgParsed = JSON.parse((pkg.stdout || '').trim().split(/\r?\n/).filter(Boolean).pop() || '{}')
        try { unlinkSync(chunksFile) } catch (e) {}
        return { ok: true, chunks: translated, resultBase64: pkgParsed.base64 || '', outFilename: pkgParsed.outName || outName, type: parsed.type || 'docx' }
      } finally {
        try { unlinkSync(tmp) } catch (e) {}
      }
    } catch (e) { return { ok: false, error: String((e && e.message) || e) } }
  }

  // 用用户审核/修改后的译文重新回填生成文件
  async saveOffice(args) {
    try {
      const b64 = args && args.file
      const filename = (args && args.filename) || 'document.docx'
      const chunks = args && args.chunks
      if (typeof b64 !== 'string' || b64 === '') return { ok: false, error: '没有文件数据' }
      if (!Array.isArray(chunks)) return { ok: false, error: '没有译文数据' }
      const raw = String(b64).replace(/^data:[^;]*;base64,/, '')
      const tmp = path.join(os.tmpdir(), 'dsh-office-' + Date.now() + '-' + Math.floor(Math.random() * 1e6) + (path.extname(filename) || '.docx'))
      writeFileSync(tmp, Buffer.from(raw, 'base64'))
      try {
        const jz = JSZIP_ENTRY()
        const chunksFile = tmp + '.chunks.json'
        writeFileSync(chunksFile, JSON.stringify(chunks.map((c) => ({ key: c.key, translated: c.translated }))))
        const outName = '译文_' + path.basename(filename)
        const pkg = await this.runNodeFile(OFFICE_MJS, ['package', tmp, jz, chunksFile, outName], {}, 180000)
        const pkgParsed = JSON.parse((pkg.stdout || '').trim().split(/\r?\n/).filter(Boolean).pop() || '{}')
        try { unlinkSync(chunksFile) } catch (e) {}
        return { ok: true, resultBase64: pkgParsed.base64 || '', outFilename: pkgParsed.outName || outName }
      } finally {
        try { unlinkSync(tmp) } catch (e) {}
      }
    } catch (e) { return { ok: false, error: String((e && e.message) || e) } }
  }
}

export function apply(ctx) {
  try {
    const svc = new DshClientFeaturesService(ctx)
    svc.startTranslateServer().catch(() => {})
  } catch (e) {
    console.error('[dsh-static] apply FAILED: ' + ((e && e.stack) || e))
  }
}
