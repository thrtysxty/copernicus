import { ipcMain } from 'electron'
import { handleIpc } from '../utils/handle-ipc'
import { IpcHandlerDeps } from './deps'
import { stateLedger } from '../db/state-ledger'
import { dispatchJulesSession } from '../jules/dispatcher'

export function registerJulesHandlers(deps: IpcHandlerDeps) {
  ipcMain.handle('jules:dispatch-session', (_e, { storyId, repo, branch, requirePlanApproval }) => handleIpc(async () => {
    const story = stateLedger.getStoryById(storyId)
    if (!story) throw new Error(`Story not found: ${storyId}`)
    
    const apiKey = deps.authManager.getApiKey('jules')
    if (!apiKey) throw new Error('Jules API key not configured')

    const result = await dispatchJulesSession({
      story,
      repo,
      branch,
      apiKey,
      requirePlanApproval
    })

    if (result.ok && result.sessionId) {
      deps.julesMonitor.startWatching(result.sessionId)
    }
    
    return result
  }))

  ipcMain.handle('jules:list-sessions', () => handleIpc(() => {
    return stateLedger.listJulesSessions()
  }))

  ipcMain.handle('jules:story-sessions', (_e, { storyId }) => handleIpc(() => {
    return stateLedger.getJulesSessionsByStory(storyId)
  }))

  ipcMain.handle('jules:retry-session', (_e, { sessionId }) => handleIpc(async () => {
    const existing = stateLedger.listJulesSessions().find(s => s.id === sessionId)
    if (!existing) throw new Error(`Session not found: ${sessionId}`)
    
    const story = stateLedger.getStoryById(existing.story_id)
    if (!story) throw new Error(`Story not found: ${existing.story_id}`)
      
    const apiKey = deps.authManager.getApiKey('jules')
    if (!apiKey) throw new Error('Jules API key not configured')

    const result = await dispatchJulesSession({
      story,
      repo: existing.repo,
      branch: existing.branch,
      apiKey
    })

    if (result.ok && result.sessionId) {
      deps.julesMonitor.startWatching(result.sessionId)
    }

    return result
  }))

  ipcMain.handle('jules:list-sources', () => handleIpc(async () => {
    const apiKey = deps.authManager.getApiKey('jules')
    if (!apiKey) throw new Error('Jules API key not configured')
      
    const JULES_API_BASE = 'https://jules.googleapis.com/v1alpha'
    const res = await fetch(`${JULES_API_BASE}/sources`, {
      headers: { 'X-Goog-Api-Key': apiKey }
    })
    
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Jules API ${res.status}: ${body.slice(0, 200)}`)
    }
    
    const data = await res.json() as { sources?: { name: string, displayName: string }[] }
    return data.sources ?? []
  }))

  ipcMain.handle('jules:approve-plan', (_e, { sessionId }) => handleIpc(async () => {
    const apiKey = deps.authManager.getApiKey('jules')
    if (!apiKey) throw new Error('Jules API key not configured')
      
    const JULES_API_BASE = 'https://jules.googleapis.com/v1alpha'
    // session name format could be just UUID or 'sessions/{UUID}'
    const name = sessionId.includes('/') ? sessionId : `sessions/${sessionId}`
    const res = await fetch(`${JULES_API_BASE}/${name}:approvePlan`, {
      method: 'POST',
      headers: { 'X-Goog-Api-Key': apiKey, 'Content-Type': 'application/json' }
    })
    
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Jules API ${res.status}: ${body.slice(0, 200)}`)
    }
    
    return { ok: true }
  }))

  ipcMain.handle('jules:list-activities', (_e, { sessionId, pageSize }) => handleIpc(async () => {
    const apiKey = deps.authManager.getApiKey('jules')
    if (!apiKey) throw new Error('Jules API key not configured')
      
    const JULES_API_BASE = 'https://jules.googleapis.com/v1alpha'
    const name = sessionId.includes('/') ? sessionId : `sessions/${sessionId}`
    const url = new URL(`${JULES_API_BASE}/${name}/activities`)
    if (pageSize) {
      url.searchParams.set('pageSize', pageSize.toString())
    }
    
    const res = await fetch(url.toString(), {
      headers: { 'X-Goog-Api-Key': apiKey }
    })
    
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Jules API ${res.status}: ${body.slice(0, 200)}`)
    }
    
    const data = await res.json() as { activities?: any[] }
    return data.activities ?? []
  }))
}
