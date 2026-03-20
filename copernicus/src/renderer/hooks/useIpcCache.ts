import { useState, useEffect, useCallback } from 'react'
import { useIpcError } from './useIpcError'

interface CacheEntry<T> {
  data?: T
  expiry: number
  promise?: Promise<T>
}

// Module-level cache — shared across all hook instances
const cache = new Map<string, CacheEntry<unknown>>()

export function useIpcCache<T>(
  channel: string,
  args: unknown[] = [],
  ttlMs: number = 5000
): { data: T | null; loading: boolean; error: string | null; invalidate: () => void } {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const invoke = useIpcError()

  const argsKey = JSON.stringify(args)
  const cacheKey = `${channel}:${argsKey}`

  const fetchData = useCallback(async (force = false) => {
    setLoading(true)
    setError(null)

    const now = Date.now()
    const cached = cache.get(cacheKey)

    if (!force && cached && cached.expiry > now) {
      if (cached.promise) {
        // Another caller is in-flight — wait on the same promise (AC3: deduplication)
        try {
          const result = await cached.promise
          setData(result as T)
          setLoading(false)
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : String(err))
          setLoading(false)
        }
        return
      } else {
        setData(cached.data as T)
        setLoading(false)
        return
      }
    }

    try {
      // Store promise so parallel callers deduplicate (AC3)
      const fetchPromise = invoke<T>(channel, ...args)
      cache.set(cacheKey, { expiry: now + ttlMs, promise: fetchPromise as Promise<unknown> })

      const result = await fetchPromise

      // Replace promise entry with resolved data
      cache.set(cacheKey, { data: result as unknown, expiry: Date.now() + ttlMs })
      setData(result as T)
      setLoading(false)
    } catch (err: unknown) {
      cache.delete(cacheKey)
      setError(err instanceof Error ? err.message : String(err))
      setLoading(false)
    }
  }, [cacheKey, channel, argsKey, invoke, ttlMs]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // AC4: invalidate clears ALL cache entries for this channel, then re-fetches
  const invalidate = useCallback(() => {
    for (const key of cache.keys()) {
      if (key.startsWith(`${channel}:`)) {
        cache.delete(key)
      }
    }
    fetchData(true)
  }, [channel, fetchData])

  return { data, loading, error, invalidate }
}
