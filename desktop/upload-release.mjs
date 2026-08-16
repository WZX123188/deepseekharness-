// 创建 GitHub Release 并上传产物。用法: node upload-release.mjs <tag> <installerExe> <portableZip>
// 需要环境变量 GH_TOKEN（git credential 里取，勿打印）
import { readFileSync } from 'node:fs'

const [tag, installer, portable] = process.argv.slice(2)
const token = process.env.GH_TOKEN
if (!token) { console.error('缺少 GH_TOKEN'); process.exit(1) }
const owner = 'WZX123188'
const repo = 'deepseekharness-'
const headers = { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'User-Agent': 'dsh-client-release', 'X-GitHub-Api-Version': '2022-11-28' }

const body = `## DSH 客户端 v3.0.1

修复版本：

### 本版修复
- ✅ 智谱 API Key 不再要求 sk- 前缀（智谱 Key 开头不规律，常见「32位十六进制.32位十六进制」两段式；只去空白/误贴引号，不做格式限制）
- ✅ 识图模型升级为 \`glm-4.6v-flash\`，不可用时自动回退 \`glm-4v-flash\`，修好测试连接与图片识别
- ✅ PDF / Office 翻译支持直接拖入 pdf/docx/xlsx/pptx，点选文件也能正常翻译（原先只能拖图片）
- ✅ 网页 PDF 实时翻译：逐页/逐段实时识别翻译，翻完一页立刻显示；聊天框/任意位置拖入 PDF 或 Office 文档 → 弹出实时翻译面板
- ✅ 英文各格式自测通过：文本翻译（术语/引脚名保真）、PDF 提取翻译、docx 提取+翻译+回填

### 安装包
- \`DeepSeek-Client-Setup-3.0.1.exe\`：安装版（Windows 10/11 64 位）
- \`DeepSeekClient-portable-3.0.1-win-x64.zip\`：便携绿色版

### 使用
- 首次打开在「设置 → 模型」配置 DeepSeek API Key。
- 识图 / PDF 扫描版 OCR 需在「设置 → 视图模式」配置免费的智谱 API Key（open.bigmodel.cn，直接粘贴官网复制的完整 Key，不以 sk- 开头）。
- 快捷键 Ctrl+Alt+D 呼出/隐藏。`

const r = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases`, {
  method: 'POST', headers,
  body: JSON.stringify({ tag_name: tag, name: tag + ' 修复版', body, draft: false, prerelease: false })
})
if (r.status !== 201) { console.error('创建 Release 失败 HTTP ' + r.status + ': ' + (await r.text()).slice(0, 500)); process.exit(1) }
const rel = await r.json()
console.log('Release 已创建: id=' + rel.id + ' url=' + rel.html_url)

for (const a of [installer, portable]) {
  if (!a) continue
  const name = a.split(/[\\/]/).pop()
  const buf = readFileSync(a)
  const up = await fetch(`https://uploads.github.com/repos/${owner}/${repo}/releases/${rel.id}/assets?name=${encodeURIComponent(name)}`, {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/octet-stream' }, body: buf
  })
  if (up.status !== 201) console.error('上传失败 ' + name + ' HTTP ' + up.status + ': ' + (await up.text()).slice(0, 300))
  else { const j = await up.json(); console.log('已上传: ' + j.name + ' (' + (j.size / 1048576).toFixed(1) + ' MB)') }
}
console.log('DONE')
