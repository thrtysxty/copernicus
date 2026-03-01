import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('ipcRenderer', {
  send: (channel: string, data: any) => ipcRenderer.send(channel, data),
  on: (channel: string, func: (...args: any[]) => void) => {
    const subscription = (_event: any, ...args: any[]) => func(...args);
    ipcRenderer.on(channel, subscription);
    return () => ipcRenderer.removeListener(channel, subscription);
  },
  off: (channel: string, func: (...args: any[]) => void) => {
    ipcRenderer.removeListener(channel, func);
  },
  invoke: (channel: string, data: any) => ipcRenderer.invoke(channel, data),
});

contextBridge.exposeInMainWorld('electronAPI', {
  createTerminal: (id: string, cols: number, rows: number, cwd?: string) =>
    ipcRenderer.send('terminal-create', { id, cols, rows, cwd }),
  resizeTerminal: (id: string, cols: number, rows: number) =>
    ipcRenderer.send('terminal-resize', { id, cols, rows }),
  writeTerminal: (id: string, data: string) =>
    ipcRenderer.send('terminal-write', { id, data }),
  killTerminal: (id: string) =>
    ipcRenderer.send('terminal-kill', { id }),
  onTerminalData: (callback: (id: string, data: string) => void) => {
    const handler = (_event: any, { id, data }: { id: string, data: string }) => callback(id, data);
    ipcRenderer.on('terminal-incoming', handler);
    return () => ipcRenderer.removeListener('terminal-incoming', handler);
  },
  onTerminalClosed: (callback: (id: string) => void) => {
    const handler = (_event: any, { id }: { id: string }) => callback(id);
    ipcRenderer.on('terminal-closed', handler);
    return () => ipcRenderer.removeListener('terminal-closed', handler);
  }
});
