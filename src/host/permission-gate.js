// 权限门（Host 侧）
// 规则：读取默认放行；写/改/删需用户勾选「同意」并确认后才放行。
// 接线：拦截 tools/pre-execute 瀑布；文件变更类工具走 userQuestions 询问。
// 重要：动态插件环境必须用 ctx.get('userQuestions')，不可用 inject（inject 会一直等待、apply 不执行）。

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
    const cmd = exec && exec.arguments && typeof exec.arguments.command === 'string'
      ? exec.arguments.command
      : ''
    return SHELL_MUTATION.test(cmd)
  }
  return false
}

return {
  apply(ctx) {
    const userQuestions = ctx.get('userQuestions')
    ctx.on('tools/pre-execute', async (exec, next) => {
      try {
        if (!needsConsent(exec)) return next()

        // fail closed：缺提问服务时对写/改/删一律拒绝
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
        return {
          kind: 'deny',
          reason: '权限门询问失败：' + (error && error.message ? error.message : String(error)),
        }
      }
    })
  },
}
