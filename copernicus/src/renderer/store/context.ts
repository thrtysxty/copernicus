import { create } from 'zustand'

interface ContextState {
  pinnedAssets: string[]
  tokenCount: number
  pruningActive: boolean
  pinAsset: (id: string) => void
  unpinAsset: (id: string) => void
  setTokenCount: (count: number) => void
  setPruningActive: (active: boolean) => void
}

export const useContextStore = create<ContextState>((set) => ({
  pinnedAssets: [],
  tokenCount: 0,
  pruningActive: false,

  pinAsset: (id: string) => {
    set((state) => ({
      pinnedAssets: state.pinnedAssets.includes(id) 
        ? state.pinnedAssets 
        : [...state.pinnedAssets, id]
    }))
  },

  unpinAsset: (id: string) => {
    set((state) => ({
      pinnedAssets: state.pinnedAssets.filter((assetId) => assetId !== id)
    }))
  },

  setTokenCount: (count: number) => {
    set({ tokenCount: count })
  },

  setPruningActive: (active: boolean) => {
    set({ pruningActive: active })
  },
}))
