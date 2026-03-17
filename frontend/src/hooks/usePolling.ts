import { useState, useEffect, useCallback } from 'react'

interface PollingState<T> {
  data: T | null
  loading: boolean
  error: string | null
  lastUpdated: Date | null
  refetch: () => void
}

export function usePolling<T>(
  fetchFn: () => Promise<T>,
  intervalMs = 30000,
): PollingState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetch = useCallback(async () => {
    try {
      const result = await fetchFn()
      setData(result)
      setError(null)
      setLastUpdated(new Date())
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [fetchFn])

  useEffect(() => {
    fetch()
    const interval = setInterval(fetch, intervalMs)
    return () => clearInterval(interval)
  }, [fetch, intervalMs])

  return { data, loading, error, lastUpdated, refetch: fetch }
}
