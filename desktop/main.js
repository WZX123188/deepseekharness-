// Electron 主进程：完全独立的原生客户端
// 关键：内置 DSH 运行时 + DSH_HOME 数据隔离，绝不触碰用户全局 npm 和 ~/.dsh。
const { app, BrowserWindow, Tray, Menu, nativeImage, globalShortcut } = require('electron')
const { spawn, execFileSync } = require('child_process')
const http = require('http')
const fs = require('fs')
const os = require('os')
const path = require('path')

// 必须先于 getPath('userData') 设置：强制界面中文 + 应用名（决定用户数据目录名）
app.commandLine.appendSwitch('lang', 'zh-CN')
// 单实例锁 + 应用名：测试环境用 DSH_CLIENT_APP_ID 换一个 id，避免跟正在运行的正式客户端抢单实例锁。
app.setAppUserModelId(process.env.DSH_CLIENT_APP_ID || 'com.dsh.client')
app.setName('DeepSeekClient')

// 资源根目录：打包后（app.isPackaged）用 extraResources 拷到 resources/，
// 开发模式（electron .）直接用 __dirname。spawn 必须用真实磁盘路径。
const APP_DIR = app.isPackaged ? process.resourcesPath : __dirname
// 可执行文件所在目录：便携模式下数据放在它下面；安装模式下只是用于探测 portable.dat。
const EXE_DIR = app.isPackaged ? path.dirname(process.resourcesPath) : __dirname

// ---- 数据目录与隔离 ----
// 便携版（zip 绿色版）根目录带 portable.dat 标记，数据放 <程序目录>\data\，随文件夹走，可拷 U 盘。
// 安装版无标记，数据放 %APPDATA%\DeepSeekClient（标准用户数据目录）。
const PORTABLE_MARKER = path.join(EXE_DIR, 'portable.dat')
const IS_PORTABLE = fs.existsSync(PORTABLE_MARKER)
const DATA_DIR = IS_PORTABLE ? path.join(EXE_DIR, 'data') : app.getPath('userData')
if (IS_PORTABLE) app.setPath('userData', DATA_DIR) // 让 cookie/cache/localStorage 也随便携目录走
// DSH 的家目录：DSH 内核通过 DSH_HOME 环境变量决定数据落点，与用户 ~/.dsh 完全隔离。
const DSH_HOME = path.join(DATA_DIR, '.dsh')

// ---- 内置运行时 ----
const BUNDLED_NODE = path.join(APP_DIR, 'node', 'node.exe')
const NODE = fs.existsSync(BUNDLED_NODE) ? BUNDLED_NODE : 'C:\\Program Files\\nodejs\\node.exe'
const BUNDLED_DSH_BIN = path.join(APP_DIR, 'dsh-runtime', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')

// 端口：测试环境用 DSH_CLIENT_PORT 换端口（如 3190），避免跟正式客户端抢 3180。
const PORT = Number(process.env.DSH_CLIENT_PORT) || 3180
const BASE = 'http://127.0.0.1:' + PORT
const MARKER = path.join(DSH_HOME, 'question-pending') // 权限询问置顶信号，隔离到本实例
const ICON = path.join(APP_DIR, 'icon.ico')

// 启动加载页：启动后立即显示，避免「点了没反应 / 黑屏干等」
const LOADING_HTML = [
  '<!doctype html><html><head><meta charset="utf-8"><style>',
  'html,body{margin:0;height:100%;background:#fff;color:#333;font-family:system-ui,"Microsoft YaHei",sans-serif;display:flex;align-items:center;justify-content:center}',
  '.box{text-align:center}.t{font-size:18px;font-weight:600}',
  '.s{margin-top:14px;color:#999;font-size:13px}',
  '.dot{display:inline-block;width:8px;height:8px;margin:0 3px;border-radius:50%;background:#4a6cf7;animation:bl 1.2s infinite}',
  '.dot:nth-child(2){animation-delay:.2s}.dot:nth-child(3){animation-delay:.4s}',
  '@keyframes bl{0%,100%{opacity:.2}50%{opacity:1}}',
  '</style></head><body><div class="box"><div class="t">正在启动 DeepSeekClient…</div>',
  '<div class="s"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>',
  '<div class="s">首次启动会初始化运行环境，请稍候</div></div></body></html>'
].join('')

let dshProc = null
let win = null
let tray = null
let quitting = false
let autoPinned = false

// 开机自启（默认开启，托盘菜单可关）
app.setLoginItemSettings({ openAtLogin: true })

function waitForServer(cb, tries) {
  tries = tries || 80
  if (tries <= 0) return cb(new Error('dsh 启动超时（端口 ' + PORT + '）'))
  const req = http.get(BASE + '/', function (res) { res.resume(); cb(null) })
  req.on('error', function () { setTimeout(function () { waitForServer(cb, tries - 1) }, 500) })
  req.setTimeout(2000, function () { req.destroy() })
}

function sleepSync(ms) {
  try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms) } catch (e) {}
}

// 启动前清掉上一次异常退出留下的「孤儿后端」：它可能还占着 3180 端口。
// 本客户端是单实例，能走到这里说明没有别的正常实例在跑，3180 上的 node 必是残留。
function freePort() {
  try {
    const re = new RegExp('TCP\\s+127\\.0\\.0\\.1:' + PORT + '\\s+[^\\s]+\\s+LISTENING\\s+(\\d+)', 'i')
    const out = execFileSync('netstat', ['-ano', '-p', 'tcp'], { encoding: 'utf8', windowsHide: true, timeout: 5000 })
    const m = out.match(re)
    if (!m || !m[1]) return
    const pid = parseInt(m[1], 10)
    if (!pid || pid === process.pid) return
    // 只杀 node.exe（dsh 后端），避免误杀占用同端口的其它程序
    const tl = execFileSync('tasklist', ['/FI', 'PID eq ' + pid, '/FO', 'CSV', '/NH'], { encoding: 'utf8', windowsHide: true, timeout: 5000 })
    if (!/node\.exe/i.test(tl)) return
    try { execFileSync('taskkill', ['/F', '/PID', String(pid)], { windowsHide: true, timeout: 8000 }) } catch (e) {}
    sleepSync(1200)  // 等端口释放
  } catch (e) {}
}

function startDsh() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }) } catch (e) {}
  const logPath = path.join(DATA_DIR, 'dsh.log')
  const logFd = fs.openSync(logPath, 'a')
  dshProc = spawn(NODE, [BUNDLED_DSH_BIN, 'web', '--port', String(PORT)], {
    cwd: DATA_DIR,
    stdio: ['ignore', logFd, logFd],
    env: Object.assign({}, process.env, { DSH_HOME: DSH_HOME }),
    windowsHide: true,
  })
  dshProc.on('error', function (e) {
    try { fs.appendFileSync(logPath, '[dsh-client] dsh 启动失败: ' + (e && e.message || e) + '\n') } catch (_) {}
  })
  dshProc.on('exit', function () { dshProc = null })
}

// 检查内置 DSH 运行时是否完整（打包时已随 app 一起装好，不再全局安装）
function ensureRuntime(cb) {
  if (fs.existsSync(BUNDLED_DSH_BIN)) return cb(null)
  cb(new Error('内置 DSH 运行时缺失，安装包损坏：' + BUNDLED_DSH_BIN))
}

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true })
  const names = fs.readdirSync(src)
  for (let i = 0; i < names.length; i++) {
    const s = path.join(src, names[i])
    const d = path.join(dst, names[i])
    const st = fs.statSync(s)
    if (st.isDirectory()) copyDir(s, d)
    else fs.copyFileSync(s, d)
  }
}

// 首次运行：把功能插件装进【隔离的】DSH_HOME，并写挂载补丁。绝不写 ~/.dsh。
function ensureFeatures(cb) {
  try {
    const profileDir = path.join(DSH_HOME, 'profiles', 'web')

    // 1) 权限门（读取放行 / G盘放行 / 写改删需勾选同意）
    const gateSrc = path.join(APP_DIR, 'gate')
    if (fs.existsSync(gateSrc)) copyDir(gateSrc, path.join(profileDir, 'node_modules', 'dsh-client-gate'))

    // 2) 静态功能插件（余额/用量/更新/市场/项目/意见区/使用指南 UI）
    const staticSrc = path.join(APP_DIR, 'plugin-static')
    if (fs.existsSync(staticSrc)) copyDir(staticSrc, path.join(profileDir, 'node_modules', 'dsh-client-static'))

    // 3) 神奇小开关 preset 装进用户 agent-presets 根（纯配置文件，非插件）
    const presetsSrc = path.join(APP_DIR, 'presets')
    const presetsDst = path.join(DSH_HOME, '.agent-presets')
    if (fs.existsSync(presetsSrc)) {
      const names = fs.readdirSync(presetsSrc)
      for (let i = 0; i < names.length; i++) {
        const srcDir = path.join(presetsSrc, names[i])
        if (!fs.statSync(srcDir).isDirectory()) continue
        copyDir(srcDir, path.join(presetsDst, names[i]))
      }
    }

    // 4) profile 清单（与官方 initProfile 的 web 模板一致）
    const pkgPath = path.join(profileDir, 'package.json')
    if (!fs.existsSync(pkgPath)) {
      fs.mkdirSync(profileDir, { recursive: true })
      fs.writeFileSync(pkgPath, JSON.stringify({ name: 'dsh-profile-web', private: true, dependencies: {}, dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'] } } }, null, 2))
    }
    // 5) 挂载补丁：首次写基础补丁（权限门 + 静态插件）；之后由插件管理（含 MCP 市场条目），不覆盖
    const patchPath = path.join(profileDir, 'cordis.patch.yml')
    if (!fs.existsSync(patchPath)) {
      fs.writeFileSync(patchPath, '- insert:\n    - id: dsh-client-gate\n      name: dsh-client-gate\n    - id: dsh-client-static\n      name: dsh-client-static\n')
    }
    // 6) pnpm workspace（供后续 dsh plugin 安装外置插件用）
    const wsPath = path.join(profileDir, 'pnpm-workspace.yaml')
    if (!fs.existsSync(wsPath)) fs.writeFileSync(wsPath, 'packages:\n  - .\n\nnodeLinker: hoisted\nautoInstallPeers: false\n')

    cb(null)
  } catch (e) { cb(e) }
}

// 放行手机远程访问端口（TCP 入站）。手机连不上常见原因是防火墙拦截；非管理员时静默跳过。
function allowFirewall() {
  try {
    const rules = [
      ['DSH-Web-3180', '3180'],
      ['DSH-Remote-3191', '3191'],
      ['DSH-Rpc-3192', '3192'],
    ]
    for (const [name, port] of rules) {
      try { execFileSync('netsh', ['advfirewall', 'firewall', 'delete', 'rule', 'name=' + name], { windowsHide: true, timeout: 8000 }) } catch (e) {}
      try { execFileSync('netsh', ['advfirewall', 'firewall', 'add', 'rule', 'name=' + name, 'dir=in', 'action=allow', 'protocol=TCP', 'localport=' + port], { windowsHide: true, timeout: 8000 }) } catch (e) {}
    }
  } catch (e) {}
}

function showWin() {
  if (!win || win.isDestroyed()) return
  win.show()
  win.focus()
}

function toggleWin() {
  if (win && win.isVisible()) win.hide()
  else showWin()
}

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 820,
    title: 'DeepSeekClient',
    icon: ICON,
    backgroundColor: '#ffffff',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })
  win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(LOADING_HTML))
  win.on('close', function (e) {
    if (!quitting) { e.preventDefault(); win.hide() }
  })
  win.on('closed', function () { win = null })
}

// 后端就绪后，把加载页切换成真正的界面
function loadApp() {
  if (win && !win.isDestroyed()) win.loadURL(BASE)
}

function refreshTrayMenu() {
  if (!tray) return
  const autoStart = app.getLoginItemSettings().openAtLogin
  const alwaysOnTop = win ? win.isAlwaysOnTop() : false
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '显示 / 隐藏', click: function () { toggleWin() } },
    { type: 'separator' },
    { label: '窗口置顶', type: 'checkbox', checked: alwaysOnTop, click: function (item) { if (win) win.setAlwaysOnTop(item.checked) } },
    { label: '开机自启', type: 'checkbox', checked: autoStart, click: function (item) { app.setLoginItemSettings({ openAtLogin: item.checked }) } },
    { type: 'separator' },
    { label: '退出', click: function () { quitting = true; app.quit() } },
  ]))
}

function createTray() {
  const img = nativeImage.createFromPath(ICON)
  tray = new Tray(img.resize({ width: 16, height: 16 }))
  tray.setToolTip('DeepSeekClient')
  refreshTrayMenu()
  tray.on('click', function () { toggleWin() })
}

// 每 500ms 检查「待处理问题」标记：只在标记从无到有时置顶聚焦一次，从有到无时还原
let wasPending = false
function pollMarker() {
  setInterval(function () {
    if (!win || win.isDestroyed()) return
    let pending = false
    try { pending = fs.existsSync(MARKER) } catch (e) { pending = false }
    if (pending && !wasPending) {
      if (!win.isAlwaysOnTop()) { win.setAlwaysOnTop(true); autoPinned = true }
      win.show()
      win.focus()
    } else if (!pending && wasPending) {
      if (autoPinned) { win.setAlwaysOnTop(false); autoPinned = false }
    }
    wasPending = pending
  }, 500)
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', function () { showWin() })

  app.whenReady().then(function () {
    Menu.setApplicationMenu(null)  // 去掉顶部 File/Edit 菜单栏
    try { fs.unlinkSync(MARKER) } catch (e) {}  // 清残留标记，防止启动即置顶
    allowFirewall()  // 放行手机远程访问端口（非管理员静默失败）
    createTray()
    try { globalShortcut.register('CommandOrControl+Alt+D', function () { toggleWin() }) } catch (e) {}

    createWindow()  // 立即显示「正在启动…」窗口，不再黑屏干等
    freePort()      // 清掉残留后端，解决端口占用

    ensureRuntime(function (err) {
      if (err) {
        console.error('[dsh-client] ' + (err && err.message || err))
        app.quit()
        return
      }
      ensureFeatures(function (err2) {
        if (err2) {
          console.error('[dsh-client] ' + (err2 && err2.message || err2))
          app.quit()
          return
        }
        startDsh()
        waitForServer(function (e3) {
          if (e3) {
            console.error('[dsh-client] ' + e3.message)
            app.quit()
            return
          }
          loadApp()   // 后端就绪，切到真正的界面
          pollMarker()
        })
      })
    })
  })

  app.on('window-all-closed', function () { /* 常驻托盘 */ })

  app.on('before-quit', function () { quitting = true })
  app.on('will-quit', function () { globalShortcut.unregisterAll() })

  app.on('quit', function () {
    if (dshProc) { try { dshProc.kill() } catch (e) {} }
  })
}
