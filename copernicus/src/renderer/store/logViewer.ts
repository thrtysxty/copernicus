import { create } from 'zustand'
import { LogEntry } from '../../../electron/debug/LogTailer'

interface LogViewerState {
  entries: LogEntry[]
  sources: string[]
  enabledSources: Set<string>
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | null
  search: string
  paused: boolean
  
  addLog: (entry: LogEntry) => void
  setEntries: (entries: LogEntry[]) => void
  setSources: (sources: string[]) => void
  toggleSource: (source: string) => void
  setLevel: (level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | null) => void
  setSearch: (query: string) => void
  setPaused: (paused: boolean) => void
  clearLogs: () => void
}

export const useLogViewerStore = create<LogViewerState>((set) => ({
  entries: [],
  sources: ['copernicus', 'language-server', 'backend'],
  enabledSources: new Set(['copernicus', 'language-server', 'backend']),
  level: 'INFO',
  search: '',
  paused: false,

  addLog: (entry) => set((state) => {
    if (state.paused) return state
    // Slice last 1000 for performance
    return { entries: [entry, ...state.entries].slice(0, 1000) }
  }),
  
  setEntries: (entries) => set({ entries }),
  setSources: (sources) => set({ sources }),
  
  toggleSource: (source) => set((state) => {
    const next = new Set(state.enabledSources)
    if (next.has(source)) next.delete(source)
    else next.add(source)
    return { enabledSources: next }
  }),
  
  setLevel: (level) => set({ level }),
  setSearch: (search) => set({ search }),
  setPaused: (paused) => set({ paused }),
  clearLogs: () => set({ entries: [] }),
}))
