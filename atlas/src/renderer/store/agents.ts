import { create } from 'zustand'

export type AgentId = 'claude' | 'gemini' | 'jules' | 'chat'

interface AgentState {
  activeAgent: AgentId
  setActiveAgent: (id: AgentId) => void
  clipboard: string
  setClipboard: (text: string) => void
  lastOutputs: Record<AgentId, string>
  setLastOutput: (id: AgentId, text: string) => void
}

export const useAgentStore = create<AgentState>((set) => ({
  activeAgent: 'claude',
  setActiveAgent: (id) => set({ activeAgent: id }),
  clipboard: '',
  setClipboard: (text) => set({ clipboard: text }),
  lastOutputs: {
    claude: '',
    gemini: '',
    jules: '',
    chat: ''
  },
  setLastOutput: (id, text) => set((state) => ({
    lastOutputs: { ...state.lastOutputs, [id]: text }
  }))
}))
