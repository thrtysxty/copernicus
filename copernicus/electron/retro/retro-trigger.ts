import { stateLedger } from '../db/state-ledger'
import { retroSynthesizer } from './retro-synthesizer'
import { SettingsStore } from '../settings-store'

const settingsStore = new SettingsStore()

export class RetroTrigger {
  async checkAndTrigger(projectId: string): Promise<void> {
    const threshold = (settingsStore.get('retro') as any)?.sessionThreshold ?? 20

    // Check if a pending_review retro already exists
    const reports = stateLedger.listRetroReports(projectId)
    const pendingReport = reports.find((r: any) => r.status === 'pending_review')
    if (pendingReport) {
      return // Do not trigger if a pending_review retro already exists
    }

    // Find the timestamp of the last approved retro
    const approvedReports = reports.filter((r: any) => r.status === 'approved')
    let lastApprovedTs = 0
    if (approvedReports.length > 0) {
      lastApprovedTs = Math.max(...approvedReports.map((r: any) => r.ts_approved || 0))
    }

    // Count session_start events since last approved retro
    const memoryRows = stateLedger.getAllAgentMemoryForProject(projectId)
    const sessionStarts = memoryRows.filter(
      (m: any) => m.event_type === 'session_start' && m.ts > lastApprovedTs
    )

    if (sessionStarts.length >= threshold) {
      await retroSynthesizer.synthesize({
        projectId,
        scope: 'project',
        fromTs: lastApprovedTs,
        toTs: Date.now()
      })
    }
  }

  async triggerManual(projectId: string): Promise<string> {
    // Find the timestamp of the last approved retro
    const reports = stateLedger.listRetroReports(projectId)
    const approvedReports = reports.filter((r: any) => r.status === 'approved')
    let lastApprovedTs = 0
    if (approvedReports.length > 0) {
      lastApprovedTs = Math.max(...approvedReports.map((r: any) => r.ts_approved || 0))
    }

    const retroId = await retroSynthesizer.synthesize({
      projectId,
      scope: 'project',
      fromTs: lastApprovedTs,
      toTs: Date.now()
    })
    return retroId
  }
}

export const retroTrigger = new RetroTrigger()
