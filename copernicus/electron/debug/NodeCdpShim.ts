import WebSocket from 'ws'
import { EventEmitter } from 'node:events'
import type { DebugProtocol } from '@vscode/debugprotocol'

export class NodeCdpShim extends EventEmitter {
  private ws: WebSocket | null = null
  private nextId = 1
  private pending = new Map<number, { resolve: (val: any) => void, reject: (err: any) => void }>()

  // Mapping from CDP scriptId to file path
  private scripts = new Map<string, string>()

  public attach(wsUrl: string) {
    this.ws = new WebSocket(wsUrl)

    this.ws.on('open', async () => {
      // Enable debugger
      await this.sendCdp('Debugger.enable', {})
      await this.sendCdp('Runtime.enable', {})

      // Start
      await this.sendCdp('Runtime.runIfWaitingForDebugger', {})

      this.emit('initialized')
    })

    this.ws.on('message', (data) => {
      const msg = JSON.parse(data.toString())
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id)!
        this.pending.delete(msg.id)
        if (msg.error) reject(msg.error)
        else resolve(msg.result)
      } else if (msg.method) {
        this.handleCdpEvent(msg.method, msg.params)
      }
    })

    this.ws.on('close', () => {
      this.emit('terminated')
    })
  }

  public async handleDapRequest(request: DebugProtocol.Request): Promise<any> {
    switch (request.command) {
      case 'setBreakpoints': {
        const args = request.arguments as DebugProtocol.SetBreakpointsArguments
        const url = 'file://' + args.source.path

        // Remove old breakpoints? We should ideally, but for MVP let's just set them.
        const bps = await Promise.all((args.breakpoints || []).map(async b => {
          try {
            await this.sendCdp('Debugger.setBreakpointByUrl', {
              lineNumber: b.line - 1, // CDP is 0-indexed
              urlRegex: url.replace(/\\/g, '/').replace(/\./g, '\\.'),
            })
            return { verified: true, line: b.line }
          } catch (e) {
            return { verified: false, line: b.line }
          }
        }))
        return { breakpoints: bps }
      }
      case 'pause':
        await this.sendCdp('Debugger.pause', {})
        return {}
      case 'continue':
        await this.sendCdp('Debugger.resume', {})
        return {}
      case 'next':
        await this.sendCdp('Debugger.stepOver', {})
        return {}
      case 'stepIn':
        await this.sendCdp('Debugger.stepInto', {})
        return {}
      case 'stepOut':
        await this.sendCdp('Debugger.stepOut', {})
        return {}
      case 'stackTrace': {
        // We only return stack trace when paused, but DAP asks for it.
        // For CDP, stackTrace is provided in the Debugger.paused event. We need to cache it.
        // For simplicity we will return empty if not cached.
        // We'll pass it when stopped.
        return { stackFrames: this.lastStackFrames || [], totalFrames: this.lastStackFrames?.length || 0 }
      }
      case 'disconnect':
        this.ws?.close()
        return {}
      default:
        console.warn(`[NodeCdpShim] Unhandled DAP request: ${request.command}`)
        return {}
    }
  }

  private lastStackFrames: any[] = []

  private handleCdpEvent(method: string, params: any) {
    if (method === 'Debugger.scriptParsed') {
      this.scripts.set(params.scriptId, params.url.replace('file://', ''))
    } else if (method === 'Debugger.paused') {
      this.lastStackFrames = params.callFrames.map((f: any, i: number) => ({
        id: i,
        name: f.functionName || '(anonymous)',
        source: { path: this.scripts.get(f.location.scriptId) || f.url },
        line: f.location.lineNumber + 1,
        column: f.location.columnNumber + 1
      }))

      this.emit('event', { event: 'stopped', body: { reason: params.reason, threadId: 1 } })
    } else if (method === 'Debugger.resumed') {
      this.emit('event', { event: 'continued', body: { threadId: 1 } })
    }
  }

  private sendCdp(method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = this.nextId++
      this.pending.set(id, { resolve, reject })
      this.ws?.send(JSON.stringify({ id, method, params }))
    })
  }
}
