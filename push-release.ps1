# 一键推送 + 创建 GitHub Release（自动重试 + 凭据安全处理，不打印 token）
# 用法：pwsh -File push-release.ps1 -Tag v4.0.0 -Asset "G:\dsh客户端\desktop\release\DeepSeekClient-portable-4.0.0-win-x64.zip"
param(
  [Parameter(Mandatory=$true)][string]$Tag,
  [string]$Asset = "",
  [string]$Repo = "WZX123188/deepseekharness-",
  [int]$MaxRetries = 6,
  [int]$RetryWaitSec = 30
)
$ErrorActionPreference = 'Continue'
$root = $PSScriptRoot
Set-Location $root

# 1) 推送 main + tags（自动重试）
$pushed = $false
for ($i = 1; $i -le $MaxRetries; $i++) {
  $out = git push -u origin main --tags 2>&1
  if ($LASTEXITCODE -eq 0) { $pushed = $true; Write-Host "[push] 成功（第 $i 次尝试）"; break }
  Write-Host "[push] 第 $i 次失败：$($out | Select-Object -Last 1)"
  if ($i -lt $MaxRetries) { Start-Sleep -Seconds $RetryWaitSec }
}
if (-not $pushed) { Write-Host "[push] 失败，跳过 release"; exit 1 }

# 2) 取 token（git credential manager，不打印）
function Get-GitToken {
  try {
    $input = "protocol=https`nhost=github.com`n`n"
    $cred = $input | git credential fill 2>$null
    foreach ($line in $cred) {
      if ($line -match '^password=(.+)$') { return $matches[1] }
    }
  } catch {}
  return $null
}
$token = Get-GitToken
if (-not $token) { Write-Host "[release] 未取到凭据，跳过 release（请手动在 GitHub 创建）"; exit 0 }

# 3) 创建/更新 release
$headers = @{ Authorization = "Bearer $token"; "User-Agent" = "dsh-release-script"; "Accept" = "application/vnd.github+json" }
$tagObj = @{ tag_name = $Tag; name = $Tag; body = "自动发布 $Tag"; draft = $false; prerelease = $false } | ConvertTo-Json -Compress
try {
  $rel = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases" -Method Post -Headers $headers -Body $tagObj -TimeoutSec 30
  Write-Host "[release] 已创建 release id=$($rel.id)"
} catch {
  if ($_.Exception.Response.StatusCode -eq 422) {
    try { $rel = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/tags/$Tag" -Headers $headers -TimeoutSec 30; Write-Host "[release] 已存在 id=$($rel.id)" } catch { Write-Host "[release] 查询失败"; exit 1 }
  } else { Write-Host "[release] 创建失败：$($_.Exception.Message)"; exit 1 }
}

# 4) 上传 asset（若提供）
if ($Asset -and (Test-Path $Asset)) {
  $name = Split-Path $Asset -Leaf
  $uploadUrl = $rel.upload_url -replace '\{.*\}', "?name=$name"
  try {
    Invoke-RestMethod -Uri $uploadUrl -Method Post -Headers @{ Authorization = "Bearer $token"; "User-Agent" = "dsh-release-script" } -ContentType "application/zip" -InFile $Asset -TimeoutSec 600
    Write-Host "[release] 已上传 asset: $name"
  } catch { Write-Host "[release] 上传 asset 失败：$($_.Exception.Message)" }
}
Write-Host "[done]"
