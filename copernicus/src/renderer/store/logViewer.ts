import { create } from 'zustand'
import { LogLine } from '../../../electron/debug/LogTailer'

interface LogViewerState {
  logs: LogLine[]
  sources: string[]
  enabledSources: Set<string>
  minLevel: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'
  searchQuery: string
  isPaused: boolean
  
  addLog: (line: LogLine) => void
  setLogs: (logs: LogLine[]) => void
  setSources: (sources: string[]) => void
  toggleSource: (source: string) => void
  setMinLevel: (level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR') => void
  setSearchQuery: (query: string) => void
  setPaused: (paused: boolean) => void
  clearLogs: () => void
}

export const useLogViewerStore = create<LogViewerState>((set) => ({
  logs: [],
  sources: ['copernicus', 'language-server', 'backend'],
  enabledSources: new Set(['copernicus', 'language-server', 'backend']),
  minLevel: 'INFO',
  searchQuery: '',
  isPaused: false,

  addLog: (line) => set((state) => {
    if (state.isPaused) return state
    return { logs: [...state.logs.slice(-999), line] }
  }),
  
  setLogs: (logs) => set({ logs }),
  setSources: (sources) => set({ sources }),
  
  toggleSource: (source) => set((state) => {
    const next = new Set(state.enabledSources)
    if (next.has(source)) next.delete(source)
    else next.add(source)
    return { enabledSources: next }
  }),
  
  setMinLevel: (minLevel) => set({ minLevel }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setPaused: (isPaused) => set({ isPaused }),
  clearLogs: () => set({ logs: [] }),
}))
