import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { AgentWorktree } from '../types/worktree'

interface WorktreeState {
  worktrees: AgentWorktree[]
  alwaysUseWorktrees: boolean
  defaultMergeMode: 'gated' | 'yolo'
}

interface WorktreeActions {
  setWorktrees: (worktrees: AgentWorktree[]) => void
  upsertWorktree: (worktree: AgentWorktree) => void
  removeWorktree: (id: string) => void
  setAlwaysUseWorktrees: (value: boolean) => void
  setDefaultMergeMode: (mode: 'gated' | 'yolo') => void
}

export const useWorktreeStore = create<WorktreeState & WorktreeActions>()(
  persist(
    (set) => ({
      worktrees: [],
      alwaysUseWorktrees: false,
      defaultMergeMode: 'gated',

      setWorktrees: (worktrees) => set({ worktrees }),
      upsertWorktree: (worktree) =>
        set((state) => {
          const existingIndex = state.worktrees.findIndex((wt) => wt.id === worktree.id)
          if (existingIndex > -1) {
            const updatedWorktrees = [...state.worktrees]
            updatedWorktrees[existingIndex] = worktree
            return { worktrees: updatedWorktrees }
          }
          return { worktrees: [...state.worktrees, worktree] }
        }),
      removeWorktree: (id) =>
        set((state) => ({
          worktrees: state.worktrees.filter((wt) => wt.id !== id),
        })),
      setAlwaysUseWorktrees: (value) => set({ alwaysUseWorktrees: value }),
      setDefaultMergeMode: (mode) => set({ defaultMergeMode: mode }),
    }),
    {
      name: 'copernicus-worktree-settings',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        alwaysUseWorktrees: state.alwaysUseWorktrees,
        defaultMergeMode: state.defaultMergeMode,
      }),
    },
  ),
)
