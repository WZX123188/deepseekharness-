// 启动引导：每个会话创建时，用 dynamicCordisRunner 自动 define+run 全部功能。
// 自动批准客户端，避免卡在 awaiting-approval。
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const dir = dirname(fileURLToPath(import.meta.url))
const hostCode = readFileSync(join(dir, 'host-body.js'), 'utf8')
const clientCode = readFileSync(join(dir, 'client-body.js'), 'utf8')

export const inject = ['dynamicCordisRunner']

export function apply(ctx) {
  const runner = ctx.dynamicCordisRunner
  console.log('[dsh-boot] apply: runner=' + (runner === undefined ? 'absent' : 'present'))
  if (runner === undefined) return
  const loaded = new Set()

  function loadForAgent(agent) {
    const sid = agent && agent.id
    if (sid === undefined || loaded.has(sid)) return
    loaded.add(sid)
    console.log('[dsh-boot] loadForAgent session=' + sid)
    try {
      const receipt = runner.define({
        sessionId: sid,
        plugin: { kind: 'new', idPrefix: 'dshx' },
        name: 'DSH 客户端功能',
        purpose: '权限门+余额+更新+API管理+工具市场+插件市场+项目区+使用指南',
        code: { host: hostCode, client: clientCode },
      })
      console.log('[dsh-boot] defined plugin=' + receipt.pluginId + ' pkg=' + receipt.packageId)
      runner.runHostHalf(agent, receipt.pluginId, receipt.packageId, 'run', null, true).then(function (res) {
        console.log('[dsh-boot] runHostHalf ok=' + (res && res.ok) + ' pluginRunId=' + (res && res.pluginRunId))
      }).catch(function (e) { console.error('[dsh-boot] runHostHalf failed: ' + ((e && e.message) || e)) })
    } catch (e) {
      console.error('[dsh-boot] define failed: ' + ((e && e.message) || e))
    }
  }

  ctx.on('agent/created', function (payload) {
    console.log('[dsh-boot] agent/created fired')
    if (payload && payload.agent) loadForAgent(payload.agent)
  })
}
