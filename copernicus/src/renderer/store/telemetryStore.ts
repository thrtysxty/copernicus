import { create } from 'zustand'

interface AgentTelemetry {
  tokensIn: number
  tokensOut: number
  limit: number
  cost: number
}

interface TelemetryState {
  capexTotal: number
  capexSessionTime: number
  capexTimer: string
  agentTelemetry: Record<string, AgentTelemetry>

  setTelemetry: (data: Partial<TelemetryState>) => void
  setCapexTimer: (timer: string) => void
  updateAgentTelemetry: (agentId: string, data: Partial<AgentTelemetry>) => void
}

export const useTelemetryStore = create<TelemetryState>()((set) => ({
  capexTotal: 0,
  capexSessionTime: 0,
  capexTimer: '00:00:00',
  agentTelemetry: {
    claude: { tokensIn: 0, tokensOut: 0, limit: 200000, cost: 0 },
    gemini: { tokensIn: 0, tokensOut: 0, limit: 1000000, cost: 0 },
    jules: { tokensIn: 0, tokensOut: 0, limit: 128000, cost: 0 },
  },

  setTelemetry: (data) => set((state) => ({ ...state, ...data })),
  setCapexTimer: (timer) => set({ capexTimer: timer }),
  updateAgentTelemetry: (agentId, data) => set((state) => {
    const existing = state.agentTelemetry[agentId] || { tokensIn: 0, tokensOut: 0, cost: 0, limit: 1000000 }
    return {
      agentTelemetry: {
        ...state.agentTelemetry,
        [agentId]: { ...existing, ...data }
      }
    }
  }),
}))
