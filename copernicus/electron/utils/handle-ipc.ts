import log from 'electron-log'

export async function handleIpc<T>(
  channel: string,
  args: any[],
  fn: () => T | Promise<T>
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const data = await fn()
    return { ok: true, data }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    log.error(`[ipc:${channel}]`, { args, message })
    return { ok: false, error: message }
  }
}
