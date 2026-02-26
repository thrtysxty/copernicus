import { useCallback } from 'react'
import { useToastStore } from '../store/toastStore'

const ipcRenderer = window.ipcRenderer

/**
 * Wraps ipcRenderer.invoke() with automatic error toasting.
 * Usage: const invoke = useIpcError()
 *        const result = await invoke('fs:list-dir', payload)
 */
export function useIpcError() {
  const addToast = useToastStore(s => s.addToast)

  return useCallback(
    async <T = unknown>(channel: string, ...args: unknown[]): Promise<T> => {
      try {
        if (!ipcRenderer) {
          throw new Error('ipcRenderer not found')
        }
        return await ipcRenderer.invoke(channel, ...args) as T
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        addToast(`IPC error [${channel}]: ${message}`, 'error')
        throw err  // re-throw so callers can still handle if needed
      }
    },
    [addToast]
  )
}
