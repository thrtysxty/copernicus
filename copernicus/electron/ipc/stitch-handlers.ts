import { ipcMain } from 'electron'
import { handleIpc } from '../utils/handle-ipc'
import { spawnSync } from 'node:child_process'
import { authManager } from '../auth-manager'

function buildStitchEnv(projectId: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, GOOGLE_CLOUD_PROJECT: projectId }
  const apiKey = authManager.getApiKey('stitch')
  if (apiKey) env.STITCH_API_KEY = apiKey
  return env
}

function runStitchCmd(projectId: string, args: string[]): any {
  const env = buildStitchEnv(projectId)
  const isWin = process.platform === 'win32'
  const cmd = isWin ? 'npx.cmd' : 'npx'
  const finalArgs = ['stitch-mcp', ...args]

  const res = spawnSync(cmd, finalArgs, { env, encoding: 'utf-8', shell: false })

  if (res.error) throw res.error
  if (res.status !== 0) throw new Error(res.stderr || `Command failed with status ${res.status}`)

  try {
    return JSON.parse(res.stdout)
  } catch {
    return res.stdout
  }
}

export function registerStitchHandlers() {
  ipcMain.handle('stitch:ping', (_e, projectId: string) =>
    handleIpc(async () => {
      try {
        const env = buildStitchEnv(projectId)
        const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx'
        const res = spawnSync(cmd, ['stitch-mcp', 'ping'], { env, encoding: 'utf-8', shell: false })

        if (res.error || res.status !== 0) {
          return { ok: false, error: res.stderr || res.error?.message || `Status ${res.status}` }
        }
        return { ok: true }
      } catch (err: any) {
        return { ok: false, error: err.message }
      }
    })
  )

  ipcMain.handle('stitch:extract-design', (_e, { projectId, screenId }: { projectId: string, screenId: string }) =>
    handleIpc(async () => runStitchCmd(projectId, ['extract-design', screenId]))
  )

  ipcMain.handle('stitch:screenshot', (_e, { projectId, screenId }: { projectId: string, screenId: string }) =>
    handleIpc(async () => runStitchCmd(projectId, ['screenshot', screenId]))
  )

  ipcMain.handle('stitch:design-dna', (_e, { projectId }: { projectId: string }) =>
    handleIpc(async () => runStitchCmd(projectId, ['design-dna']))
  )

  ipcMain.handle('stitch:verify-ui', (_e, { projectId, screenId, currentHtml }: { projectId: string, screenId: string, currentHtml: string }) =>
    handleIpc(async () => {
      // currentHtml is passed in because the AC specifies it for the verification workflow,
      // even if the script only fetches spec HTML and screenshot.
      const design = runStitchCmd(projectId, ['extract-design', screenId])
      const screenshot = runStitchCmd(projectId, ['screenshot', screenId])

      return {
        specHtml: design.html || '',
        specCss: design.css || '',
        screenshot: screenshot.base64 || '',
        _currentHtml: currentHtml // to avoid unused variable warning
      }
    })
  )
}
