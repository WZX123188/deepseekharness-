# DSH 客户端守护脚本（watchdog）
# 作用：持续探测客户端后端（默认 3180 端口）。连续探测失败达到阈值 → 判定「连接失败/卡死」→ 自动重启客户端。
# 判定标准（可调）：默认每 30 秒探测一次，连续 3 次失败（约 90 秒）触发重启。
#   -FailThreshold 连续失败次数   -CheckInterval 探测间隔秒数   -Port 端口   -ProbeTimeoutMs 单次超时
# 运行方式（隐藏窗口）：
#   Start-Process powershell -ArgumentList '-ExecutionPolicy Bypass -WindowStyle Hidden -File "G:\dsh客户端\watchdog.ps1"'
# 或双击 start-watchdog.bat。日志写入 G:\dsh客户端\watchdog.log。
param(
  [int]$Port = 3180,
  [int]$FailThreshold = 3,
  [int]$CheckInterval = 30,
  [int]$ProbeTimeoutMs = 5000,
  [string]$ClientExe = "G:\dsh客户端\desktop\dsh\DeepSeekClient.exe"
)

$log = Join-Path $PSScriptRoot 'watchdog.log'
$utf8 = New-Object System.Text.UTF8Encoding($false)

function Write-Log($msg) {
  $line = (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + '  ' + $msg
  try { [System.IO.File]::AppendAllText($log, $line + "`r`n", $utf8) } catch {}
}

Write-Log "watchdog started: port=$Port threshold=$FailThreshold interval=${CheckInterval}s exe=$ClientExe"
$failCount = 0

while ($true) {
  $ok = $false
  try {
    $req = [System.Net.HttpWebRequest]::Create("http://127.0.0.1:$Port/")
    $req.Timeout = $ProbeTimeoutMs
    $req.Method = 'GET'
    $resp = $req.GetResponse()
    if ($resp.StatusCode -eq 200) { $ok = $true }
    $resp.Close()
  } catch { $ok = $false }

  if ($ok) {
    if ($failCount -gt 0) { Write-Log "connection recovered (after $failCount failures)" }
    $failCount = 0
  } else {
    $failCount++
    if ($failCount -eq 1) { Write-Log "probe failed (1st) - backend unreachable on port $Port" }
    else { Write-Log "probe failed ($failCount/$FailThreshold)" }
    if ($failCount -ge $FailThreshold) {
      Write-Log "DETECTED DOWN after $failCount failures - restarting client..."
      # 1) 杀掉残留客户端与后端进程
      Get-Process DeepSeekClient -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
      Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -match "--port $Port" } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
      Start-Sleep -Seconds 3
      # 2) 重新启动客户端
      if (Test-Path $ClientExe) {
        Start-Process -FilePath $ClientExe -WorkingDirectory (Split-Path $ClientExe)
        Write-Log "client restarted: $ClientExe"
      } else {
        Write-Log "client exe not found: $ClientExe"
      }
      $failCount = 0
      Start-Sleep -Seconds 15  # 给启动留时间，避免立刻再判失败
    }
  }
  Start-Sleep -Seconds $CheckInterval
}
