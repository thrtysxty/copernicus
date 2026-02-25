import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('ipcRenderer', {
  on(channel: string, listener: (event: Electron.IpcRendererEvent, ...args: unknown[]) => void): () => void {
    if (channel !== 'splash-status') {
      console.warn(`[splash-preload] Blocked channel: ${channel}`)
      return () => { /* no-op */ }
    }
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.off(channel, listener)
  },

  send(channel: string, ...args: unknown[]): void {
    if (channel !== 'splash-ready') {
      console.warn(`[splash-preload] Blocked send on channel: ${channel}`)
      return
    }
    ipcRenderer.send(channel, ...args)
  },

  // Splash does not need invoke or off — provide safe no-ops
  invoke(_channel: string, ..._args: unknown[]): Promise<unknown> {
    return Promise.reject(new Error('invoke not available in splash context'))
  },

  off(_channel: string, ..._args: unknown[]): void {
    // no-op
  },
})
