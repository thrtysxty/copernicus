import { ipcMain, app } from 'electron'
import { spawn, execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { handleIpc } from '../utils/handle-ipc'

function getDaemonScriptPath(): string {
  const resourcesPath = process.resourcesPath ?? path.join(app.getAppPath(), '..', '..', '..')
  const scriptName = process.platform === 'win32' ? 'install-daemon.ps1' : 'install-daemon.sh'
  return path.join(resourcesPath, scriptName)
}

function isDaemonRegistered(): boolean {
  try {
    if (process.platform === 'darwin') {
      const plist = path.join(app.getPath('home'), 'Library', 'LaunchAgents', 'com.copernicus.jules-daemon.plist')
      return fs.existsSync(plist)
    } else if (process.platform === 'linux') {
      execSync('systemctl --user is-enabled jules-daemon', { stdio: 'ignore' })
      return true
    } else if (process.platform === 'win32') {
      execSync('powershell.exe -Command "Get-ScheduledTask -TaskName CopernicusJulesDaemon -ErrorAction Stop"', { stdio: 'ignore' })
      return true
    }
  } catch {
    // not registered
  }
  return false
}

export function registerDaemonHandlers(): void {
  ipcMain.handle('daemon:install', (_e) => handleIpc(async () => {
    const scriptPath = getDaemonScriptPath()
    if (!fs.existsSync(scriptPath)) {
      throw new Error(`Daemon installer not found: ${scriptPath}`)
    }
    return new Promise<{ success: boolean }>((resolve, reject) => {
      const proc = process.platform === 'win32'
        ? spawn('powershell.exe', ['-ExecutionPolicy', 'Bypass', '-File', scriptPath])
        : spawn('sh', [scriptPath])

      let stderr = ''
      proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString() })
      proc.on('close', (code) => {
        if (code === 0) resolve({ success: true })
        else reject(new Error(`Daemon installer exited ${code}: ${stderr}`))
      })
    })
  }))

  ipcMain.handle('daemon:is-registered', (_e) => handleIpc(() => ({
    registered: isDaemonRegistered()
  })))
}
