export {};

declare global {
  interface Window {
    ipcRenderer: {
      invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T>;
      send(channel: string, ...args: unknown[]): void;
      on(channel: string, func: (event: Electron.IpcRendererEvent, ...args: any[]) => void): () => void;
      off(channel: string, func: (event: Electron.IpcRendererEvent, ...args: any[]) => void): void;
    };
  }
}
