import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import log from '../utils/logger'

interface TopicEntry {
  id: string
  title: string
  file: string
  keywords: string[]
}

interface TopicIndex {
  version: number
  topics: TopicEntry[]
}

export class KnowledgeRouter {
  private index: TopicIndex | null = null
  private knowledgeDir: string | null = null

  private resolveDir(): string {
    return app.isPackaged
      ? path.join(process.resourcesPath, 'knowledge')
      : path.join(app.getAppPath(), '..', 'resources', 'knowledge')
  }

  private ensureLoaded() {
    if (this.index) return
    try {
      this.knowledgeDir = this.resolveDir()
      const raw = fs.readFileSync(path.join(this.knowledgeDir, 'index.json'), 'utf-8')
      this.index = JSON.parse(raw)
    } catch (e) {
      log.warn('[KnowledgeRouter] Failed to load knowledge index:', e)
      this.index = { version: 1, topics: [] }
    }
  }

  public getContext(query: string, maxTopics = 2): string {
    this.ensureLoaded()
    if (!this.index || !this.knowledgeDir) return ''

    const q = query.toLowerCase()
    const scored = this.index.topics
      .map(t => ({ ...t, score: t.keywords.filter(k => q.includes(k)).length }))
      .filter(t => t.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxTopics)

    if (scored.length === 0) return ''

    return scored.map(t => {
      try {
        const content = fs.readFileSync(path.join(this.knowledgeDir!, t.file), 'utf-8')
        return `## ${t.title}\n\n${content}`
      } catch {
        return ''
      }
    }).filter(Boolean).join('\n\n---\n\n')
  }
}

export const knowledgeRouter = new KnowledgeRouter()
