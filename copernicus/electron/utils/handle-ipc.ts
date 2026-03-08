import log from 'electron-log'

export async function handleIpc<T>(
  channelOrFn: string | (() => T | Promise<T>),
  argsOrNothing?: any[],
  fnOrNothing?: () => T | Promise<T>
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  let channel = 'unknown'
  let args: any[] = []
  let fn: () => T | Promise<T>

  if (typeof channelOrFn === 'function') {
    fn = channelOrFn
  } else {
    channel = channelOrFn
    args = argsOrNothing || []
    fn = fnOrNothing as () => T | Promise<T>
  }

  try {
    const data = await fn()
    return { ok: true, data }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    log.error(`[ipc:${channel}]`, { args, message })
    return { ok: false, error: message }
  }
}
