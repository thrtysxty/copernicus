import { create } from 'zustand'

interface CopernicusState {
  version: string
  theme: 'technical-phosphor'
  status: 'online' | 'offline' | 'error'
  setStatus: (status: 'online' | 'offline' | 'error') => void
}

export const useCopernicusStore = create<CopernicusState>((set) => ({
  version: '0.1.0',
  theme: 'technical-phosphor',
  status: 'online',
  setStatus: (status) => set({ status }),
}))
