# Initialize test environment: build isolated DSH_HOME, copy gate/plugin-static, write clean profile
# Usage: pwsh -File init-home.ps1   (or: & .\init-home.ps1)
$ErrorActionPreference = 'Stop'

$envRoot   = Split-Path -Parent $MyInvocation.MyCommand.Path          # G:\dsh客户端\test-env
$srcRes    = Join-Path $envRoot '..\desktop\dsh\resources'            # production resources (read-only ref)
$testHome  = Join-Path $envRoot 'home'
$profile   = Join-Path $testHome 'profiles\web'

Write-Host "== Init test DSH_HOME: $testHome"

# 1) rebuild test home (test data, safe to delete)
if (Test-Path $testHome) { Remove-Item -Recurse -Force $testHome }
New-Item -ItemType Directory -Force -Path $profile | Out-Null

# 2) profile package.json (same shape as main.js ensureFeatures, no BOM)
$pkg = @{
  name = 'dsh-profile-web'
  private = $true
  dependencies = @{}
  dsh = @{ profile = @{ bundles = @('@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app') } }
} | ConvertTo-Json -Depth 6
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Join-Path $profile 'package.json'), $pkg, $utf8NoBom)

# 3) cordis.patch.yml mounts gate + static
$patch = '- insert:' + "`n" + '    - id: dsh-client-gate' + "`n" + '      name: dsh-client-gate' + "`n" + '    - id: dsh-client-static' + "`n" + '      name: dsh-client-static' + "`n"
[System.IO.File]::WriteAllText((Join-Path $profile 'cordis.patch.yml'), $patch, $utf8NoBom)

# 4) copy gate / plugin-static into test profile
Copy-Item -Recurse -Force (Join-Path $srcRes 'gate')          (Join-Path $profile 'node_modules\dsh-client-gate')   -ErrorAction Stop
Copy-Item -Recurse -Force (Join-Path $srcRes 'plugin-static') (Join-Path $profile 'node_modules\dsh-client-static') -ErrorAction Stop

# 5) default permission mode: trust (same as production; switch to ask by editing this file)
$cfg = @{ permissionMode = 'trust' } | ConvertTo-Json -Compress
[System.IO.File]::WriteAllText((Join-Path $testHome 'dsh-client-config.json'), $cfg, $utf8NoBom)

Write-Host '== Done. Test home ready.'
Write-Host '   start: .\run-test.ps1   (port 3197)'
Write-Host '   unit : node test-gate.mjs'
