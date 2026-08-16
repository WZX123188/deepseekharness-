// 临时验证：office.mjs 提取链路 + 模拟 parseAttachment 逻辑
import { execFileSync } from 'node:child_process'
import { writeFileSync, unlinkSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const JSZIP = 'G:/dsh客户端/desktop/dsh/resources/dsh-runtime/node_modules/pdf-tools/node_modules/jszip/lib/index.js'
const OFFICE = 'G:/dsh客户端/desktop/dsh/resources/plugin-static/lib/office.mjs'
const JSZip = require(JSZIP)

const tmp = mkdtempSync(join(tmpdir(), 'att-test-'))

async function testDocx() {
  const zip = new JSZip()
  zip.file('word/document.xml', '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Hello DSH attachment test \u9644\u4ef6\u6d4b\u8bd5 123</w:t></w:r></w:p></w:body></w:document>')
  const buf = await zip.generateAsync({ type: 'nodebuffer' })
  const f = join(tmp, 'test.docx')
  writeFileSync(f, buf)
  const out = execFileSync(process.execPath, [OFFICE, 'extract', f, JSZIP], { encoding: 'utf8' })
  const parsed = JSON.parse(out.trim())
  console.log('docx extract:', parsed.type, 'chunks=', parsed.chunks.length, 'text=', JSON.stringify(parsed.chunks.map(c => c.text).join('\n')))
  unlinkSync(f)
}

async function testXlsx() {
  const zip = new JSZip()
  zip.file('xl/sharedStrings.xml', '<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>Sheet data A1</t></si><si><t>Sheet data B2</t></si></sst>')
  zip.file('xl/worksheets/sheet1.xml', '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c></row></sheetData></worksheet>')
  const buf = await zip.generateAsync({ type: 'nodebuffer' })
  const f = join(tmp, 'test.xlsx')
  writeFileSync(f, buf)
  const out = execFileSync(process.execPath, [OFFICE, 'extract', f, JSZIP], { encoding: 'utf8' })
  const parsed = JSON.parse(out.trim())
  console.log('xlsx extract:', parsed.type, 'chunks=', parsed.chunks.length, 'text=', JSON.stringify(parsed.chunks.map(c => c.text).join('\n')))
  unlinkSync(f)
}

try {
  await testDocx()
  await testXlsx()
  console.log('ALL OK')
} catch (e) {
  console.error('FAIL:', e.message)
  process.exit(1)
}
