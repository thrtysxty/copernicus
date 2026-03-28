import log from '../utils/logger'
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
      // Check for Jules daemon
      const julesPlist = path.join(app.getPath('home'), 'Library', 'LaunchAgents', 'com.copernicus.jules-daemon.plist')
      if (fs.existsSync(julesPlist)) return true
      // Check for MCP Hub daemon
      const mcpHubPlist = path.join(app.getPath('home'), 'Library', 'LaunchAgents', 'com.copernicus.mcp-hub.plist')
      if (fs.existsSync(mcpHubPlist)) return true
    } else if (process.platform === 'linux') {
      // Check for Jules daemon
      try {
        execSync('systemctl --user is-enabled jules-daemon', { stdio: 'ignore' })
        return true
      } catch (e) { /* ignore */ }
      // Check for MCP Hub daemon
      try {
        execSync('systemctl --user is-enabled copernicus-mcp-hub', { stdio: 'ignore' })
        return true
      } catch (e) { /* ignore */ }
    } else if (process.platform === 'win32') {
      // Check for Jules daemon
      try {
        execSync('powershell.exe -Command "Get-ScheduledTask -TaskName CopernicusJulesDaemon -ErrorAction Stop"', { stdio: 'ignore' })
        return true
      } catch (e) { /* ignore */ }
      // Check for MCP Hub daemon
      try {
        execSync('powershell.exe -Command "Get-ScheduledTask -TaskName CopernicusMCPHub -ErrorAction Stop"', { stdio: 'ignore' })
        return true
      } catch (e) { /* ignore */ }
    }
  } catch {
    // not registered
  }
  return false
}

async function getMcpHubStatus() {
  const scriptPath = path.join(app.getAppPath(), 'scripts', 'mcp_hub.py')
  try {
    // Attempt to run mcp_hub.py with --status and capture output
    const output = execSync(`python3 ${scriptPath} --status`, { encoding: 'utf8', timeout: 5000 }).trim()

    const status: {
      port?: number,
      toolCount?: number,
      proxies: Array<{ name: string, status: string, toolCount?: number }>
    } = { proxies: [] }

    let currentProxy: any = null;

    output.split('\\n').forEach(line => {
      let parts: string[];
      if (line.includes('Bound Port:')) {
        parts = line.split(':');
        if (parts.length > 1 && parts[1] !== undefined) {
          status.port = parseInt(parts[1].trim())
        }
      } else if (line.includes('Total Tools:')) {
        parts = line.split(':');
        if (parts.length > 1 && parts[1] !== undefined) {
          status.toolCount = parseInt(parts[1].trim())
        }
      } else if (line.includes('Active Proxies:')) {
        // Start of proxies section
      } else if (line.startsWith('  - ')) {
        const match = line.match(/  - (.*?): (.*?) \\(Eager: (.*?)\\)/)
        if (match) {
          currentProxy = { name: match[1], status: match[2] }
          status.proxies.push(currentProxy)
        }
      } else if (line.startsWith('    Tools provided:') && currentProxy) {
        parts = line.split(':');
        if (parts.length > 1 && parts[1] !== undefined) {
          currentProxy.toolCount = parseInt(parts[1].trim())
        }
      }
    })

    return { running: true, ...status }

  } catch (error: any) {
    // If command fails, assume hub is not running or encountered an error
    log.error('Failed to get MCP Hub status:', error.message)
    return { running: false, error: error.message }
  }
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

  ipcMain.handle('daemon:status', (_e) => handleIpc(async () => {
    return getMcpHubStatus()
  }))
}
