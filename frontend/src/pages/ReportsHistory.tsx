import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchReports } from '../api/client'
import { usePolling } from '../hooks/usePolling'
import { StatusBadge } from '../components/StatusBadge'

export function ReportsHistory() {
  const [page, setPage] = useState(1)
  const fetch = useCallback(() => fetchReports(page), [page])
  const { data: reports, loading, error } = usePolling(fetch, 60000)

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-white">Report History</h1>

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {loading && <p className="text-slate-400">Loading...</p>}

      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-slate-400 text-left">
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Preview</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {reports?.map(r => (
              <tr key={r.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                <td className="px-4 py-3 text-slate-400">#{r.id}</td>
                <td className="px-4 py-3 text-white">{new Date(r.run_date).toLocaleString()}</td>
                <td className="px-4 py-3"><StatusBadge value={r.status} /></td>
                <td className="px-4 py-3 text-slate-400 truncate max-w-sm">
                  {r.pm_summary?.slice(0, 80) ?? '—'}
                </td>
                <td className="px-4 py-3">
                  <Link
                    to={`/reports/${r.id}`}
                    className="text-purple-400 hover:text-purple-300 font-medium"
                  >
                    View →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white text-sm rounded-lg"
        >
          Previous
        </button>
        <span className="text-slate-400 text-sm self-center">Page {page}</span>
        <button
          onClick={() => setPage(p => p + 1)}
          disabled={(reports?.length ?? 0) < 20}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white text-sm rounded-lg"
        >
          Next
        </button>
      </div>
    </div>
  )
}
