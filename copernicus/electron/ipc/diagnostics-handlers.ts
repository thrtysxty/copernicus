import { ipcMain, BrowserWindow } from 'electron'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { handleIpc } from '../utils/handle-ipc'
import { IpcHandlerDeps } from './deps'

export function register(win: BrowserWindow, deps: IpcHandlerDeps) {
  const cwd = () => deps.settingsStore.get<string>('workspace', process.cwd())

  ipcMain.handle('diagnostics:run-tsc', () => handleIpc('diagnostics:run-tsc', [], () => {
    return new Promise<any[]>((resolve) => {
      const copDir = path.join(cwd(), 'copernicus')
      const proc = spawn('npx', ['tsc', '--noEmit', '--pretty', 'false'], {
        cwd: copDir, shell: true
      })
      let output = ''
      proc.stdout.on('data', (d: Buffer) => output += d.toString())
      proc.stderr.on('data', (d: Buffer) => output += d.toString())
      proc.on('close', () => {
        // Parse "file(line,col): error TS1234: message" format
        const diags: any[] = []
        for (const line of output.split('\n')) {
          const m = line.match(/^(.+?)\((\d+),(\d+)\):\s+(error|warning|info)\s+(TS\d+):\s+(.+)$/)
          if (m && m[1] && m[2] && m[3] && m[4] && m[5] && m[6]) {
            diags.push({
              file: m[1], line: parseInt(m[2]), col: parseInt(m[3]),
              severity: m[4], code: m[5], message: m[6]
            })
          }
        }
        // Stream progress to renderer
        win.webContents.send('diagnostics:tsc-complete', diags)
        resolve(diags)
      })
      // Stream line-by-line progress
      proc.stdout.on('data', (d: Buffer) => {
        win.webContents.send('diagnostics:tsc-progress', d.toString())
      })
    })
  }))
}
