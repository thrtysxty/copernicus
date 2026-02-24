import { create } from 'zustand'

export type StoryboardView = 'blueprint' | 'studio' | 'engine-room'
export type PaneId = 'explorer' | 'editor' | 'telemetry' | 'chat' | 'kanban'

interface LayoutState {
  activeView: StoryboardView
  isFlipped: Record<string, boolean>
  spotlightPane: PaneId | null
  
  // Actions
  setView: (view: StoryboardView) => void
  toggleFlip: (paneId: string) => void
  setSpotlight: (paneId: PaneId | null) => void
}

export const useLayoutStore = create<LayoutState>((set) => ({
  activeView: 'engine-room', // Default starting view
  isFlipped: {
    sidebar: false, // Explorer <-> Command Deck
    chat: false,    // Chat <-> Kanban
  },
  spotlightPane: null,

  setView: (view) => set({ activeView: view }),
  
  toggleFlip: (paneId) => set((state) => ({
    isFlipped: {
      ...state.isFlipped,
      [paneId]: !state.isFlipped[paneId]
    }
  })),

  setSpotlight: (paneId) => set({ spotlightPane: paneId })
}))
