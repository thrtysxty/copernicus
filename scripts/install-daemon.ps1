param([switch]$Uninstall)

$TaskName = "CopernicusJulesDaemon"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$DaemonPy = Join-Path $ScriptDir "jules_daemon.py"
$PythonW = (Get-Command pythonw.exe -ErrorAction SilentlyContinue)?.Source
if (-not $PythonW) { $PythonW = (Get-Command python.exe).Source }

if ($Uninstall) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host "Jules daemon removed from Task Scheduler"
    exit
}

# Idempotent — remove if exists before re-registering
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

$Action = New-ScheduledTaskAction -Execute $PythonW -Argument "`"$DaemonPy`""
$Trigger = New-ScheduledTaskTrigger -AtLogOn
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable
$Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -RunLevel Limited

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger `
    -Settings $Settings -Principal $Principal -Force

Write-Host "Jules daemon scheduled via Task Scheduler"
