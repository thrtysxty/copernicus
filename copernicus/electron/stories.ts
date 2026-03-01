import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { BrowserWindow } from 'electron'
import { StateLedger, StoryRecord } from './db/state-ledger'

interface Story {
  id: string
  title: string
  status: string
  path: string
  priority: 'P0' | 'P1' | 'P2' | 'P3' | 'UNKNOWN'
  type: string
  epic: string | null
  model: string | null
  date: string
  blocked: boolean
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
    this.storiesPath = path.join(rootPath, 'docs/stories')
    console.log(`[StoriesManager] path set: ${this.storiesPath}`)

    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
    }

    if (fs.existsSync(this.storiesPath)) {
      this.watch()
      this.syncFromDisk()
    } else {
      console.warn(`Stories path not found: ${this.storiesPath}`)
    }
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

    for (const file of files) {
      const id = file.replace('.md', '')
      const filePath = path.join(this.storiesPath, file)

      try {
        const existing = this.ledger.getStoryById(id)
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
        console.warn(`[StoriesManager] syncFromDisk: failed to sync ${file}`, e)
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
      model:    r.assigned_to ?? null,
      date:     r.date ?? '',
      blocked:  (r.blocked_by ?? []).length > 0,
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

    const epicMatch = content.match(/\*\*Epic:\*\*\s*(story_\d+|\(none\))/m)
    const epic = epicMatch && epicMatch[1] !== '(none)' ? epicMatch[1] : null

    const modelMatch = content.match(/\*\*(?:Model|Assigned To):\*\*\s*(.+)$/m)
    const assigned_to = modelMatch && modelMatch[1].trim() !== '(unassigned)'
      ? modelMatch[1].trim() : undefined

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

    return {
      id, title, status,
      priority, type, epic: epic ?? undefined,
      assigned_to,
      blocked_by, blocks,
      body_md: content,
      file_path: path.join(this.storiesPath, filename),
      date,
    }
  }

  updateStoryStatus(id: string, newStatus: string) {
    if (newStatus === 'COMPLETE') {
       try {
         const auditScript = path.join(this.projectRoot, 'scripts/utils/security_audit.py')
         if (fs.existsSync(auditScript)) {
            execSync(`python3 "${auditScript}"`, { cwd: this.projectRoot })
         }
       } catch (e) {
         console.error('[SECURITY] Audit REJECTED.', e)
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

    const verboseStatus = newStatus === 'READY'   ? 'READY FOR IMPLEMENTATION'
                        : newStatus === 'REVIEW'  ? 'READY FOR REVIEW'
                        : newStatus

    const record = this.ledger.getStoryById(id)
    if (!record) return

    const updatedBody = record.body_md.replace(
      /(\*\*Status:\*\*).+$/m, `$1 ${verboseStatus}`
    )

    this.ledger.updateStoryFields(id, { status: newStatus, body_md: updatedBody })
    writeFileAtomic(record.file_path, updatedBody)
    this.broadcastUpdate()
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
      blocked_by: [], blocks: [], body_md: body, file_path: filepath, date: dateStr,
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
    return !this.storiesPath.endsWith('.copernicus/docs/stories') && this.storiesPath.split(path.sep).length > 4;
  }

  updateStoryContent(id: string, content: string) {
    const record = this.ledger.getStoryById(id)
    if (!record) return

    const fresh = this._parseStoryRecord(path.basename(record.file_path), content)
    this.ledger.upsertStory({ ...fresh, id, file_path: record.file_path })
    writeFileAtomic(record.file_path, content)
    this.broadcastUpdate()
  }

  setField(id: string, field: string, value: string) {
    const ALLOWED_FIELDS = ['priority', 'type', 'model', 'epic', 'status']
    if (!ALLOWED_FIELDS.includes(field)) return

    const record = this.ledger.getStoryById(id)
    if (!record) return

    const fieldLabel = field === 'model' ? 'Model'
      : field.charAt(0).toUpperCase() + field.slice(1)

    const updatedBody = record.body_md.replace(
      new RegExp(`(\\*\\*${fieldLabel}:\\*\\*).*$`, 'm'),
      `$1 ${value}`
    )

    const dbField = field === 'model' ? 'assigned_to' : field as any
    this.ledger.updateStoryFields(id, { [dbField]: value, body_md: updatedBody })
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

    try { fs.unlinkSync(record.file_path) } catch { /* ignore */ }
    this.broadcastUpdate()
  }

  watch() {
    if (!fs.existsSync(this.storiesPath)) return
    if (this.watcher) this.watcher.close()
    
    this.watcher = fs.watch(this.storiesPath, (_eventType, filename) => {
        if (filename && filename.endsWith('.md') && !filename.endsWith('.tmp')) {
            // We should ideally sync here, but to avoid infinite loops if we are the writer,
            // we'll just broadcast for now or rely on the syncFromDisk on focus.
            this.broadcastUpdate()
        }
    })
  }

  private broadcastUpdate() {
      if (this.window) {
          try {
            this.window.webContents.send('stories:updated', this.listStories())
          } catch (e) {
            console.error("Failed to broadcast update", e)
          }
      }
  }
}
