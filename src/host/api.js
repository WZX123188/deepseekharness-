// API 管理（Host 侧）：查看 / 设置 / 清除 / 测试 DeepSeek API Key
const KEY = 'DEEPSEEK_API_KEY'
const MODELS_URL = 'https://api.deepseek.com/models'

function testScript() {
  return "(async()=>{try{const r=await fetch('" + MODELS_URL + "',{headers:{Authorization:'Bearer '+process.env.DSH_API_KEY,Accept:'application/json'}});console.log(JSON.stringify({status:r.status,body:await r.text()}))}catch(e){console.error(String((e&&e.stack)||e));process.exit(1)}})()"
}

return {
  apply(ctx) {
    const credentials = ctx.get('credentials')
    if (credentials === undefined) return
    const subprocess = ctx.get('subprocess')

    harness.handle('get-api-status', async () => {
      try {
        const info = await credentials.describe(KEY)
        return { ok: true, configured: info.configured, source: info.source, writable: info.writable }
      } catch (error) {
        return { ok: false, error: String((error && error.message) || error) }
      }
    })

    harness.handle('set-api-key', async (args) => {
      try {
        const value = args && args.value
        if (typeof value !== 'string' || value.trim() === '') return { ok: false, error: 'Key 不能为空' }
        await credentials.set(KEY, value.trim())
        return { ok: true }
      } catch (error) {
        return { ok: false, error: String((error && error.message) || error) }
      }
    })

    harness.handle('clear-api-key', async () => {
      try {
        await credentials.unset(KEY)
        return { ok: true }
      } catch (error) {
        return { ok: false, error: String((error && error.message) || error) }
      }
    })

    harness.handle('test-api', async () => {
      try {
        const resolved = await credentials.resolve(KEY)
        if (resolved === undefined || typeof resolved.value !== 'string' || resolved.value === '') {
          return { ok: false, error: '未配置 API Key' }
        }
        if (subprocess === undefined) return { ok: false, error: '缺少子进程服务' }
        const nodePath = await subprocess.resolveExecutable('node')
        const handle = subprocess.spawn({
          argv: [nodePath, '-e', testScript()],
          cwd: 'C:\\Users\\WZX',
          stdio: { stdin: 'ignore', stdout: { maxBytes: 65536 }, stderr: { maxBytes: 65536 } },
          graceMs: 15000,
          env: { DSH_API_KEY: resolved.value },
        })
        await handle.waitForExit()
        const stdout = handle.collected.stdout ? handle.collected.stdout.readFrom(0).text : ''
        const stderr = handle.collected.stderr ? handle.collected.stderr.readFrom(0).text : ''
        const last = stdout.trim().split(/\r?\n/).filter(Boolean).pop()
        if (last === undefined) return { ok: false, error: stderr.trim() || '测试请求无输出' }
        const parsed = JSON.parse(last)
        if (parsed.status === 200) return { ok: true, status: parsed.status }
        return { ok: false, error: 'HTTP ' + parsed.status + '：' + parsed.body.slice(0, 200) }
      } catch (error) {
        return { ok: false, error: String((error && error.message) || error) }
      }
    })
  },
}
