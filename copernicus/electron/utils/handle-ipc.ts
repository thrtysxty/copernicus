import log from 'electron-log'

export async function handleIpc<T>(
  fn: () => T | Promise<T>
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const data = await fn()
    return { ok: true, data }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    log.error('[ipc]', message)
    return { ok: false, error: message }
  }
}
