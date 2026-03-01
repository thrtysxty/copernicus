import { BrowserWindow } from 'electron'
import { stateLedger } from '../db/state-ledger'
import { pollJulesSession } from './dispatcher'

const POLL_INTERVAL_MS = 30_000

export class JulesMonitor {
  private timers = new Map<string, NodeJS.Timeout>()
  private win: BrowserWindow | null = null
  private apiKey: string = ''

  setWindow(win: BrowserWindow) { this.win = win }
  setApiKey(key: string) { this.apiKey = key }

  startWatching(sessionId: string): void {
    if (this.timers.has(sessionId)) return  // already watching

    const tick = async () => {
      if (!this.apiKey) return
      try {
        const update = await pollJulesSession(sessionId, this.apiKey)
        // Find existing record to preserve prompt hash etc
        const session = stateLedger.listJulesSessions()
          .find(s => s.id === sessionId)
        if (!session) { this.stopWatching(sessionId); return }

        stateLedger.upsertJulesSession({ ...session, ...update } as any)

        if (this.win && !this.win.isDestroyed()) {
          this.win.webContents.send('jules:session-update', { sessionId, ...update })
        }

        if (update.status === 'completed' || update.status === 'failed') {
          this.stopWatching(sessionId)
        }
      } catch (err: any) {
        console.error(`[JulesMonitor] poll error for ${sessionId}:`, err.message)
      }
    }

    tick()  // immediate first poll
    this.timers.set(sessionId, setInterval(tick, POLL_INTERVAL_MS))
  }

  stopWatching(sessionId: string): void {
    const t = this.timers.get(sessionId)
    if (t) { clearInterval(t); this.timers.delete(sessionId) }
  }

  resumeWatching(): void {
    // On app start, resume watching any sessions that were pending/running
    const pending = stateLedger.listJulesSessions('pending')
    const running = stateLedger.listJulesSessions('running')
    
    pending.concat(running).forEach(s => this.startWatching(s.id))
  }
}

export const julesMonitor = new JulesMonitor()
