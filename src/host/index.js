// DSH 客户端 —— 宿主侧入口（合并：权限门 + 余额 + 更新）
// 说明：动态插件环境不可 import，故全部内联；正式 npm 包可直接引用本文件。

// ===== 权限门 =====
const SHELL_MUTATION = new RegExp(
  '\\b(Remove-Item|del|erase|rm|rd|rmdir|Set-Content|Add-Content|Out-File|' +
  'New-Item|mkdir|md|Move-Item|Rename-Item|ren|Copy-Item|copy|ni|ri|' +
  'chmod|chown|tee|attrib|icacls|takeown)\\b|' +
  '>>|>|\\|\\s*Out-File|curl\\s+[^\\r\\n]*-o|wget\\s+[^\\r\\n]*-O',
  'i'
)

function describeOperation(name, args) {
  if (name === 'write') {
    const p = args && typeof args.file_path === 'string' ? args.file_path : '(未知路径)'
    const n = args && typeof args.content === 'string' ? args.content.length : 0
    return '写入文件：' + p + '（约 ' + n + ' 字符）'
  }
  if (name === 'edit') {
    const p = args && typeof args.file_path === 'string' ? args.file_path : '(未知路径)'
    return '修改文件：' + p
  }
  if (name === 'pwsh' || name === 'bash' || name === 'bash-persistent') {
    const c = args && typeof args.command === 'string' ? args.command : '(未知命令)'
    return '执行命令：' + (c.length > 240 ? c.slice(0, 240) + '…' : c)
  }
  return '执行操作：' + name
}

function needsConsent(exec) {
  const name = exec && exec.name
  if (name === 'write' || name === 'edit') return true
  if (name === 'pwsh' || name === 'bash' || name === 'bash-persistent') {
    const cmd = exec && exec.arguments && typeof exec.arguments.command === 'string' ? exec.arguments.command : ''
    return SHELL_MUTATION.test(cmd)
  }
  return false
}

function applyGate(ctx) {
  const userQuestions = ctx.get('userQuestions')
  ctx.on('tools/pre-execute', async (exec, next) => {
    try {
      if (!needsConsent(exec)) return next()
      if (userQuestions === undefined) {
        return { kind: 'deny', reason: '权限门不可用：缺少 userQuestions 服务' }
      }
      const answer = await userQuestions.ask({
        agent: exec.agent,
        signal: exec.signal,
        questions: [{
          id: 'file-op-consent',
          header: '文件操作需要你的同意',
          question: describeOperation(exec.name, exec.arguments),
          detail: '勾选「同意」并点击确认以放行；不勾选直接确认将拒绝该操作。',
          multiSelect: true,
          options: [{ label: '同意' }],
        }],
      })
      const approved = answer && Array.isArray(answer.answers) &&
        answer.answers.some(function (a) {
          return a && Array.isArray(a.selected) && a.selected.indexOf('同意') !== -1
        })
      if (approved) return next()
      return { kind: 'deny', reason: '用户未同意此文件操作' }
    } catch (error) {
      return { kind: 'deny', reason: '权限门询问失败：' + (error && error.message ? error.message : String(error)) }
    }
  })
}

// ===== 余额 =====
const BALANCE_URL = 'https://api.deepseek.com/user/balance'

function balanceScript() {
  return [
    '(async () => {',
    '  try {',
    "    const r = await fetch('" + BALANCE_URL + "', {",
    "      headers: { Authorization: 'Bearer ' + process.env.DSH_BALANCE_KEY, Accept: 'application/json' },",
    '    });',
    '    const text = await r.text();',
    "    console.log(JSON.stringify({ status: r.status, body: text }));",
    '  } catch (e) {',
    "    console.error(String((e && e.stack) || e));",
    '    process.exit(1);',
    '  }',
    '})();',
  ].join('\n')
}

function applyBalance(ctx) {
  const credentials = ctx.get('credentials')
  const subprocess = ctx.get('subprocess')
  if (credentials === undefined || subprocess === undefined) return
  harness.handle('deepseek-balance', async () => {
    try {
      const resolved = await credentials.resolve('DEEPSEEK_API_KEY')
      if (resolved === undefined || typeof resolved.value !== 'string' || resolved.value === '') {
        return { ok: false, error: '未配置 DeepSeek API Key（DEEPSEEK_API_KEY）' }
      }
      const nodePath = await subprocess.resolveExecutable('node')
      const handle = subprocess.spawn({
        argv: [nodePath, '-e', balanceScript()],
        cwd: 'C:\\Users\\WZX',
        stdio: { stdin: 'ignore', stdout: { maxBytes: 65536 }, stderr: { maxBytes: 65536 } },
        graceMs: 15000,
        env: { DSH_BALANCE_KEY: resolved.value },
      })
      await handle.waitForExit()
      const stdout = handle.collected.stdout ? handle.collected.stdout.readFrom(0).text : ''
      const stderr = handle.collected.stderr ? handle.collected.stderr.readFrom(0).text : ''
      const last = stdout.trim().split(/\r?\n/).filter(Boolean).pop()
      if (last === undefined) return { ok: false, error: stderr.trim() || '余额请求无输出' }
      const parsed = JSON.parse(last)
      return { ok: true, status: parsed.status, body: parsed.body }
    } catch (error) {
      return { ok: false, error: String((error && error.message) || error) }
    }
  })
}

// ===== 更新 =====
const PKG = '@deepseek-ai/dsh'
const REGISTRY_LATEST = 'https://registry.npmmirror.com/' + PKG.replace('/', '%2f') + '/latest'
const CURRENT_VERSION = '0.1.0-rc.6'

function latestScript() {
  return [
    '(async () => {',
    "  const r = await fetch('" + REGISTRY_LATEST + "');",
    '  const j = await r.json();',
    "  console.log(String(j.version || ''));",
    '})().catch((e) => { console.error(String((e && e.stack) || e)); process.exit(1); });',
  ].join('\n')
}

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
      const nodePath = await subprocess.resolveExecutable('node')
      const handle = subprocess.spawn({
        argv: [nodePath, '-e', latestScript()],
        cwd: 'C:\\Users\\WZX',
        stdio: { stdin: 'ignore', stdout: { maxBytes: 16384 }, stderr: { maxBytes: 16384 } },
        graceMs: 20000,
      })
      const { stdout, stderr } = await collect(handle)
      const latest = stdout.trim().split(/\r?\n/).filter(Boolean).pop() || ''
      if (latest === '') return { ok: false, error: stderr.trim() || '查询最新版本失败' }
      return { ok: true, current: CURRENT_VERSION, latest, hasUpdate: latest !== CURRENT_VERSION }
    } catch (error) {
      return { ok: false, error: String((error && error.message) || error) }
    }
  })

  harness.handle('do-update', async () => {
    try {
      const cmdPath = await subprocess.resolveExecutable('cmd.exe')
      const handle = subprocess.spawn({
        argv: [cmdPath, '/c', 'npm', 'install', '-g', PKG + '@latest'],
        cwd: 'C:\\Users\\WZX',
        stdio: { stdin: 'ignore', stdout: { maxBytes: 262144 }, stderr: { maxBytes: 262144 } },
        graceMs: 180000,
      })
      const { stdout, stderr } = await collect(handle)
      return { ok: true, stdout: stdout.slice(-4000), stderr: stderr.slice(-4000) }
    } catch (error) {
      return { ok: false, error: String((error && error.message) || error) }
    }
  })
}

return {
  apply(ctx) {
    applyGate(ctx)
    applyBalance(ctx)
    applyUpdate(ctx)
  },
}
