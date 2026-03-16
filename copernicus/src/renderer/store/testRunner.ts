import { create } from 'zustand'

export interface TestCase {
  id: string
  name: string
  suiteId: string
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped'
  error?: string
  file?: string
  line?: number
}

export interface TestSuite {
  id: string
  name: string
  type: 'vitest' | 'playwright'
  tests: TestCase[]
}

export interface TestCoverage {
  [filePath: string]: {
    lines: { [line: number]: 'covered' | 'uncovered' | 'partial' }
  }
}

interface TestRunnerState {
  suites: TestSuite[]
  setSuites: (suites: TestSuite[]) => void
  updateTestStatus: (suiteId: string, testId: string, status: TestCase['status'], error?: string) => void

  runLogs: string
  appendLog: (log: string) => void
  clearLogs: () => void

  coverage: TestCoverage
  setCoverage: (coverage: TestCoverage) => void

  isRunning: boolean
  setIsRunning: (running: boolean) => void

  rerunOnSave: boolean
  setRerunOnSave: (rerun: boolean) => void
}

export const useTestRunnerStore = create<TestRunnerState>((set) => ({
  suites: [],
  setSuites: (suites) => set({ suites }),

  updateTestStatus: (suiteId, testId, status, error) => set((state) => {
    const suites = state.suites.map(s => {
      if (s.id !== suiteId) return s
      return {
        ...s,
        tests: s.tests.map(t => {
          if (t.id !== testId) return t
          return { ...t, status, error }
        })
      }
    })
    return { suites }
  }),

  runLogs: '',
  appendLog: (log) => set((state) => ({ runLogs: state.runLogs + log })),
  clearLogs: () => set({ runLogs: '' }),

  coverage: {},
  setCoverage: (coverage) => set({ coverage }),

  isRunning: false,
  setIsRunning: (running) => set({ isRunning: running }),

  rerunOnSave: false,
  setRerunOnSave: (rerun) => set({ rerunOnSave: rerun })
}))
