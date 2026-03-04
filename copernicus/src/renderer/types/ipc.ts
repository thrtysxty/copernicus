/** Standard structured response from all IPC handlers */
export interface IpcResult<T = undefined> {
  ok: boolean
  data?: T
  error?: string
}

/** Unwrap the {ok, data} envelope returned by handleIpc() */
export function unwrapIpc<T>(result: unknown): T {
  if (!result || typeof result !== 'object') return result as T
  
  const res = result as IpcResult<T>
  if (res.ok === undefined) return result as T // Not an IpcResult envelope
  
  if (!res.ok) {
    throw new Error(res.error || 'IPC call failed')
  }
  return res.data as T
}
