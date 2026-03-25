param(
    [switch]$Uninstall,
    [string]$Service = "jules" # Default service
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path (Split-Path $ScriptDir -Parent) -Parent # Two levels up

$PythonW = (Get-Command pythonw.exe -ErrorAction SilentlyContinue)?.Source
if (-not $PythonW) { $PythonW = (Get-Command python.exe).Source }

function Register-JulesDaemon {
    $TaskName = "CopernicusJulesDaemon"
    $DaemonPy = Join-Path $ScriptDir "jules_daemon.py"

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
}

function Register-FlaskBackend {
    $TaskName = "CopernicusBackend"
    $GunicornConfig = Join-Path $RepoRoot "backend\gunicorn.conf.py"
    $RunService = "backend.run_service:app"

    if ($Uninstall) {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
        Write-Host "Flask backend service removed from Task Scheduler"
        exit
    }

    # Idempotent — remove if exists before re-registering
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

    $GunicornPath = (Get-Command gunicorn.exe -ErrorAction SilentlyContinue)?.Source
    if (-not $GunicornPath) {
        # Try to find gunicorn in common Python script directories
        $PythonScriptsDir = Join-Path (Split-Path $PythonW -Parent) "Scripts"
        $GunicornPath = Join-Path $PythonScriptsDir "gunicorn.exe"
        if (-not (Test-Path $GunicornPath)) {
            Write-Error "gunicorn.exe not found. Please ensure gunicorn is installed and in your PATH or Python's Scripts directory."
            exit 1
        }
    }

    $Arguments = "-c `"$GunicornConfig`" $RunService"

    $Action = New-ScheduledTaskAction -Execute $GunicornPath -Argument $Arguments
    $Trigger = New-ScheduledTaskTrigger -AtLogOn
    $Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable
    $Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -RunLevel Limited

    Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger `
        -Settings $Settings -Principal $Principal -Force

    Write-Host "Flask backend service scheduled via Task Scheduler"
}

function Register-MCPHub {
    $TaskName = "CopernicusMCPHub"
    $McpHubScript = Join-Path $ScriptDir "mcp_hub.py"

    if ($Uninstall) {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
        Write-Host "MCP Hub service removed from Task Scheduler"
        exit
    }

    # Idempotent — remove if exists before re-registering
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

    $Arguments = "`"$McpHubScript`" --transport tcp"

    $Action = New-ScheduledTaskAction -Execute $PythonW -Argument $Arguments
    $Trigger = New-ScheduledTaskTrigger -AtLogOn
    $Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable
    $Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -RunLevel Limited

    Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger `
        -Settings $Settings -Principal $Principal -Force

    Write-Host "MCP Hub service scheduled via Task Scheduler"
}

switch ($Service) {
    "jules" {
        Register-JulesDaemon
    }
    "flask" {
        Register-FlaskBackend
    }
    "mcp-hub" {
        Register-MCPHub
    }
    default {
        Write-Error "Unknown service specified: $Service. Supported services are 'jules', 'flask', and 'mcp-hub'."
        exit 1
    }
}

