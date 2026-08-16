// gate 权限门单元测试：改 gate 前先跑本脚本，验证行为符合预期，再同步到正式实例
// 用法：node test-gate.mjs
import { apply } from '../desktop/gate/index.js'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let passed = 0, failed = 0
function check(name, cond, extra = '') {
  if (cond) { passed++; console.log(`  PASS  ${name}`) }
  else { failed++; console.log(`  FAIL  ${name}  ${extra}`) }
}

// 构造一个 gate 实例，返回触发 pre-execute 的函数
function makeGate({ mode = 'ask', approvalPolicy = 'ask', userQuestions = 'ok', fileExists = true, askThrows = false } = {}) {
  const tmp = mkdtempSync(join(tmpdir(), 'gate-test-'))
  writeFileSync(join(tmp, 'dsh-client-config.json'), JSON.stringify({ permissionMode: mode }), 'utf8')
  process.env.DSH_HOME = tmp
  let handler = null
  const uq = userQuestions === 'ok' ? { ask: async () => ({ answers: [{ selected: ['同意'] }] }) }
    : userQuestions === 'none' ? undefined
    : userQuestions === 'reject' ? { ask: async () => ({ answers: [{ selected: [] }] }) }
    : { ask: async () => { throw new Error('ask boom') } }
  const ctx = {
    get(name) {
      if (name === 'userQuestions') return uq
      if (name === 'approval') return { effectivePolicy: () => approvalPolicy }
      if (name === 'fs') return { lstat: async () => fileExists ? {} : undefined }
      return undefined
    },
    on(evt, cb) { if (evt === 'tools/pre-execute') handler = cb },
  }
  apply(ctx)
  return {
    async run(name, args) {
      const exec = { name, arguments: args, agent: { session: {} }, signal: { aborted: false } }
      let wentNext = false
      const result = await handler(exec, () => { wentNext = true })
      return { wentNext, result }
    },
    cleanup() { rmSync(tmp, { recursive: true, force: true }) },
  }
}

console.log('== trust 模式：所有写操作放行 ==')
{
  const g = makeGate({ mode: 'trust' })
  let r = await g.run('pwsh', { command: 'Set-Content x.txt hi' }); check('trust + Set-Content 放行', r.wentNext)
  r = await g.run('write', { file_path: 'C:\\x\\existing.txt', content: 'x' }); check('trust + C盘已存在 write 放行', r.wentNext)
  r = await g.run('edit', { file_path: 'C:\\x\\existing.txt' }); check('trust + edit 放行', r.wentNext)
  g.cleanup()
}

console.log('== ask 模式 + approval=never：弹窗禁用时放行（不堵死） ==')
{
  const g = makeGate({ mode: 'ask', approvalPolicy: 'never' })
  let r = await g.run('pwsh', { command: 'Remove-Item x.txt' }); check('never + Remove-Item 放行', r.wentNext)
  r = await g.run('write', { file_path: 'C:\\x\\existing.txt', content: 'x' }); check('never + C盘已存在 write 放行', r.wentNext)
  g.cleanup()
}

console.log('== ask 模式 + approval=ask + 弹窗可用：按用户选择 ==')
{
  const g = makeGate({ mode: 'ask', approvalPolicy: 'ask', userQuestions: 'ok' })
  let r = await g.run('pwsh', { command: 'Set-Content x.txt hi' }); check('弹窗同意 + Set-Content 放行', r.wentNext)
  r = await g.run('write', { file_path: 'C:\\x\\existing.txt', content: 'x' }); check('弹窗同意 + C盘已存在 write 放行', r.wentNext)
  g.cleanup()
}
{
  const g = makeGate({ mode: 'ask', approvalPolicy: 'ask', userQuestions: 'reject' })
  let r = await g.run('pwsh', { command: 'Set-Content x.txt hi' })
  check('弹窗拒绝 + Set-Content 拦截', !r.wentNext && r.result && r.result.kind === 'deny')
  r = await g.run('write', { file_path: 'C:\\x\\existing.txt', content: 'x' })
  check('弹窗拒绝 + C盘已存在 write 拦截', !r.wentNext && r.result && r.result.kind === 'deny')
  g.cleanup()
}

console.log('== 常规放行规则（不弹窗） ==')
{
  const g = makeGate({ mode: 'ask', approvalPolicy: 'ask', userQuestions: 'reject', fileExists: false })
  let r = await g.run('pwsh', { command: 'Get-Content a.txt' }); check('读取命令放行', r.wentNext)
  r = await g.run('read', { file_path: 'C:\\x\\a.txt' }); check('非拦截工具(read)放行', r.wentNext)
  r = await g.run('write', { file_path: 'G:\\x\\new.txt', content: 'x' }); check('G盘 write 放行', r.wentNext)
  r = await g.run('write', { file_path: 'C:\\x\\brand-new.txt', content: 'x' })
  check('C盘新文件 write 放行', r.wentNext)
  r = await g.run('pwsh', { command: '[System.IO.File]::WriteAllText("a","b")' })
  check('.NET 写命令（无正则命中）放行', r.wentNext)
  g.cleanup()
}
{
  // 明确验证"已存在且非我的 C 盘文件"在弹窗拒绝时被拦（与上面新文件场景区分）
  const g2 = makeGate({ mode: 'ask', approvalPolicy: 'ask', userQuestions: 'reject', fileExists: true })
  const r2 = await g2.run('write', { file_path: 'C:\\x\\existing.txt', content: 'x' })
  check('C盘已存在 write + 拒绝 → 拦截', !r2.wentNext && r2.result && r2.result.kind === 'deny')
  g2.cleanup()
}

console.log('== 弹窗链路故障：fail-open 放行 ==')
{
  const g = makeGate({ mode: 'ask', approvalPolicy: 'ask', userQuestions: 'throw' })
  const r = await g.run('pwsh', { command: 'Set-Content x.txt hi' })
  check('ask 抛异常 → 放行', r.wentNext)
  g.cleanup()
}
{
  const g = makeGate({ mode: 'ask', approvalPolicy: 'ask', userQuestions: 'none' })
  const r = await g.run('pwsh', { command: 'Set-Content x.txt hi' })
  check('userQuestions 不存在 → 放行', r.wentNext)
  g.cleanup()
}

console.log(`\n结果: ${passed} 通过, ${failed} 失败`)
process.exit(failed === 0 ? 0 : 1)
