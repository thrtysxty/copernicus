import { create } from 'zustand'
import type { DebugProtocol } from '@vscode/debugprotocol'

export interface DebugState {
  isAttached: boolean
  isPaused: boolean
  callStack: DebugProtocol.StackFrame[]
  scopes: DebugProtocol.Scope[]
  variables: Record<number, DebugProtocol.Variable[]>
  breakpoints: Record<string, DebugProtocol.SourceBreakpoint[]>

  // Actions
  setIsAttached: (attached: boolean) => void
  setIsPaused: (paused: boolean) => void
  setCallStack: (frames: DebugProtocol.StackFrame[]) => void
  setScopes: (scopes: DebugProtocol.Scope[]) => void
  setVariables: (ref: number, vars: DebugProtocol.Variable[]) => void
  clearVariables: () => void
  setBreakpoints: (path: string, bps: DebugProtocol.SourceBreakpoint[]) => void
  toggleBreakpoint: (path: string, line: number) => void
  clearBreakpoints: (path: string) => void
}

export const useDebugStore = create<DebugState>((set) => ({
  isAttached: false,
  isPaused: false,
  callStack: [],
  scopes: [],
  variables: {},
  breakpoints: {},

  setIsAttached: (attached) => set({ isAttached: attached }),
  setIsPaused: (paused) => set({ isPaused: paused }),
  setCallStack: (frames) => set({ callStack: frames }),
  setScopes: (scopes) => set({ scopes }),
  setVariables: (ref, vars) => set((state) => ({
    variables: { ...state.variables, [ref]: vars }
  })),
  clearVariables: () => set({ variables: {}, scopes: [] }),
  setBreakpoints: (path, bps) => set((state) => ({
    breakpoints: { ...state.breakpoints, [path]: bps }
  })),
  toggleBreakpoint: (path, line) => set((state) => {
    const fileBps = state.breakpoints[path] || []
    const exists = fileBps.some(b => b.line === line)

    let newBps
    if (exists) {
      newBps = fileBps.filter(b => b.line !== line)
    } else {
      newBps = [...fileBps, { line }]
    }

    return {
      breakpoints: { ...state.breakpoints, [path]: newBps }
    }
  }),
  clearBreakpoints: (path) => set((state) => {
    const newBps = { ...state.breakpoints }
    delete newBps[path]
    return { breakpoints: newBps }
  })
}))
