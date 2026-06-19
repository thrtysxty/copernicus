import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { KanbanColumn } from '../types/layout'
import log from '../utils/logger'

export const DEFAULT_COLUMNS: KanbanColumn[] = [
  { id: 'planning',       status: 'PLANNING',       label: 'Planning',        color: 'bg-slate-400/20 border-slate-300/60',    accent: 'bg-slate-300' },
  { id: 'storyboarding',  status: 'STORYBOARDING',  label: 'Storyboarding',   color: 'bg-violet-500/20 border-violet-400/70',  accent: 'bg-violet-400' },
  { id: 'sprint-planning',status: 'SPRINT_PLANNING', label: 'Sprint Planning', color: 'bg-indigo-500/20 border-indigo-400/70',  accent: 'bg-indigo-400' },
  { id: 'development',    status: 'IN_PROGRESS',     label: 'Development',     color: 'bg-yellow-400/20 border-yellow-300/70',  accent: 'bg-yellow-300' },
  { id: 'testing',        status: 'TESTING',         label: 'Testing',         color: 'bg-orange-500/20 border-orange-400/70',  accent: 'bg-orange-400' },
  { id: 'qa',             status: 'QA',              label: 'QA',              color: 'bg-amber-400/20 border-amber-300/70',    accent: 'bg-amber-300' },
  { id: 'documenting',    status: 'DOCUMENTING',     label: 'Documenting',     color: 'bg-cyan-500/20 border-cyan-300/70',      accent: 'bg-cyan-300' },
  { id: 'ready-to-build', status: 'READY',           label: 'Ready to Build',  color: 'bg-teal-500/20 border-teal-300/70',      accent: 'bg-teal-300' },
  { id: 'done',           status: 'COMPLETE',        label: 'Done',            color: 'bg-copernicus-phosphor/20 border-copernicus-phosphor/70', accent: 'bg-copernicus-phosphor' },
]

interface KanbanState {
  columns: KanbanColumn[]
  inProgressCount: number
  setColumns: (columns: KanbanColumn[]) => void
  updateKanbanColumn: (id: string, updates: Partial<KanbanColumn>, invoke: (channel: string, ...args: unknown[]) => Promise<unknown>) => Promise<void>
  setInProgressCount: (count: number) => void
}

export const useKanbanStore = create<KanbanState>()(
  persist(
    (set) => ({
      columns: DEFAULT_COLUMNS,
      inProgressCount: 0,
      setColumns: (columns) => set({ columns }),
      updateKanbanColumn: async (id, updates, invoke) => {
        try {
          await invoke('kanban:set-column', id, updates)
          set((state) => ({
            columns: state.columns.map(c => c.id === id ? { ...c, ...updates } : c)
          }))
        } catch (e) {
          log.error('Failed to update column', e)
        }
      },
      setInProgressCount: (count) => set({ inProgressCount: count }),
    }),
    {
      name: 'copernicus-kanban-storage',
      partialize: (state) => ({ columns: state.columns }),
    }
  )
)
