// 更新页（Host 侧）
// check-update：node 子进程查 npm registry（npmmirror）最新版，无需 npm。
// do-update：cmd.exe /c npm install -g 一键更新。

const PKG = '@deepseek-ai/dsh'
const REGISTRY_LATEST = 'https://registry.npmmirror.com/' + PKG.replace('/', '%2f') + '/latest'
const CURRENT = '0.1.0-rc.6'

function latestScript() {
  return [
    "(async () => {",
    "  const r = await fetch('" + REGISTRY_LATEST + "');",
    '  const j = await r.json();',
    "  console.log(String(j.version || ''));",
    '})().catch((e) => { console.error(String((e && e.stack) || e)); process.exit(1); });',
  ].join('\n')
}

return {
  apply(ctx) {
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
        return { ok: true, current: CURRENT, latest, hasUpdate: latest !== CURRENT }
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
  },
}
