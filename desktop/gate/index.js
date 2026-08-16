// DSH 客户端权限门（正式插件包，ESM）
// 规则：读取放行；写新文件/我的文件/G盘文件放行；改删已存在且非我的文件需勾选同意；
//       pwsh/bash 含删除/写入信号需同意。询问时写标记文件，供 Electron 置顶。
import { writeFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

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

async function isNewPath(fs, path) {
  if (fs === undefined || path === null || path === '') return false
  try {
    const info = await fs.lstat(path)
    return info === undefined
  } catch (error) {
    return false
  }
}

// 置顶信号：写入/删除 $DSH_HOME/question-pending（与 Electron 端轮询路径一致，实例隔离）
function markerPath() {
  const home = process.env.DSH_HOME
  return join(home && home.length ? home : '', 'question-pending')
}
function setMarker(pending) {
  try {
    const p = markerPath()
    if (pending) writeFileSync(p, '1')
    else { try { unlinkSync(p) } catch (e) {} }
  } catch (e) {}
}

async function askForConsent(userQuestions, exec, path, mine, signal) {
  if (userQuestions === undefined) return false
  if (signal) signal(true)
  try {
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
    if (approved && path !== null && mine !== undefined) mine.add(path)
    return approved
  } finally {
    if (signal) signal(false)
  }
}

export function apply(ctx) {
  const userQuestions = ctx.get('userQuestions')
  const fs = ctx.get('fs')
  const mine = new Set()
  const signal = setMarker

  ctx.on('tools/pre-execute', async (exec, next) => {
    try {
      const name = exec && exec.name
      const args = (exec && exec.arguments) || {}

      if (name !== 'write' && name !== 'edit' && name !== 'pwsh' && name !== 'bash' && name !== 'bash-persistent') {
        return next()
      }

      if (name === 'pwsh' || name === 'bash' || name === 'bash-persistent') {
        const cmd = typeof args.command === 'string' ? args.command : ''
        if (!SHELL_MUTATION.test(cmd)) return next()
        const ok = await askForConsent(userQuestions, exec, null, mine, signal)
        if (ok) return next()
        return { kind: 'deny', reason: '用户未同意此命令' }
      }

      const path = typeof args.file_path === 'string' ? args.file_path : null

      if (path !== null && mine.has(path)) return next()

      if (path !== null && typeof path === 'string' && path.toUpperCase().indexOf('G:') === 0) {
        mine.add(path)
        return next()
      }

      if (name === 'write' && path !== null && await isNewPath(fs, path)) {
        mine.add(path)
        return next()
      }

      const ok = await askForConsent(userQuestions, exec, path, mine, signal)
      if (ok) return next()
      return { kind: 'deny', reason: '用户未同意此文件操作' }
    } catch (error) {
      return { kind: 'deny', reason: '权限门询问失败：' + (error && error.message ? error.message : String(error)) }
    }
  })
}
