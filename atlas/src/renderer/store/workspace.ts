import { create } from 'zustand'

interface WorkspaceState {
  cwd: string
  gitBranch: string
  setCwd: (path: string) => void
  setGitBranch: (branch: string) => void
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  cwd: '',
  gitBranch: '',
  setCwd: (path) => set({ cwd: path }),
  setGitBranch: (branch) => set({ gitBranch: branch })
}))
