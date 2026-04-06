import { ipcMain } from 'electron'
import { handleIpc } from '../utils/handle-ipc'
import { execFileAsync } from '../utils/exec-async'
import log from 'electron-log'

export function registerBrowserHandlers() {
  ipcMain.handle('browser:navigate', (_e, url: string) => handleIpc(async () => {
    log.info(`[Browser] Navigating to ${url}`)
    const { stdout, stderr } = await execFileAsync('agent-browser', ['open', url, '--json'])
    if (stderr) log.warn(`[Browser] stderr: ${stderr}`)
    return JSON.parse(stdout)
  }))

  ipcMain.handle('browser:snapshot', (_e) => handleIpc(async () => {
    log.info(`[Browser] Taking snapshot`)
    const { stdout, stderr } = await execFileAsync('agent-browser', ['snapshot', '--json'])
    if (stderr) log.warn(`[Browser] stderr: ${stderr}`)
    return JSON.parse(stdout)
  }))

  ipcMain.handle('browser:screenshot', (_e, options?: { full?: boolean }) => handleIpc(async () => {
    log.info(`[Browser] Taking screenshot`)
    const args = ['screenshot', '--json']
    if (options?.full) args.push('--full')
    const { stdout, stderr } = await execFileAsync('agent-browser', args)
    if (stderr) log.warn(`[Browser] stderr: ${stderr}`)
    return JSON.parse(stdout)
  }))

  ipcMain.handle('browser:click', (_e, selectorOrRef: string) => handleIpc(async () => {
    log.info(`[Browser] Clicking ${selectorOrRef}`)
    const { stdout, stderr } = await execFileAsync('agent-browser', ['click', selectorOrRef, '--json'])
    if (stderr) log.warn(`[Browser] stderr: ${stderr}`)
    return JSON.parse(stdout)
  }))
}
