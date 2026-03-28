import { ipcMain } from 'electron'
import { handleIpc } from '../utils/handle-ipc'
import { IpcHandlerDeps } from './deps'
import { stateLedger } from '../db/state-ledger'
import { dispatchJulesSession } from '../jules/dispatcher'
import { JulesApiError, JulesError, JulesNetworkError } from '@google/jules-sdk'

export function registerJulesHandlers(deps: IpcHandlerDeps) {
  ipcMain.handle('jules:dispatch-session', (_e, { storyId, repo, branch, requirePlanApproval }) => handleIpc(async () => {
    const story = stateLedger.getStoryById(storyId)
    if (!story) throw new Error(`Story not found: ${storyId}`)

    try {
      const result = await dispatchJulesSession({
        story,
        repo,
        branch,
        julesClient: deps.julesClient,
        requirePlanApproval
      })

      if (result.ok && result.sessionId) {
        deps.julesMonitor.startWatching(result.sessionId)
      }
      return result
    } catch (error: unknown) {
      if (error instanceof JulesApiError || error instanceof JulesError || error instanceof JulesNetworkError) {
        throw new Error(`Jules Error: ${error.message}`);
      }
      throw error;
    }
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

    try {
      const result = await dispatchJulesSession({
        story,
        repo: existing.repo,
        branch: existing.branch,
        julesClient: deps.julesClient
      })

      if (result.ok && result.sessionId) {
        deps.julesMonitor.startWatching(result.sessionId)
      }

      return result
    } catch (error: unknown) {
      if (error instanceof JulesApiError || error instanceof JulesError || error instanceof JulesNetworkError) {
        throw new Error(`Jules Error: ${error.message}`);
      }
      throw error;
    }
  }))

  ipcMain.handle('jules:list-sources', () => handleIpc(async () => {
    const apiKey = deps.authManager.getApiKey('jules')
    if (!apiKey) throw new Error('Jules API key not configured')
      
    try {
      return await deps.julesClient.listSources(apiKey)
    } catch (error: unknown) {
      if (error instanceof JulesApiError || error instanceof JulesError || error instanceof JulesNetworkError) {
        throw new Error(`Jules Error: ${error.message}`);
      }
      throw error;
    }
  }))

  ipcMain.handle('jules:approve-plan', (_e, { sessionId }) => handleIpc(async () => {
    try {
      const session = await deps.julesClient.session(sessionId);
      await session.approve()
      return { ok: true }
    } catch (error: unknown) {
      if (error instanceof JulesApiError || error instanceof JulesError || error instanceof JulesNetworkError) {
        throw new Error(`Jules Error: ${error.message}`);
      }
      throw error;
    }
  }))

  ipcMain.handle('jules:list-activities', (_e, { sessionId }) => handleIpc(async () => {
    try {
      const session = await deps.julesClient.session(sessionId);
      return await session.history()
    } catch (error: unknown) {
      if (error instanceof JulesApiError || error instanceof JulesError || error instanceof JulesNetworkError) {
        throw new Error(`Jules Error: ${error.message}`);
      }
      throw error;
    }
  }))
}
