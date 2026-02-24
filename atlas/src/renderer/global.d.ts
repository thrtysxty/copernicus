export {};

declare global {
  interface Window {
    electron: {
      ipcRenderer: {
        send: (channel: string, data: any) => void;
        invoke: (channel: string, data: any) => Promise<any>;
        on: (channel: string, func: (data: any) => void) => () => void;
      };
    };
  }
}
