// DSH 网页 PDF 实时翻译 - 后台 service worker
// 职责：下载 PDF → 交本机 DeepSeekClient(127.0.0.1:3190) 解析/OCR/翻译 → 逐页推送结果给 content script
const API = 'http://127.0.0.1:3190'

async function post(route, body) {
  try {
    const r = await fetch(API + route, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    const j = await r.json().catch(() => ({}))
    return { status: r.status, ok: r.ok, ...j }
  } catch (e) {
    return { ok: false, status: 0, error: '无法连接本机翻译服务（' + String((e && e.message) || e) + '）。请先启动 DeepSeekClient。' }
  }
}

function base64FromBuffer(buf) {
  const bytes = new Uint8Array(buf)
  let bin = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK))
  }
  return btoa(bin)
}

async function runTranslate(url) {
  try {
    let buf
    try {
      const resp = await fetch(url, { credentials: 'omit' })
      if (!resp.ok) throw new Error('PDF 下载失败 HTTP ' + resp.status)
      buf = await resp.arrayBuffer()
    } catch (e) {
      throw new Error('无法读取 PDF：' + String((e && e.message) || e))
    }
    if (!buf || buf.byteLength === 0) throw new Error('PDF 内容为空')

    const dataUrl = 'data:application/pdf;base64,' + base64FromBuffer(buf)
    const probe = await post('/pdf-probe', { pdf: dataUrl })
    if (!probe.ok) throw new Error(probe.error || 'PDF 解析失败')
    if (probe.mode === 'scan-nokey') throw new Error('扫描版 PDF（无文字层）需要先在 DeepSeekClient「设置 → 视图模式」配置智谱视觉 Key')

    const pages = probe.pages || []
    for (let i = 0; i < pages.length; i++) {
      const pg = pages[i]
      let original = ''
      if (probe.mode === 'scan') {
        const ocr = await post('/ocr', { image: pg.image })
        original = ocr.ok ? ocr.text : '[OCR失败] ' + (ocr.error || '')
      } else {
        original = pg.text || ''
      }
      const tr = await post('/translate', { text: original })
      chrome.runtime.sendMessage({ type: 'dsh-pdf-page', page: pg.page, original, translated: tr.ok ? tr.text : '[翻译失败] ' + (tr.error || '') })
    }
    chrome.runtime.sendMessage({ type: 'dsh-pdf-done', total: pages.length, mode: probe.mode })
  } catch (e) {
    chrome.runtime.sendMessage({ type: 'dsh-pdf-error', message: String((e && e.message) || e) })
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'dsh-pdf-translate') {
    runTranslate(msg.url || '')
    return false
  }
})
