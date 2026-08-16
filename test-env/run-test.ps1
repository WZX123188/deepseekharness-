# Start test instance: isolated DSH_HOME + port 3197. Verify plugin changes don't crash the instance.
# Usage: pwsh -File run-test.ps1   (auto-stops after verification)
$ErrorActionPreference = 'Stop'

$envRoot = $PSScriptRoot
$srcRes  = Join-Path $envRoot '..\desktop\dsh\resources'
$node    = Join-Path $srcRes 'node\node.exe'
$bin     = Join-Path $srcRes 'dsh-runtime\node_modules\@deepseek-ai\dsh\lib\bin.js'
$testHome = Join-Path $envRoot 'home'
$port    = 3197

if (-not (Test-Path (Join-Path $testHome 'profiles\web\package.json'))) {
  Write-Host 'Test home not initialized. Run init-home.ps1 first.'
  exit 1
}

Write-Host "== Start test instance  port=$port  DSH_HOME=$testHome"
$env:DSH_HOME = $testHome
$proc = Start-Process -FilePath $node -ArgumentList @($bin, 'web', '--port', $port) `
  -WorkingDirectory $testHome -WindowStyle Hidden -PassThru `
  -RedirectStandardOutput (Join-Path $envRoot 'test-out.log') -RedirectStandardError (Join-Path $envRoot 'test-err.log')

try {
  $ok = $false
  for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Milliseconds 500
    if ($proc.HasExited) { break }
    try {
      $r = Invoke-WebRequest -Uri "http://127.0.0.1:$port/" -TimeoutSec 2 -UseBasicParsing
      if ($r.StatusCode -eq 200) { $ok = $true; break }
    } catch {}
  }
  if ($ok) {
    Write-Host '== PASS: test instance HTTP 200, plugins loaded without crash =='
  } else {
    Write-Host "== FAIL: test instance not ready (exit=$($proc.ExitCode)) =="
    Write-Host '--- stderr ---'
    if (Test-Path (Join-Path $envRoot 'test-err.log')) { Get-Content (Join-Path $envRoot 'test-err.log') -Tail 40 }
  }
} finally {
  if (-not $proc.HasExited) { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue }
}
