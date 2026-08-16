// 精简内置 DSH 运行时：删除运行时永不加载的冗余文件，只保留网页版实际需要的部分。
// 用法：node strip-runtime.mjs [dsh-runtime根目录]
import { readdirSync, rmSync, statSync, unlinkSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const roots = process.argv.slice(2)
if (roots.length === 0) roots.push('G:/dsh客户端/desktop/dsh-runtime/node_modules')

const DEL_FILE = /\.(map|d\.ts|pdb)$/i          // 源映射 / 类型定义 / 调试符号（永不加载）
const DEL_NAME = /^(readme|changelog|history|changes|contributing|authors)/i  // 说明文档
const DEL_TEST = /\.(test|spec)\./              // 测试文件
const DEL_DIR = /^(test|tests|__tests__|example|examples|benchmark|benchmarks)$/i

let files = 0
let bytes = 0

function walk(dir, inNodePty) {
  let entries
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
  for (const ent of entries) {
    const full = join(dir, ent.name)
    if (ent.isDirectory()) {
      const isPty = inNodePty || ent.name === 'node-pty'
      if (!inNodePty && DEL_DIR.test(ent.name)) {
        try { rmSync(full, { recursive: true, force: true }); files++ } catch {}
        continue
      }
      walk(full, isPty)
    } else if (ent.isFile()) {
      let del = DEL_FILE.test(ent.name) || DEL_NAME.test(ent.name) || DEL_TEST.test(ent.name)
      if (inNodePty) {
        // node-pty：只留 win32-x64 预编译，删其它平台二进制与 C++/python 源码
        if (full.includes('prebuilds') && !full.includes('win32-x64')) del = true
        if (/\.(cc|h|py|gyp|mk|sh|bat|ps1)$/i.test(ent.name)) del = true
      }
      if (del) {
        try { bytes += statSync(full).size; unlinkSync(full); files++ } catch {}
      }
    }
  }
}

const t0 = Date.now()
for (const r of roots) { if (existsSync(r)) walk(r, false) }
console.log(`[strip] 删除 ${files} 个文件，释放 ${(bytes / 1048576).toFixed(1)} MB，耗时 ${Date.now() - t0}ms`)
