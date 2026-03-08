import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { BrowserWindow } from 'electron'
import { StateLedger, StoryRecord } from './db/state-ledger'
import log from './utils/logger'

interface Story {
  id: string
  title: string
  status: string
  path: string
  priority: 'P0' | 'P1' | 'P2' | 'P3' | 'UNKNOWN'
  type: string
  epic: string | null
  model: string | null
  workflowId: string | null
  date: string
  blocked: boolean
  flagged: boolean
}

function writeFileAtomic(targetPath: string, content: string): void {
  const tmp = targetPath + '.tmp'
  fs.writeFileSync(tmp, content, 'utf-8')
  fs.renameSync(tmp, targetPath)  // rename(2) is atomic on POSIX/macOS
}

export class StoriesManager {
  private storiesPath: string = ''
  private projectRoot: string = ''
  private window: BrowserWindow | null = null
  private watcher: fs.FSWatcher | null = null
  private ledger: StateLedger

  constructor(rootPath: string, ledger: StateLedger) {
    this.ledger = ledger
    this.setProjectRoot(rootPath)
  }

  setProjectRoot(rootPath: string) {
    this.projectRoot = rootPath
    const potentialPath = path.join(rootPath, 'docs/stories')
    
    // If the root itself is a project, target it
    if (fs.existsSync(potentialPath) || fs.existsSync(path.join(rootPath, '.git'))) {
      this.targetProject(rootPath)
    } else {
      this.storiesPath = ''
      log.info(`[StoriesManager] Repo store root recognized: ${rootPath}. No active project stories mapped.`)
    }
  }

  targetProject(projectPath: string) {
    this.storiesPath = path.join(projectPath, 'docs/stories')
    log.info(`[StoriesManager] Project stories targeted: ${this.storiesPath}`)

    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
    }

    if (fs.existsSync(this.storiesPath)) {
      this.watch()
      this.syncFromDisk()
    } else {
      log.warn(`Stories path not found in project: ${this.storiesPath}`)
    }
    this.broadcastUpdate()
  }

  setWindow(win: BrowserWindow) {
    this.window = win
    this.watch()
  }

  syncFromDisk(): number {
    if (!fs.existsSync(this.storiesPath)) return 0
    let count = 0

    const files = fs.readdirSync(this.storiesPath)
      .filter(f => f.endsWith('.md') && !f.endsWith('.tmp'))

    const allInDb = this.ledger.listStoriesFromDb()
    const dbMap = new Map(allInDb.map(s => [s.id, s]))

    for (const file of files) {
      const id = file.replace('.md', '')
      const filePath = path.join(this.storiesPath, file)

      try {
        const existing = dbMap.get(id)
        const mtime = fs.statSync(filePath).mtimeMs

        // Import if new OR if file has been modified since last sync
        const lastSynced = existing?.last_synced_at
          ? new Date(existing.last_synced_at).getTime()
          : 0

        if (!existing || mtime > lastSynced) {
          const content = fs.readFileSync(filePath, 'utf-8')
          const parsed = this._parseStoryRecord(file, content)
          this.ledger.upsertStory(parsed)
          count++
        }
      } catch (e) {
        log.warn(`[StoriesManager] syncFromDisk: failed to sync ${file}`, e)
      }
    }

    return count
  }

  listStories(): Story[] {
    return this.ledger.listStoriesFromDb().map(r => ({
      id:       r.id,
      title:    r.title,
      status:   r.status,
      path:     r.file_path,
      priority: (r.priority ?? 'UNKNOWN') as Story['priority'],
      type:     r.type ?? 'Unknown',
      epic:     r.epic ?? null,
      model:      r.assigned_to ?? null,
      workflowId: r.workflow_id ?? null,
      date:       r.date ?? '',
      blocked:    (r.blocked_by ?? []).length > 0,
      flagged:    r.flagged ?? false,
    }))
  }

  private _parseStoryRecord(filename: string, content: string): StoryRecord {
    const id = filename.replace('.md', '')
    const titleMatch = content.match(/^#\s+(.+)$/m)
    let title = titleMatch ? titleMatch[1] : id
    title = title.replace(/^Story \d+[:\s—]+\s*/, '')

    const statusMatch = content.match(/\*\*Status:\*\*\s*(.+)$/m)
    const statusRaw = statusMatch ? statusMatch[1].trim() : 'UNKNOWN'
    let status = 'UNKNOWN'
    if (statusRaw.includes('READY')) status = 'READY'
    else if (statusRaw.includes('IN PROGRESS')) status = 'IN PROGRESS'
    else if (statusRaw.includes('TESTING')) status = 'TESTING'
    else if (statusRaw.includes('REVIEW')) status = 'REVIEW'
    else if (statusRaw.includes('DOCUMENTING')) status = 'DOCUMENTING'
    else if (statusRaw.includes('COMPLETE') || statusRaw.includes('DONE')) status = 'COMPLETE'

    const priorityMatch = content.match(/\*\*Priority:\*\*\s*(P\d|UNKNOWN)/m)
    const priority = priorityMatch ? priorityMatch[1] : 'UNKNOWN'

    const typeMatch = content.match(/\*\*Type:\*\*\s*(.+)$/m)
    const type = typeMatch ? typeMatch[1].trim() : 'Unknown'

    const epicMatch = content.match(/\*\*Epic:\*\*\s*(.+)$/m)
    const epic = epicMatch && epicMatch[1].trim() !== '(none)' && epicMatch[1].trim() !== ''
      ? epicMatch[1].trim() : null

    const modelMatch = content.match(/\*\*(?:Model|Assigned To):\*\*\s*(.+)$/m)
    const assigned_to = modelMatch && modelMatch[1].trim() !== '(unassigned)'
      ? modelMatch[1].trim() : undefined

    const workflowMatch = content.match(/\*\*(?:Workflow):\*\*\s*(.+)$/m)
    const workflow_id = workflowMatch && workflowMatch[1].trim() !== '(none)' && workflowMatch[1].trim() !== '— none —' && workflowMatch[1].trim() !== ''
      ? workflowMatch[1].trim() : null

    const blockedByMatch = content.match(/##\s+Blocked By\s*\n([\s\S]*?)(?=\n##|$)/)
    const blockedByLines = (blockedByMatch?.[1] ?? '').trim().split('\n')
    const blocked_by = blockedByLines
      .map(l => l.replace(/^[-*]\s*/, '').trim())
      .filter(l => l.length > 0 && !l.toLowerCase().includes('none'))
      .map(l => l.match(/story_\d+/i)?.[0] ?? l)

    const blocksMatch = content.match(/##\s+Blocks\s*\n([\s\S]*?)(?=\n##|$)/)
    const blocksLines = (blocksMatch?.[1] ?? '').trim().split('\n')
    const blocks = blocksLines
      .map(l => l.replace(/^[-*]\s*/, '').trim())
      .filter(l => l.length > 0 && !l.toLowerCase().includes('none'))
      .map(l => l.match(/story_\d+/i)?.[0] ?? l)

    const dateMatch = content.match(/\*\*Date:\*\*\s*(.+)$/m)
    const date = dateMatch ? dateMatch[1].trim() : ''

    const flaggedMatch = content.match(/\*\*Flagged:\*\*\s*(.+)$/m)
    const flagged = flaggedMatch ? flaggedMatch[1].trim().toLowerCase() === 'true' : false

    return {
      id, title, status,
      priority, type, epic: epic ?? undefined,
      assigned_to,
      workflow_id,
      blocked_by, blocks,
      body_md: content,
      file_path: path.join(this.storiesPath, filename),
      date,
      flagged,
    }
  }

  updateStoryStatus(id: string, newStatus: string) {
    const record = this.ledger.getStoryById(id)
    if (!record) return

    if (newStatus === 'COMPLETE') {
       try {
         const auditScript = path.join(this.projectRoot, 'scripts/utils/security_audit.py')
         if (fs.existsSync(auditScript)) {
            execSync(`python3 "${auditScript}"`, { cwd: this.projectRoot })
         }
       } catch (e) {
         log.error('[SECURITY] Audit REJECTED.', e)
         if (this.window) {
           this.window.webContents.send('app:critical-error', {
             type: 'Security Audit Rejected',
             message: `Security Audit Rejected story ${id}.`
           })
         }
         return
       }
       this.archiveStory(id)
       return
    }

    if (newStatus === 'DOCUMENTING') {
      log.info(`[StoriesManager] Story ${id} entered DOCUMENTING state. Triggering scribe...`);
      fetch('http://localhost:5001/api/docs/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ story_id: id, status: 'DOCUMENTING' })
      }).catch(err => log.error('[StoriesManager] Failed to trigger documentation generation:', err));
    }

    const verboseStatus = newStatus === 'READY'   ? 'READY FOR IMPLEMENTATION'
                        : newStatus === 'REVIEW'  ? 'READY FOR REVIEW'
                        : newStatus

    const updatedBody = record.body_md.replace(
      /(\*\*Status:\*\*).+$/m, `$1 ${verboseStatus}`
    )

    this.ledger.updateStoryFields(id, { status: newStatus, body_md: updatedBody })
    writeFileAtomic(record.file_path, updatedBody)
    this.broadcastUpdate()
    
    if (this.window) {
      this.window.webContents.send('story:status-changed', { id, status: newStatus })
    }
  }

  createStory({ title, type = 'Feature', epic = '(none)', priority = 'P2' }: {
    title: string; type?: string; epic?: string; priority?: string
  }): string {
    if (!this.storiesPath) throw new Error('No story storage path targeted.')
    if (!fs.existsSync(this.storiesPath)) {
      fs.mkdirSync(this.storiesPath, { recursive: true })
    }

    const rows = this.ledger.listStoriesFromDb()
    const maxId = rows.reduce((max, r) => {
      const m = r.id.match(/story_(\d+)/)
      return m ? Math.max(max, parseInt(m[1], 10)) : max
    }, 0)

    const nextNum = maxId + 1
    const id = `story_${String(nextNum).padStart(3, '0')}`
    const slug = `${id}_${title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`
    const dateStr = new Date().toISOString().split('T')[0]
    const filepath = path.join(this.storiesPath, `${id}.md`)

    const body = `# Story ${String(nextNum).padStart(3, '0')}: ${title}

**Status:** READY
**Type:** ${type}
**Priority:** ${priority}
**Epic:** ${epic}
**Model:** (unassigned)
**Date:** ${dateStr}

---

## Problem
${title}

## Acceptance Criteria
- [ ] Implement ${title}

## Blocks
- None

## Blocked By
- None

## Documentation Impact
- None

## Definition of Done
- [ ] ...
`

    this.ledger.upsertStory({
      id, slug, title, status: 'READY', priority, type, epic,
      workflow_id: null,
      blocked_by: [], blocks: [], body_md: body, file_path: filepath, date: dateStr,
      flagged: false,
    })

    writeFileAtomic(filepath, body)
    this.broadcastUpdate()
    return id
  }

  getStoryContent(id: string): string {
    const record = this.ledger.getStoryById(id)
    return record?.body_md ?? ''
  }

  getStoryPath(id: string): string {
    const record = this.ledger.getStoryById(id)
    return record?.file_path ?? ''
  }

  isRepoTargeted(): boolean {
    return this.storiesPath !== '' && fs.existsSync(this.storiesPath);
  }

  updateStoryContent(id: string, content: string) {
    const record = this.ledger.getStoryById(id)
    if (!record) return

    const fresh = this._parseStoryRecord(path.basename(record.file_path), content)
    this.ledger.upsertStory({ ...fresh, id, file_path: record.file_path })
    writeFileAtomic(record.file_path, content)
    this.broadcastUpdate()
  }

  setField(id: string, field: string, value: string | boolean) {
    const ALLOWED_FIELDS = ['priority', 'type', 'model', 'epic', 'status', 'workflowId', 'flagged']
    if (!ALLOWED_FIELDS.includes(field)) return

    const record = this.ledger.getStoryById(id)
    if (!record) return

    let fieldLabel = field.charAt(0).toUpperCase() + field.slice(1)
    if (field === 'model') fieldLabel = 'Model'
    if (field === 'workflowId') fieldLabel = 'Workflow'

    const finalValue = (value === '— none —' || value === '(none)') ? '(none)' : String(value)
    const re = new RegExp(`^\\*\\*${fieldLabel}:\\*\\*(.*?)$`, 'm')
    let updatedBody = record.body_md

    if (re.test(updatedBody)) {
      updatedBody = updatedBody.replace(re, `**${fieldLabel}:** ${finalValue}`)
    } else {
      updatedBody = updatedBody.replace(/^(# .*?\n)/, `$1**${fieldLabel}:** ${finalValue}\n`)
    }

    let dbField: string = field
    if (field === 'model') dbField = 'assigned_to'
    if (field === 'workflowId') dbField = 'workflow_id'

    const dbValue = finalValue === '(none)' ? null : (field === 'flagged' ? (value === true || value === 'true') : finalValue)
    this.ledger.updateStoryFields(id, { [dbField]: dbValue, body_md: updatedBody } as any)
    writeFileAtomic(record.file_path, updatedBody)
    this.broadcastUpdate()
  }

  archiveStory(id: string) {
    const record = this.ledger.getStoryById(id)
    if (!record) return

    const archiveDir = path.join(this.storiesPath, 'completed')
    if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir, { recursive: true })

    const archivePath = path.join(archiveDir, path.basename(record.file_path))
    const archivedBody = record.body_md.replace(
      /(\*\*Status:\*\*).+$/m, '$1 COMPLETE'
    )

    this.ledger.updateStoryFields(id, {
      status:    'COMPLETE',
      body_md:   archivedBody,
      file_path: archivePath,
    })

    writeFileAtomic(archivePath, archivedBody)

    // Trigger Implementation Report Generation (Story 227)
    fetch('http://localhost:5001/api/docs/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ story_id: id, status: 'COMPLETE' })
    }).catch(err => log.error('[StoriesManager] Failed to trigger implementation report:', err));

    try { fs.unlinkSync(record.file_path) } catch { /* ignore */ }
    this.broadcastUpdate()
    
    if (this.window) {
      this.window.webContents.send('story:status-changed', { id, status: 'COMPLETE' })
    }
  }

  deleteStory(id: string) {
    const record = this.ledger.getStoryById(id)
    if (!record) return

    this.ledger.deleteStory(id)
    try {
      if (fs.existsSync(record.file_path)) {
        fs.unlinkSync(record.file_path)
      }
    } catch (e) {
      log.warn(`[StoriesManager] Failed to delete file for story ${id}`, e)
    }
    this.broadcastUpdate()
  }

  watch() {
    if (!fs.existsSync(this.storiesPath)) return
    if (this.watcher) this.watcher.close()
    
    this.watcher = fs.watch(this.storiesPath, (_eventType, filename) => {
        if (filename && filename.endsWith('.md') && !filename.endsWith('.tmp')) {
            this.broadcastUpdate()
        }
    })
  }

  private broadcastUpdate() {
      if (this.window && !this.window.isDestroyed()) {
          try {
            this.window.webContents.send('stories:updated', this.listStories())
          } catch (e) {
            log.error("Failed to broadcast update", e)
          }
      }
  }
}
