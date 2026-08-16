// DSH 客户端 3.0.1 自测：英文各格式 → 翻译链路验证（模拟宿主插件管线）
// T1 纯文本翻译（DeepSeek API）  T2 最小文本 PDF 提取+逐页翻译  T3 构造 docx 提取+翻译+回填
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, dirname } from 'node:path'
import { spawnSync } from 'node:child_process'

const ROOT = 'G:/dsh客户端'
const NODE = 'D:/新建文件夹/DeepSeekClient/resources/node/node.exe'
const PDFJS = 'G:/dsh客户端/desktop/dsh-runtime/node_modules/pdf-tools/node_modules/pdfjs-dist/legacy/build/pdf.mjs'
const JSZIP_DIR = 'G:/dsh客户端/desktop/dsh-runtime/node_modules/pdf-tools/node_modules/jszip/lib/index.js'
const OFFICE_MJS = 'G:/dsh客户端/plugin-static/lib/office.mjs'
const TMP = 'G:/dsh客户端/.selftest'
const require = createRequire(import.meta.url)

// ---- 读 DeepSeek key ----
const home = process.env.DSH_HOME || 'C:/Users/WZX/AppData/Roaming/DeepSeekClient/.dsh'
let key = ''
try {
  const yaml = readFileSync(join(home, '.credentials.yaml'), 'utf8')
  const m = yaml.match(/^DEEPSEEK_API_KEY:\s*["']?([^"'\s]+)/m)
  if (m) key = m[1]
} catch (e) {}
if (!key) { console.log('FAIL: 未找到 DEEPSEEK_API_KEY'); process.exit(1) }
console.log('key ok, len=' + key.length)

const SYS = '你是专业技术文档翻译引擎。把用户给出的英文技术资料精确翻译成中文：专业术语、数字、单位、型号、寄存器名、引脚名（如 VCC、GND、I2C、SCL、SDA、UART、SPI、GPIO、PWM）保持原文不译；保留段落与编号；只输出译文，不要任何解释或前缀。'
async function translate(text) {
  const r = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
    body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'system', content: SYS }, { role: 'user', content: text }], temperature: 0.2 })
  })
  const t = await r.text()
  if (r.status !== 200) return { ok: false, error: 'HTTP ' + r.status + ': ' + t.slice(0, 300) }
  try { const b = JSON.parse(t); return { ok: true, text: b.choices[0].message.content } } catch (e) { return { ok: false, error: t.slice(0, 300) } }
}

// ---- T1 纯文本翻译 ----
console.log('\n===== T1 纯文本翻译 =====')
const sample = 'The STM32F103C8T6 microcontroller features an ARM Cortex-M3 core running at 72 MHz. The I2C1 peripheral supports clock stretching and 7-bit addressing. Connect VCC to 3.3V and GND to ground.\n\nPin PB0 can be configured as a PWM output using TIM3_CH3. The USART1 baud rate is set to 115200.'
const t1 = await translate(sample)
console.log(t1.ok ? 'OK:\n' + t1.text : 'FAIL: ' + t1.error)

// ---- 最小文本 PDF 生成（含正确 xref） ----
function makePdf(lines) {
  const objs = []
  objs.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')
  objs.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n')
  const textOps = 'BT /F1 12 Tf 50 740 Td 16 TL\n' + lines.map((l) => '(' + l.replace(/[\\()]/g, '\\$&') + ') Tj T*').join('\n') + '\nET\n'
  objs.push('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n')
  objs.push('4 0 obj\n<< /Length ' + Buffer.byteLength(textOps) + ' >>\nstream\n' + textOps + 'endstream\nendobj\n')
  objs.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n')
  let out = '%PDF-1.4\n'
  const offsets = []
  for (let i = 0; i < objs.length; i++) { offsets.push(out.length); out += objs[i] }
  const xrefPos = out.length
  out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n'
  for (const off of offsets) out += String(off).padStart(10, '0') + ' 00000 n \n'
  out += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xrefPos + '\n%%EOF\n'
  return Buffer.from(out, 'latin1')
}

// ---- T2 PDF 提取 + 逐页翻译（模拟 pdfProbe → translateText） ----
console.log('\n===== T2 PDF 提取 + 翻译 =====')
mkdirSync(TMP, { recursive: true })
const pdfBuf = makePdf([
  'STM32F103C8T6 Datasheet',
  'The device embeds 64 Kbytes of Flash memory and 20 Kbytes of SRAM.',
  'The I2C interface supports both standard and fast mode, up to 400 kHz.',
  'The TIM3 general-purpose timer provides four independent channels.',
  'Absolute maximum ratings: VDD from 2.0 V to 3.6 V, storage temperature -65 C to +150 C.'
])
writeFileSync(join(TMP, 'sample.pdf'), pdfBuf)
const pdfjs = await import('file:///' + PDFJS)
const doc = await pdfjs.getDocument({ data: new Uint8Array(pdfBuf), useWorkerFetch: false, isEvalSupported: false, disableFontFace: true }).promise
const pages = []
for (let i = 1; i <= doc.numPages; i++) {
  const pg = await doc.getPage(i)
  const tc = await pg.getTextContent()
  pages.push({ page: i, text: tc.items.map((x) => x.str).join(' ') })
}
console.log('提取页数: ' + pages.length)
for (const p of pages) {
  const tr = await translate(p.text)
  console.log('第' + p.page + '页 原文: ' + p.text.slice(0, 80))
  console.log('第' + p.page + '页 译文: ' + (tr.ok ? tr.text.slice(0, 120) : 'FAIL ' + tr.error))
}

// ---- T3 构造 docx + office.mjs extract + 翻译 + package 回填 ----
console.log('\n===== T3 docx 提取 + 翻译 + 回填 =====')
const JSZip = require(JSZIP_DIR)
const zip = new JSZip()
zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
const w = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
const paras = [
  'Introduction to I2C Protocol',
  'I2C uses two bidirectional open-drain lines, SDA and SCL, pulled up with resistors.',
  'The master initiates communication by generating a START condition.',
  'Data is transferred in 8-bit bytes followed by an acknowledge bit from the receiver.'
]
zip.file('word/document.xml', '<?xml version="1.0"?><w:document ' + w + '><w:body>' + paras.map((t) => '<w:p><w:r><w:t>' + t + '</w:t></w:r></w:p>').join('') + '</w:body></w:document>')
const docxBuf = await zip.generateAsync({ type: 'nodebuffer' })
writeFileSync(join(TMP, 'sample.docx'), docxBuf)

function runNode(args, opts) {
  const r = spawnSync(NODE, args, { encoding: 'utf8', ...opts })
  if (r.error) return { ok: false, error: String(r.error.message) }
  const last = (r.stdout || '').trim().split(/\r?\n/).filter(Boolean).pop() || ''
  let parsed = null
  try { parsed = JSON.parse(last) } catch (e) {}
  return { ok: r.status === 0, stdout: r.stdout, stderr: r.stderr, parsed }
}
const ext = runNode([OFFICE_MJS, 'extract', join(TMP, 'sample.docx'), JSZIP_DIR])
if (!ext.ok || !ext.parsed) { console.log('FAIL office extract: ' + (ext.stderr || ext.error)) } else {
  const chunks = ext.parsed.chunks || []
  console.log('提取段数: ' + chunks.length + ' type=' + ext.parsed.type)
  const translated = []
  for (const c of chunks) {
    const tr = await translate(c.text)
    translated.push({ key: c.key, translated: tr.ok ? tr.text : '[FAIL]' })
    console.log('段[' + c.key.split('#')[0] + ']: ' + c.text.slice(0, 60) + ' => ' + (tr.ok ? tr.text.slice(0, 60) : tr.error))
  }
  writeFileSync(join(TMP, 'chunks.json'), JSON.stringify(translated))
  const pkg = runNode([OFFICE_MJS, 'package', join(TMP, 'sample.docx'), JSZIP_DIR, join(TMP, 'chunks.json'), '译文_sample.docx'])
  if (!pkg.ok || !pkg.parsed || !pkg.parsed.base64) { console.log('FAIL office package: ' + (pkg.stderr || pkg.error)) } else {
    const outBuf = Buffer.from(pkg.parsed.base64, 'base64')
    const zip2 = await JSZip.loadAsync(outBuf)
    const xml = await zip2.file('word/document.xml').async('string')
    const zh = xml.match(/<w:t>([^<]*)<\/w:t>/g) || []
    console.log('回填 w:t 数: ' + zh.length + '，示例: ' + zh[0])
    const hasChinese = /[\u4e00-\u9fff]/.test(xml)
    console.log(hasChinese ? 'OK：译文已回填进 docx' : 'FAIL：回填后无中文')
  }
}
rmSync(TMP, { recursive: true, force: true })
console.log('\n===== 自测结束 =====')
