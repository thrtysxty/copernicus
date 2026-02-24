import { create } from 'zustand'

export type StoryboardView = 'blueprint' | 'studio' | 'engine-room'
export type PaneId = 'explorer' | 'editor' | 'telemetry' | 'chat' | 'kanban'

interface AgentTelemetry {
  tokensIn: number
  tokensOut: number
  limit: number
  cost: number
}

interface LayoutState {
  activeView: StoryboardView
  isFlipped: Record<string, boolean>
  spotlightPane: PaneId | null
  activeStoryId: string | null
  
  // Panel Modes
  leftPanelMode: 'explorer' | 'command-deck'
  rightPanelMode: 'telemetry' | 'kanban'
  
  // Telemetry
  workingDir: string
  gitBranch: string
  isGitDirty: boolean
  capexTotal: number
  capexSessionTime: number // seconds
  agentTelemetry: Record<string, AgentTelemetry>
  
  // Actions
  setView: (view: StoryboardView) => void
  toggleFlip: (paneId: string) => void
  setSpotlight: (paneId: PaneId | null) => void
  setActiveStoryId: (id: string | null) => void
  setTelemetry: (data: Partial<LayoutState>) => void
  updateAgentTelemetry: (agentId: string, data: Partial<AgentTelemetry>) => void
  toggleLeftPanelMode: () => void
  toggleRightPanelMode: () => void
}

export const useLayoutStore = create<LayoutState>((set) => ({
  activeView: 'engine-room',
  isFlipped: {
    sidebar: false,
    chat: false,
  },
  spotlightPane: null,
  activeStoryId: 'STORY_089',
  
  leftPanelMode: 'explorer',
  rightPanelMode: 'telemetry',

  workingDir: '~/Projects/agentic-platform',
  gitBranch: 'main',
  isGitDirty: true,
  capexTotal: 0,
  capexSessionTime: 0,
  agentTelemetry: {
    claude: { tokensIn: 0, tokensOut: 0, limit: 200000, cost: 0 },
    gemini: { tokensIn: 0, tokensOut: 0, limit: 1000000, cost: 0 },
    jules: { tokensIn: 0, tokensOut: 0, limit: 128000, cost: 0 },
  },

  setView: (view) => set({ activeView: view }),
  
  toggleFlip: (paneId) => set((state) => ({
    isFlipped: {
      ...state.isFlipped,
      [paneId]: !state.isFlipped[paneId]
    }
  })),

  setSpotlight: (paneId) => set({ spotlightPane: paneId }),
  
  setActiveStoryId: (id) => set({ activeStoryId: id }),
  
  setTelemetry: (data) => set((state) => ({ ...state, ...data })),
  
  updateAgentTelemetry: (agentId, data) => set((state) => ({
    agentTelemetry: {
      ...state.agentTelemetry,
      [agentId]: { ...state.agentTelemetry[agentId], ...data }
    }
  })),

  toggleLeftPanelMode: () => set((state) => ({
    leftPanelMode: state.leftPanelMode === 'explorer' ? 'command-deck' : 'explorer'
  })),

  toggleRightPanelMode: () => set((state) => ({
    rightPanelMode: state.rightPanelMode === 'telemetry' ? 'kanban' : 'telemetry'
  }))
}))
