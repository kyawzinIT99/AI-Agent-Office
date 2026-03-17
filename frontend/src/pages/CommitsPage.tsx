import { useCallback } from 'react'
import { fetchCommits } from '../api/client'
import { usePolling } from '../hooks/usePolling'

export function CommitsPage() {
  const fetch = useCallback(() => fetchCommits(), [])
  const { data: commits, loading } = usePolling(fetch, 60000)

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-white">All Commits</h1>

      {loading && <p className="text-slate-400">Loading...</p>}

      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-slate-400 text-left">
              <th className="px-4 py-3">SHA</th>
              <th className="px-4 py-3">Author</th>
              <th className="px-4 py-3">Message</th>
              <th className="px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {commits?.map(c => (
              <tr key={c.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                <td className="px-4 py-3">
                  <a href={c.url} target="_blank" rel="noreferrer" className="font-mono text-purple-400 hover:text-purple-300">
                    {c.sha.slice(0, 7)}
                  </a>
                </td>
                <td className="px-4 py-3 text-slate-300">{c.author}</td>
                <td className="px-4 py-3 text-slate-300 max-w-md truncate">{c.message}</td>
                <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                  {c.committed_at ? new Date(c.committed_at).toLocaleString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {commits?.length === 0 && (
          <p className="text-slate-400 text-center py-8">No commits yet.</p>
        )}
      </div>
    </div>
  )
}
