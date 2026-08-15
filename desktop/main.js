// Electron 主进程：原生客户端（图标/托盘/单实例/开机自启/全局热键/弹窗置顶）
const { app, BrowserWindow, Tray, Menu, nativeImage, globalShortcut } = require('electron')
const { spawn } = require('child_process')
const http = require('http')
const fs = require('fs')
const os = require('os')
const path = require('path')

const NODE = 'C:\\Program Files\\nodejs\\node.exe'
const DSH_BIN = 'C:\\Users\\WZX\\AppData\\Roaming\\npm\\node_modules\\@deepseek-ai\\dsh\\lib\\bin.js'
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
  dshProc = spawn(NODE, [DSH_BIN, 'web', '--port', String(PORT)], {
    cwd: 'C:\\Users\\WZX',
    stdio: 'ignore',
    env: process.env,
  })
  dshProc.on('exit', function () { dshProc = null })
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

// 每 500ms 检查「待处理问题」标记：存在则置顶+聚焦，不存在则还原（仅还原本插件自动置顶，不干扰手动置顶）
function pollMarker() {
  setInterval(function () {
    if (!win || win.isDestroyed()) return
    let pending = false
    try { pending = fs.existsSync(MARKER) } catch (e) { pending = false }
    if (pending) {
      if (!win.isAlwaysOnTop()) { win.setAlwaysOnTop(true); autoPinned = true }
      win.show()
      win.focus()
    } else {
      if (autoPinned) { win.setAlwaysOnTop(false); autoPinned = false }
    }
  }, 500)
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', function () { showWin() })

  app.whenReady().then(function () {
    startDsh()
    createTray()
    try { globalShortcut.register('CommandOrControl+Alt+D', function () { toggleWin() }) } catch (e) {}
    waitForServer(function (err) {
      if (err) {
        console.error('[dsh-client] ' + err.message)
        app.quit()
        return
      }
      createWindow()
      pollMarker()
    })
  })

  app.on('window-all-closed', function () { /* 常驻托盘 */ })

  app.on('before-quit', function () { quitting = true })
  app.on('will-quit', function () { globalShortcut.unregisterAll() })

  app.on('quit', function () {
    if (dshProc) { try { dshProc.kill() } catch (e) {} }
  })
}
