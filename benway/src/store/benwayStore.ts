import { create } from 'zustand'

interface BenwayState {
  version: string
  theme: 'surgical-phosphor'
  status: 'online' | 'offline' | 'error'
  setStatus: (status: 'online' | 'offline' | 'error') => void
}

export const useBenwayStore = create<BenwayState>((set) => ({
  version: '0.1.0',
  theme: 'surgical-phosphor',
  status: 'online',
  setStatus: (status) => set({ status }),
}))
