// 启动引导：每个会话创建时，用 dynamicCordisRunner 自动 define+run 全部功能。
// 复用动态插件格式代码（免重写 RPC / 客户端打包）。
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const dir = dirname(fileURLToPath(import.meta.url))
const hostCode = readFileSync(join(dir, 'host-body.js'), 'utf8')
const clientCode = readFileSync(join(dir, 'client-body.js'), 'utf8')

export function apply(ctx) {
  const runner = ctx.get('dynamicCordisRunner')
  if (runner === undefined) return
  const loaded = new Set()

  function loadForAgent(agent) {
    const sid = agent && agent.id
    if (sid === undefined || loaded.has(sid)) return
    loaded.add(sid)
    try {
      const receipt = runner.define({
        sessionId: sid,
        plugin: { kind: 'new', idPrefix: 'dshx' },
        name: 'DSH 客户端功能',
        purpose: '权限门+余额+更新+API管理+工具市场+项目区+使用指南',
        code: { host: hostCode, client: clientCode },
      })
      runner.run(agent, receipt.pluginId, receipt.packageId, 'run').catch(function (e) {
        console.error('[dsh-boot] run failed: ' + ((e && e.message) || e))
      })
    } catch (e) {
      console.error('[dsh-boot] define failed: ' + ((e && e.message) || e))
    }
  }

  ctx.on('agent/created', function (payload) {
    if (payload && payload.agent) loadForAgent(payload.agent)
  })
}
