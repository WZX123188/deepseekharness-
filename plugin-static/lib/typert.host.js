// 手写 typert host 清单：参数/返回值用 strict 编解码 + z.unknown() 宽松 schema，
// 既通过 typert-loader 的 strict 校验，又对任意 JSON 放行（免编译器）。
// 注意：此清单必须与 lib/index.js 的 DshClientFeaturesService 全部公开方法一一对应，
// 漏一个就会让该 RPC 在宿主侧 404（历史教训：v2.1.0 起的视觉/翻译/壁纸方法曾长期缺失，
// 导致识图「保存 Key / 测试 / 识别 / 打开官网」与 PDF/Office 翻译全部失败）。
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
    // 视图模式（识图）
    direct('getVisionStatus'),
    direct('setVisionKey', [argsParam()]),
    direct('clearVisionKey'),
    direct('testVision'),
    direct('seeImage', [argsParam()]),
    direct('openVisionSite'),
    // 翻译（文本 / PDF 实时 / Office 实时）
    direct('translateText', [argsParam()]),
    direct('translatePdf', [argsParam()]),
    direct('pdfProbe', [argsParam()]),
    direct('officeProbe', [argsParam()]),
    direct('translateOffice', [argsParam()]),
    direct('saveOffice', [argsParam()]),
    // 对话框文档暂存
    direct('saveDraftFile', [argsParam()]),
    // 壁纸
    direct('getWallpaper'),
    direct('setWallpaper', [argsParam()]),
  ],
}
