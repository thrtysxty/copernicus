import { create } from 'zustand'

export interface Agent {
  id: string
  name: string
  color: string
}

export interface AgentLog {
  id: string
  timestamp: number
  content: string
  source: string // e.g., 'stdout', 'stderr', 'user'
}

interface AgentState {
  agents: Agent[]
  activeAgentId: string
  logs: Record<string, AgentLog[]>
  agentClipboard: string | null

  setActiveAgent: (agentId: string) => void
  appendLog: (agentId: string, content: string, source?: string) => void
  clearLogs: (agentId: string) => void
  setClipboard: (content: string) => void
  getClipboard: () => string | null

  // Interop actions
  sendDelegate: (targetAgent: string, task: string) => void
  sendForward: (targetAgent: string, content: string) => void

  // Initialize listeners
  initIPCListeners: () => void
}

const INITIAL_AGENTS: Agent[] = [
  { id: 'claude', name: 'Claude', color: '#D97757' },
  { id: 'gemini', name: 'Gemini', color: '#4D96FF' },
  { id: 'jules', name: 'Jules', color: '#4ADE80' },
]

export const useAgentStore = create<AgentState>((set, get) => ({
  agents: INITIAL_AGENTS,
  activeAgentId: 'claude',
  logs: {
    claude: [],
    gemini: [],
    jules: [],
  },
  agentClipboard: null,

  setActiveAgent: (agentId) => set({ activeAgentId: agentId }),

  appendLog: (agentId, content, source = 'stdout') => set((state) => {
    const newLog: AgentLog = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      content,
      source
    }
    return {
      logs: {
        ...state.logs,
        [agentId]: [...(state.logs[agentId] || []), newLog]
      }
    }
  }),

  clearLogs: (agentId) => set((state) => ({
    logs: {
      ...state.logs,
      [agentId]: []
    }
  })),

  setClipboard: (content: string) => set({ agentClipboard: content }),
  getClipboard: () => get().agentClipboard,

  sendDelegate: (target: string, task: string) => {
    const ipcRenderer = window.ipcRenderer;
    if (ipcRenderer) {
      ipcRenderer.send('agent:delegate', { target, task })
    }
  },

  sendForward: (target: string, content: string) => {
    const ipcRenderer = window.ipcRenderer;
    if (ipcRenderer) {
      ipcRenderer.send('agent:forward', { target, content })
    }
  },

  initIPCListeners: () => {
    const ipcRenderer = window.ipcRenderer;
    if (ipcRenderer) {
        ipcRenderer.on('agent:input', (_event: any, { target, content }: any) => {
            get().appendLog(target, content, 'stdin')
            get().appendLog(target, `Executing: ${content.substring(0, 50)}...`, 'stdout')
        })
    }
  }
}))
