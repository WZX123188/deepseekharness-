// 手写 typert host 清单：参数/返回值用 strict 编解码 + z.unknown() 宽松 schema，
// 既通过 typert-loader 的 strict 校验，又对任意 JSON 放行（免编译器）。
import { z } from 'zod'

const LOOSE = { mode: 'strict', typeSymbol: 'json', schema: z.unknown() }
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
  ],
}
