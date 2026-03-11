import { create } from 'zustand'

interface SessionState {
  timerState: 'idle' | 'running' | 'paused'
  elapsedSeconds: number
  _intervalId: ReturnType<typeof setInterval> | null
  startTimer: () => void
  stopTimer: () => void
  endSession: () => void
  resetTimer: () => void
}

export const useSessionStore = create<SessionState>((set, get) => ({
  timerState: 'idle',
  elapsedSeconds: 0,
  _intervalId: null,
  startTimer: () => {
    const id = setInterval(() => set(s => ({ elapsedSeconds: s.elapsedSeconds + 1 })), 1000)
    set({ timerState: 'running', _intervalId: id })
  },
  stopTimer: () => {
    const { _intervalId } = get()
    if (_intervalId) clearInterval(_intervalId)
    set({ timerState: 'paused', _intervalId: null })
  },
  endSession: () => {
    const { _intervalId } = get()
    if (_intervalId) clearInterval(_intervalId)
    set({ timerState: 'idle', _intervalId: null })
  },
  resetTimer: () => {
    const { _intervalId } = get()
    if (_intervalId) clearInterval(_intervalId)
    set({ timerState: 'idle', elapsedSeconds: 0, _intervalId: null })
  }
}))

export const formatElapsed = (s: number) => {
  const h = Math.floor(s / 3600).toString().padStart(2, '0')
  const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0')
  const sec = (s % 60).toString().padStart(2, '0')
  return `${h}:${m}:${sec}`
}
