import { useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { fetchReport } from '../api/client'
import { usePolling } from '../hooks/usePolling'
import { StatusBadge } from '../components/StatusBadge'
import { AgentPanel } from '../components/AgentPanel'

export function ReportDetailPage() {
  const { id } = useParams<{ id: string }>()
  const fetch = useCallback(() => fetchReport(Number(id)), [id])
  const { data: report, loading } = usePolling(fetch, 10000)

  if (loading) return <div className="p-6 text-slate-400">Loading report...</div>
  if (!report) return <div className="p-6 text-slate-400">Report not found.</div>

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/reports" className="text-slate-400 hover:text-white text-sm">← Back</Link>
        <h1 className="text-2xl font-bold text-white">Report #{report.id}</h1>
        <StatusBadge value={report.status} />
        <span className="text-slate-400 text-sm ml-auto">{new Date(report.run_date).toLocaleString()}</span>
      </div>

      {report.error_message && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-300 text-sm">
          {report.error_message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <AgentPanel role="Developer" icon="👨‍💻" summary={report.developer_summary} color="border-blue-700" />
        <AgentPanel role="QA Engineer" icon="🔍" summary={report.qa_summary} color="border-yellow-700" />
        <AgentPanel role="Product Manager" icon="📊" summary={report.pm_summary} color="border-purple-700" />
      </div>

      {report.commits.length > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-3">Commits ({report.commits.length})</h2>
          <div className="space-y-2">
            {report.commits.map(c => (
              <div key={c.id} className="flex items-start gap-3 text-sm">
                <a href={c.url} target="_blank" rel="noreferrer" className="font-mono text-purple-400 hover:text-purple-300 shrink-0">{c.sha.slice(0, 7)}</a>
                <span className="text-slate-400 shrink-0">{c.author}</span>
                <span className="text-slate-300">{c.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {report.issues.length > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-3">Issues ({report.issues.length})</h2>
          <div className="space-y-2">
            {report.issues.map(i => (
              <div key={i.id} className="flex items-center gap-3 text-sm">
                <span className="font-mono text-blue-400 shrink-0">{i.jira_key}</span>
                <StatusBadge value={i.status} />
                {i.priority && <StatusBadge value={i.priority} />}
                <span className="text-slate-300 flex-1">{i.summary}</span>
                <span className="text-slate-500 shrink-0">{i.assignee ?? 'Unassigned'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
