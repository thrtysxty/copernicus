import { create } from 'zustand'

export interface AgentSwarmEntry {
  name: string
  status: 'RUNNING' | 'IDLE' | 'STALLED' | 'ERROR'
  sessionId?: string
  startedAt?: number
}

export interface ActiveTaskEntry {
  id: string
  label: string
  workflowId?: string
  currentNode?: string
  elapsedMs: number
  status: 'RUNNING' | 'PAUSED' | 'COMPLETE' | 'FAILED'
}

export interface LspState {
  running: boolean
  status: 'running' | 'restarting' | 'dead' | 'stopped'
  serverName: string
  openFiles: number
  errorCount: number
  warningCount: number
}

export interface McpUsage {
  serverName: string
  callCount: number
  lastUsed: number
}

interface CommandState {
  agentSwarms: AgentSwarmEntry[]
  activeTasks: ActiveTaskEntry[]
  lspState: LspState | null
  mcpUsage: McpUsage[]
  agentStalls: AgentSwarmEntry[]
  lastUpdated: number | null

  setAgentSwarms: (swarms: AgentSwarmEntry[]) => void
  setActiveTasks: (tasks: ActiveTaskEntry[]) => void
  setLspState: (state: LspState) => void
  setMcpUsage: (usage: McpUsage[]) => void
  pushTelemetry: (payload: Partial<CommandState>) => void
}

export const useCommandStore = create<CommandState>()((set) => ({
  agentSwarms: [],
  activeTasks: [],
  lspState: null,
  mcpUsage: [],
  agentStalls: [],
  lastUpdated: null,

  setAgentSwarms: (swarms) => set({
    agentSwarms: swarms,
    agentStalls: swarms.filter((s) => s.status === 'STALLED'),
  }),
  setActiveTasks: (tasks) => set({ activeTasks: tasks }),
  setLspState: (state) => set({ lspState: state }),
  setMcpUsage: (usage) => set({ mcpUsage: usage }),
  pushTelemetry: (payload) => set((state) => {
    const newState = { ...state, ...payload, lastUpdated: Date.now() }
    if (payload.agentSwarms) {
      newState.agentStalls = payload.agentSwarms.filter((s) => s.status === 'STALLED')
    }
    return newState
  }),
}))
