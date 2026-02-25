export {};

declare global {
  interface Window {
    ipcRenderer: {
      invoke(channel: string, ...args: any[]): Promise<any>;
      send(channel: string, ...args: any[]): void;
      on(channel: string, func: (event: any, ...args: any[]) => void): () => void;
      off(channel: string, func: (event: any, ...args: any[]) => void): void;
    };
  }
}
