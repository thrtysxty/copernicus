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
    ipcMain.on('agent:delegate', (event, { target, task }) => {
      console.log(`[Interop] DELEGATE -> ${target}: ${task}`)
      
      // Echo back to the renderer as "input" for the target agent
      event.sender.send('agent:input', { target, content: task })
    })

    // Listen for forwarding requests
    // Channel: 'agent:forward'
    ipcMain.on('agent:forward', (event, { target, content }) => {
      console.log(`[Interop] FORWARD -> ${target} (${content.length} chars)`)
      
      // Echo back as input
      event.sender.send('agent:input', { target, content })
    })
    
    // Listen for logging intents
    ipcMain.on('ledger:log-intent', (_event, logEntry) => {
        console.log(`[Ledger] INTENT: ${JSON.stringify(logEntry)}`)
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
