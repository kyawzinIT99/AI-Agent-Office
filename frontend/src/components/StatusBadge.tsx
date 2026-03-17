const COLORS: Record<string, string> = {
  completed: 'bg-emerald-900 text-emerald-300',
  running: 'bg-blue-900 text-blue-300 animate-pulse',
  pending: 'bg-yellow-900 text-yellow-300',
  failed: 'bg-red-900 text-red-300',
  'In Progress': 'bg-blue-900 text-blue-300',
  Done: 'bg-emerald-900 text-emerald-300',
  'To Do': 'bg-slate-700 text-slate-300',
  Blocked: 'bg-red-900 text-red-300',
  High: 'bg-red-900 text-red-300',
  Medium: 'bg-yellow-900 text-yellow-300',
  Low: 'bg-slate-700 text-slate-300',
}

export function StatusBadge({ value }: { value: string }) {
  const cls = COLORS[value] ?? 'bg-slate-700 text-slate-300'
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>
      {value}
    </span>
  )
}
