@echo off
rem Start DSH watchdog in a hidden window. Log: G:\dsh客户端\watchdog.log
start "" powershell -ExecutionPolicy Bypass -WindowStyle Hidden -File "G:\dsh客户端\watchdog.ps1"
echo Watchdog started in background. Log: G:\dsh客户端\watchdog.log
