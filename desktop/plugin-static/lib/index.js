// 静态宿主插件：把原 host-body.js 的 RPC 方法迁到 TypertRemoteService，
// 用 src-json 宽松编解码，免编译器。权限门仍由 dsh-client-gate 提供，这里不含。
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { randomBytes, randomInt } from 'node:crypto'
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { TYPERT } from './typert.host.js'

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

// 视图模式：智谱 GLM 视觉模型（免费国产视觉模型，OpenAI 兼容接口）
const VISION_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
// 优先 glm-4.6v-flash，失败自动回退 glm-4v-flash（模型名随时可能调整）
const VISION_MODELS = ['glm-4.6v-flash', 'glm-4v-flash']
const VISION_MODEL = VISION_MODELS[0]
// 直接打开智谱开放平台首页（v3.0.3：/usercenter/apikeys 在部分环境 404，首页可进，用户从控制台找 API 入口）
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
      let cfg = {}
      try { cfg = JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) } catch (e) {}
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
    try { return JSON.parse(readFileSync(p, 'utf8')) } catch (e) { return {} }
  }

  async writeJsonFile(p, obj) {
    try { writeFileSync(p, JSON.stringify(obj), 'utf8') } catch (e) {}
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
    const k = args && args.key
    if (typeof k !== 'string') return { ok: false, error: '无效的 Key' }
    visionKey = k.trim()
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

  // 带模型回退的智谱视觉调用：依次尝试 VISION_MODELS，返回 { ok, model, text, error }
  async visionChat(content) {
    if (!visionKey) return { ok: false, error: '未配置智谱视觉 API Key：请先在「视图模式」页点「去官网申请」领免费 Key 并保存。' }
    let lastError = ''
    for (const model of VISION_MODELS) {
      try {
        const res = await fetch(VISION_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + visionKey }, body: JSON.stringify({ model: model, messages: [{ role: 'user', content: content }] }) })
        const text = await res.text()
        if (res.status === 200) {
          let out = ''
          try { const b = JSON.parse(text); out = (b.choices && b.choices[0] && b.choices[0].message && b.choices[0].message.content) || '' } catch (e) {}
          if (typeof out !== 'string') out = JSON.stringify(out)
          return { ok: true, model: model, text: out }
        }
        let msg = 'HTTP ' + res.status
        try { const b = JSON.parse(text); if (b && b.error && b.error.message) msg = String(b.error.message) } catch (e) {}
        lastError = model + ': ' + msg
        // 401/403 = 密钥问题，换模型也没用，直接返回
        if (res.status === 401 || res.status === 403) return { ok: false, error: msg }
      } catch (e) { lastError = model + ': ' + String((e && e.message) || e) }
    }
    return { ok: false, error: lastError || '所有视觉模型均连接失败' }
  }

  async testVision() {
    try {
      if (!visionKey) return { ok: false, error: '请先填写并保存智谱 API Key' }
      const r = await this.visionChat([{ type: 'text', text: 'ping' }])
      if (r.ok) return { ok: true, model: r.model }
      return { ok: false, error: r.error }
    } catch (e) { return { ok: false, error: String((e && e.message) || e) } }
  }

  async seeImage(args) {
    try {
      const image = args && args.image
      if (typeof image !== 'string' || image === '') return { ok: false, error: '没有图片数据' }
      const prompt = (args && args.prompt) || '请详细、准确地描述这张图片里的全部内容，包括文字、数字、图表和结构。'
      const r = await this.visionChat([{ type: 'image_url', image_url: { url: image } }, { type: 'text', text: prompt }])
      if (r.ok) return { ok: true, text: r.text, model: r.model }
      return { ok: false, error: r.error }
    } catch (e) { return { ok: false, error: String((e && e.message) || e) } }
  }

  async openVisionSite() {
    try {
      await this.runCmd(['start', '', VISION_SITE], 8000)
      return { ok: true }
    } catch (e) { return { ok: false, error: String((e && e.message) || e) } }
  }

  // 聊天附件解析：docx/xlsx/pptx/pdf/txt 等 → 提取文本，供前端附加到消息里随问题一起发送
  async parseAttachment(args) {
    try {
      const b64 = args && args.file
      const filename = (args && args.filename) || 'file'
      if (typeof b64 !== 'string' || b64 === '') return { ok: false, error: '没有文件数据' }
      const raw = String(b64).replace(/^data:[^;]*;base64,/, '')
      const ext = (path.extname(filename) || '').toLowerCase()
      const tmp = path.join(os.tmpdir(), 'dsh-att-' + Date.now() + '-' + Math.floor(Math.random() * 1e6) + ext)
      writeFileSync(tmp, Buffer.from(raw, 'base64'))
      try {
        if (ext === '.docx' || ext === '.xlsx' || ext === '.pptx') {
          const jz = JSZIP_ENTRY()
          const out = await this.runNodeFile(OFFICE_MJS, ['extract', tmp, jz], {}, 120000)
          const parsed = JSON.parse((out.stdout || '').trim().split(/\r?\n/).filter(Boolean).pop() || '{"chunks":[]}')
          const chunks = parsed.chunks || []
          const text = chunks.map((c) => c.text).join('\n')
          if (!text.trim()) return { ok: false, error: '未能从文档中提取到文本（可能是纯图片或空文档）' }
          return { ok: true, type: parsed.type || 'office', name: filename, text: text, chars: text.length }
        }
        if (ext === '.pdf') {
          const out = await this.runNode(extractPdfScript(), { DSH_F: tmp }, 120000)
          const pages = (JSON.parse((out.stdout || '').trim().split(/\r?\n/).filter(Boolean).pop() || '{"pages":[]}')).pages || []
          const text = pages.map((p) => p.text).join('\n')
          if (!text.trim()) return { ok: false, error: 'PDF 没有文字层（扫描版 PDF 请用「PDF 翻译」页的扫描识别功能）' }
          return { ok: true, type: 'pdf', name: filename, text: text, chars: text.length }
        }
        if (ext === '.txt' || ext === '.md' || ext === '.csv' || ext === '.json' || ext === '.log' || ext === '.js' || ext === '.ts' || ext === '.py' || ext === '.html' || ext === '.xml') {
          const text = readFileSync(tmp, 'utf8')
          return { ok: true, type: 'text', name: filename, text: text, chars: text.length }
        }
        return { ok: false, error: '暂不支持的文件类型：' + (ext || '未知') + '（支持 docx/xlsx/pptx/pdf/txt/csv/json 等；图片请直接拖入）' }
      } finally {
        try { unlinkSync(tmp) } catch (e) {}
      }
    } catch (e) { return { ok: false, error: String((e && e.message) || e) } }
  }

  // 聊天附件缓存：把拖入的文档存到本机（$DSH_HOME/attachments），返回本地路径，供 agent 读取
  async cacheAttachment(args) {
    try {
      const b64 = args && args.data
      const filename = (args && args.filename) || 'file'
      if (typeof b64 !== 'string' || b64 === '') return { ok: false, error: '没有文件数据' }
      const raw = String(b64).replace(/^data:[^;]*;base64,/, '')
      const dir = path.join(HOME, 'attachments')
      mkdirSync(dir, { recursive: true })
      const safe = path.basename(filename).replace(/[\\/:*?"<>|]/g, '_')
      const dest = path.join(dir, Date.now() + '-' + Math.floor(Math.random() * 1e6) + '_' + safe)
      writeFileSync(dest, Buffer.from(raw, 'base64'))
      // 记录到 index.json，供 agent 读取（agent 回答文件相关问题前先读这里找到文件）。不截断，保留全部有效记录。
      try {
        const idxFile = path.join(dir, 'index.json')
        let idx = []
        try { idx = JSON.parse(readFileSync(idxFile, 'utf8')) } catch (e) {}
        if (!Array.isArray(idx)) idx = []
        idx.push({ name: filename, path: dest, ts: Date.now() })
        writeFileSync(idxFile, JSON.stringify(idx, null, 2))
      } catch (e) {}
      return { ok: true, path: dest, name: filename }
    } catch (e) { return { ok: false, error: String((e && e.message) || e) } }
  }

  // 删除附件：点叉叉移除图标时，删除缓存文件 + 从 index.json 移除记录
  async deleteAttachment(args) {
    try {
      const p = args && args.path
      if (typeof p !== 'string' || !p) return { ok: false, error: '无效路径' }
      const dir = path.join(HOME, 'attachments')
      const norm = path.resolve(p)
      if (norm.indexOf(path.resolve(dir)) !== 0) return { ok: false, error: '非法路径' }
      try { unlinkSync(norm) } catch (e) {}
      try {
        const idxFile = path.join(dir, 'index.json')
        let idx = []
        try { idx = JSON.parse(readFileSync(idxFile, 'utf8')) } catch (e) {}
        if (!Array.isArray(idx)) idx = []
        idx = idx.filter((it) => path.resolve(it.path) !== norm)
        writeFileSync(idxFile, JSON.stringify(idx, null, 2))
      } catch (e) {}
      return { ok: true }
    } catch (e) { return { ok: false, error: String((e && e.message) || e) } }
  }

  // 手机远程信息：配对码 + 端口 + 本机局域网 IP（供客户端「手机远程」页展示）
  async getRemoteInfo() {
    const ips = []
    try {
      const nifs = os.networkInterfaces()
      for (const name in nifs) {
        const list = nifs[name] || []
        for (const n of list) if (n.family === 'IPv4' && !n.internal) ips.push(n.address)
      }
    } catch (e) {}
    return { ok: true, port: RC_PORT, code: rcCode, ips }
  }

  // 多轮对话：读取当前活动 agent 会话的消息流（用户消息 + 助手回复），供手机端展示完整对话
  async getChatMessages() {
    try {
      let events = []
      try { events = (latestAgent && latestAgent.session && latestAgent.session.events) || [] } catch (e) {}
      if (!events.length) {
        try {
          const sessions = this.ctx.get('sessions')
          if (sessions && typeof sessions.list === 'function') {
            const list = sessions.list()
            if (list && list.length) {
              const s = list[list.length - 1]
              if (s && s.events) events = s.events
            }
          }
        } catch (e) {}
      }
      const msgs = []
      for (const ev of events) {
        if (!ev || !ev.data) continue
        if (ev.type === 'user/message') {
          const parts = ev.data.content || []
          const txt = parts.map((c) => (c && typeof c.text === 'string') ? c.text : '').join(' ').trim()
          if (txt && txt.indexOf('【自动续跑检查】') !== 0) msgs.push({ role: 'user', text: txt })
        } else if (ev.type === 'assistant/message') {
          const parts = ev.data.content || []
          const txt = parts.map((c) => (c && typeof c.text === 'string') ? c.text : '').join(' ').trim()
          if (txt) msgs.push({ role: 'assistant', text: txt })
        }
      }
      return { ok: true, messages: msgs }
    } catch (e) { return { ok: false, error: String((e && e.message) || e) } }
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

// 本地 RPC HTTP 服务：client 端直接 fetch 本服务，绕开 typert/gateway 的注册问题。
// 端口按实例隔离：默认 3192（web 端口 3180 的实例）；测试实例可用 DSH_LOCAL_RPC_PORT 覆盖，避免多实例冲突。
const LOCAL_RPC_PORT = Number(process.env.DSH_LOCAL_RPC_PORT) || 3192
function startLocalRpc(svc) {
  try {
    const server = createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
      if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }
      if (req.method !== 'POST') { res.writeHead(405, { 'Content-Type': 'application/json' }); res.end('{"ok":false,"error":"method"}'); return }
      let body = ''
      req.on('data', (c) => { body += c; if (body.length > 60e6) req.destroy() })
      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body || '{}')
          const method = parsed && parsed.method
          const fn = method && typeof svc[method] === 'function' ? svc[method] : null
          if (!fn) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: 'unknown method: ' + method })); return }
          const result = await fn.call(svc, parsed.args)
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(result))
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: false, error: String((e && e.message) || e) }))
        }
      })
    })
    server.listen(LOCAL_RPC_PORT, '127.0.0.1')
    console.log('[dsh-static] local rpc server: http://127.0.0.1:' + LOCAL_RPC_PORT)
  } catch (e) { console.error('[dsh-static] local rpc server failed: ' + ((e && e.message) || e)) }
}

// ===== 远程控制服务（手机 App，端口 3191）=====
// 功能：配对码认证（6位）→ 手机发指令给电脑 agent 执行 → agent 把结果写 remote-reply.txt → 手机轮询读取；
//       文件浏览/下载（找电脑文件传手机）。局域网直连 + Tailscale 跨网（WireGuard 加密，免费私密）。
const RC_PORT = Number(process.env.DSH_REMOTE_PORT) || 3191
let rcCode = ''
let rcToken = ''
let latestAgent = null
function rcReplyFile() { return path.join(HOME, 'remote-reply.txt') }
function rcInboxFile() { return path.join(HOME, 'remote-inbox.txt') }
function rcJson(res, obj, code) {
  res.writeHead(code || 200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(obj))
}
function rcListDir(dir) {
  try {
    const target = dir && String(dir).trim() ? dir : os.homedir()
    const safe = path.resolve(target)
    const entries = readdirSync(safe).map((name) => {
      const full = path.join(safe, name)
      let isDir = false, size = 0
      try { const st = statSync(full); isDir = st.isDirectory(); size = st.size } catch (e) {}
      return { name, path: full, isDir, size }
    }).sort((a, b) => (b.isDir - a.isDir) || a.name.localeCompare(b.name))
    return { ok: true, path: safe, entries }
  } catch (e) { return { ok: false, error: String((e && e.message) || e) } }
}
function rcSendFile(res, file) {
  try {
    const safe = path.resolve(file || '')
    const st = statSync(safe)
    if (st.isDirectory()) return rcJson(res, { ok: false, error: '是目录' })
    res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': st.size, 'Content-Disposition': 'attachment; filename*=UTF-8\'\'' + encodeURIComponent(path.basename(safe)) })
    res.end(readFileSync(safe))
  } catch (e) { return rcJson(res, { ok: false, error: String((e && e.message) || e) }, 404) }
}
function startRemoteControl(ctx, svc) {
  try {
    rcCode = String(randomInt(100000, 999999))
    const tokenFile = path.join(HOME, 'remote-token.json')
    try { if (existsSync(tokenFile)) { rcToken = (JSON.parse(readFileSync(tokenFile, 'utf8')).token) || '' } } catch (e) {}
    if (!rcToken) { rcToken = randomBytes(24).toString('hex'); try { writeFileSync(tokenFile, JSON.stringify({ token: rcToken })) } catch (e) {} }
    ctx.on('agent/created', (carrier, ev) => { try { if (ev && ev.agent) latestAgent = ev.agent } catch (e) {} })
    const server = createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
      if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }
      const url = new URL(req.url, 'http://127.0.0.1')
      const api = url.pathname
      let body = ''
      req.on('data', (c) => { body += c; if (body.length > 60e6) req.destroy() })
      req.on('end', async () => {
        let parsed = {}
        try { parsed = body ? JSON.parse(body) : {} } catch (e) {}
        const token = parsed.token || url.searchParams.get('token') || ''
        try {
          // 手机网页静态文件（PWA）：http://IP:3191 或 /mobile 都进网页（根路径避免弹「未授权」JSON）
          let staticPath = api
          if (staticPath === '/' || staticPath === '/mobile' || staticPath === '/mobile/') staticPath = '/mobile/index.html'
          if (staticPath.indexOf('/mobile/') === 0) {
            const rel = staticPath.slice('/mobile/'.length) || 'index.html'
            const mime = rel.endsWith('.html') ? 'text/html; charset=utf-8' : rel.endsWith('.json') ? 'application/json' : rel.endsWith('.png') ? 'image/png' : 'application/octet-stream'
            const file = path.join(PLUGIN_DIR, '..', 'mobile', 'web', rel)
            if (existsSync(file) && !rel.includes('..')) { res.writeHead(200, { 'Content-Type': mime }); res.end(readFileSync(file)); return }
            return rcJson(res, { ok: false, error: 'not found' }, 404)
          }
          if (api === '/api/status') return rcJson(res, { ok: true, version: '5.0.0', paired: !!rcCode })
          if (api === '/api/pair') {
            if (parsed.code === rcCode) return rcJson(res, { ok: true, token: rcToken })
            return rcJson(res, { ok: false, error: '配对码错误' }, 401)
          }
          if (token !== rcToken || !rcToken) return rcJson(res, { ok: false, error: '未授权' }, 401)
          if (api === '/api/chat/send') {
            const text = String(parsed.text || '')
            if (!text.trim()) return rcJson(res, { ok: false, error: '消息为空' })
            // 多轮对话：手机消息作为普通用户消息注入活动 agent 会话（原文），agent 回复也留在会话里，
            // 手机端通过 getChatMessages 读完整对话流，实现连续对话。
            if (latestAgent && typeof latestAgent.inject === 'function') {
              latestAgent.inject(createUserMessage({
                content: [{ type: 'text', text: text }],
                source: { kind: 'plugin', plugin: 'dsh-client-static' }
              }))
              return rcJson(res, { ok: true, delivered: true })
            }
            writeFileSync(rcInboxFile(), text)
            return rcJson(res, { ok: true, delivered: false, error: '电脑端无活动会话，暂存于收件箱' })
          }
          if (api === '/api/chat/poll') {
            let reply = ''
            try { if (existsSync(rcReplyFile())) reply = readFileSync(rcReplyFile(), 'utf8') } catch (e) {}
            return rcJson(res, { ok: true, reply })
          }
          if (api === '/api/files/list') return rcJson(res, rcListDir(parsed.path))
          if (api === '/api/files/download') return rcSendFile(res, parsed.path)
          // 通用 RPC 转发（token 已认证）：手机端余额/用量/设置/多轮对话等走这里，避免直接暴露 3192
          if (api === '/api/rpc') {
            const method = parsed.method
            const fn = svc && typeof svc[method] === 'function' ? svc[method] : null
            if (!fn) return rcJson(res, { ok: false, error: 'unknown method: ' + method }, 404)
            const result = await fn.call(svc, parsed.args)
            return rcJson(res, result)
          }
          return rcJson(res, { ok: false, error: 'unknown api: ' + api }, 404)
        } catch (e) { return rcJson(res, { ok: false, error: String((e && e.message) || e) }, 500) }
      })
    })
    server.listen(RC_PORT, '0.0.0.0')
    console.log('[dsh-static] remote control server: http://0.0.0.0:' + RC_PORT + ' (pair code ready)')
  } catch (e) { console.error('[dsh-static] remote control server failed: ' + ((e && e.message) || e)) }
}

// 自动续跑断点：新会话创建时，若 CURRENT_TASK.md 有未完成任务，注入提示，agent 汇报并等用户确认继续
const CHECKPOINT_FILE = path.join('G:', 'dsh客户端', 'CURRENT_TASK.md')
function applyCheckpointInjection(ctx) {
  try {
    ctx.on('agent/created', (carrier, ev) => {
      try {
        const agent = ev && ev.agent
        if (!agent || typeof agent.inject !== 'function') return
        if (!existsSync(CHECKPOINT_FILE)) return
        const raw = readFileSync(CHECKPOINT_FILE, 'utf8') || ''
        const text = raw.trim()
        if (!text) return
        // 无任务/已完成 状态不注入
        if (/^#\s*状态[:：]\s*(无任务|已完成)/m.test(text)) return
        const lines = text.split('\n')
        const summary = lines.slice(0, 14).join('\n')
        agent.inject(createUserMessage({
          content: [{ type: 'text', text: '【自动续跑检查】检测到上次任务断点（' + CHECKPOINT_FILE + '）：\n' + summary + '\n—— 请先向用户汇报断点内容；用户说「继续」时读取完整断点接着完成，否则先询问是否需要继续。' }],
          source: { kind: 'plugin', plugin: 'dsh-client-static' }
        }))
      } catch (e) {}
    })
  } catch (e) { console.error('[dsh-static] checkpoint injection failed: ' + String((e && e.message) || e)) }
}

// 启动时清理超过 7 天的旧附件缓存（文件 + index.json 记录）
function cleanupOldAttachments() {
  try {
    const dir = path.join(HOME, 'attachments')
    if (!existsSync(dir)) return
    const now = Date.now()
    const sevenDays = 7 * 24 * 3600 * 1000
    const names = readdirSync(dir)
    for (const n of names) {
      if (n === 'index.json') continue
      const full = path.join(dir, n)
      try {
        const st = statSync(full)
        if (now - st.mtimeMs > sevenDays) unlinkSync(full)
      } catch (e) {}
    }
    const idxFile = path.join(dir, 'index.json')
    let idx = []
    try { idx = JSON.parse(readFileSync(idxFile, 'utf8')) } catch (e) {}
    if (!Array.isArray(idx)) idx = []
    const keep = idx.filter((it) => it.ts && (now - it.ts) <= sevenDays)
    writeFileSync(idxFile, JSON.stringify(keep, null, 2))
  } catch (e) {}
}

export function apply(ctx) {
  try {
    const svc = new DshClientFeaturesService(ctx)
    startLocalRpc(svc)
    applyCheckpointInjection(ctx)
    startRemoteControl(ctx, svc)
    cleanupOldAttachments()
    // agent 系统提示：拖入的文档附件缓存位置 + 回答前先读文件
    try {
      ctx.inject(["systemPrompt"], (scope) => {
        scope.systemPrompt.context({
          name: "dsh-attachments",
          order: 300,
          text: () => "用户拖入对话框的文档附件（docx/xlsx/pptx/pdf/txt 等）会缓存在 " + path.join(HOME, 'attachments') + " 目录，其中 index.json 的每个条目是 {name: 原始文件名, path: 本地路径}。当用户消息中出现「【附件】文件名」时，必须先读取该目录的 index.json，按 name 字段找到对应文件的 path，再用文件读取工具读取该文件内容，然后基于文件内容回答用户问题；不要凭空猜测文件内容，也不要把路径展示给用户。"
        })
      })
    } catch (e) { console.error('[dsh-static] attachment prompt inject failed: ' + ((e && e.message) || e)) }
  } catch (e) {
    console.error('[dsh-static] apply FAILED: ' + ((e && e.stack) || e))
  }
}
