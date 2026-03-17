import { useState, useEffect, useRef } from 'react'
import { triggerRun, fetchRunStatus } from '../api/client'

type RunState = 'idle' | 'starting' | 'running' | 'completed' | 'failed'

export function useRunStatus(onComplete?: () => void) {
  const [state, setState] = useState<RunState>('idle')
  const [reportId, setReportId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startRun = async () => {
    setState('starting')
    setError(null)
    try {
      const resp = await triggerRun()
      setReportId(resp.report_id)
      setState('running')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to start run'
      setError(msg)
      setState('failed')
    }
  }

  useEffect(() => {
    if (state !== 'running' || !reportId) return

    intervalRef.current = setInterval(async () => {
      try {
        const status = await fetchRunStatus(reportId)
        if (status.status === 'completed') {
          setState('completed')
          clearInterval(intervalRef.current!)
          onComplete?.()
        } else if (status.status === 'failed') {
          setState('failed')
          setError(status.error_message || 'Run failed')
          clearInterval(intervalRef.current!)
        }
      } catch {
        // keep polling
      }
    }, 5000)

    return () => clearInterval(intervalRef.current!)
  }, [state, reportId, onComplete])

  const reset = () => {
    setState('idle')
    setReportId(null)
    setError(null)
  }

  return { state, reportId, error, startRun, reset }
}
