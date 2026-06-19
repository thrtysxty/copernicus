import { config } from './config'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { BrowserWindow } from 'electron'
import { StateLedger, StoryRecord } from './db/state-ledger'
import log from './utils/logger'
import matter from 'gray-matter'
import yaml from 'js-yaml'

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
  private activeProjectId: string = ''
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

  targetProject(projectPath: string): number {
    this.activeProjectId = path.resolve(projectPath)
    this.storiesPath = path.join(this.activeProjectId, 'docs/stories')
    log.info(`[StoriesManager] Project stories targeted: ${this.storiesPath}`)

    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
    }

    let imported = 0
    if (!fs.existsSync(this.storiesPath)) {
      fs.mkdirSync(this.storiesPath, { recursive: true })
    }
    this.watch()
    imported = this.syncFromDisk()
    this.broadcastUpdate()
    return imported
  }

  setWindow(win: BrowserWindow) {
    this.window = win
    this.watch()
  }

  syncFromDisk(): number {
    if (!fs.existsSync(this.storiesPath)) return 0
    if (!this.ledger.db.open) return 0
    let count = 0

    const files = fs.readdirSync(this.storiesPath)
      .filter(f => f.endsWith('.md') && !f.endsWith('.tmp'))

    const validFilePaths: string[] = []

    const allInDb = this.ledger.listStoriesFromDb(this.activeProjectId)
    const dbMap = new Map(allInDb.map(s => [s.id, s]))

    for (const file of files) {
      const id = file.replace('.md', '')
      const filePath = path.join(this.storiesPath, file)
      validFilePaths.push(filePath)

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

    // Cleanup pass: remove stories that belong to the active project but no longer exist on disk
    this.ledger.deleteOrphanedStories(this.activeProjectId, validFilePaths)

    return count
  }

  listStories(filter?: { status?: string }): Story[] {
    const all = this.ledger.listStoriesFromDb(this.activeProjectId)
    const rows = filter?.status
      ? all.filter(r => r.status === filter.status)
      : all
    return rows.map(r => ({
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
    const { data, content: body } = matter(content)

    const titleMatch = body.match(/^#\s+(.+)$/m)
    const title = data.title || (titleMatch ? titleMatch[1]! : id)

    const statusRaw = (data.status || '').toString().trim().toUpperCase()
    const BOARD_STATUSES = ['PLANNING', 'STORYBOARDING', 'SPRINT_PLANNING', 'IN_PROGRESS', 'TESTING', 'QA', 'DOCUMENTING', 'READY', 'COMPLETE']
    let status = 'PLANNING'
    if (BOARD_STATUSES.includes(statusRaw)) status = statusRaw
    else if (statusRaw.includes('SPRINT')) status = 'SPRINT_PLANNING'
    else if (statusRaw.includes('STORYBOARD')) status = 'STORYBOARDING'
    else if (statusRaw.includes('PROGRESS')) status = 'IN_PROGRESS'
    else if (statusRaw.includes('TESTING')) status = 'TESTING'
    else if (statusRaw.includes('QA')) status = 'QA'
    else if (statusRaw.includes('DOC')) status = 'DOCUMENTING'
    else if (statusRaw.includes('READY')) status = 'READY'
    else if (statusRaw.includes('COMPLETE') || statusRaw.includes('DONE')) status = 'COMPLETE'

    const priority = (data.priority || 'UNKNOWN').toString().toUpperCase()
    const type = (data.type || 'Unknown').toString()
    const epic = (data.epic && data.epic !== '(none)' && data.epic !== '') ? data.epic : null
    const assigned_to = (data.assigned_to && data.assigned_to !== '(unassigned)') ? data.assigned_to : undefined
    const workflow_id = (data.workflow_id && data.workflow_id !== '(none)' && data.workflow_id !== '— none —' && data.workflow_id !== '')
      ? data.workflow_id : null

    const blocked_by = Array.isArray(data.blocked_by)
      ? data.blocked_by.map(l => (typeof l === 'string' ? l.match(/story_\d+/i)?.[0] ?? l : String(l)))
      : []

    const blocks = Array.isArray(data.blocks)
      ? data.blocks.map(l => (typeof l === 'string' ? l.match(/story_\d+/i)?.[0] ?? l : String(l)))
      : []

    const date = (data.date || '').toString()
    const flagged = !!data.flagged

    return {
      id, title, status, project_id: this.activeProjectId,
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

  async setStoryStatus(storyNumber: number, status: string) {
    const id = `story_${String(storyNumber).padStart(3, '0')}`
    await this.updateStoryStatus(id, status)
  }

  updateStoryStatus(id: string, newStatus: string) {
    const record = this.ledger.getStoryById(id)
    if (!record) return

    if (newStatus === 'COMPLETE') {
       const auditScript = path.join(this.projectRoot, 'scripts/utils/security_audit.py')
       if (fs.existsSync(auditScript)) {
         try {
           execFileSync('python3', [auditScript], { cwd: this.projectRoot, timeout: 30000 })
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
       }
       this.archiveStory(id)
       return
    }

    if (newStatus === 'DOCUMENTING') {
      log.info(`[StoriesManager] Story ${id} entered DOCUMENTING state. Triggering scribe...`);
      fetch(`${config.backend.url}/api/docs/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ story_id: id, status: 'DOCUMENTING' })
      }).catch(err => log.error('[StoriesManager] Failed to trigger documentation generation:', err));
    }

    const { data, content } = matter(record.body_md)
    const updatedData = { ...data, status: newStatus }
    const updatedBody = `---\n${yaml.dump(updatedData)}---\n\n${content}`

    this.ledger.updateStoryFields(id, { status: newStatus, body_md: updatedBody })
    writeFileAtomic(record.file_path, updatedBody)
    this.broadcastUpdate()

    if (this.window) {
      this.window.webContents.send('story:status-changed', { id, status: newStatus })
    }
  }

  createStory({ title, type = 'Feature', epic = '(none)', priority = 'P2', ac, description }: {
    title: string; type?: string; epic?: string; priority?: string; ac?: string; description?: string
  }): string {
    if (!this.storiesPath) throw new Error('No story storage path targeted.')
    if (!fs.existsSync(this.storiesPath)) {
      fs.mkdirSync(this.storiesPath, { recursive: true })
    }

    const rows = this.ledger.listStoriesFromDb(this.activeProjectId)
    const maxId = rows.reduce((max, r) => {
      const m = r.id.match(/story_(\d+)/)
      return m ? Math.max(max, parseInt(m[1]!, 10)) : max
    }, 0)

    const nextNum = maxId + 1
    const id = `story_${String(nextNum).padStart(3, '0')}`
    const slug = `${id}_${title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`
    const dateStr = new Date().toISOString().split('T')[0]
    const filepath = path.join(this.storiesPath, `${id}.md`)

    const status = type === 'Epic' ? 'EPIC' : 'PLANNING'

    const data = {
      title,
      status,
      type,
      priority,
      epic: epic === '(none)' ? null : epic,
      assigned_to: '(unassigned)',
      workflow_id: '(none)',
      date: dateStr,
      flagged: false,
      blocked_by: [],
      blocks: [],
    }

    const body = `# Story ${String(nextNum).padStart(3, '0')}: ${title}

## Problem
${title}
${description ? `\n## Description\n${description}\n` : ''}
## Acceptance Criteria
${ac ? ac : `- [ ] Implement ${title}`}

## Blocks
- None

## Blocked By
- None

## Documentation Impact
- None

## Definition of Done
- [ ] ...`

    const content = `---\n${yaml.dump(data)}---\n\n${body}`

    this.ledger.upsertStory({
      id, slug, title, project_id: this.activeProjectId, status: type === 'Epic' ? 'EPIC' : 'PLANNING', priority, type, epic,
      workflow_id: null,
      blocked_by: [], blocks: [], body_md: content, file_path: filepath, date: dateStr,
      flagged: false,
    })

    writeFileAtomic(filepath, content)
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
    return this.storiesPath !== '';
  }

  updateStoryContent(id: string, content: string) {
    const record = this.ledger.getStoryById(id)
    if (!record) return

    const fresh = this._parseStoryRecord(path.basename(record.file_path), content)
    // Preserve the existing DB status — content edits don't change workflow state
    this.ledger.upsertStory({ ...fresh, id, file_path: record.file_path, status: record.status })
    writeFileAtomic(record.file_path, content)
    this.broadcastUpdate()
  }

  setField(id: string, field: string, value: string | boolean) {
    const ALLOWED_FIELDS = ['priority', 'type', 'model', 'epic', 'status', 'workflowId', 'flagged']
    if (!ALLOWED_FIELDS.includes(field)) return

    const record = this.ledger.getStoryById(id)
    if (!record) return

    let dbField: string = field
    if (field === 'model') dbField = 'assigned_to'
    if (field === 'workflowId') dbField = 'workflow_id'

    const finalValue = (value === '— none —' || value === '(none)') ? '(none)' : String(value)
    const dbValue = finalValue === '(none)' ? null : (field === 'flagged' ? (value === true || value === 'true') : finalValue)

    const { data, content } = matter(record.body_md)
    const fieldMap: Record<string, string> = {
      priority: 'priority',
      type: 'type',
      model: 'assigned_to',
      epic: 'epic',
      status: 'status',
      workflowId: 'workflow_id',
      flagged: 'flagged'
    }
    const yamlKey = fieldMap[field] as string
    const updatedData = { ...data, [yamlKey]: dbValue }
    const updatedBody = `---\n${yaml.dump(updatedData)}---\n\n${content}`

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
    const { data, content } = matter(record.body_md)
    const updatedData = { ...data, status: 'COMPLETE' }
    const archivedBody = `---\n${yaml.dump(updatedData)}---\n\n${content}`

    this.ledger.updateStoryFields(id, {
      status:    'COMPLETE',
      body_md:   archivedBody,
      file_path: archivePath,
    })

    writeFileAtomic(archivePath, archivedBody)

    // Trigger Implementation Report Generation (Story 227)
    fetch(`${config.backend.url}/api/docs/generate`, {
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
        try {
          execFileSync('git', ['rm', '-f', record.file_path], { cwd: this.projectRoot, encoding: 'utf8', timeout: 10000 })
        } catch {
          fs.unlinkSync(record.file_path)
        }
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
