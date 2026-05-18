import { ChildProcess, spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import { app, BrowserWindow } from 'electron'
import log from 'electron-log'

interface PendingRequest {
  resolve: (result: any) => void
  reject: (err: Error) => void
  timer: ReturnType<typeof setTimeout>
}

function getLspScriptPath(): string {
  const base = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'typescript-language-server')
    : path.join(app.getAppPath(), 'node_modules', 'typescript-language-server')

  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(base, 'package.json'), 'utf-8'))
    const binEntry: string | undefined = typeof pkg.bin === 'string'
      ? pkg.bin
      : pkg.bin?.['typescript-language-server']
    if (binEntry) return path.join(base, binEntry)
  } catch {
    // fallthrough to default
  }
  // Common locations for v4+
  const candidates = ['lib/cli.mjs', 'lib/cli.js']
  for (const c of candidates) {
    const p = path.join(base, c)
    if (fs.existsSync(p)) return p
  }
  throw new Error(`[LSP] Cannot locate typescript-language-server entry in ${base}`)
}

export type LspProcessStatus = 'running' | 'restarting' | 'dead' | 'stopped'

export class LspManager {
  private static readonly MAX_DIAGNOSTICS = 500
  private static readonly MAX_FILE_VERSIONS = 1000

  private proc: ChildProcess | null = null
  private nextId = 1
  private pending = new Map<number, PendingRequest>()
  private buf = ''
  private win: BrowserWindow | null = null
  private fileVersions = new Map<string, number>()
  public diagnosticsCache = new Map<string, any[]>()

  private status: LspProcessStatus = 'stopped'
  private rootPath: string | null = null
  private healthPollTimer: ReturnType<typeof setInterval> | null = null
  private restartAttempt = 0
  private expectedExit = false

  setWindow(win: BrowserWindow) {
    this.win = win
  }

  private setStatus(newStatus: LspProcessStatus, metadata?: any) {
    this.status = newStatus
    if (this.win && !this.win.isDestroyed()) {
      this.win.webContents.send('lsp:status-changed', { status: newStatus, ...metadata })
    }
  }

  start(rootPath: string) {
    this.rootPath = rootPath
    this.expectedExit = false

    if (this.proc) return
    let script: string
    try {
      script = getLspScriptPath()
    } catch (err) {
      log.warn('[LSP] typescript-language-server not found — LSP features unavailable:', err)
      return
    }

    if (!this.healthPollTimer) {
      this.healthPollTimer = setInterval(() => this.checkHealth(), 15000)
    }
    this.proc = spawn(process.execPath, [script, '--stdio'], {
      cwd: rootPath,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    })
    this.proc.stdout!.on('data', (chunk: Buffer) => this.onData(chunk.toString()))
    this.proc.stderr!.on('data', (d: Buffer) => log.warn('[LSP stderr]', d.toString().trim()))
    this.proc.on('exit', (code) => {
      log.info(`[LSP] Server exited (code ${code})`)
      this.proc = null
      this.pending.forEach(p => p.reject(new Error('LSP process exited')))
      this.pending.clear()

      if (!this.expectedExit) {
        // Unexpected exit before the poll loop caught it
        // Check health immediately to trigger recovery
        this.checkHealth()
      }
    })

    this.sendRequest('initialize', {
      processId: process.pid,
      rootUri: `file://${rootPath}`,
      capabilities: {
        textDocument: {
          completion: { completionItem: { snippetSupport: false } },
          hover: { contentFormat: ['plaintext', 'markdown'] },
          definition: {},
          publishDiagnostics: { relatedInformation: false },
        },
        workspace: { symbol: {}, applyEdit: { supported: true } },
      },
      initializationOptions: {},
    }).then(() => {
      this.sendNotify('initialized', {})
      log.info('[LSP] Server ready')
      this.restartAttempt = 0
      this.setStatus('running')
    }).catch(err => log.error(err))
  }

  private checkHealth() {
    if (this.expectedExit) return

    // Determine if process is dead
    // We check this.proc AND this.proc.killed/exitCode
    const isDead = !this.proc || this.proc.killed || this.proc.exitCode !== null

    if (isDead) {
      log.warn(`[LSP] Server process death detected by health check. Restart attempt ${this.restartAttempt + 1}/3`)

      if (this.restartAttempt < 3) {
        this.restartAttempt++
        this.setStatus('restarting', { attempt: this.restartAttempt })

        // Ensure process is fully cleaned up before restart
        if (this.proc) {
          try {
            this.proc.kill()
          } catch { /* ignore */ }
          this.proc = null
        }

        setTimeout(() => {
          if (!this.expectedExit && this.rootPath) {
            this.start(this.rootPath)
          }
        }, 5000)
      } else {
        log.error('[LSP] Server failed to restart after 3 attempts. Marking as dead.')
        this.setStatus('dead', { reason: 'Max retries reached' })
        if (this.healthPollTimer) {
          clearInterval(this.healthPollTimer)
          this.healthPollTimer = null
        }
      }
    }
  }

  openFile(filePath: string, content: string) {
    if (!this.proc) return
    const uri = `file://${filePath}`
    const ver = (this.fileVersions.get(uri) ?? 0) + 1
    this.fileVersions.set(uri, ver)
    if (this.fileVersions.size > LspManager.MAX_FILE_VERSIONS) {
      const firstKey = this.fileVersions.keys().next().value
      if (firstKey !== undefined) this.fileVersions.delete(firstKey)
    }
    if (ver === 1) {
      this.sendNotify('textDocument/didOpen', {
        textDocument: { uri, languageId: 'typescript', version: ver, text: content },
      })
    } else {
      this.sendNotify('textDocument/didChange', {
        textDocument: { uri, version: ver },
        contentChanges: [{ text: content }],
      })
    }
  }

  closeFile(filePath: string) {
    if (!this.proc) return
    const uri = `file://${filePath}`
    this.fileVersions.delete(uri)
    this.diagnosticsCache.delete(uri)
    this.sendNotify('textDocument/didClose', { textDocument: { uri } })
  }

  getDiagnostics(filePath: string): any[] {
    const uri = `file://${filePath}`
    return this.diagnosticsCache.get(uri) ?? []
  }

  watchMemoryDir(exportDir: string) {
    if (!this.proc) return
    this.sendNotify('workspace/didChangeWatchedFiles', {
      changes: [{
        uri: `file://${exportDir}/*.jsonl`,
        type: 1 // Created
      }]
    })
  }

  stop() {
    this.expectedExit = true
    this.status = 'stopped'
    this.restartAttempt = 0

    if (this.healthPollTimer) {
      clearInterval(this.healthPollTimer)
      this.healthPollTimer = null
    }

    if (!this.proc) return
    this.sendRequest('shutdown', {})
      .then(() => this.sendNotify('exit', {}))
      .catch(err => log.error(err))
    setTimeout(() => { this.proc?.kill(); this.proc = null }, 2000)
  }

  getStatus(): { running: boolean; status: LspProcessStatus; pid: number | null } {
    return {
      running: !!this.proc,
      status: this.status,
      pid: this.proc?.pid ?? null
    }
  }

  async workspaceCheck(): Promise<{ errorCount: number; diagnostics: any[] }> {
    if (!this.proc) throw new Error('LSP not running');
    // For workspace diagnostics, we may need to pull from cache or wait if it's not supported by TS server in this way
    // For now we will return aggregated diagnostics from the cache or request them if needed
    let errorCount = 0;
    const allDiagnostics: any[] = [];

    // In a real implementation this might send a 'workspace/diagnostic' request if supported
    // For now, we'll aggregate what's in the cache
    for (const [uri, diags] of this.diagnosticsCache.entries()) {
      for (const diag of diags) {
        if (diag.severity === 1) { // 1 = Error in LSP spec
          errorCount++;
        }
        allDiagnostics.push({ uri, ...diag });
      }
    }

    return { errorCount, diagnostics: allDiagnostics };
  }

  sendRequest(method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.proc) return reject(new Error('LSP not running'))
      const id = this.nextId++
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error('LSP_TIMEOUT'))
      }, 10000)
      this.pending.set(id, { resolve, reject, timer })
      this.write({ jsonrpc: '2.0', id, method, params })
    })
  }

  sendNotify(method: string, params: any) {
    if (!this.proc) return
    this.write({ jsonrpc: '2.0', method, params })
  }

  private write(msg: object) {
    const body = JSON.stringify(msg)
    this.proc!.stdin!.write(`Content-Length: ${Buffer.byteLength(body, 'utf-8')}\r\n\r\n${body}`)
  }

  private onData(chunk: string) {
    this.buf += chunk
    while (true) {
      const headerEnd = this.buf.indexOf('\r\n\r\n')
      if (headerEnd === -1) break
      const header = this.buf.slice(0, headerEnd)
      const lenMatch = header.match(/Content-Length:\s*(\d+)/i)
      if (!lenMatch || !lenMatch[1]) { this.buf = this.buf.slice(headerEnd + 4); continue }
      const len = parseInt(lenMatch[1], 10)
      const bodyStart = headerEnd + 4
      if (this.buf.length < bodyStart + len) break
      const body = this.buf.slice(bodyStart, bodyStart + len)
      this.buf = this.buf.slice(bodyStart + len)
      try { this.dispatch(JSON.parse(body)) } catch { /* ignore malformed */ }
    }
  }

  public async applyWorkspaceEdit(edit: any): Promise<{ applied: boolean; failureReason?: string; filesChanged: string[] }> {
    const filesChanged: Set<string> = new Set()

    try {
      if (edit.documentChanges) {
        for (const docEdit of edit.documentChanges) {
          if (!docEdit.textDocument?.uri || !docEdit.edits) continue

          const uri = docEdit.textDocument.uri
          const filePath = uri.startsWith('file://') ? uri.slice(7) : uri
          if (!fs.existsSync(filePath)) continue

          let content = fs.readFileSync(filePath, 'utf-8')
          const edits = [...docEdit.edits].sort((a, b) => {
            if (a.range.start.line !== b.range.start.line) return b.range.start.line - a.range.start.line
            return b.range.start.character - a.range.start.character
          })

          for (const textEdit of edits) {
            const lines = content.split('\n')
            let startOffset = 0
            for (let i = 0; i < textEdit.range.start.line; i++) {
              startOffset += (lines[i]?.length ?? 0) + 1
            }
            startOffset += textEdit.range.start.character

            let endOffset = 0
            for (let i = 0; i < textEdit.range.end.line; i++) {
              endOffset += (lines[i]?.length ?? 0) + 1
            }
            endOffset += textEdit.range.end.character

            content = content.slice(0, startOffset) + textEdit.newText + content.slice(endOffset)
          }

          fs.writeFileSync(filePath, content, 'utf-8')
          log.info(`[LSP] Applied document edit to ${filePath}`)
          filesChanged.add(filePath)

          // Let LSP server know about the change if file is open
          if (this.fileVersions.has(uri)) {
             const ver = (this.fileVersions.get(uri) ?? 0) + 1
             this.fileVersions.set(uri, ver)
             this.sendNotify('textDocument/didChange', {
               textDocument: { uri, version: ver },
               contentChanges: [{ text: content }],
             })
          }
        }
      } else if (edit.changes) {
        for (const [uri, textEdits] of Object.entries<any[]>(edit.changes)) {
          const filePath = uri.startsWith('file://') ? uri.slice(7) : uri
          if (!fs.existsSync(filePath)) continue

          let content = fs.readFileSync(filePath, 'utf-8')
          const edits = [...textEdits].sort((a, b) => {
            if (a.range.start.line !== b.range.start.line) return b.range.start.line - a.range.start.line
            return b.range.start.character - a.range.start.character
          })

          for (const textEdit of edits) {
            const lines = content.split('\n')
            let startOffset = 0
            for (let i = 0; i < textEdit.range.start.line; i++) {
              startOffset += (lines[i]?.length ?? 0) + 1
            }
            startOffset += textEdit.range.start.character

            let endOffset = 0
            for (let i = 0; i < textEdit.range.end.line; i++) {
              endOffset += (lines[i]?.length ?? 0) + 1
            }
            endOffset += textEdit.range.end.character

            content = content.slice(0, startOffset) + textEdit.newText + content.slice(endOffset)
          }

          fs.writeFileSync(filePath, content, 'utf-8')
          log.info(`[LSP] Applied edit to ${filePath}`)
          filesChanged.add(filePath)

          // Let LSP server know about the change if file is open
          if (this.fileVersions.has(uri)) {
             const ver = (this.fileVersions.get(uri) ?? 0) + 1
             this.fileVersions.set(uri, ver)
             this.sendNotify('textDocument/didChange', {
               textDocument: { uri, version: ver },
               contentChanges: [{ text: content }],
             })
          }
        }
      }

      return { applied: true, filesChanged: Array.from(filesChanged) }
    } catch (err: any) {
      log.error('[LSP] Failed to apply workspace edit:', err)
      return { applied: false, failureReason: err.message, filesChanged: Array.from(filesChanged) }
    }
  }

  private dispatch(msg: any) {
    if (msg.method === 'workspace/applyEdit') {
      const edit = msg.params.edit
      this.applyWorkspaceEdit(edit).then(result => {
         if (msg.id != null) {
            this.write({
               jsonrpc: '2.0',
               id: msg.id,
               result: { applied: result.applied, failureReason: result.failureReason }
            })
         }
      })
      return
    }
    // Response to a pending request
    if (msg.id != null && this.pending.has(msg.id)) {
      const p = this.pending.get(msg.id)!
      clearTimeout(p.timer)
      this.pending.delete(msg.id)
      if (msg.error) p.reject(new Error(msg.error.message ?? 'LSP error'))
      else p.resolve(msg.result)
      return
    }
    // Server-initiated notification
    if (msg.method === 'textDocument/publishDiagnostics' && this.win && !this.win.isDestroyed()) {
      const uri = msg.params.uri
      const diagnostics = msg.params.diagnostics
      this.diagnosticsCache.set(uri, diagnostics)
      if (this.diagnosticsCache.size > LspManager.MAX_DIAGNOSTICS) {
        const firstKey = this.diagnosticsCache.keys().next().value
        if (firstKey !== undefined) this.diagnosticsCache.delete(firstKey)
      }
      
      let errorCount = 0
      for (const diags of this.diagnosticsCache.values()) {
        errorCount += diags.filter(d => d.severity === 1).length
      }
      
      this.win.webContents.send('lsp:diagnostics-update', { uri, diagnostics, errorCount })
    }
  }
}

export const lspManager = new LspManager()
