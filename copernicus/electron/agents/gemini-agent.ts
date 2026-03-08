import * as pty from 'node-pty'
import { EventEmitter } from 'events'
import * as os from 'os'
import * as path from 'path'
import * as fs from 'fs'
import { execFile } from 'child_process'
import { promisify } from 'util'
import log from '../utils/logger'

const execFileAsync = promisify(execFile)

export interface GeminiAgentOptions {
  cwd: string
  cols?: number
  rows?: number
  onOutput?: (chunk: string) => void
}

export class GeminiAgent extends EventEmitter {
  private ptyProcess: pty.IPty | null = null
  private buffer: string = ''
  private pendingResolver: ((_text: string) => void) | null = null
  private pendingRejecter: ((err: Error) => void) | null = null
  // Gemini CLI ready prompt — matches '> ' or '❯ ' on its own line
  private readonly PROMPT_RE = /(?:^|\n)[>❯]\s*$/
  private readonly TIMEOUT_MS = 180_000
  private timeoutHandle: NodeJS.Timeout | null = null
  readonly sessionId: string

  constructor(private opts: GeminiAgentOptions) {
    super()
    this.sessionId = `gemini-${Date.now()}`
  }

  /** Spawns the Gemini CLI process and waits for the initial prompt */
  async spawn(): Promise<void> {
    const credsPath = path.join(os.homedir(), '.gemini', 'oauth_creds.json')
    if (!fs.existsSync(credsPath)) {
      throw new Error(
        'Gemini credentials not found at ~/.gemini/oauth_creds.json. ' +
        'Sign in via Settings → Providers → Google.'
      )
    }

    const geminiCmd = await this.findGeminiCli()
    log.info(`[GeminiAgent] Spawning: ${geminiCmd} in ${this.opts.cwd}`)

    this.ptyProcess = pty.spawn(geminiCmd, [], {
      name: 'xterm-256color',
      cols: this.opts.cols ?? 120,
      rows: this.opts.rows ?? 50,
      cwd: this.opts.cwd,
      env: {
        ...process.env,
        HOME: os.homedir(),
        TERM: 'xterm-256color',
      } as Record<string, string>,
    })

    this.ptyProcess.onData((data) => this.handleData(data))
    this.ptyProcess.onExit(({ exitCode }) => {
      log.info(`[GeminiAgent] Process exited with code ${exitCode}`)
      this.emit('exit', exitCode)
      this.cleanup()
    })

    await this.waitForPrompt(30_000)
    log.info(`[GeminiAgent] ${this.sessionId} ready`)
  }

  /** Sends a prompt and resolves with the full response text when done */
  async sendPrompt(_text: string): Promise<string> {
    if (!this.ptyProcess) throw new Error('GeminiAgent not spawned')
    if (this.pendingResolver) throw new Error('Already waiting for a response')

    return new Promise((resolve, reject) => {
      this.pendingResolver = resolve
      this.pendingRejecter = reject
      this.buffer = ''

      this.timeoutHandle = setTimeout(() => {
        this.pendingResolver = null
        this.pendingRejecter = null
        reject(new Error(`Gemini response timed out after ${this.TIMEOUT_MS / 1000}s`))
      }, this.TIMEOUT_MS)

      this.ptyProcess!.write(_text + '\r')
    })
  }

  /** Closes the PTY and cleans up */
  close(): void {
    this.cleanup()
  }

  /** Returns true if the Gemini CLI is installed and credentials exist */
  static async isAvailable(): Promise<{ ok: boolean; reason?: string }> {
    const credsPath = path.join(os.homedir(), '.gemini', 'oauth_creds.json')
    if (!fs.existsSync(credsPath)) {
      return { ok: false, reason: 'Not signed in to Google. Use Settings → Providers.' }
    }
    try {
      await GeminiAgent.findGeminiCliStatic()
      return { ok: true }
    } catch {
      return { ok: false, reason: 'gemini CLI not installed. Run: npm install -g @google/gemini-cli' }
    }
  }

  private handleData(data: string): void {
    this.opts.onOutput?.(data)
    this.emit('output', data)

    if (this.pendingResolver) {
      this.buffer += data
      const clean = stripAnsi(this.buffer)

      if (this.PROMPT_RE.test(clean)) {
        const response = this.extractResponse(clean)
        clearTimeout(this.timeoutHandle!)
        const resolver = this.pendingResolver
        this.pendingResolver = null
        this.pendingRejecter = null
        this.buffer = ''
        resolver?.(response)
      }
    }
  }

  private extractResponse(cleanBuffer: string): string {
    // Buffer: [echoed input line]\n[response lines]\n[prompt line]
    const lines = cleanBuffer.split('\n')
    // Find last line matching the prompt pattern
    let promptIdx = -1
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i]
      if (line && /^[>❯]\s*$/.test(line.trim())) { promptIdx = i; break }
    }
    const responseLines = lines.slice(1, promptIdx > 0 ? promptIdx : undefined)
    return responseLines.join('\n').trim()
  }

  private waitForPrompt(timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Gemini CLI did not show prompt within ${timeoutMs / 1000}s`))
      }, timeoutMs)

      let done = false
      const disposable = this.ptyProcess!.onData((data: string) => {
        if (done) return
        this.buffer += data
        if (this.PROMPT_RE.test(stripAnsi(this.buffer))) {
          done = true
          clearTimeout(timer)
          this.buffer = ''
          disposable.dispose()
          resolve()
        }
      })
    })
  }

  private cleanup(): void {
    if (this.timeoutHandle) clearTimeout(this.timeoutHandle)
    if (this.pendingRejecter) {
      this.pendingRejecter(new Error('GeminiAgent session closed'))
      this.pendingResolver = null
      this.pendingRejecter = null
    }
    try { this.ptyProcess?.kill() } catch { /* already dead */ }
    this.ptyProcess = null
  }

  private async findGeminiCli(): Promise<string> {
    return GeminiAgent.findGeminiCliStatic()
  }

  private static async findGeminiCliStatic(): Promise<string> {
    for (const cmd of ['gemini', '/opt/homebrew/bin/gemini', '/usr/local/bin/gemini']) {
      try {
        await execFileAsync('which', [cmd.split('/').pop()!])
        return cmd
      } catch { /* try next */ }
    }
    // Try direct paths
    for (const p of ['/opt/homebrew/bin/gemini', '/usr/local/bin/gemini']) {
      if (fs.existsSync(p)) return p
    }
    throw new Error('gemini CLI not found in PATH')
  }
}

function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*[mGKHFJA-Za-z]/g, '').replace(/\x1b\].*?\x07/g, '')
}
