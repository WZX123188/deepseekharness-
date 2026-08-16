# One-click backup: chat sessions, configs, fixed gate sources -> BACKUP\
# NOTE: this file must be UTF-8 WITH BOM so PowerShell 5.1 reads the Chinese paths correctly.
# Usage: pwsh -File backup.ps1  (or: & .\backup.ps1)
$ErrorActionPreference = 'Continue'

$envRoot  = $PSScriptRoot
if (-not $envRoot) { $envRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition }
$backup   = Join-Path $envRoot 'BACKUP'
$sessDir  = Join-Path $backup 'sessions'
$cfgDir   = Join-Path $backup 'config'
$gateDir  = Join-Path $backup 'gate'

New-Item -ItemType Directory -Force -Path $sessDir | Out-Null
New-Item -ItemType Directory -Force -Path $cfgDir  | Out-Null
New-Item -ItemType Directory -Force -Path $gateDir | Out-Null

Write-Host '== Backing up chat sessions =='
$srcDecoded = 'D:\新建文件夹\会话备份-20260816\decoded'
if (Test-Path $srcDecoded) {
  Get-ChildItem $srcDecoded -Filter '*.jsonl' -File | ForEach-Object {
    Copy-Item $_.FullName (Join-Path $sessDir $_.Name) -Force
    Write-Host "   session: $($_.Name) ($([math]::Round($_.Length/1KB)) KB)"
  }
} else { Write-Host '   (decoded folder not found, skipped)' }

$srcCdrive = 'D:\新建文件夹\_cdrive_ee1e156b.jsonl'
if (Test-Path $srcCdrive) {
  Copy-Item $srcCdrive (Join-Path $sessDir '_cdrive_ee1e156b.jsonl') -Force
  Write-Host '   cdrive capture copied'
}

$liveSess = Get-ChildItem (Join-Path $envRoot 'desktop\dsh\data\.dsh\sessions') -Recurse -Filter '*.jsonl.zstd' -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($liveSess) {
  $dst = Join-Path $sessDir ('live-' + $liveSess.Name)
  Copy-Item $liveSess.FullName $dst -Force
  Write-Host "   live session: $dst"
} else { Write-Host '   (no live session found)' }

Write-Host '== Backing up configs =='
$cfgs = @(
  'G:\dsh客户端\desktop\dsh\data\.dsh\dsh-client-config.json',
  'C:\Users\WZX\AppData\Roaming\DeepSeekClient\.dsh\dsh-client-config.json'
)
foreach ($c in $cfgs) {
  if (Test-Path $c) {
    $name = ($c -replace '[\\:]', '_')
    Copy-Item $c (Join-Path $cfgDir $name) -Force
    Write-Host "   config: $name"
  }
}
Copy-Item (Join-Path $envRoot 'desktop\dsh\data\.dsh\profiles\web\cordis.patch.yml') (Join-Path $cfgDir 'cordis.patch.yml') -Force -ErrorAction SilentlyContinue

Write-Host '== Backing up fixed gate sources =='
foreach ($g in @('desktop\gate\index.js', 'plugin\index.js')) {
  $p = Join-Path $envRoot $g
  if (Test-Path $p) {
    $name = ($g -replace '[\\]', '_')
    Copy-Item $p (Join-Path $gateDir $name) -Force
    Write-Host "   gate: $name"
  }
}

$manifest = @{ backupTime = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss'); generatedBy = 'backup.ps1' } | ConvertTo-Json
[System.IO.File]::WriteAllText((Join-Path $backup 'manifest.json'), $manifest, (New-Object System.Text.UTF8Encoding($false)))

Write-Host "== Done. Backup root: $backup"
