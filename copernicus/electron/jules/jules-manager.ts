import log from '../utils/logger'
import { stateLedger, JulesSession } from '../db/state-ledger'
import { memoryService } from '../memory/memoryService'
import { fsManager } from '../fs-manager'

export class JulesManager {
  async getSessionStatus(sessionId: string): Promise<JulesSession | null> {
    const rows = stateLedger.listJulesSessions()
    return rows.find(s => s.id === sessionId) ?? null
  }

  listSessions(): JulesSession[] {
    return stateLedger.listJulesSessions()
  }

  createSession(storyId: string, sessionId: string, prompt: string): void {
    const rootPath = fsManager.getRootPath();
    const projectId = rootPath ? (stateLedger.getProjectByPath(rootPath)?.id ?? 'default') : 'default';

    memoryService.logWork({
      projectId,
      bankId: 'orchestrator',
      eventType: 'agent_spawn',
      meta: {
        agent_type: 'jules',
        story: storyId,
        session_id: sessionId,
        prompt_summary: prompt.slice(0, 200)
      }
    }).catch(log.warn);
  }
}

export const julesManager = new JulesManager()
