import { ChildProcess, spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import { app, BrowserWindow } from 'electron'

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

export class LspManager {
  private proc: ChildProcess | null = null
  private nextId = 1
  private pending = new Map<number, PendingRequest>()
  private buf = ''
  private win: BrowserWindow | null = null

  setWindow(win: BrowserWindow) {
    this.win = win
  }

  start(rootPath: string) {
    if (this.proc) return
    let script: string
    try {
      script = getLspScriptPath()
    } catch (err) {
      console.warn('[LSP] typescript-language-server not found — LSP features unavailable:', err)
      return
    }
    this.proc = spawn(process.execPath, [script, '--stdio'], {
      cwd: rootPath,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    })
    this.proc.stdout!.on('data', (chunk: Buffer) => this.onData(chunk.toString()))
    this.proc.stderr!.on('data', (d: Buffer) => console.warn('[LSP stderr]', d.toString().trim()))
    this.proc.on('exit', (code) => {
      console.log(`[LSP] Server exited (code ${code})`)
      this.proc = null
      this.pending.forEach(p => p.reject(new Error('LSP process exited')))
      this.pending.clear()
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
        workspace: { symbol: {} },
      },
      initializationOptions: {},
    }).then(() => {
      this.sendNotify('initialized', {})
      console.log('[LSP] Server ready')
    }).catch(console.error)
  }

  stop() {
    if (!this.proc) return
    this.sendRequest('shutdown', {})
      .then(() => this.sendNotify('exit', {}))
      .catch(() => {})
    setTimeout(() => { this.proc?.kill(); this.proc = null }, 2000)
  }

  getStatus(): { running: boolean; pid: number | null } {
    return { running: !!this.proc, pid: this.proc?.pid ?? null }
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
      if (!lenMatch) { this.buf = this.buf.slice(headerEnd + 4); continue }
      const len = parseInt(lenMatch[1], 10)
      const bodyStart = headerEnd + 4
      if (this.buf.length < bodyStart + len) break
      const body = this.buf.slice(bodyStart, bodyStart + len)
      this.buf = this.buf.slice(bodyStart + len)
      try { this.dispatch(JSON.parse(body)) } catch { /* ignore malformed */ }
    }
  }

  private dispatch(msg: any) {
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
      this.win.webContents.send('lsp:diagnostics', msg.params)
    }
  }
}

export const lspManager = new LspManager()
