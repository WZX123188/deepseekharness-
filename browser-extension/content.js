// DSH 网页 PDF 实时翻译 - content script
// 在 PDF 页面注入可关闭的悬浮翻译按钮 + 译文面板；点按钮通知后台逐页翻译，结果实时追加
(() => {
  const isPdf =
    document.contentType === 'application/pdf' ||
    /\.pdf($|\?)/i.test(location.href) ||
    /web\/viewer\.html/i.test(location.href)
  if (!isPdf) return
  if (window.__dshPdfInjected) return
  window.__dshPdfInjected = true

  const css =
    '#dsh-pdf-btn{position:fixed;right:24px;bottom:64px;z-index:2147483646;background:#4d6bfe;color:#fff;border:none;border-radius:20px;padding:10px 16px;font:600 14px/1 system-ui,"Microsoft YaHei",sans-serif;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.35)}' +
    '#dsh-pdf-btn:hover{filter:brightness(1.1)}' +
    '#dsh-pdf-panel{position:fixed;right:16px;bottom:16px;top:16px;width:min(460px,92vw);z-index:2147483646;background:#fff;color:#222;border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,.4);display:none;flex-direction:column;overflow:hidden;font:14px/1.6 system-ui,"Microsoft YaHei",sans-serif}' +
    '#dsh-pdf-panel .hd{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid #e5e7eb;font-weight:600}' +
    '#dsh-pdf-panel .st{font-size:12px;color:#999;font-weight:400}' +
    '#dsh-pdf-panel .hd button{background:none;border:none;font-size:16px;cursor:pointer;color:#666;margin-left:auto;padding:2px 8px;border-radius:6px}' +
    '#dsh-pdf-panel .hd button:hover{background:#f0f0f0}' +
    '#dsh-pdf-panel .bd{flex:1;min-height:0;overflow-y:auto;padding:10px 12px;display:flex;flex-direction:column;gap:10px}' +
    '#dsh-pdf-panel .tip{color:#888;font-size:13px;text-align:center;padding:20px 0}' +
    '#dsh-pdf-panel .card{border:1px solid #e5e7eb;border-radius:10px;padding:10px 12px}' +
    '#dsh-pdf-panel .card .pg{font-weight:600;margin-bottom:8px}' +
    '#dsh-pdf-panel .card .col+.col{margin-top:8px}' +
    '#dsh-pdf-panel .card .lab{font-size:12px;color:#999;margin-bottom:2px}' +
    '#dsh-pdf-panel .card .txt{white-space:pre-wrap;font-size:13px}' +
    '#dsh-pdf-panel .card .tran{color:#111}' +
    '#dsh-pdf-panel .err{color:#e5484d;font-size:13px;white-space:pre-wrap}'
  const style = document.createElement('style')
  style.textContent = css
  ;(document.head || document.documentElement).appendChild(style)

  const btn = document.createElement('button')
  btn.id = 'dsh-pdf-btn'
  btn.textContent = '📄 翻译'
  btn.title = 'DSH 网页 PDF 实时翻译'
  btn.addEventListener('click', () => {
    panel.style.display = 'flex'
    const body = document.getElementById('dsh-pdf-body')
    const st = document.getElementById('dsh-pdf-status')
    body.innerHTML = '<div class="tip">正在获取 PDF 并逐页实时翻译…（翻译由本机 DeepSeekClient 完成）</div>'
    if (st) st.textContent = ''
    try { chrome.runtime.sendMessage({ type: 'dsh-pdf-translate', url: location.href }) } catch (e) {}
  })

  const panel = document.createElement('div')
  panel.id = 'dsh-pdf-panel'
  panel.innerHTML =
    '<div class="hd"><span>📄 PDF 实时翻译</span><span class="st" id="dsh-pdf-status"></span>' +
    '<button id="dsh-pdf-hide" title="关闭面板（本页仍可重新打开）">✕</button>' +
    '<button id="dsh-pdf-off" title="本页不再显示按钮">🚫</button></div>' +
    '<div class="bd" id="dsh-pdf-body"><div class="tip">点击右下角「📄 翻译」按钮开始逐页实时翻译</div></div>'

  ;(document.documentElement || document.body).appendChild(btn)
  ;(document.documentElement || document.body).appendChild(panel)

  const offBtn = document.getElementById('dsh-pdf-off')
  const hideBtn = document.getElementById('dsh-pdf-hide')
  if (offBtn) offBtn.addEventListener('click', () => { panel.remove(); btn.remove() })
  if (hideBtn) hideBtn.addEventListener('click', () => { panel.style.display = 'none' })

  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || typeof msg.type !== 'string') return
    const body = document.getElementById('dsh-pdf-body')
    const st = document.getElementById('dsh-pdf-status')
    if (msg.type === 'dsh-pdf-page') {
      if (st) st.textContent = '第 ' + msg.page + ' 页'
      if (!body) return
      const card = document.createElement('div')
      card.className = 'card'
      const orig = document.createElement('div')
      orig.className = 'txt'
      orig.textContent = msg.original
      const tran = document.createElement('div')
      tran.className = 'txt tran'
      tran.textContent = msg.translated
      const c1 = document.createElement('div')
      c1.className = 'col'
      const l1 = document.createElement('div')
      l1.className = 'lab'
      l1.textContent = '原文'
      c1.appendChild(l1); c1.appendChild(orig)
      const c2 = document.createElement('div')
      c2.className = 'col'
      const l2 = document.createElement('div')
      l2.className = 'lab'
      l2.textContent = '译文'
      c2.appendChild(l2); c2.appendChild(tran)
      const pg = document.createElement('div')
      pg.className = 'pg'
      pg.textContent = '第 ' + msg.page + ' 页'
      card.appendChild(pg); card.appendChild(c1); card.appendChild(c2)
      body.appendChild(card)
      body.scrollTop = body.scrollHeight
    } else if (msg.type === 'dsh-pdf-done') {
      if (st) st.textContent = '✓ 完成 ' + msg.total + ' 页'
    } else if (msg.type === 'dsh-pdf-error') {
      if (st) st.textContent = '⚠ 出错'
      if (body) {
        const d = document.createElement('div')
        d.className = 'err'
        d.textContent = msg.message
        body.appendChild(d)
      }
    }
  })
})()
