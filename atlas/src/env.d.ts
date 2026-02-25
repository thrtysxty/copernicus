/// <reference types="vite/client" />

interface Window {
  electronAPI: {
    createTerminal: (id: string, cols: number, rows: number, cwd?: string) => void;
    resizeTerminal: (id: string, cols: number, rows: number) => void;
    writeTerminal: (id: string, data: string) => void;
    killTerminal: (id: string) => void;
    onTerminalData: (callback: (id: string, data: string) => void) => () => void;
    onTerminalClosed: (callback: (id: string) => void) => () => void;
  };
}
