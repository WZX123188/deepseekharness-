// Electron 主进程：原生客户端（图标/托盘/单实例/开机自启/全局热键/弹窗置顶）
const { app, BrowserWindow, Tray, Menu, nativeImage, globalShortcut } = require('electron')
const { spawn } = require('child_process')
const http = require('http')
const fs = require('fs')
const os = require('os')
const path = require('path')

// 优先用打包进去的 Node 运行时，缺失时回退到系统 Node
const BUNDLED_NODE = path.join(__dirname, 'node', 'node.exe')
const NODE = fs.existsSync(BUNDLED_NODE) ? BUNDLED_NODE : 'C:\\Program Files\\nodejs\\node.exe'
const DSH_BIN = path.join(process.env.APPDATA || 'C:\\Users\\WZX\\AppData\\Roaming', 'npm', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
const NPM_CLI = path.join(__dirname, 'node', 'node_modules', 'npm', 'bin', 'npm-cli.js')
const PORT = 3180
const BASE = 'http://127.0.0.1:' + PORT
const MARKER = path.join(os.tmpdir(), 'dsh-question-pending')
const ICON = path.join(__dirname, 'icon.ico')

let dshProc = null
let win = null
let tray = null
let quitting = false
let autoPinned = false

app.setAppUserModelId('com.dsh.client')
app.setName('DeepSeek Harness')
// 内存优化：纯文本聊天界面不需要 GPU 加速，关闭可显著降低 GPU 进程内存占用
app.disableHardwareAcceleration()
// 限制渲染进程数为 1（本应用只有一个窗口，避免 Chromium 多开渲染进程）
app.commandLine.appendSwitch('renderer-process-limit', '1')
// 开机自启（默认开启，托盘菜单可关）
app.setLoginItemSettings({ openAtLogin: true })

function waitForServer(cb, tries) {
  tries = tries || 80
  if (tries <= 0) return cb(new Error('dsh 启动超时（端口 ' + PORT + '）'))
  const req = http.get(BASE + '/', function (res) { res.resume(); cb(null) })
  req.on('error', function () { setTimeout(function () { waitForServer(cb, tries - 1) }, 500) })
  req.setTimeout(2000, function () { req.destroy() })
}

function startDsh() {
  const logFd = fs.openSync(path.join(__dirname, 'dsh.log'), 'a')
  dshProc = spawn(NODE, [DSH_BIN, 'web', '--port', String(PORT)], {
    cwd: 'C:\\Users\\WZX',
    stdio: ['ignore', logFd, logFd],
    env: process.env,
    windowsHide: true,
  })
  dshProc.on('exit', function () { dshProc = null })
}

// 首次运行：若核心组件（DSH）未安装，用内置 Node/npm 自动安装（走国内镜像）
function ensureDsh(cb) {
  if (fs.existsSync(DSH_BIN)) return cb(null)
  console.log('[dsh-client] 首次运行：正在安装核心组件（需联网，约 1-2 分钟）…')
  let proc
  try {
    proc = spawn(NODE, [NPM_CLI, 'install', '-g', '@deepseek-ai/dsh', '--registry', 'https://registry.npmmirror.com'], {
      cwd: 'C:\\Users\\WZX',
      stdio: 'ignore',
      env: process.env,
      windowsHide: true,
    })
  } catch (e) { return cb(e) }
  proc.on('exit', function (code) {
    if (code === 0 && fs.existsSync(DSH_BIN)) cb(null)
    else cb(new Error('核心组件安装失败（code ' + code + '）'))
  })
  proc.on('error', function (e) { cb(e) })
}

// 首次运行：把内置的功能插件装进用户 profile，并写挂载补丁
function ensureFeatures(cb) {
  try {
    const home = process.env.USERPROFILE || 'C:\\Users\\WZX'
    const profileDir = path.join(home, '.dsh', 'profiles', 'web')
    const bootSrc = path.join(__dirname, 'boot')
    const bootDst = path.join(profileDir, 'node_modules', 'dsh-client-boot')
    fs.mkdirSync(bootDst, { recursive: true })
    const files = ['package.json', 'index.js', 'host-body.js', 'client-body.js']
    for (let i = 0; i < files.length; i++) {
      const s = path.join(bootSrc, files[i])
      if (fs.existsSync(s)) fs.copyFileSync(s, path.join(bootDst, files[i]))
    }
    // 把「神奇小开关」preset 装进用户 agent-presets 根（纯配置文件，非插件）
    const presetsSrc = path.join(__dirname, 'presets')
    const presetsDst = path.join(home, '.dsh', '.agent-presets')
    if (fs.existsSync(presetsSrc)) {
      const names = fs.readdirSync(presetsSrc)
      for (let i = 0; i < names.length; i++) {
        const srcDir = path.join(presetsSrc, names[i])
        const dstDir = path.join(presetsDst, names[i])
        if (!fs.statSync(srcDir).isDirectory()) continue
        fs.mkdirSync(dstDir, { recursive: true })
        const pFiles = fs.readdirSync(srcDir)
        for (let j = 0; j < pFiles.length; j++) {
          const s = path.join(srcDir, pFiles[j])
          if (fs.statSync(s).isFile()) fs.copyFileSync(s, path.join(dstDir, pFiles[j]))
        }
      }
    }
    const pkgPath = path.join(profileDir, 'package.json')
    if (!fs.existsSync(pkgPath)) {
      fs.mkdirSync(profileDir, { recursive: true })
      fs.writeFileSync(pkgPath, JSON.stringify({ name: 'dsh-profile-web', private: true, dependencies: {}, dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'] } } }, null, 2))
    }
    fs.writeFileSync(path.join(profileDir, 'cordis.patch.yml'), '- insert:\n    - id: dsh-client-boot\n      name: dsh-client-boot\n')
    cb(null)
  } catch (e) { cb(e) }
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
    title: 'DeepSeek Harness',
    icon: ICON,
    backgroundColor: '#ffffff',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })
  win.loadURL(BASE)
  win.on('close', function (e) {
    if (!quitting) { e.preventDefault(); win.hide() }
  })
  win.on('closed', function () { win = null })
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
  tray.setToolTip('DeepSeek Harness')
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
    createTray()
    try { globalShortcut.register('CommandOrControl+Alt+D', function () { toggleWin() }) } catch (e) {}
    ensureDsh(function (err) {
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
          createWindow()
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
