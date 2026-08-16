import { readFileSync } from 'node:fs'

const token = process.env.GH_TOKEN
const owner = 'WZX123188'
const repo = 'deepseekharness-'
const releaseId = process.env.REL_ID
const base = 'G:/dsh客户端/desktop/release/'

const headers = { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'User-Agent': 'dsh-client-release', 'X-GitHub-Api-Version': '2022-11-28' }

const assets = [
  { path: base + 'DeepSeek-Client-Setup-3.0.0.exe', type: 'application/octet-stream' },
  { path: base + 'DeepSeekClient-portable-3.0.0-win-x64.zip', type: 'application/zip' }
]
for (const a of assets) {
  const name = a.path.split('/').pop()
  // 先删同名旧资产（若有）
  try {
    const list = await (await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/${releaseId}/assets`, { headers })).json()
    for (const x of list) { if (x.name === name) { await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/assets/${x.id}`, { method: 'DELETE', headers }); console.log('删除旧资产 ' + name) } }
  } catch (e) {}
  const buf = readFileSync(a.path)
  console.log('开始上传 ' + name + ' (' + (buf.length / 1048576).toFixed(1) + ' MB)…')
  const up = await fetch(`https://uploads.github.com/repos/${owner}/${repo}/releases/${releaseId}/assets?name=${encodeURIComponent(name)}`, {
    method: 'POST', headers: { ...headers, 'Content-Type': a.type }, body: buf
  })
  if (up.status !== 201) { console.error('上传失败 ' + name + ' HTTP ' + up.status + ': ' + (await up.text()).slice(0, 300)) }
  else { const j = await up.json(); console.log('已上传: ' + j.name + ' state=' + j.state + ' (' + (j.size / 1048576).toFixed(1) + ' MB)') }
}
console.log('DONE')
