import { readFileSync } from 'node:fs'

const token = process.env.GH_TOKEN
const owner = 'WZX123188'
const repo = 'deepseekharness-'
const base = 'G:/dsh客户端/desktop/release/'

const body = `## DSH 客户端 v3.0.0 正式版

完全独立、便携的 DeepSeek Harness 桌面客户端：内置运行时 + 数据隔离，不碰你已有的网页版 DSH / 全局 npm / Node。

### 本版内容
- ✅ 完全独立 + 便携版（zip 绿色版，数据随程序目录 data\\ 走）
- ✅ 视图模式（智谱 GLM-4V-Flash 免费视觉模型，识图/OCR）
- ✅ PDF 实时翻译（文字版 + 扫描版，精准翻译数据手册，术语/引脚名保真）
- ✅ Office 全文翻译（Word/Excel/PPT，支持 WPS 另存格式，预览审核修改后保存译文文件）
- ✅ 整页壁纸（预设色/渐变 + 上传图片）
- ✅ 权限门 / 余额用量 / 检查更新 / Tool·Plugin 市场 / 项目 / 使用指南 / 意见区 / 神奇小开关
- ✅ 体积精简（删其它厂商 SDK，只保留中英文语言包）

### 安装包
- \`DeepSeek-Client-Setup-3.0.0.exe\`：安装版（Windows 10/11 64 位）
- \`DeepSeekClient-portable-3.0.0-win-x64.zip\`：便携绿色版，解压即用，可拷 U 盘

### 使用
- 首次打开在「设置 → 模型」配置 DeepSeek API Key。
- 识图 / PDF 扫描版 OCR 需在「设置 → 视图模式」配置免费的智谱 API Key（open.bigmodel.cn）。
- 快捷键 Ctrl+Alt+D 呼出/隐藏。

> 免责声明见安装包内《说明》。AI 输出仅供辅助，使用前请自行审核。`

const headers = { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'User-Agent': 'dsh-client-release', 'X-GitHub-Api-Version': '2022-11-28' }

// 1) 创建 Release
const r = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases`, {
  method: 'POST', headers,
  body: JSON.stringify({ tag_name: 'v3.0.0', name: 'v3.0.0 正式版', body, draft: false, prerelease: false })
})
if (r.status !== 201) { console.error('创建 Release 失败 HTTP ' + r.status + ': ' + (await r.text()).slice(0, 500)); process.exit(1) }
const rel = await r.json()
console.log('Release 已创建: id=' + rel.id + ' url=' + rel.html_url)

// 2) 上传资产
const assets = [
  { path: base + 'DeepSeek-Client-Setup-3.0.0.exe', type: 'application/octet-stream' },
  { path: base + 'DeepSeekClient-portable-3.0.0-win-x64.zip', type: 'application/zip' }
]
for (const a of assets) {
  const name = a.path.split('/').pop()
  const buf = readFileSync(a.path)
  const up = await fetch(`https://uploads.github.com/repos/${owner}/${repo}/releases/${rel.id}/assets?name=${encodeURIComponent(name)}`, {
    method: 'POST', headers: { ...headers, 'Content-Type': a.type }, body: buf
  })
  if (up.status !== 201) { console.error('上传失败 ' + name + ' HTTP ' + up.status + ': ' + (await up.text()).slice(0, 300)) }
  else { const j = await up.json(); console.log('已上传: ' + j.name + ' (' + (j.size / 1048576).toFixed(1) + ' MB)') }
}
console.log('DONE')
