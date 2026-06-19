import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface QueueEntry {
  storyNumber: number
  title: string
  blockedBy: number[]
  status: 'waiting' | 'ready' | 'running' | 'done' | 'failed'
}

interface QueueState {
  queue: QueueEntry[]
  pendingReadyStories: number[]
  
  addToQueue: (n: number, blockedBy: number[], title: string) => void
  markDone: (n: number) => void
  markFailed: (n: number) => void
  markRunning: (n: number) => void
  getReady: () => QueueEntry[]
  clearPendingReady: () => void
  dispatchGuard: (n: number) => { blocked: boolean, deps: number[] }
}

export const useQueueStore = create<QueueState>()(
  persist(
    (set, get) => ({
      queue: [],
      pendingReadyStories: [],

      addToQueue: (n, blockedBy, title) => set((state) => {
        if (state.queue.some(entry => entry.storyNumber === n)) return state
        const status = blockedBy.length === 0 ? 'ready' : 'waiting'
        return {
          queue: [...state.queue, { storyNumber: n, title, blockedBy, status }]
        }
      }),

      markDone: (n) => {
        const state = get()
        const updatedQueue = state.queue.map(entry => 
          entry.storyNumber === n ? { ...entry, status: 'done' as const } : entry
        )
        
        // After marking done, check if any stories became ready
        const newlyReady: number[] = []
        const finalQueue = updatedQueue.map(entry => {
          if (entry.status === 'waiting') {
            const allDone = entry.blockedBy.every(dep => 
              updatedQueue.find(e => e.storyNumber === dep)?.status === 'done'
            )
            if (allDone) {
              newlyReady.push(entry.storyNumber)
              return { ...entry, status: 'ready' as const }
            }
          }
          return entry
        })

        set({ 
          queue: finalQueue, 
          pendingReadyStories: [...state.pendingReadyStories, ...newlyReady] 
        })
      },

      markFailed: (n) => set((state) => ({
        queue: state.queue.map(entry => 
          entry.storyNumber === n ? { ...entry, status: 'failed' as const } : entry
        )
      })),

      markRunning: (n) => set((state) => ({
        queue: state.queue.map(entry => 
          entry.storyNumber === n ? { ...entry, status: 'running' as const } : entry
        )
      })),

      getReady: () => {
        const { queue } = get()
        return queue.filter(entry => entry.status === 'ready')
      },

      clearPendingReady: () => set({ pendingReadyStories: [] }),

      dispatchGuard: (n) => {
        const { queue } = get()
        const entry = queue.find(e => e.storyNumber === n)
        if (!entry) return { blocked: false, deps: [] }
        
        const unresolvedDeps = entry.blockedBy.filter(dep => {
          const depEntry = queue.find(e => e.storyNumber === dep)
          return !depEntry || depEntry.status !== 'done'
        })

        return {
          blocked: unresolvedDeps.length > 0,
          deps: unresolvedDeps
        }
      }
    }),
    {
      name: 'copernicus-queue'
    }
  )
)

// AC3: Auto-dispatch notification
// We need to subscribe to 'stories:status-changed'
if (typeof window !== 'undefined' && window.ipcRenderer) {
  window.ipcRenderer.on('stories:status-changed', (_e: Electron.IpcRendererEvent, data: { storyNumber: number, status: string }) => {
    if (data.status === 'COMPLETE') {
      useQueueStore.getState().markDone(data.storyNumber)
    }
  })
}
