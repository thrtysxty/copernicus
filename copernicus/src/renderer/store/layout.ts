import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type StoryboardView = 'blueprint' | 'studio' | 'engine-room'
export type PaneId = 'explorer' | 'editor' | 'telemetry' | 'chat' | 'kanban'

export const PHOSPHOR_PRESETS = {
  green: { label: 'Green', hex: '#4ADE80', rgb: '74 222 128' },
  amber: { label: 'Amber', hex: '#FBBF24', rgb: '251 191 36' },
  white: { label: 'White', hex: '#F4F4F5', rgb: '244 244 245' },
  blue:  { label: 'Blue',  hex: '#60A5FA', rgb: '96 165 250' },
} as const

export type PhosphorColor = keyof typeof PHOSPHOR_PRESETS

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
  phosphorColor: PhosphorColor
  
  // Panel Modes
  leftPanelMode: 'explorer' | 'command-deck'
  rightPanelMode: 'telemetry' | 'kanban'
  flippedPanes: string[] // Changed Set to string[] for persist compatibility
  
  // Telemetry
  workingDir: string
  gitBranch: string
  isGitDirty: boolean
  capexTotal: number
  capexSessionTime: number // seconds
  capexTimer: string
  agentTelemetry: Record<string, AgentTelemetry>
  
  // Actions
  setView: (view: StoryboardView) => void
  toggleFlip: (paneId: string) => void
  setSpotlight: (paneId: PaneId | null) => void
  setActiveStoryId: (id: string | null) => void
  setTelemetry: (data: Partial<LayoutState>) => void
  setCapexTimer: (timer: string) => void
  updateAgentTelemetry: (agentId: string, data: Partial<AgentTelemetry>) => void
  toggleLeftPanelMode: () => void
  toggleRightPanelMode: () => void
  setPhosphorColor: (color: PhosphorColor) => void
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      activeView: 'engine-room',
      isFlipped: {
        sidebar: false,
        chat: false,
      },
      spotlightPane: null,
      activeStoryId: 'STORY_089',
      phosphorColor: 'green',
      
      leftPanelMode: 'explorer',
      rightPanelMode: 'telemetry',
      flippedPanes: [],

      workingDir: '~/Projects/agentic-platform',
      gitBranch: 'main',
      isGitDirty: true,
      capexTotal: 0,
      capexSessionTime: 0,
      capexTimer: '00:00:00',
      agentTelemetry: {
        claude: { tokensIn: 0, tokensOut: 0, limit: 200000, cost: 0 },
        gemini: { tokensIn: 0, tokensOut: 0, limit: 1000000, cost: 0 },
        jules: { tokensIn: 0, tokensOut: 0, limit: 128000, cost: 0 },
      },

      setView: (view) => set({ activeView: view }),
      
      toggleFlip: (paneId) => set((state) => {
        const newFlipped = [...state.flippedPanes]
        const index = newFlipped.indexOf(paneId)
        if (index > -1) {
          newFlipped.splice(index, 1)
        } else {
          newFlipped.push(paneId)
        }
        return { flippedPanes: newFlipped }
      }),

      setSpotlight: (paneId) => set({ spotlightPane: paneId }),
      
      setActiveStoryId: (id) => set({ activeStoryId: id }),
      
      setTelemetry: (data) => set((state) => ({ ...state, ...data })),

      setCapexTimer: (timer) => set({ capexTimer: timer }),
      
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
      })),

      setPhosphorColor: (color) => set({ phosphorColor: color }),
    }),
    {
      name: 'copernicus-layout-storage',
    }
  )
)
