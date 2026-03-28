import log from '../utils/logger'
import { ipcMain, BrowserWindow } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { stateLedger } from '../db/state-ledger'
import { handleIpc } from '../utils/handle-ipc'
import { retroSynthesizer } from '../retro/retro-synthesizer'
import { retroTrigger } from '../retro/retro-trigger'
import { SettingsStore } from '../settings-store'
import { fsManager } from '../fs-manager'
import { IpcHandlerDeps } from './deps'

const settingsStore = new SettingsStore()

export function registerRetroHandlers(deps?: IpcHandlerDeps) {
  ipcMain.handle('retro:gate-status', (_e, projectId: string) => handleIpc(() => {
    const sprintGateEnabled = (settingsStore.get('retro') as any)?.sprintGate ?? false
    if (!sprintGateEnabled) {
      return { blocked: false }
    }
    const reports = stateLedger.listRetroReports(projectId)
    const pendingReport = reports.find((r: any) => r.status === 'pending_review')
    if (pendingReport) {
      return { blocked: true, retroId: pendingReport.id }
    }
    return { blocked: false }
  }))

  ipcMain.handle('retro:list', (_e, projectId: string) => handleIpc(() => {
    return stateLedger.listRetroReports(projectId)
  }))

  ipcMain.handle('retro:get', (_e, id: string) => handleIpc(() => {
    return stateLedger.getRetroReport(id)
  }))

  ipcMain.handle('retro:create', (_e, data: {
    project_id: string
    scope: string
    status: string
    ts_generated: number
    ts_approved?: number
    sessions_range: string
    inflection_ids?: string
    items: {
      item_type: string
      content: string
      target?: string
      importance?: number
      supersedes_memory_id?: string
      status: string
      edited_content?: string
      ts: number
    }[]
  }) => handleIpc(() => {
    return stateLedger.createRetroReport(data)
  }))

  ipcMain.handle('retro:update-item', (_e, id: string, data: { status: string; edited_content?: string }) => handleIpc(() => {
    return stateLedger.updateRetroItem(id, data)
  }))

  ipcMain.handle('retro:commit', (_e, data: { retroId: string }) => handleIpc(async () => {
    const { retroId } = data;
    const report = stateLedger.getRetroReport(retroId)
    if (!report) {
      throw new Error(`Retro report not found: ${retroId}`)
    }

    const items = report.items || []
    const rootPath = fsManager.getRootPath()
    if (!rootPath) {
      throw new Error('No root path targeted')
    }

    const filePatches: { path: string, content: string }[] = []
    let newStoryIds: string[] = []

    // Prepare story scaffolding and file patches
    for (const item of items) {
      if (item.status === 'approved' || item.status === 'edited') {
        if (item.item_type === 'file_patch') {
          if (!item.target) {
            log.warn(`[RetroCommit] file_patch missing target: ${item.id}`)
            continue
          }
          const content = item.status === 'edited' ? (item.edited_content || item.content) : item.content
          const targetPath = path.resolve(rootPath, item.target)
          
          if (!targetPath.startsWith(rootPath)) {
            log.warn(`[RetroCommit] file_patch outside root path: ${targetPath}`)
            continue
          }

          const relativePath = path.relative(rootPath, targetPath).split(path.sep).join('/')
          // Match references/gotchas.md, CLAUDE.md, or .claude/rules/*.md
          // Note: using test rather than exact match to account for any .claude/rules/ paths
          if (relativePath !== 'references/gotchas.md' && relativePath !== 'CLAUDE.md' && !relativePath.startsWith('.claude/rules/')) {
            log.warn(`[RetroCommit] file_patch skipped (not in allowlist): ${relativePath}`)
            continue
          }
          
          filePatches.push({ path: targetPath, content })
        }
      }
    }

    let serializedPath = ''
    try {
      stateLedger.db.transaction(() => {
        for (const item of items) {
          if (item.status === 'approved' || item.status === 'edited') {
            if (item.item_type === 'memory_fact') {
              const content = item.status === 'edited' ? (item.edited_content || item.content) : item.content
              
              const memoryId = crypto.randomUUID()
              stateLedger.addAgentMemory({
                id: memoryId,
                projectId: report.project_id,
                bankId: item.target || 'default',
                eventType: 'memory_fact',
                content: content,
                importance: item.importance ?? 8,
                tags: null,
                entities: null,
                meta: null,
                ts: Math.floor(Date.now() / 1000)
              })

              if (item.supersedes_memory_id) {
                stateLedger.demoteMemoryImportance(item.supersedes_memory_id)
              }
            } else if (item.item_type === 'story_queue' && item.status === 'approved') {
              const meta = item.meta ? JSON.parse(item.meta) : {}
              const priority = meta.priority ?? 'P2'
              const title = item.content
              
              if (deps?.scaffoldRunner && typeof deps.scaffoldRunner.scaffold === 'function') {
                const newStoryId = deps.scaffoldRunner.scaffold({ title, priority })
                if (newStoryId) newStoryIds.push(newStoryId)
              } else if (deps?.storiesManager) {
                const newStoryId = deps.storiesManager.createStory({ title, priority, type: 'Feature', epic: '(none)' })
                newStoryIds.push(newStoryId)
              } else {
                log.warn(`[RetroCommit] scaffoldRunner not available for scaffolding`)
              }
            }
          }
        }

        const currentStories = report.retro_originated_stories ? JSON.parse(report.retro_originated_stories) : []
        const updatedStories = [...currentStories, ...newStoryIds]

        stateLedger.approveRetroReport(retroId, updatedStories)

        // File I/O MUST be inside transaction closure to trigger a rollback on failure.
        for (const patch of filePatches) {
          const existing = fs.existsSync(patch.path) ? fs.readFileSync(patch.path, 'utf8') : ''
          const sep = existing ? '\n---\n' : ''
          const newContent = existing + sep + patch.content
          const dir = path.dirname(patch.path)
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true })
          }
          fs.writeFileSync(patch.path, newContent, 'utf8')
        }

        // Serialize report to disk
        // Using Date.now() and crypto string to generate a ULID-like random ID since ulid is missing
        const newUlid = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
        const retrosDir = path.join(rootPath, '.claude', 'retros')
        if (!fs.existsSync(retrosDir)) {
          fs.mkdirSync(retrosDir, { recursive: true })
        }
        serializedPath = path.join(retrosDir, `retro_${newUlid}.md`)
        
        let formattedItems = ''
        for (const item of items) {
          if (item.status === 'approved' || item.status === 'edited') {
            const content = item.status === 'edited' ? (item.edited_content || item.content) : item.content
            formattedItems += `- [${item.item_type}] ${content}\n`
          }
        }

        const reportMarkdown = `# Retro ${retroId}\n\n${formattedItems}`
        fs.writeFileSync(serializedPath, reportMarkdown, 'utf8')

      })()

    } catch (e: any) {
      log.error(`[RetroCommit] transaction failed`, e)
      throw new Error(`Commit failed: ${e.message}`)
    }

    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      win.webContents.send('retro:approved', { reportId: retroId })
    }

    return { ok: true, retroId, serializedPath }
  }))

  ipcMain.handle('retro:generate', (_e, data: {
    projectId: string
    scope: string
    fromTs: number
    toTs: number
  }) => handleIpc(async () => {
    const retroId = await retroSynthesizer.synthesize(data)
    return { retroId }
  }))

  ipcMain.handle('retro:push-ready', (_e, id: string) => handleIpc(() => {
    stateLedger.pushRetroReady(id)
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
        win.webContents.send('retro:ready', { reportId: id })
    }
    return true
  }))

  ipcMain.handle('retro:trigger-manual', (_e, projectId: string) => handleIpc(async () => {
    const retroId = await retroTrigger.triggerManual(projectId)
    return { retroId }
  }))
}
