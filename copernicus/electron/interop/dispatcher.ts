import { ipcMain, BrowserWindow } from 'electron'

/**
 * InteropDispatcher
 * Handles inter-agent communication and task delegation at the electron main process level.
 * This acts as the message bus for the agentic workflow engine.
 */
export class InteropDispatcher {
  constructor() {
    this.setupListeners()
  }

  private setupListeners() {
    // Listen for delegation requests from frontend
    // Channel: 'agent:delegate'
    ipcMain.on('agent:delegate', (_event, { target, task }) => {
      try {
        console.log(`[Interop] DELEGATE -> ${target}: ${task}`)
        this.broadcast('agent:input', { target, content: task })
      } catch (err: unknown) {
        console.error('[dispatcher] Error in agent:delegate:', err)
      }
    })

    // Listen for forwarding requests
    // Channel: 'agent:forward'
    ipcMain.on('agent:forward', (_event, { target, content }) => {
      try {
        console.log(`[Interop] FORWARD -> ${target} (${content.length} chars)`)
        this.broadcast('agent:input', { target, content })
      } catch (err: unknown) {
        console.error('[dispatcher] Error in agent:forward:', err)
      }
    })
    
    // Listen for logging intents
    ipcMain.on('ledger:log-intent', (_event, logEntry) => {
      try {
        console.log(`[Ledger] INTENT: ${JSON.stringify(logEntry)}`)
      } catch (err: unknown) {
        console.error('[dispatcher] Error in ledger:log-intent:', err)
      }
    })
  }

  public broadcast(channel: string, message: any) {
    BrowserWindow.getAllWindows().forEach(win => {
        if (!win.isDestroyed()) {
            win.webContents.send(channel, message)
        }
    })
  }
}

// Singleton instance
export const dispatcher = new InteropDispatcher()
