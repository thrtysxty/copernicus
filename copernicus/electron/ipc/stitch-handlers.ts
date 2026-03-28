import { ipcMain } from 'electron'
import { handleIpc } from '../utils/handle-ipc'
import { authManager } from '../auth-manager'
import { Stitch, StitchToolClient, StitchError } from '@google/stitch-sdk'

let stitchClient: Stitch | null = null
let currentApiKey: string | null = null

function getStitchClient(): Stitch {
  const apiKey = authManager.getApiKey('stitch')
  if (!apiKey) {
    throw new Error('STITCH_API_KEY is not set')
  }

  // Re-initialize client if API key has changed
  if (!stitchClient || currentApiKey !== apiKey) {
    const toolClient = new StitchToolClient({ apiKey })
    stitchClient = new Stitch(toolClient)
    currentApiKey = apiKey
  }

  return stitchClient
}

export function registerStitchHandlers() {
  ipcMain.handle('stitch:ping', (_e) =>
    handleIpc(async () => {
      try {
        const client = getStitchClient()
        await client.projects() // reachability check
        return { ok: true }
      } catch (err: any) {
        if (err instanceof StitchError) {
          throw new Error(`[${err.code}] ${err.message}`)
        }
        throw err
      }
    })
  )

  ipcMain.handle('stitch:extract-design', (_e, { projectId, screenId }: { projectId: string, screenId: string }) =>
    handleIpc(async () => {
      try {
        const client = getStitchClient()
        const project = client.project(projectId)
        const screen = await project.getScreen(screenId)
        const html = await screen.getHtml()
        return html
      } catch (err: any) {
        if (err instanceof StitchError) {
          throw new Error(`[${err.code}] ${err.message}`)
        }
        throw err
      }
    })
  )

  ipcMain.handle('stitch:screenshot', (_e, { projectId, screenId }: { projectId: string, screenId: string }) =>
    handleIpc(async () => {
      try {
        const client = getStitchClient()
        const project = client.project(projectId)
        const screen = await project.getScreen(screenId)
        const imageUrl = await screen.getImage()
        return imageUrl
      } catch (err: any) {
        if (err instanceof StitchError) {
          throw new Error(`[${err.code}] ${err.message}`)
        }
        throw err
      }
    })
  )

  ipcMain.handle('stitch:design-dna', (_e, { projectId }: { projectId: string }) =>
    handleIpc(async () => {
      try {
        const client = getStitchClient()
        const project = client.project(projectId)
        return project
      } catch (err: any) {
        if (err instanceof StitchError) {
          throw new Error(`[${err.code}] ${err.message}`)
        }
        throw err
      }
    })
  )

  ipcMain.handle('stitch:verify-ui', (_e, { projectId, screenId, currentHtml }: { projectId: string, screenId: string, currentHtml: string }) =>
    handleIpc(async () => {
      try {
        const client = getStitchClient()
        const project = client.project(projectId)
        const screen = await project.getScreen(screenId)

        const html = await screen.getHtml()
        const imageUrl = await screen.getImage()

        return {
          specHtml: html || '',
          specCss: '',
          screenshot: imageUrl || '',
          _currentHtml: currentHtml
        }
      } catch (err: any) {
        if (err instanceof StitchError) {
          throw new Error(`[${err.code}] ${err.message}`)
        }
        throw err
      }
    })
  )

  ipcMain.handle('stitch:generate', (_e, { projectId, prompt, deviceType }: { projectId: string, prompt: string, deviceType?: 'MOBILE' | 'DESKTOP' | 'TABLET' | 'AGNOSTIC' }) =>
    handleIpc(async () => {
      try {
        const client = getStitchClient()
        const project = client.project(projectId)
        // Note: SDK typing for generate may differ. AC says project.generate(prompt, deviceType?) returns { screenId }
        // Looking at Stitch SDK: generate(prompt, deviceType?) -> might return an object with screenId or a Screen object.
        // Assuming it returns an object with `screenId` based on AC.
        const result: any = await project.generate(prompt, deviceType)
        if (result.screenId) {
            return { screenId: result.screenId }
        }
        return result
      } catch (err: any) {
        if (err instanceof StitchError) {
          throw new Error(`[${err.code}] ${err.message}`)
        }
        throw err
      }
    })
  )

  ipcMain.handle('stitch:edit', (_e, { projectId, screenId, prompt }: { projectId: string, screenId: string, prompt: string }) =>
    handleIpc(async () => {
      try {
        const client = getStitchClient()
        const project = client.project(projectId)
        const screen = await project.getScreen(screenId)
        // AC says screen.edit(prompt) -> { screenId }
        const result: any = await screen.edit(prompt)
        if (result.screenId) {
            return { screenId: result.screenId }
        }
        return result
      } catch (err: any) {
        if (err instanceof StitchError) {
          throw new Error(`[${err.code}] ${err.message}`)
        }
        throw err
      }
    })
  )

  ipcMain.handle('stitch:variants', (_e, { projectId, screenId, prompt, options }: { projectId: string, screenId: string, prompt: string, options?: any }) =>
    handleIpc(async () => {
      try {
        const client = getStitchClient()
        const project = client.project(projectId)
        const screen = await project.getScreen(screenId)
        // AC says screen.variants(prompt, options) -> { screenIds: string[] }
        const result: any = await screen.variants(prompt, options)
        if (result.screenIds) {
            return { screenIds: result.screenIds }
        }
        return result
      } catch (err: any) {
        if (err instanceof StitchError) {
          throw new Error(`[${err.code}] ${err.message}`)
        }
        throw err
      }
    })
  )

  ipcMain.handle('stitch:list-screens', (_e, { projectId }: { projectId: string }) =>
    handleIpc(async () => {
      try {
        const client = getStitchClient()
        const project = client.project(projectId)
        const screens = await project.screens()
        return screens
      } catch (err: any) {
        if (err instanceof StitchError) {
          throw new Error(`[${err.code}] ${err.message}`)
        }
        throw err
      }
    })
  )
}
