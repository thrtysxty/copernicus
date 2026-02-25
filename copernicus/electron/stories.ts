import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { BrowserWindow } from 'electron'

interface Story {
  id: string
  title: string
  status: string
  path: string
}

export class StoriesManager {
  private storiesPath: string
  private projectRoot: string
  private window: BrowserWindow | null = null

  constructor(rootPath: string) {
    this.projectRoot = rootPath
    this.storiesPath = path.join(rootPath, 'docs/stories')
    if (!fs.existsSync(this.storiesPath)) {
      console.warn(`Stories path not found: ${this.storiesPath}`)
    }
  }

  setWindow(win: BrowserWindow) {
    this.window = win
    this.watch()
  }

  listStories(): Story[] {
    if (!fs.existsSync(this.storiesPath)) return []
    
    try {
        const files = fs.readdirSync(this.storiesPath).filter(f => f.endsWith('.md'))
        return files.map(file => {
          const content = fs.readFileSync(path.join(this.storiesPath, file), 'utf-8')
          return this.parseStory(file, content)
        })
    } catch (e) {
        console.error("Failed to list stories", e)
        return []
    }
  }

  private parseStory(filename: string, content: string): Story {
    const id = filename.replace('.md', '')
    const titleMatch = content.match(/^#\s+(.+)$/m)
    let title = titleMatch ? titleMatch[1] : id
    title = title.replace(/^Story \d+:\s*/, '')
    
    const statusMatch = content.match(/\*\*Status:\*\*\s*(.+)$/m)
    let statusRaw = statusMatch ? statusMatch[1].trim() : 'UNKNOWN'
    
    let status = 'UNKNOWN'
    if (statusRaw.includes('READY')) status = 'READY'
    else if (statusRaw.includes('IN PROGRESS')) status = 'IN PROGRESS'
    else if (statusRaw.includes('TESTING')) status = 'TESTING'
    else if (statusRaw.includes('REVIEW')) status = 'REVIEW'
    else if (statusRaw.includes('DOCUMENTING')) status = 'DOCUMENTING'
    else if (statusRaw.includes('COMPLETE') || statusRaw.includes('DONE')) status = 'COMPLETE'

    return { id, title, status, path: path.join(this.storiesPath, filename) }
  }

  updateStoryStatus(id: string, newStatus: string) {
    const filepath = path.join(this.storiesPath, `${id}.md`)
    if (!fs.existsSync(filepath)) return

    if (newStatus === 'COMPLETE') {
       // --- Security Gate ---
       try {
         const auditScript = path.join(this.projectRoot, 'scripts/utils/security_audit.py')
         console.log(`[SECURITY] Running pre-archive audit: ${auditScript}`)
         execSync(`python3 "${auditScript}"`, { cwd: this.projectRoot })
       } catch (e) {
         console.error('[SECURITY] Audit REJECTED. Story cannot be completed.', e)
         if (this.window) {
           this.window.webContents.send('system:notification', {
             type: 'error',
             message: `Security Audit Rejected story ${id}. Credential leak detected.`
           })
         }
         return
       }
       
       this.archiveStory(id)
       return
    }

    let content = fs.readFileSync(filepath, 'utf-8')
    let verboseStatus = newStatus
    if (newStatus === 'READY') verboseStatus = 'READY FOR IMPLEMENTATION'
    else if (newStatus === 'REVIEW') verboseStatus = 'READY FOR REVIEW'
    
    content = content.replace(/(\*\*Status:\*\*).+$/m, `$1 ${verboseStatus}`)
    fs.writeFileSync(filepath, content)
    this.broadcastUpdate()
  }

  archiveStory(id: string) {
    const src = path.join(this.storiesPath, `${id}.md`)
    const archiveDir = path.join(this.storiesPath, 'archived')
    if (!fs.existsSync(archiveDir)) fs.mkdirSync(archiveDir)
    
    const dest = path.join(archiveDir, `${id}.md`)
    if (fs.existsSync(src)) {
        let content = fs.readFileSync(src, 'utf-8')
        content = content.replace(/(\*\*Status:\*\*).+$/m, `$1 COMPLETE`)
        fs.writeFileSync(src, content)
        fs.renameSync(src, dest)
        this.broadcastUpdate()
    }
  }

  watch() {
    if (!fs.existsSync(this.storiesPath)) return
    fs.watch(this.storiesPath, (_eventType, filename) => {
        if (filename && filename.endsWith('.md')) {
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
