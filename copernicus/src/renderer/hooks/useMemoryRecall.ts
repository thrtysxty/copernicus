import { useState, useEffect } from 'react'
import { useIpcError } from './useIpcError'
import { unwrapIpc, IpcResult } from '../types/ipc'

export interface MemoryRow {
  id: string
  bank_id: string
  event_type: string
  content: string
  importance: number
  score: number
  ts: number
}

export function useMemoryRecall(projectId: string, bankId: string, limit = 5) {
  const [memories, setMemories] = useState<MemoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const invoke = useIpcError()

  useEffect(() => {
    let isMounted = true

    const fetchMemories = async () => {
      try {
        setLoading(true)
        const result = await invoke<IpcResult<MemoryRow[]>>('memory:get-working-set', { projectId, bankId, limit })
        const data = unwrapIpc<MemoryRow[]>(result)
        if (isMounted && data) {
          setMemories(data)
        }
      } catch (err) {
        console.error('Failed to fetch working set memories:', err)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchMemories()

    return () => {
      isMounted = false
    }
  }, [projectId, bankId, limit, invoke])

  return { memories, loading }
}
