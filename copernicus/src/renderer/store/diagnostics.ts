import { create } from 'zustand'

export type DiagnosticSource = 'LSP' | 'ESLint' | 'Ruff' | 'Audit'

export interface DiagnosticsIssue {
  file: string
  line: number
  col: number
  severity: 'error' | 'warning' | 'info'
  code: string
  message: string
  source: DiagnosticSource
}

interface DiagnosticsState {
  diagnostics: DiagnosticsIssue[]
  setDiagnostics: (diags: DiagnosticsIssue[]) => void
  addDiagnostics: (diags: DiagnosticsIssue[]) => void
  clearDiagnostics: (source?: DiagnosticSource) => void
  removeDiagnosticsForFile: (file: string, source?: DiagnosticSource) => void
}

export const useDiagnosticsStore = create<DiagnosticsState>((set) => ({
  diagnostics: [],
  setDiagnostics: (diags) => set({ diagnostics: diags }),
  addDiagnostics: (diags) => set((state) => ({
    diagnostics: [...state.diagnostics, ...diags]
  })),
  clearDiagnostics: (source) => set((state) => ({
    diagnostics: source ? state.diagnostics.filter(d => d.source !== source) : []
  })),
  removeDiagnosticsForFile: (file, source) => set((state) => ({
    diagnostics: state.diagnostics.filter(d => {
      if (d.file !== file) return true
      if (source && d.source !== source) return true
      return false
    })
  }))
}))
