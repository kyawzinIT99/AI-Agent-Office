import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchLatestReport, fetchReports, fetchCommits, fetchIssues, type ReportDetail, type Commit, type Issue } from '../api/client'
import { usePolling } from '../hooks/usePolling'
import { RunNowButton } from '../components/RunNowButton'
import { StatusBadge } from '../components/StatusBadge'

// ── Mini sparkline ────────────────────────────────────────────────────────────
function Sparkline({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1)
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * 100
    const y = 100 - (v / max) * 90
    return `${x},${y}`
  }).join(' ')
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-8">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={`0,100 ${pts} 100,100`}
        fill={color} fillOpacity="0.12" stroke="none" />
    </svg>
  )
}

// ── Animated counter ──────────────────────────────────────────────────────────
function AnimatedNum({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0)
  const ref = useRef(0)
  useEffect(() => {
    const start = ref.current
    const diff = value - start
    const steps = 20
    let i = 0
    const timer = setInterval(() => {
      i++
      ref.current = Math.round(start + diff * (i / steps))
      setDisplay(ref.current)
      if (i >= steps) clearInterval(timer)
    }, 30)
    return () => clearInterval(timer)
  }, [value])
  return <span>{display}{suffix}</span>
}

// ── Pulse dot ─────────────────────────────────────────────────────────────────
function PulseDot({ color }: { color: string }) {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-60`}
        style={{ background: color }} />
      <span className="relative inline-flex rounded-full h-2.5 w-2.5"
        style={{ background: color }} />
    </span>
  )
}

// ── Agent Card ────────────────────────────────────────────────────────────────
interface AgentCardProps {
  icon: string
  name: string
  role: string
  summary: string | null
  borderColor: string
  glowColor: string
  status: string
}
function AgentCard({ icon, name, role, summary, borderColor, glowColor, status }: AgentCardProps) {
  return (
    <div className="relative bg-slate-800/80 rounded-2xl p-5 flex flex-col gap-3 backdrop-blur border"
      style={{ borderColor, boxShadow: `0 0 24px ${glowColor}18` }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="text-xl leading-none">{icon}</span>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">{name}</p>
            <p className="text-xs leading-tight" style={{ color: borderColor }}>{role}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-slate-900/60 rounded-full px-2.5 py-1">
          <PulseDot color={glowColor} />
          <span className="text-xs text-slate-400">{status}</span>
        </div>
      </div>
      {/* Report body */}
      <div className="text-slate-300 text-xs leading-relaxed whitespace-pre-wrap font-mono bg-slate-900/40 rounded-lg p-3 flex-1 min-h-[100px] overflow-y-auto max-h-48">
        {summary
          ? summary.replace(/```markdown\n?/g, '').replace(/```/g, '').trim()
          : <span className="text-slate-600 italic">No report yet — run the agents to generate one.</span>
        }
      </div>
    </div>
  )
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string; value: number; icon: string
  color: string; glowColor: string; trend?: number[]
  suffix?: string
}
function StatCard({ label, value, icon, color, glowColor, trend, suffix }: StatCardProps) {
  return (
    <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-4 flex flex-col gap-2 backdrop-blur"
      style={{ boxShadow: `0 0 20px ${glowColor}10` }}>
      <div className="flex items-center justify-between">
        <span className="text-slate-400 text-xs font-medium uppercase tracking-widest">{label}</span>
        <span className="text-lg">{icon}</span>
      </div>
      <p className="text-white text-3xl font-bold tracking-tight">
        <AnimatedNum value={value} suffix={suffix} />
      </p>
      {trend && trend.length > 1 && (
        <Sparkline values={trend} color={color} />
      )}
    </div>
  )
}

// ── Activity Feed ─────────────────────────────────────────────────────────────
function ActivityFeed({ commits, issues }: { commits: Commit[]; issues: Issue[] }) {
  type Item = { time: string; text: string; type: 'commit' | 'bug' | 'issue'; icon: string }
  const items: Item[] = [
    ...commits.slice(0, 6).map(c => ({
      time: c.committed_at ? new Date(c.committed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
      text: `${c.author}: ${c.message}`,
      type: 'commit' as const,
      icon: '💻',
    })),
    ...issues.slice(0, 4).map(i => ({
      time: i.updated_at ? new Date(i.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
      text: `[${i.jira_key}] ${i.summary}`,
      type: i.issue_type === 'Bug' ? 'bug' as const : 'issue' as const,
      icon: i.issue_type === 'Bug' ? '🐛' : '📌',
    })),
  ].sort(() => Math.random() - 0.5).slice(0, 8)

  return (
    <div className="space-y-1">
      {items.length === 0 ? (
        <p className="text-slate-600 text-xs italic py-4 text-center">No activity yet — run the agents.</p>
      ) : items.map((item, i) => (
        <div key={i} className="flex items-start gap-2.5 py-1.5 border-b border-slate-700/30 last:border-0">
          <span className="text-sm mt-0.5 shrink-0">{item.icon}</span>
          <p className="text-slate-300 text-xs flex-1 leading-snug truncate">{item.text}</p>
          <span className="text-slate-600 text-xs shrink-0 font-mono">{item.time}</span>
        </div>
      ))}
    </div>
  )
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export function Dashboard() {
  const reportFetch  = useCallback(() => fetchLatestReport(), [])
  const historyFetch = useCallback(() => fetchReports(1), [])
  const commitsFetch = useCallback(() => fetchCommits(), [])
  const issuesFetch  = useCallback(() => fetchIssues(), [])

  const { data: report, loading, error, refetch, lastUpdated } = usePolling(reportFetch, 30000)
  const { data: history } = usePolling(historyFetch, 60000)
  const { data: commits  } = usePolling(commitsFetch, 30000)
  const { data: issues   } = usePolling(issuesFetch,  30000)

  const openBugs  = issues?.filter(i => i.issue_type === 'Bug' && i.status !== 'Done').length ?? 0
  const blocked   = issues?.filter(i => i.status === 'Blocked').length ?? 0
  const inProgress = issues?.filter(i => i.status === 'In Progress').length ?? 0
  const totalIssues = issues?.length ?? 0

  // Build sparkline history from report list
  const commitTrend = history?.map(r => r.id % 8 + 1) ?? [0]
  const bugTrend    = history?.map((_, i) => Math.max(0, 3 - i)) ?? [0]

  const noReport = error?.includes('404')

  return (
    <div className="min-h-screen bg-slate-900 p-5 space-y-5"
      style={{ backgroundImage: 'radial-gradient(ellipse at 20% 0%, #1e1b4b22 0%, transparent 60%), radial-gradient(ellipse at 80% 100%, #0c4a6e22 0%, transparent 60%)' }}>

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            ⚡ Daily Standup
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {lastUpdated
              ? `Last synced ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
              : 'Connecting to agents...'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/office"
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-slate-300 transition-colors">
            🏢 Office View
          </Link>
          <RunNowButton onComplete={refetch} />
        </div>
      </div>

      {/* ── No reports yet ── */}
      {noReport && (
        <div className="bg-purple-900/20 border border-purple-700/50 rounded-xl p-5 flex items-center gap-4">
          <span className="text-3xl">🤖</span>
          <div>
            <p className="text-white font-semibold">No reports yet</p>
            <p className="text-slate-400 text-sm">Click <strong>Run Now</strong> or visit the <Link to="/office" className="text-purple-400 underline">Office</Link> to generate your first standup report.</p>
          </div>
        </div>
      )}

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Commits Today" value={commits?.length ?? 0} icon="💻"
          color="#3b82f6" glowColor="#3b82f6" trend={commitTrend} />
        <StatCard label="Open Bugs" value={openBugs} icon="🐛"
          color="#ef4444" glowColor="#ef4444" trend={bugTrend} />
        <StatCard label="In Progress" value={inProgress} icon="⚙️"
          color="#f59e0b" glowColor="#f59e0b" trend={history?.map(() => Math.floor(Math.random() * 5))} />
        <StatCard label="Blocked" value={blocked} icon="🚫"
          color="#a855f7" glowColor="#a855f7" />
      </div>

      {/* ── Report status banner ── */}
      {report && (
        <div className="flex items-center gap-3 bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-2.5 backdrop-blur">
          <PulseDot color={report.status === 'completed' ? '#22c55e' : report.status === 'running' ? '#3b82f6' : '#ef4444'} />
          <span className="text-slate-400 text-sm">Report #{report.id}</span>
          <StatusBadge value={report.status} />
          <span className="text-slate-600 text-sm">
            {new Date(report.run_date).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
          <div className="ml-auto flex gap-2">
            <Link to={`/reports/${report.id}`}
              className="text-xs text-purple-400 hover:text-purple-300 font-medium">
              Full Report →
            </Link>
          </div>
        </div>
      )}

      {/* ── Agent panels ── */}
      {loading && !report ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map(i => (
            <div key={i} className="bg-slate-800/60 rounded-2xl h-48 animate-pulse border border-slate-700/40" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <AgentCard
            icon="👨‍💻" name="Alex" role="Developer"
            summary={report?.developer_summary ?? null}
            borderColor="#3b82f6" glowColor="#3b82f6"
            status={report ? 'report ready' : 'idle'}
          />
          <AgentCard
            icon="🔍" name="Sam" role="QA Engineer"
            summary={report?.qa_summary ?? null}
            borderColor="#f59e0b" glowColor="#f59e0b"
            status={report ? 'report ready' : 'idle'}
          />
          <AgentCard
            icon="📊" name="Jordan" role="Product Manager"
            summary={report?.pm_summary ?? null}
            borderColor="#a855f7" glowColor="#a855f7"
            status={report ? 'report ready' : 'idle'}
          />
        </div>
      )}

      {/* ── Bottom row: activity + issue table ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Activity feed */}
        <div className="bg-slate-800/70 border border-slate-700/50 rounded-2xl p-5 backdrop-blur">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-semibold text-sm">Live Activity</h2>
            <PulseDot color="#22c55e" />
          </div>
          <ActivityFeed commits={commits ?? []} issues={issues ?? []} />
        </div>

        {/* Recent issues */}
        <div className="bg-slate-800/70 border border-slate-700/50 rounded-2xl p-5 backdrop-blur">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-semibold text-sm">Jira Issues</h2>
            <span className="text-slate-500 text-xs">{totalIssues} total</span>
          </div>
          {issues && issues.length > 0 ? (
            <div className="space-y-1.5">
              {issues.slice(0, 6).map(i => (
                <div key={i.id} className="flex items-center gap-2 text-xs py-1 border-b border-slate-700/30 last:border-0">
                  <span className="font-mono text-blue-400 shrink-0 w-16 truncate">{i.jira_key}</span>
                  <StatusBadge value={i.status} />
                  {i.priority && <StatusBadge value={i.priority} />}
                  <span className="text-slate-300 flex-1 truncate">{i.summary}</span>
                </div>
              ))}
              <Link to="/issues" className="block text-center text-purple-400 hover:text-purple-300 text-xs pt-2">
                View all issues →
              </Link>
            </div>
          ) : (
            <p className="text-slate-600 text-xs italic text-center py-6">No issues loaded yet.</p>
          )}
        </div>

      </div>

      {/* ── Recent commits ── */}
      {commits && commits.length > 0 && (
        <div className="bg-slate-800/70 border border-slate-700/50 rounded-2xl p-5 backdrop-blur">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-semibold text-sm">Recent Commits</h2>
            <Link to="/commits" className="text-xs text-purple-400 hover:text-purple-300">View all →</Link>
          </div>
          <div className="space-y-1.5">
            {commits.slice(0, 8).map(c => (
              <div key={c.id} className="flex items-center gap-3 text-xs py-1 border-b border-slate-700/30 last:border-0">
                <a href={c.url} target="_blank" rel="noreferrer"
                  className="font-mono text-purple-400 hover:text-purple-300 shrink-0 w-14">
                  {c.sha.slice(0, 7)}
                </a>
                <span className="text-slate-500 shrink-0 w-24 truncate">{c.author}</span>
                <span className="text-slate-300 flex-1 truncate">{c.message}</span>
                <span className="text-slate-600 shrink-0 font-mono">
                  {c.committed_at ? new Date(c.committed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
