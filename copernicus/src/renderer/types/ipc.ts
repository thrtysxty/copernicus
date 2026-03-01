/** Standard structured response from all IPC handlers */
export interface IpcResult<T = undefined> {
  ok: boolean
  data?: T
  error?: string
}

/** Unwrap the {ok, data} envelope returned by handleIpc() */
export function unwrapIpc<T>(result: unknown): T {
  return ((result as any)?.data ?? result) as T
}
