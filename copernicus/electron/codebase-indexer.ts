import fs from 'fs'
import path from 'path'
import sqliteVec from 'sqlite-vec'
import { stateLedger } from './db/state-ledger'
import { authManager } from './auth-manager'
import { SettingsStore } from './settings-store'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Re-using same instance logic as main.ts
const settingsStore = new SettingsStore()

export interface IndexStatus {
  indexing: boolean
  filesIndexed: number
  totalFiles: number
  provider: string
}

export class CodebaseIndexer {
  private isIndexing = false
  private filesIndexed = 0
  private totalFiles = 0
  private activeProvider = 'none'

  constructor() {
    // Initialize vector extension
    sqliteVec.load(stateLedger.db)
    this.initSchema()
  }

  private initSchema() {
    stateLedger.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS codebase_vec USING vec0(
        file_path TEXT PRIMARY KEY,
        content TEXT,
        embedding FLOAT[768]
      );
    `)
  }

  public getStatus(): IndexStatus {
    return {
      indexing: this.isIndexing,
      filesIndexed: this.filesIndexed,
      totalFiles: this.totalFiles,
      provider: this.activeProvider,
    }
  }

  private async getEmbedding(text: string): Promise<{ embedding: number[]; provider: string }> {
    const order = settingsStore.get('embeddingProviderOrder', ['ollama', 'google', 'deepinfra', 'openai', 'openrouter'])

    for (const provider of order) {
      try {
        const embedding = await this.tryProvider(provider, text)
        if (embedding) return { embedding, provider }
      } catch (e) {
        continue
      }
    }

    throw new Error('No embedding provider available.')
  }

  private async tryProvider(provider: string, text: string): Promise<number[] | null> {
    switch (provider) {
      case 'ollama': {
        const url = process.env.OLLAMA_BASE_URL
        if (!url) return null
        const res = await fetch(`${url.replace(/\/$/, '')}/api/embeddings`, {
          method: 'POST',
          body: JSON.stringify({ model: 'nomic-embed-text', prompt: text }),
        })
        const { embedding } = await res.json() as any
        return embedding
      }
      case 'google': {
        const key = authManager.getApiKey('google')
        if (!key) return null
        const genAI = new GoogleGenerativeAI(key)
        const model = genAI.getGenerativeModel({ model: 'text-embedding-004' })
        const result = await model.embedContent(text)
        return Array.from(result.embedding.values)
      }
      case 'openai':
      case 'openrouter':
      case 'deepinfra': {
        const resolved = authManager.resolveForProvider(provider)
        if (!resolved) return null
        const modelMap: Record<string, string> = {
          openai: 'text-embedding-3-small',
          openrouter: 'openai/text-embedding-3-small',
          deepinfra: 'BAAI/bge-base-en-v1.5'
        }
        const body: any = {
          model: modelMap[provider],
          input: text
        }
        if (provider !== 'deepinfra') body.dimensions = 768

        const res = await fetch(`${resolved.baseUrl}/embeddings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${resolved.key}`,
            ...(resolved.headers || {})
          },
          body: JSON.stringify(body)
        })
        const json = await res.json() as any
        return json.data[0].embedding
      }
      default:
        return null
    }
  }

  public async startIndexing(rootPath: string) {
    if (this.isIndexing) return
    this.isIndexing = true
    this.filesIndexed = 0
    
    try {
      const files = this.walk(rootPath).filter(f => 
        ['.ts', '.tsx', '.py', '.md', '.json', '.sql'].includes(path.extname(f)) &&
        !f.includes('node_modules') && !f.includes('.git')
      )
      
      this.totalFiles = files.length
      
      for (const file of files) {
        await this.indexFile(file)
        this.filesIndexed++
      }
    } catch (e) {
      console.error('[Indexer] Full index failed:', e)
    } finally {
      this.isIndexing = false
    }
  }

  public async indexFile(filePath: string) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      if (!content.trim()) return

      // For MVP, we index the whole file if small, or first 2000 chars
      const textToIndex = content.slice(0, 2000)
      const { embedding, provider } = await this.getEmbedding(textToIndex)
      this.activeProvider = provider

      const stmt = stateLedger.db.prepare(`
        INSERT INTO codebase_vec(file_path, content, embedding)
        VALUES (?, ?, ?)
        ON CONFLICT(file_path) DO UPDATE SET
          content = excluded.content,
          embedding = excluded.embedding
      `)
      
      stmt.run(filePath, textToIndex, new Float32Array(embedding))
    } catch (e) {
      console.error(`[Indexer] Failed to index ${filePath}:`, e)
    }
  }

  public async search(query: string, topK = 5): Promise<any[]> {
    const { embedding } = await this.getEmbedding(query)
    
    const stmt = stateLedger.db.prepare(`
      SELECT file_path, content, distance
      FROM codebase_vec
      WHERE embedding MATCH ?
      ORDER BY distance
      LIMIT ?
    `)
    
    const rows = stmt.all(new Float32Array(embedding), topK)
    return rows.map((r: any) => ({
      path: r.file_path,
      content: r.content,
      similarity: 1 - r.distance // dist 0 = similarity 1
    }))
  }

  private walk(dir: string): string[] {
    let results: string[] = []
    const list = fs.readdirSync(dir)
    list.forEach(file => {
      file = path.join(dir, file)
      const stat = fs.statSync(file)
      if (stat && stat.isDirectory()) {
        results = results.concat(this.walk(file))
      } else {
        results.push(file)
      }
    })
    return results
  }
}

export const codebaseIndexer = new CodebaseIndexer()
