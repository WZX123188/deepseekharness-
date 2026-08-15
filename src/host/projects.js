// 项目区（Host 侧）：列出 / 创建项目（DSH 工作区）
return {
  apply(ctx) {
    const workspaceRegistry = ctx.get('workspaceRegistry')
    if (workspaceRegistry === undefined) return

    harness.handle('list-projects', async () => {
      try {
        const list = workspaceRegistry.list()
        const items = list.map(function (w) {
          return {
            id: w.id === undefined ? '' : String(w.id),
            path: w.path === undefined ? '' : String(w.path),
            title: (w.title === undefined || w.title === null || w.title === '') ? (w.path === undefined ? '' : String(w.path)) : String(w.title),
          }
        })
        return { ok: true, items }
      } catch (error) {
        return { ok: false, error: String((error && error.message) || error) }
      }
    })

    harness.handle('create-project', async (args) => {
      try {
        const path = args && args.path
        const title = args && args.title
        if (typeof path !== 'string' || path === '') return { ok: false, error: '路径不能为空' }
        const w = await workspaceRegistry.create(path, (typeof title === 'string' && title !== '') ? title : undefined)
        return { ok: true, id: w.id === undefined ? '' : String(w.id), path: w.path === undefined ? '' : String(w.path) }
      } catch (error) {
        return { ok: false, error: String((error && error.message) || error) }
      }
    })
  },
}
