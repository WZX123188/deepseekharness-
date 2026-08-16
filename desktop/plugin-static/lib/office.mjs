// Office 文档（docx/xlsx/pptx）文本提取与回填。由宿主插件调用。
// 用法: node office.mjs extract <officeFile> <jszipDir>                    → stdout JSON {type, chunks}
//       node office.mjs package <officeFile> <jszipDir> <chunksFile> <outName> → stdout JSON {base64, outName}
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { extname } from 'node:path'

const [mode, officeFile, jszipDir, chunksFile, outName] = process.argv.slice(2)
const require = createRequire(import.meta.url)
const JSZip = require(jszipDir)

const buf = readFileSync(officeFile)
const zip = await JSZip.loadAsync(buf)
const ext = (extname(officeFile) || '.docx').toLowerCase()

function unesc(s) { return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'") }
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }

function tagFor() { return ext === '.docx' ? 'w:t' : ext === '.xlsx' ? 't' : 'a:t' }

function targetFiles() {
  if (ext === '.docx') return ['word/document.xml', 'word/header1.xml', 'word/footer1.xml'].filter((f) => zip.files[f])
  if (ext === '.xlsx') return Object.keys(zip.files).filter((f) => /^xl\/(worksheets\/sheet\d+\.xml|sharedStrings\.xml)$/.test(f))
  if (ext === '.pptx') return Object.keys(zip.files).filter((f) => /^ppt\/(slides\/slide\d+\.xml|notesSlides\/notesSlide\d+\.xml)$/.test(f))
  return []
}

async function extract() {
  const chunks = []
  const tag = tagFor()
  const re = new RegExp('<' + tag + '\\b[^>]*>([\\s\\S]*?)</' + tag + '>', 'g')
  for (const f of targetFiles()) {
    const xml = await zip.file(f).async('string')
    let m
    while ((m = re.exec(xml))) {
      const t = unesc(m[1])
      if (t.trim()) chunks.push({ key: f + '#' + chunks.length, text: t })
    }
  }
  return { type: ext.replace('.', ''), chunks }
}

async function pack() {
  const data = JSON.parse(readFileSync(chunksFile, 'utf8'))
  const byFile = {}
  for (const c of data) { (byFile[c.key.split('#')[0]] = byFile[c.key.split('#')[0]] || []).push(c) }
  const tag = tagFor()
  for (const f of Object.keys(byFile)) {
    if (!zip.files[f]) continue
    const xml = await zip.file(f).async('string')
    const re = new RegExp('<' + tag + '\\b[^>]*>([\\s\\S]*?)</' + tag + '>', 'g')
    let idx = 0
    const items = byFile[f]
    const newXml = xml.replace(re, function (full, inner) {
      const t = unesc(inner)
      if (!t.trim()) return full
      const item = items[idx++]
      if (item && item.translated) return '<' + tag + '>' + esc(item.translated) + '</' + tag + '>'
      return full
    })
    zip.file(f, newXml)
  }
  const out = await zip.generateAsync({ type: 'nodebuffer' })
  return { base64: out.toString('base64'), outName: outName || ('translated' + ext) }
}

const result = mode === 'extract' ? await extract() : await pack()
console.log(JSON.stringify(result))
