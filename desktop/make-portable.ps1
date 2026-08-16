# 从 release\win-unpacked 生成便携版（绿色 zip）：解压即用，数据随程序目录 data\ 走。
# 用 robocopy + 7z，避免 PowerShell Copy-Item/Compress-Archive 在 node_modules 长路径上失败。
$ErrorActionPreference = 'Stop'
$version = (Get-Content (Join-Path $PSScriptRoot 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json).version
$src = Join-Path $PSScriptRoot 'release\win-unpacked'
$dst = Join-Path $PSScriptRoot ('release\DeepSeekClient-portable-' + $version)
$zip = Join-Path $PSScriptRoot ('release\DeepSeekClient-portable-' + $version + '-win-x64.zip')
$seven = Join-Path $PSScriptRoot 'node_modules\7zip-bin\win\x64\7za.exe'

if (-not (Test-Path $src)) { throw "win-unpacked 不存在，请先跑 electron-builder --win nsis" }
if (-not (Test-Path $seven)) { throw '7za.exe 未找到（node_modules/7zip-bin）' }

# 1) 复制解包目录（robocopy 支持长路径）
if (Test-Path $dst) { Remove-Item -Recurse -Force $dst }
New-Item -ItemType Directory -Force -Path $dst | Out-Null
robocopy $src $dst /E /NFL /NDL /NJH /NJS /NP /R:1 /W:1 | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed (exit $LASTEXITCODE)" }

# 2) 便携标记 + 数据目录（portable.dat 让 main.js 进入便携模式，数据放 data\）
New-Item -ItemType File -Path (Join-Path $dst 'portable.dat') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $dst 'data') -Force | Out-Null

# 3) 压缩（7z，支持长路径）
if (Test-Path $zip) { Remove-Item -Force $zip }
Push-Location $dst
& $seven a -tzip -mx=5 $zip '*'
$code = $LASTEXITCODE
Pop-Location
if ($code -ne 0) { throw "7z failed (exit $code)" }

Write-Output "便携版已生成：$zip ($([Math]::Round((Get-Item $zip).Length / 1MB, 1)) MB)"
