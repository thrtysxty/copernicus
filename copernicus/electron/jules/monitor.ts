import { BrowserWindow } from 'electron'
import { stateLedger } from '../db/state-ledger'
import log from '../utils/logger'
import { JulesClient } from './jules-client'

export class JulesMonitor {
  private watching = new Set<string>()
  private client: JulesClient | null = null

  setWindow(_win: BrowserWindow) { /* noop, kept for compat */ }
  setClient(client: JulesClient) { this.client = client }

  async startWatching(sessionId: string): Promise<void> {
    if (this.watching.has(sessionId)) return  // already watching
    if (!this.client) return

    this.watching.add(sessionId)

    try {
      for await (const activity of this.client.streamSession(sessionId)) {
        if (!this.watching.has(sessionId)) break;

        const session = stateLedger.listJulesSessions().find(s => s.id === sessionId)
        if (!session) { this.stopWatching(sessionId); break; }

        const activeWin = BrowserWindow.getAllWindows()[0]

        if (activity.type === 'planGenerated') {
          const sessionInfo = await this.client.getSessionInfo(sessionId)
          const status = sessionInfo.requirePlanApproval ? 'pending' : 'running'
          stateLedger.upsertJulesSession({ ...session, status, activities_json: JSON.stringify([activity]) })
          activeWin?.webContents.send('jules:session-update', { sessionId, status, activities_json: JSON.stringify([activity]) })
        } else if (activity.type === 'progressUpdated') {
          stateLedger.upsertJulesSession({ ...session, status: 'running', activities_json: JSON.stringify([activity]) })
          activeWin?.webContents.send('jules:session-update', { sessionId, status: 'running', activities_json: JSON.stringify([activity]) })
        } else if (activity.type === 'agentMessaged') {
          activeWin?.webContents.send('jules:activity', activity)
        } else if (activity.type === 'sessionCompleted') {
          const sessionInfo = await this.client.getSessionInfo(sessionId)
          const prOutput = sessionInfo.outputs?.find(o => 'type' in o && o.type === 'pullRequest') as any
          const pr_url = prOutput?.pullRequest?.url
          const pr_number = prOutput?.pullRequest?.number

          stateLedger.upsertJulesSession({ ...session, status: 'completed', pr_url, pr_number, completed_at: new Date().toISOString() })
          activeWin?.webContents.send('jules:session-update', { sessionId, status: 'completed', pr_url, pr_number })
          this.stopWatching(sessionId)
        } else if (activity.type === 'sessionFailed') {
          const error_message = (activity as any).error?.message || 'Task failed'
          stateLedger.upsertJulesSession({ ...session, status: 'failed', error_message, completed_at: new Date().toISOString() })
          activeWin?.webContents.send('jules:session-update', { sessionId, status: 'failed', error_message })
          this.stopWatching(sessionId)
        }
      }
    } catch (err: unknown) {
      log.error(`[JulesMonitor] stream error for ${sessionId}:`, (err as Error).message)
      const session = stateLedger.listJulesSessions().find(s => s.id === sessionId)
      if (session) {
        stateLedger.upsertJulesSession({ ...session, status: 'failed', error_message: (err as Error).message, completed_at: new Date().toISOString() })
        BrowserWindow.getAllWindows()[0]?.webContents.send('jules:session-update', { sessionId, status: 'failed', error_message: (err as Error).message })
      }
      this.stopWatching(sessionId)
    }
  }

  stopWatching(sessionId: string): void {
    this.watching.delete(sessionId)
  }

  resumeWatching(): void {
    // On app start, resume watching any sessions that were pending/running
    const pending = stateLedger.listJulesSessions('pending')
    const running = stateLedger.listJulesSessions('running')
    
    pending.concat(running).forEach(s => this.startWatching(s.id))
  }
}

export const julesMonitor = new JulesMonitor()
