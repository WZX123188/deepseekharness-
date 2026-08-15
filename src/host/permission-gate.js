// 权限门（Host 侧）v3 —— 归属感知 + 弹窗置顶信号
// 规则：
//   非文件工具 / 纯读取            → 放行
//   写「新文件」（目标不存在）      → 视为创建自己的文件 → 放行并记入 mine
//   改/删「我创建过的文件」（mine 集）→ 放行
//   写/改「已存在但非我创建」的文件  → 勾选同意
//   pwsh/bash 含删除/写入等信号     → 勾选同意（暂不区分归属）
// 弹窗置顶：询问前写标记文件 %TEMP%\dsh-question-pending，回答后删除；Electron 端轮询该标记把窗口置顶。
// 重要：动态插件环境必须用 ctx.get('userQuestions')，不可用 inject。

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

function makeMarkerSignal(subprocess) {
  if (subprocess === undefined) return null
  let cmdPath = null
  return function (pending) {
    try {
      const run = function (resolved) {
        const argv = pending
          ? [resolved, '/c', 'echo 1 > %TEMP%\\dsh-question-pending']
          : [resolved, '/c', 'del %TEMP%\\dsh-question-pending']
        subprocess.spawn({
          argv: argv,
          cwd: 'C:\\Users\\WZX',
          stdio: { stdin: 'ignore', stdout: 'inherit', stderr: 'inherit' },
          graceMs: 5000,
        })
      }
      if (cmdPath === null) {
        cmdPath = subprocess.resolveExecutable('cmd.exe')
        cmdPath.then(run).catch(function () {})
      } else {
        run(cmdPath)
      }
    } catch (error) {}
  }
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

return {
  apply(ctx) {
    const userQuestions = ctx.get('userQuestions')
    const fs = ctx.get('fs')
    const subprocess = ctx.get('subprocess')
    const mine = new Set()
    const signal = makeMarkerSignal(subprocess)

    ctx.on('tools/pre-execute', async (exec, next) => {
      try {
        const name = exec && exec.name
        const args = (exec && exec.arguments) || {}

        // 1. 非文件工具 → 放行
        if (name !== 'write' && name !== 'edit' && name !== 'pwsh' && name !== 'bash' && name !== 'bash-persistent') {
          return next()
        }

        // 2. pwsh/bash：无变更信号 → 放行；有 → 询问
        if (name === 'pwsh' || name === 'bash' || name === 'bash-persistent') {
          const cmd = typeof args.command === 'string' ? args.command : ''
          if (!SHELL_MUTATION.test(cmd)) return next()
          const ok = await askForConsent(userQuestions, exec, null, mine, signal)
          if (ok) return next()
          return { kind: 'deny', reason: '用户未同意此命令' }
        }

        // 3. write/edit：取路径
        const path = typeof args.file_path === 'string' ? args.file_path : null

        // 4. 我的文件 → 放行
        if (path !== null && mine.has(path)) return next()

        // 4.5 G 盘 = 我的工作区 → 自动放行（用户指定，不询问）
        if (path !== null && typeof path === 'string' && path.toUpperCase().indexOf('G:') === 0) {
          mine.add(path)
          return next()
        }

        // 5. write 到新路径 → 创建自己的文件 → 放行并记录
        if (name === 'write' && path !== null && await isNewPath(fs, path)) {
          mine.add(path)
          return next()
        }

        // 6. 其余 → 询问
        const ok = await askForConsent(userQuestions, exec, path, mine, signal)
        if (ok) return next()
        return { kind: 'deny', reason: '用户未同意此文件操作' }
      } catch (error) {
        return { kind: 'deny', reason: '权限门询问失败：' + (error && error.message ? error.message : String(error)) }
      }
    })
  },
}
