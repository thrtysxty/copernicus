import { create } from 'zustand'

export interface ReplayRun {
  run_id: string
  started_at: string
  model_id: string
  provider: string
  step_count: number
  outcome: 'success' | 'failed' | 'unknown'
}

export interface ReplayStep {
  id: number
  run_id: string
  model_id: string
  provider: string
  tokens_in: number
  tokens_out: number
  latency_ms: number | null
  created_at: string
  has_prompt: boolean
  has_response: boolean
}

export interface ReplayStepDetail extends ReplayStep {
  prompt_text: string | null
  response_text: string | null
  context_json: string | null
}

interface ReplayState {
  runs: ReplayRun[]
  selectedRunId: string | null
  steps: ReplayStep[]
  selectedStepId: number | null
  selectedStepDetail: ReplayStepDetail | null
  isLoading: boolean

  setRuns: (runs: ReplayRun[]) => void
  setSelectedRunId: (id: string | null) => void
  setSteps: (steps: ReplayStep[]) => void
  setSelectedStepId: (id: number | null) => void
  setSelectedStepDetail: (detail: ReplayStepDetail | null) => void
  setIsLoading: (isLoading: boolean) => void
}

export const useReplayStore = create<ReplayState>((set) => ({
  runs: [],
  selectedRunId: null,
  steps: [],
  selectedStepId: null,
  selectedStepDetail: null,
  isLoading: false,

  setRuns: (runs) => set({ runs }),
  setSelectedRunId: (id) => set({ 
    selectedRunId: id, 
    steps: id === null ? [] : [], // clear steps if run deselected
    selectedStepId: null, 
    selectedStepDetail: null 
  }),
  setSteps: (steps) => set({ steps }),
  setSelectedStepId: (id) => set({ selectedStepId: id, selectedStepDetail: id === null ? null : undefined }),
  setSelectedStepDetail: (detail) => set({ selectedStepDetail: detail }),
  setIsLoading: (isLoading) => set({ isLoading }),
}))
