import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { stateLedger } from './db/state-ledger'
import { authManager } from './auth-manager'
import { SettingsStore } from './settings-store'
import { GoogleGenerativeAI } from '@google/generative-ai'
import log from './utils/logger'
import { lspManager } from './lsp/lsp-manager'
import * as chokidar from 'chokidar'

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
  private watcher?: chokidar.FSWatcher

  constructor() {
    try {
      this.loadVectorExtension()
      this.initSchema()
    } catch (err) {
      log.error('[CodebaseIndexer] Failed to initialize:', err)
    }
  }

  private loadVectorExtension() {
    const os = process.platform === 'darwin' ? 'darwin' : process.platform === 'win32' ? 'windows' : 'linux'
    const arch = process.arch === 'arm64' ? 'arm64' : 'x86_64'
    const pkgName = `sqlite-vec-${os}-${arch}`
    const dir = app.isPackaged
      ? path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', pkgName)
      : path.dirname(require.resolve(`${pkgName}/package.json`))
    stateLedger.db.loadExtension(path.join(dir, 'vec0'))
  }

  private initSchema() {
    stateLedger.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS codebase_vec USING vec0(
        chunk_id TEXT PRIMARY KEY,
        file_path TEXT,
        line_start INTEGER,
        line_end INTEGER,
        symbols TEXT,
        chunk_index INTEGER,
        content TEXT,
        embedding FLOAT[768]
      );
    `)
  }

  private async getSymbols(filePath: string): Promise<any[]> {
    try {
      const symbols = await lspManager.sendRequest('textDocument/documentSymbol', {
        textDocument: { uri: `file://${filePath}` }
      })
      return Array.isArray(symbols) ? symbols : []
    } catch {
      return []
    }
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
    const order = settingsStore.get('embeddingProviderOrder', ['ollama', 'google', 'openai'])
    for (const provider of order) {
      try {
        const embedding = await this.tryProvider(provider, text)
        if (embedding) return { embedding, provider }
      } catch { continue }
    }
    throw new Error('No embedding provider available.')
  }

  private async tryProvider(provider: string, text: string): Promise<number[] | null> {
    if (provider === 'ollama') {
      const url = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
      const res = await fetch(`${url}/api/embeddings`, {
        method: 'POST',
        body: JSON.stringify({ model: 'qwen3-embedding:0.6b', prompt: text }),
      })
      const { embedding } = await res.json() as any
      return embedding
    }
    if (provider === 'google') {
      const apiKey = authManager.getApiKey('google')
      if (!apiKey) return null
      const genAI = new GoogleGenerativeAI(apiKey)
      const model = genAI.getGenerativeModel({ model: 'text-embedding-004' })
      const result = await model.embedContent(text)
      return Array.from(result.embedding.values)
    }
    if (provider === 'openai') {
      const apiKey = authManager.getApiKey('openai')
      if (!apiKey) return null
      const res = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          input: text,
          model: 'text-embedding-3-small'
        })
      })
      const { data } = await res.json() as any
      return (data as any)[0]?.embedding || null
    }
    return null
  }

  public async indexFile(filePath: string) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      const lines = content.split('\n')
      const symbols = await this.getSymbols(filePath)
      
      let chunks: any[] = []
      if (symbols.length > 0) {
        chunks = symbols.map((s, i) => ({
          chunk_id: `${filePath}#${i}`,
          line_start: s.location?.range?.start?.line ?? s.range?.start?.line ?? 0,
          line_end: s.location?.range?.end?.line ?? s.range?.end?.line ?? 0,
          symbols: s.name,
          chunk_index: i,
          content: lines.slice(
            s.location?.range?.start?.line ?? s.range?.start?.line ?? 0,
            (s.location?.range?.end?.line ?? s.range?.end?.line ?? 0) + 1
          ).join('\n')
        }))
      } else {
        // Recursive character splitter (1000 chars, 200 overlap)
        const chunkSize = 1000
        const overlap = 200
        const step = chunkSize - overlap
        for (let i = 0; i < content.length; i += step) {
          const chunkContent = content.slice(i, i + chunkSize)
          chunks.push({
            chunk_id: `${filePath}#c${i}`,
            line_start: 0,
            line_end: 0,
            symbols: '',
            chunk_index: chunks.length,
            content: chunkContent
          })
          if (i + chunkSize >= content.length) break
        }
      }

      const insertStmt = stateLedger.db.prepare(`
        INSERT INTO codebase_vec(chunk_id, file_path, line_start, line_end, symbols, chunk_index, content, embedding)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)

      stateLedger.db.transaction(() => {
        stateLedger.db.prepare('DELETE FROM codebase_vec WHERE file_path = ?').run(filePath)
      })()

      for (const chunk of chunks) {
        try {
          const { embedding, provider } = await this.getEmbedding(chunk.content)
          this.activeProvider = provider
          stateLedger.db.transaction(() => {
            insertStmt.run(
              chunk.chunk_id,
              filePath,
              chunk.line_start,
              chunk.line_end,
              chunk.symbols,
              chunk.chunk_index,
              chunk.content,
              new Float32Array(embedding)
            )
          })()
        } catch (e) {
          log.error(`Failed to generate embedding for chunk ${chunk.chunk_id}:`, e)
        }
      }
    } catch (e) {
      log.error(`Failed to index ${filePath}:`, e)
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

      // Background watcher for incremental re-indexing on file changes
      if (this.watcher) await this.watcher.close()
      this.watcher = chokidar.watch(rootPath, {
        ignored: [/(^|[/\\])\../, /node_modules/],
        persistent: true,
        ignoreInitial: true,
      })
      this.watcher.on('change', async (changedPath) => {
        if (['.ts', '.tsx', '.py', '.md', '.json', '.sql'].includes(path.extname(changedPath))) {
          log.info(`[Indexer] Re-indexing modified file: ${changedPath}`)
          await this.indexFile(changedPath)
        }
      })
    } catch (e) {
      log.error('[Indexer] Full index failed:', e)
    } finally {
      this.isIndexing = false
    }
  }

  public async search(query: string, topK = 5): Promise<any[]> {
    const { embedding } = await this.getEmbedding(query)

    // Fetch workspace symbols for the query to boost relevant chunks
    let symbolNames: string[] = []
    try {
      const wsSymbols = await lspManager.sendRequest('workspace/symbol', { query })
      if (Array.isArray(wsSymbols)) {
        symbolNames = wsSymbols.map((s: any) => s.name.toLowerCase())
      }
    } catch {
      // LSP may not be running — non-fatal
    }

    const stmt = stateLedger.db.prepare(`
      SELECT chunk_id, file_path, line_start, line_end, symbols, content, distance
      FROM codebase_vec
      WHERE embedding MATCH ?
      ORDER BY distance
      LIMIT ?
    `)
    // Fetch 2× to allow re-ranking with symbol boost
    const rows = stmt.all(new Float32Array(embedding), topK * 2) as any[]

    const ranked = rows.map((r) => {
      let similarity = 1 - r.distance
      if (r.symbols && symbolNames.length > 0) {
        const chunkSymbols = r.symbols.split(',').map((s: string) => s.trim().toLowerCase())
        if (chunkSymbols.some((cs: string) => symbolNames.includes(cs))) {
          similarity += 0.2
        }
      }
      return {
        chunkId: r.chunk_id, path: r.file_path, lineStart: r.line_start, lineEnd: r.line_end,
        symbols: r.symbols, content: r.content, similarity
      }
    })

    ranked.sort((a, b) => b.similarity - a.similarity)
    return ranked.slice(0, topK)
  }

  private walk(dir: string): string[] {
    let results: string[] = []
    const list = fs.readdirSync(dir)
    list.forEach(file => {
      file = path.join(dir, file)
      const stat = fs.statSync(file)
      if (stat && stat.isDirectory()) results = results.concat(this.walk(file))
      else results.push(file)
    })
    return results
  }
}

export const codebaseIndexer = new CodebaseIndexer()
