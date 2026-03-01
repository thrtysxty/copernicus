/** Standard structured response from all IPC handlers */
export interface IpcResult<T = undefined> {
  ok: boolean
  data?: T
  error?: string
}
