import { ChildProcess, spawn } from 'node:child_process'
import { EventEmitter } from 'node:events'
import fs from 'node:fs/promises'
import path from 'node:path'
import { BrowserWindow } from 'electron'
import type { DebugProtocol } from '@vscode/debugprotocol'
import { fsManager } from '../fs-manager'
import { NodeCdpShim } from './NodeCdpShim'

interface LaunchConfig {
  type: 'node' | 'python'
  program?: string
  module?: string
  args?: string[]
  cwd?: string
}

export class DapClient extends EventEmitter {
  private adapterProcess: ChildProcess | null = null
  private seq = 1
  private pendingRequests = new Map<number, { resolve: (val: any) => void; reject: (err: Error) => void }>()
  private rawData = Buffer.alloc(0)
  private cdpShim: NodeCdpShim | null = null

  // Track state
  public breakpoints: Record<string, DebugProtocol.SourceBreakpoint[]> = {}
  public isAttached = false

  constructor() {
    super()
  }

  async readLaunchConfig(): Promise<LaunchConfig | null> {
    const rootPath = fsManager.getRootPath()
    if (!rootPath) return null

    try {
      const configPath = path.join(rootPath, '.copernicus', 'launch.json')
      const data = await fs.readFile(configPath, 'utf-8')
      const config = JSON.parse(data)
      // Return first config for simplicity
      if (config.configurations && config.configurations.length > 0) {
        return config.configurations[0] as LaunchConfig
      }
      return null
    } catch {
      return null
    }
  }

  async launch(config?: LaunchConfig): Promise<void> {
    const rootPath = fsManager.getRootPath()
    if (!rootPath) throw new Error('No workspace open')

    if (!config) {
      config = await this.readLaunchConfig() || {
        type: 'node',
        program: path.join(rootPath, 'index.js')
      }
    }

    if (config.type === 'node') {
      this.adapterProcess = spawn('node', ['--inspect-brk=9229', config.program!], {
        cwd: config.cwd || rootPath
      })

      this.cdpShim = new NodeCdpShim()
      this.adapterProcess.stdout?.resume() // AC2: Consume stdout to prevent pipe buffer from filling
      this.cdpShim.on('event', (e) => this.emitEvent(e.event, e.body))
      this.cdpShim.on('initialized', () => this.emitEvent('initialized', {}))
      this.cdpShim.on('terminated', () => {
        this.isAttached = false
        this.emitEvent('terminated', {})
      })

      // We need to wait for debugger output to get the ws url, or just connect to localhost:9229
      // For simplicity we try to connect after a small delay
      let wsUrl: string | undefined
      for (let attempt = 0; attempt < 10; attempt++) {
        await new Promise(r => setTimeout(r, 200))
        try {
          const res = await fetch('http://localhost:9229/json/list')
          const list = await res.json() as Array<{ webSocketDebuggerUrl?: string }>
          wsUrl = list[0]?.webSocketDebuggerUrl
          if (wsUrl) break
        } catch {
          // inspector not ready yet
        }
      }
      if (!wsUrl) {
        console.error('[DAP] Failed to connect to node debugger after 10 attempts')
        throw new Error('Failed to connect to node debugger')
      }
      this.cdpShim.attach(wsUrl)
      this.isAttached = true
      return

    } else if (config.type === 'python') {
      // Use debugpy
      this.adapterProcess = spawn('python', ['-m', 'debugpy.adapter'], {
        stdio: ['pipe', 'pipe', 'pipe']
      })
    } else {
      throw new Error(`Unsupported debug type: ${config.type}`)
    }

    if (!this.adapterProcess) throw new Error('Failed to start debug adapter')

    if (config.type === 'python') {
      this.adapterProcess.stdout?.on('data', this.handleData.bind(this))
    }
    this.adapterProcess.stderr?.on('data', (err) => {
      console.error('[DAP Error]', err.toString())
    })

    this.adapterProcess.on('exit', () => {
      this.isAttached = false
      this.emitEvent('terminated', {})
    })

    this.isAttached = true

    // Initialize DAP
    await this.sendRequest('initialize', {
      clientID: 'copernicus',
      clientName: 'Copernicus IDE',
      adapterID: config.type,
      pathFormat: 'path',
      linesStartAt1: true,
      columnsStartAt1: true,
      supportsVariableType: true,
      supportsVariablePaging: false,
      supportsRunInTerminalRequest: false,
    })

    // Launch
    await this.sendRequest('launch', {
      ...config,
      cwd: config.cwd || rootPath
    })

    // Set pending breakpoints
    for (const [file, bps] of Object.entries(this.breakpoints)) {
      await this.setBreakpoints(file, bps)
    }

    // Configuration done
    await this.sendRequest('configurationDone', {})
  }

  async stop(): Promise<void> {
    if (!this.isAttached) return
    try {
      if (this.cdpShim) {
        await this.cdpShim.handleDapRequest({ command: 'disconnect', type: 'request', seq: 0, arguments: {} })
      } else {
        await this.sendRequest('disconnect', { terminateDebuggee: true })
      }
    } catch {
      // ignore
    }
    // AC1: Clear pending requests
    for (const [, { reject }] of this.pendingRequests) {
      reject(new Error('Debug session stopped'))
    }
    this.pendingRequests.clear()
    this.adapterProcess?.kill()
    this.cdpShim = null
    this.isAttached = false
  }

  async pause(): Promise<void> {
    // Requires threadId, for now we assume thread 1
    await this.sendRequest('pause', { threadId: 1 })
  }

  async resume(): Promise<void> {
    await this.sendRequest('continue', { threadId: 1 })
  }

  async stepOver(): Promise<void> {
    await this.sendRequest('next', { threadId: 1 })
  }

  async stepInto(): Promise<void> {
    await this.sendRequest('stepIn', { threadId: 1 })
  }

  async stepOut(): Promise<void> {
    await this.sendRequest('stepOut', { threadId: 1 })
  }

  async setBreakpoints(sourcePath: string, breakpoints: DebugProtocol.SourceBreakpoint[]): Promise<DebugProtocol.SetBreakpointsResponse['body'] | undefined> {
    this.breakpoints[sourcePath] = breakpoints
    if (!this.isAttached) {
      return { breakpoints: breakpoints.map(b => ({ verified: false, line: b.line })) }
    }

    const response = await this.sendRequest('setBreakpoints', {
      source: { path: sourcePath },
      breakpoints,
    })
    return response as DebugProtocol.SetBreakpointsResponse['body']
  }

  async getCallStack(threadId: number = 1): Promise<DebugProtocol.StackTraceResponse['body'] | undefined> {
    if (!this.isAttached) return { stackFrames: [], totalFrames: 0 }
    const response = await this.sendRequest('stackTrace', { threadId })
    return response as DebugProtocol.StackTraceResponse['body']
  }

  async getScopes(frameId: number): Promise<DebugProtocol.ScopesResponse['body'] | undefined> {
    if (!this.isAttached) return { scopes: [] }
    const response = await this.sendRequest('scopes', { frameId })
    return response as DebugProtocol.ScopesResponse['body']
  }

  async getVariables(variablesReference: number): Promise<DebugProtocol.VariablesResponse['body'] | undefined> {
    if (!this.isAttached) return { variables: [] }
    const response = await this.sendRequest('variables', { variablesReference })
    return response as DebugProtocol.VariablesResponse['body']
  }

  async evaluate(expression: string, frameId?: number, context: 'watch' | 'repl' | 'hover' = 'repl'): Promise<DebugProtocol.EvaluateResponse['body'] | undefined> {
    if (!this.isAttached) throw new Error('Not attached')
    const response = await this.sendRequest('evaluate', { expression, frameId, context })
    return response as DebugProtocol.EvaluateResponse['body']
  }

  // --- Internals ---

  private handleData(data: Buffer) {
    this.rawData = Buffer.concat([this.rawData, data])
    if (this.rawData.length > 10 * 1024 * 1024) {
      console.warn('[DAP] rawData exceeded 10 MB — resetting buffer')
      this.rawData = Buffer.alloc(0)
      return
    }

    while (true) {
      const match = this.rawData.toString('utf-8').match(/Content-Length: (\d+)\r\n\r\n/)
      if (!match || !match[1]) break

      const contentLength = parseInt(match[1], 10)
      const headerLength = Buffer.byteLength(match[0], 'utf-8')
      const totalLength = headerLength + contentLength

      if (this.rawData.length < totalLength) break

      const payload = this.rawData.subarray(headerLength, totalLength)
      this.rawData = this.rawData.subarray(totalLength)

      try {
        const message = JSON.parse(payload.toString('utf-8'))
        this.handleMessage(message)
      } catch (err) {
        console.error('[DAP] Failed to parse message:', err)
      }
    }
  }

  private handleMessage(message: DebugProtocol.ProtocolMessage) {
    if (message.type === 'response') {
      const response = message as DebugProtocol.Response
      const pending = this.pendingRequests.get(response.request_seq)
      if (pending) {
        this.pendingRequests.delete(response.request_seq)
        if (response.success) {
          pending.resolve(response.body)
        } else {
          pending.reject(new Error(response.message || 'DAP request failed'))
        }
      }
    } else if (message.type === 'event') {
      const event = message as DebugProtocol.Event
      this.emitEvent(event.event, event.body || {})
    }
  }

  private emitEvent(event: string, body: any) {
    this.emit('event', { event, body })

    // Broadcast to renderer
    const windows = BrowserWindow.getAllWindows()
    if (windows.length > 0 && windows[0]) {
      windows[0].webContents.send('debug:event', { event, body })
    }
  }

  private sendRequest(command: string, args: any): Promise<any> {
    if (this.cdpShim) {
      return this.cdpShim.handleDapRequest({ command, type: 'request', seq: this.seq++, arguments: args })
    }

    return new Promise((resolve, reject) => {
      const seq = this.seq++
      this.pendingRequests.set(seq, { resolve, reject })

      const request: DebugProtocol.Request = {
        seq,
        type: 'request',
        command,
        arguments: args,
      }

      const json = JSON.stringify(request)
      const payload = `Content-Length: ${Buffer.byteLength(json, 'utf-8')}\r\n\r\n${json}`

      if (!this.adapterProcess?.stdin) {
        reject(new Error('Adapter process not running'))
        return
      }

      this.adapterProcess!.stdin!.write(payload)
    })
  }
}

export const dapClient = new DapClient()
