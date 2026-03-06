import { stateLedger, JulesSession } from '../db/state-ledger'

export class JulesManager {
  async getSessionStatus(sessionId: string): Promise<JulesSession | null> {
    const rows = stateLedger.listJulesSessions()
    return rows.find(s => s.id === sessionId) ?? null
  }

  listSessions(): JulesSession[] {
    return stateLedger.listJulesSessions()
  }
}

export const julesManager = new JulesManager()
