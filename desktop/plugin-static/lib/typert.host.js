// 手写 typert host 清单：参数/返回值用 strict 编解码 + 宽松 schema（伪 zod：带 _zod 标志 + parse 透传），
// 既通过 typert-loader / registry 的 strict 校验，又对任意 JSON 放行（免编译器、免 zod 依赖）。
// 2026-08-17：去掉 `import { z } from 'zod'`（plugin-static 不在 zod 解析链上，导致清单从未注册、RPC 全 404）。

const LOOSE_SCHEMA = { _zod: true, parse: (v) => v }
const LOOSE = { mode: 'strict', typeSymbol: 'json', schema: LOOSE_SCHEMA }
const NS = 'dshClientFeatures'
const PKG = 'dsh-client-static'

function direct(method, params) {
  return {
    id: `${PKG}#${NS}/${method}`,
    service: NS,
    namespace: NS,
    method,
    invocation: { kind: 'direct' },
    parameters: params || [],
    result: LOOSE,
  }
}
function argsParam() {
  return { name: 'args', wire: 'args', source: 'json', codec: LOOSE }
}

export const TYPERT = {
  package: PKG,
  face: 'host',
  schemas: [],
  model: { services: [], events: [], objects: [] },
  invocations: [
    direct('deepseekBalance'),
    direct('getUsage'),
    direct('checkUpdate'),
    direct('doUpdate'),
    direct('getPermissionMode'),
    direct('setPermissionMode', [argsParam()]),
    direct('listTools'),
    direct('installTool', [argsParam()]),
    direct('setToolEnabled', [argsParam()]),
    direct('uninstallTool', [argsParam()]),
    direct('listPlugins'),
    direct('installPlugin', [argsParam()]),
    direct('setPluginEnabled', [argsParam()]),
    direct('uninstallPlugin', [argsParam()]),
    direct('listProjects'),
    direct('createProject', [argsParam()]),
    direct('openFeedback', [argsParam()]),
    // 视图/识图（v3.0.1 起就有，但漏注册导致一直 404 —— 2026-08-17 补全）
    direct('getVisionStatus'),
    direct('setVisionKey', [argsParam()]),
    direct('clearVisionKey'),
    direct('testVision'),
    direct('seeImage', [argsParam()]),
    direct('openVisionSite'),
    // 翻译（文字/PDF/Office/保存）
    direct('translateText', [argsParam()]),
    direct('translatePdf', [argsParam()]),
    direct('translateOffice', [argsParam()]),
    direct('saveOffice', [argsParam()]),
    // 壁纸
    direct('getWallpaper'),
    direct('setWallpaper', [argsParam()]),
    // v3.0.2 聊天附件解析
    direct('parseAttachment', [argsParam()]),
    // v3.0.3 聊天附件本地缓存（返回本地路径供 agent 读取）
    direct('cacheAttachment', [argsParam()]),
    // v5.1.3 删除附件（点叉叉移除时删文件+记录）
    direct('deleteAttachment', [argsParam()]),
    // v5.0.0 手机远程信息（配对码+端口+本机IP）
    direct('getRemoteInfo'),
    // v5.3.0 多轮对话：读取活动会话消息流
    direct('getChatMessages'),
    // v5.5.0 多会话 + 发文件 + 思考同步
    direct('listSessions'),
    direct('createSession'),
    direct('getSessionMessages', [argsParam()]),
    direct('sendToSession', [argsParam()]),
    direct('getAgentStatus'),
    direct('listPhoneInbox'),
    direct('pushFileToPhone', [argsParam()]),
  ],
}
