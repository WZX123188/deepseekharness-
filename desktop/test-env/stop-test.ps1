# 只停止测试实例（3199 端口 + pid.txt 记录的进程），绝不碰正式客户端（3180）
$root = $PSScriptRoot

# 按端口 3199 找并杀后端
$conn = Get-NetTCPConnection -State Listen -LocalPort 3199 -ErrorAction SilentlyContinue
if ($conn) {
  $conn | Select-Object -Unique OwningProcess | ForEach-Object {
    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
    Write-Host "已停止测试后端 PID $($_.OwningProcess)"
  }
}
# 按 pid.txt 杀测试主进程（若有）
$pidFile = Join-Path $root 'pid.txt'
if (Test-Path $pidFile) {
  $testPid = (Get-Content $pidFile -ErrorAction SilentlyContinue).Trim()
  if ($testPid) { Stop-Process -Id $testPid -Force -ErrorAction SilentlyContinue }
}
Write-Host '测试实例已停止（3180 正式客户端未受影响）'
