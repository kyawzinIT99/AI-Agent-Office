import { useRunStatus } from '../hooks/useRunStatus'

const LABELS: Record<string, string> = {
  idle: 'Run Now',
  starting: 'Starting...',
  running: 'Running Agents...',
  completed: 'Done!',
  failed: 'Failed — Retry',
}

interface Props {
  onComplete?: () => void
}

export function RunNowButton({ onComplete }: Props) {
  const { state, error, startRun, reset } = useRunStatus(onComplete)
  const isActive = state === 'starting' || state === 'running'

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={state === 'completed' || state === 'failed' ? reset : startRun}
        disabled={isActive}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
          isActive
            ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
            : state === 'completed'
            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
            : state === 'failed'
            ? 'bg-red-600 hover:bg-red-700 text-white'
            : 'bg-purple-600 hover:bg-purple-700 text-white'
        }`}
      >
        {isActive && (
          <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
        )}
        {LABELS[state]}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
