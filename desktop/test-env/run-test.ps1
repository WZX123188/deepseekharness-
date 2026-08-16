# 隔离测试环境启动脚本
# 用途：用【3199 端口 + 独立数据目录 + 独立单实例锁】起一个测试实例，
#       绝不触碰正在运行的正式客户端（3180 端口），测试不会再把正式客户端搞闪退。
# 用法：右键/命令行运行本脚本即可。测试完跑 stop-test.ps1 关闭。
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$dshHome = Join-Path $root '.dsh'                       # 独立数据目录（与正式客户端完全隔离）
$profileDir = Join-Path $dshHome 'profiles\web'
$port = 3199

# 1) 先停掉旧测试实例（只杀 3199，不碰 3180）
& (Join-Path $root 'stop-test.ps1') | Out-Null

# 2) 准备隔离数据目录 + 部署功能插件（从源码最新版复制）
New-Item -ItemType Directory -Force -Path $profileDir | Out-Null
$srcRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent   # G:\dsh客户端
robocopy (Join-Path $srcRoot 'plugin-static') (Join-Path $profileDir 'node_modules\dsh-client-static') /E /NFL /NDL /NJH /NJS /NP /R:1 /W:1 | Out-Null
robocopy (Join-Path $srcRoot 'desktop\gate') (Join-Path $profileDir 'node_modules\dsh-client-gate') /E /NFL /NDL /NJH /NJS /NP /R:1 /W:1 | Out-Null
if (-not (Test-Path (Join-Path $profileDir 'package.json'))) {
  [System.IO.File]::WriteAllText((Join-Path $profileDir 'package.json'), '{"name":"dsh-profile-web","private":true,"dependencies":{},"dsh":{"profile":{"bundles":["@deepseek-ai/dsh-base","@deepseek-ai/dsh-web-app"]}}}')
}
[System.IO.File]::WriteAllText((Join-Path $profileDir 'cordis.patch.yml'), "- insert:`n    - id: dsh-client-gate`n      name: dsh-client-gate`n    - id: dsh-client-static`n      name: dsh-client-static`n")

# 3) 用内置 Node + 内置 DSH 起 web（3199 端口，DSH_HOME 隔离）
$node = Join-Path $srcRoot 'desktop\node\node.exe'
if (-not (Test-Path $node)) { $node = 'C:\Program Files\nodejs\node.exe' }
$bin = Join-Path $srcRoot 'desktop\dsh-runtime\node_modules\@deepseek-ai\dsh\lib\bin.js'
$env:DSH_HOME = $dshHome
$env:DSH_CLIENT_PORT = "$port"
$p = Start-Process -FilePath $node -ArgumentList @($bin,'web','--port',"$port") -WorkingDirectory $root -RedirectStandardOutput (Join-Path $root 'out.log') -RedirectStandardError (Join-Path $root 'err.log') -WindowStyle Hidden -PassThru
$p.Id | Out-File (Join-Path $root 'pid.txt')

Write-Host "测试实例已启动 PID $($p.Id)，端口 $port，数据目录 $dshHome"
Write-Host '等待就绪…'
$ok = $false
for ($i = 0; $i -lt 45; $i++) {
  Start-Sleep -Seconds 2
  try { $r = Invoke-WebRequest -Uri "http://127.0.0.1:$port/" -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { $ok = $true; break } } catch {}
}
if ($ok) { Write-Host "✅ 测试环境就绪：http://127.0.0.1:$port （正式客户端 3180 不受影响）" }
else { Write-Host '⚠️ 未在预期时间内就绪，看 err.log' }
