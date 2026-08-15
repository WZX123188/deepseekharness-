// 工具市场（Host 侧）：热门工具分类列表 + 一键安装（npm install -g）
// 说明：此处为热门 MCP 服务器等 npm 工具；正式版可对接 npm registry 动态发现。

const TOOLS = [
  { id: 'mcp-filesystem', name: 'Filesystem', category: '文件与系统', desc: '读写本地文件系统', pkg: '@modelcontextprotocol/server-filesystem' },
  { id: 'mcp-everything', name: 'Everything', category: '文件与系统', desc: 'Windows 文件快速搜索', pkg: '@modelcontextprotocol/server-everything' },
  { id: 'mcp-fetch', name: 'Fetch', category: '网页抓取', desc: '抓取网页内容转 Markdown', pkg: '@modelcontextprotocol/server-fetch' },
  { id: 'mcp-puppeteer', name: 'Puppeteer', category: '浏览器自动化', desc: '无头浏览器自动化、网页交互', pkg: '@modelcontextprotocol/server-puppeteer' },
  { id: 'mcp-playwright', name: 'Playwright', category: '浏览器自动化', desc: '浏览器自动化与测试', pkg: '@playwright/mcp' },
  { id: 'mcp-github', name: 'GitHub', category: '代码与仓库', desc: '操作 GitHub 仓库、Issue、PR', pkg: '@modelcontextprotocol/server-github' },
  { id: 'mcp-git', name: 'Git', category: '代码与仓库', desc: '读取与操作本地 Git 仓库', pkg: '@modelcontextprotocol/server-git' },
  { id: 'mcp-brave', name: 'Brave Search', category: '搜索', desc: 'Brave 网络搜索', pkg: '@modelcontextprotocol/server-brave-search' },
  { id: 'mcp-postgres', name: 'PostgreSQL', category: '数据库', desc: '查询 PostgreSQL 数据库', pkg: '@modelcontextprotocol/server-postgres' },
  { id: 'mcp-sqlite', name: 'SQLite', category: '数据库', desc: '查询 SQLite 数据库', pkg: '@modelcontextprotocol/server-sqlite' },
  { id: 'mcp-memory', name: 'Memory', category: '知识记忆', desc: '持久化知识图谱记忆', pkg: '@modelcontextprotocol/server-memory' },
  { id: 'mcp-time', name: 'Time', category: '实用工具', desc: '时间与时区查询', pkg: '@modelcontextprotocol/server-time' },
]

return {
  apply(ctx) {
    const subprocess = ctx.get('subprocess')
    if (subprocess === undefined) return

    async function runNpm(args, graceMs) {
      const cmdPath = await subprocess.resolveExecutable('cmd.exe')
      const handle = subprocess.spawn({
        argv: [cmdPath, '/c', 'npm'].concat(args),
        cwd: 'C:\\Users\\WZX',
        stdio: { stdin: 'ignore', stdout: { maxBytes: 262144 }, stderr: { maxBytes: 262144 } },
        graceMs: graceMs || 30000,
      })
      await handle.waitForExit()
      const stdout = handle.collected.stdout ? handle.collected.stdout.readFrom(0).text : ''
      const stderr = handle.collected.stderr ? handle.collected.stderr.readFrom(0).text : ''
      return { stdout, stderr }
    }

    harness.handle('list-tools', async () => {
      try {
        let installed = {}
        try {
          const { stdout } = await runNpm(['ls', '-g', '--depth=0', '--json'], 30000)
          const parsed = JSON.parse(stdout)
          installed = (parsed && parsed.dependencies) || {}
        } catch (e) { installed = {} }

        const list = TOOLS.map(function (t) {
          return { id: t.id, name: t.name, category: t.category, desc: t.desc, pkg: t.pkg, installed: Object.prototype.hasOwnProperty.call(installed, t.pkg) }
        })
        const categories = []
        const order = []
        list.forEach(function (t) {
          if (order.indexOf(t.category) === -1) order.push(t.category)
        })
        order.forEach(function (cat) {
          categories.push({ name: cat, items: list.filter(function (t) { return t.category === cat }) })
        })
        return { ok: true, categories }
      } catch (error) {
        return { ok: false, error: String((error && error.message) || error) }
      }
    })

    harness.handle('install-tool', async (args) => {
      try {
        const pkg = args && args.pkg
        if (typeof pkg !== 'string' || pkg === '') return { ok: false, error: '缺少包名' }
        const { stdout, stderr } = await runNpm(['install', '-g', pkg], 180000)
        return { ok: true, pkg, stdout: stdout.slice(-2000), stderr: stderr.slice(-2000) }
      } catch (error) {
        return { ok: false, error: String((error && error.message) || error) }
      }
    })
  },
}
