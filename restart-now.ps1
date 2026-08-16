# 独立重启器：延时后杀残留进程并重新启动 DSH 客户端（本体重启测试用）
# 关键：本脚本由独立 powershell 进程运行，不依赖被杀的客户端——解决"只能关不能开"。
Start-Sleep -Seconds 12
$log = "G:\dsh客户端\restart-test.log"
function Log($m) { try { [System.IO.File]::AppendAllText($log, (Get-Date -Format 'HH:mm:ss') + '  ' + $m + "`r`n", (New-Object System.Text.UTF8Encoding($false))) } catch {} }
Log 'restarter armed'
# 杀残留（幂等：即使目标已死也无妨）
Get-Process DeepSeekClient -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -match '--port 3180' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 3
Log 'processes killed, launching exe'
# 启动客户端（本体）
Start-Process "G:\dsh客户端\desktop\dsh\DeepSeekClient.exe" -WorkingDirectory "G:\dsh客户端\desktop\dsh"
Log 'exe launched'
