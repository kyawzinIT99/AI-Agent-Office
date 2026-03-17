import { useCallback, useState } from 'react'
import { fetchIssues } from '../api/client'
import { usePolling } from '../hooks/usePolling'
import { StatusBadge } from '../components/StatusBadge'

const STATUSES = ['', 'To Do', 'In Progress', 'Done', 'Blocked']
const PRIORITIES = ['', 'High', 'Medium', 'Low']

export function IssuesPage() {
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')

  const fetch = useCallback(
    () => fetchIssues({ status: status || undefined, priority: priority || undefined }),
    [status, priority]
  )
  const { data: issues, loading } = usePolling(fetch, 60000)

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-white">Jira Issues</h1>

      <div className="flex gap-4">
        <select
          value={status}
          onChange={e => setStatus(e.target.value)}
          className="bg-slate-700 text-slate-200 border border-slate-600 rounded-lg px-3 py-2 text-sm"
        >
          {STATUSES.map(s => <option key={s} value={s}>{s || 'All Statuses'}</option>)}
        </select>
        <select
          value={priority}
          onChange={e => setPriority(e.target.value)}
          className="bg-slate-700 text-slate-200 border border-slate-600 rounded-lg px-3 py-2 text-sm"
        >
          {PRIORITIES.map(p => <option key={p} value={p}>{p || 'All Priorities'}</option>)}
        </select>
      </div>

      {loading && <p className="text-slate-400">Loading...</p>}

      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-slate-400 text-left">
              <th className="px-4 py-3">Key</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Summary</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Assignee</th>
            </tr>
          </thead>
          <tbody>
            {issues?.map(i => (
              <tr key={i.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                <td className="px-4 py-3 font-mono text-blue-400">{i.jira_key}</td>
                <td className="px-4 py-3 text-slate-400">{i.issue_type ?? '—'}</td>
                <td className="px-4 py-3 text-slate-300 max-w-xs truncate">{i.summary}</td>
                <td className="px-4 py-3"><StatusBadge value={i.status} /></td>
                <td className="px-4 py-3">{i.priority ? <StatusBadge value={i.priority} /> : '—'}</td>
                <td className="px-4 py-3 text-slate-400">{i.assignee ?? 'Unassigned'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {issues?.length === 0 && (
          <p className="text-slate-400 text-center py-8">No issues found.</p>
        )}
      </div>
    </div>
  )
}
