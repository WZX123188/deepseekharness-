// DSH 会话备份：raw 副本 + 解码 jsonl + 可读 Markdown（递归扫描多个 sessions 根）
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { zstdDecompressSync } from 'node:zlib'
import { join } from 'node:path'

const OUT = process.argv[2] || 'D:/新建文件夹/会话备份-20260816'
const ROOTS = [
  'C:/Users/WZX/AppData/Roaming/DeepSeekClient/.dsh/sessions',
  'C:/Users/WZX/.dsh/sessions'
]
const ZSTD_MAGIC = 0xFD2FB528

function decodeZstd(buf) {
  const parts = []; let offset = 0
  while (offset < buf.length) {
    const start = offset
    if (buf.length - offset < 4 || buf.readUInt32LE(offset) !== ZSTD_MAGIC) break
    offset += 4
    if (offset >= buf.length) break
    const d = buf.readUInt8(offset); offset += 1
    const csf = d >>> 6, single = (d & 32) !== 0, checksum = (d & 4) !== 0
    const dictFlag = d & 3, dictBytes = dictFlag === 3 ? 4 : dictFlag
    const sizeBytes = csf === 0 ? (single ? 1 : 0) : (1 << csf)
    const rest = (single ? 0 : 1) + dictBytes + sizeBytes
    if (buf.length - offset < rest) break
    offset += rest
    let ok = false
    for (;;) {
      if (buf.length - offset < 3) { offset = start; break }
      const bh = buf.readUIntLE(offset, 3); offset += 3
      const last = (bh & 1) !== 0, type = (bh >>> 1) & 3, size = bh >>> 3
      const pay = type === 1 ? 1 : size
      if (buf.length - offset < pay) { offset = start; break }
      offset += pay
      if (last) { ok = true; break }
    }
    if (!ok) break
    if (checksum) { if (buf.length - offset < 4) break; offset += 4 }
    try { parts.push(zstdDecompressSync(buf.subarray(start, offset))) } catch { break }
  }
  return Buffer.concat(parts).toString('utf8')
}

function texts(arr) {
  if (!Array.isArray(arr)) return ''
  return arr.map(x => x && x.type === 'text' ? x.text : '').filter(Boolean).join('\n')
}
function extractMd(jsonlText, title) {
  const out = [`# 会话 ${title}\n`]
  for (const raw of jsonlText.split('\n')) {
    if (!raw.trim()) continue
    let ev; try { ev = JSON.parse(raw) } catch { continue }
    if (ev.type === 'user/message') out.push('\n## 👤 用户\n\n' + texts(ev.data && ev.data.content))
    else if (ev.type === 'assistant/message') out.push('\n## 🤖 助手\n\n' + texts(ev.data && ev.data.message && ev.data.message.content))
    else if (ev.type === 'tool/call') out.push(`\n### 🔧 工具：${ev.data && ev.data.name}\n\n\`\`\`json\n${(ev.data && ev.data.arguments) || ''}\n\`\`\``)
  }
  return out.join('\n')
}

function findSessions(dir, depth) {
  const found = []
  let entries
  try { entries = readdirSync(dir) } catch { return found }
  for (const e of entries) {
    const full = join(dir, e)
    let st; try { st = statSync(full) } catch { continue }
    if (st.isDirectory()) {
      const zf = join(full, 'session.jsonl.zstd')
      if (existsSync(zf)) found.push({ id: e, zf })
      else if (depth < 3) found.push(...findSessions(full, depth + 1))
    }
  }
  return found
}

mkdirSync(join(OUT, 'raw'), { recursive: true })
mkdirSync(join(OUT, 'decoded'), { recursive: true })
const md = []
let n = 0
for (const root of ROOTS) {
  for (const s of findSessions(root, 0)) {
    copyFileSync(s.zf, join(OUT, 'raw', s.id + '.zstd'))
    const jsonl = decodeZstd(readFileSync(s.zf))
    writeFileSync(join(OUT, 'decoded', s.id + '.jsonl'), jsonl)
    md.push(extractMd(jsonl, s.id))
    n++
    console.log('OK ' + s.id + ' (' + Math.round(jsonl.length / 1024) + ' KB)')
  }
}
writeFileSync(join(OUT, '会话记录.md'), md.join('\n\n---\n\n'))
console.log('DONE: ' + n + ' sessions -> ' + OUT)
