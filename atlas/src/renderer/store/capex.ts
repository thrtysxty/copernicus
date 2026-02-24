import { create } from 'zustand'

interface CapexState {
  budget: number
  spent: number
  sessionActive: boolean
  startTime: number | null
  startSession: () => void
  endSession: () => void
}

export const useCapexStore = create<CapexState>((set) => ({
  budget: 0,
  spent: 0,
  sessionActive: false,
  startTime: null,
  startSession: () => set({ sessionActive: true, startTime: Date.now() }),
  endSession: () => set({ sessionActive: false, startTime: null })
}))
