// 余额页（Host 侧）
// 通过子进程 node fetch 调 DeepSeek 官方余额接口；key 从 credentials 取，不经浏览器暴露。

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

return {
  apply(ctx) {
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
        if (last === undefined) {
          return { ok: false, error: stderr.trim() || '余额请求无输出' }
        }
        const parsed = JSON.parse(last)
        return { ok: true, status: parsed.status, body: parsed.body }
      } catch (error) {
        return { ok: false, error: String((error && error.message) || error) }
      }
    })
  },
}
