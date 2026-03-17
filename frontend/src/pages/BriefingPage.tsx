import { useCallback, useState, useRef } from 'react'
import { getLatestBriefing, runBriefing, getBriefingStatus } from '../api/personalClient'
import { usePolling } from '../hooks/usePolling'
import { speak, stopSpeech, setVoiceEnabled } from '../office/voice'

// ── Markdown renderer (no extra dep — simple regex) ──────────────────────────
function Md({ text }: { text: string }) {
  const lines = text
    .replace(/```markdown\n?/g, '').replace(/```/g, '')
    .split('\n')
  return (
    <div className="space-y-1 text-sm leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith('## ')) return <h3 key={i} className="text-white font-semibold mt-3 mb-1 text-base">{line.slice(3)}</h3>
        if (line.startsWith('# '))  return <h2 key={i} className="text-white font-bold mt-4 mb-2 text-lg">{line.slice(2)}</h2>
        if (line.startsWith('- '))  return <li key={i} className="text-slate-300 ml-4 list-disc">{line.slice(2).replace(/\*\*(.*?)\*\*/g, '$1')}</li>
        if (line.match(/^\d+\. /)) return <li key={i} className="text-slate-300 ml-4 list-decimal">{line.replace(/^\d+\. /, '').replace(/\*\*(.*?)\*\*/g, '$1')}</li>
        if (line.trim() === '')   return <div key={i} className="h-1" />
        return <p key={i} className="text-slate-300">{line.replace(/\*\*(.*?)\*\*/g, '$1')}</p>
      })}
    </div>
  )
}

// ── Agent panel ───────────────────────────────────────────────────────────────
function BriefPanel({ icon, title, content, color, onSpeak, speaking }: {
  icon: string; title: string; content: string | null
  color: string; onSpeak: () => void; speaking: boolean
}) {
  return (
    <div className="bg-slate-800/80 border rounded-2xl p-5 flex flex-col gap-3 backdrop-blur"
      style={{ borderColor: color + '60', boxShadow: speaking ? `0 0 24px ${color}30` : 'none' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          <h3 className="text-white font-semibold">{title}</h3>
        </div>
        <button onClick={onSpeak}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
            speaking
              ? 'text-white border-current animate-pulse'
              : 'text-slate-400 border-slate-700 hover:border-slate-500 hover:text-white'
          }`}
          style={speaking ? { borderColor: color, color } : {}}>
          {speaking ? '⏹ Stop' : '🔊 Read'}
        </button>
      </div>
      <div className="overflow-y-auto max-h-64 pr-1">
        {content ? <Md text={content} /> : (
          <p className="text-slate-600 italic text-sm">Run a briefing to see this section.</p>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function BriefingPage() {
  const [running, setRunning] = useState(false)
  const [speakingPanel, setSpeakingPanel] = useState<string | null>(null)
  const [voiceOn] = useState(true)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetch = useCallback(() => getLatestBriefing(), [])
  const { data: briefing, refetch, error } = usePolling(fetch, 30000)

  const triggerBriefing = async () => {
    if (running) return
    setRunning(true)
    try {
      const resp = await runBriefing()
      pollRef.current = setInterval(async () => {
        const s = await getBriefingStatus(resp.briefing_id)
        if (s.status === 'completed' || s.status === 'failed') {
          clearInterval(pollRef.current!)
          setRunning(false)
          refetch()
        }
      }, 5000)
    } catch {
      setRunning(false)
    }
  }

  const readPanel = async (text: string | null, agentId: 'dev' | 'qa' | 'pm' | 'narrator', panelKey: string) => {
    if (speakingPanel === panelKey) {
      stopSpeech()
      setSpeakingPanel(null)
      return
    }
    if (!text) return
    setVoiceEnabled(voiceOn)
    setSpeakingPanel(panelKey)
    await speak(text, agentId)
    setSpeakingPanel(null)
  }

  const readAll = async () => {
    if (speakingPanel === 'all') { stopSpeech(); setSpeakingPanel(null); return }
    if (!briefing) return
    setSpeakingPanel('all')
    setVoiceEnabled(true)
    await speak("Here is your daily personal briefing.", 'narrator')
    if (briefing.planner_output)   await speak(briefing.planner_output,   'dev')
    if (briefing.scheduler_output) await speak(briefing.scheduler_output, 'qa')
    if (briefing.coach_output)     await speak(briefing.coach_output,     'pm')
    setSpeakingPanel(null)
  }

  const noData = error?.includes('404')
  const todayStr = new Date().toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="p-5 space-y-5"
      style={{ backgroundImage: 'radial-gradient(ellipse at 40% 0%, #1e1b4b20 0%, transparent 60%)' }}>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">🤖 Daily Briefing</h1>
          <p className="text-slate-400 text-sm mt-1">{todayStr}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {briefing && (
            <button onClick={readAll}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                speakingPanel === 'all'
                  ? 'bg-purple-900/50 border-purple-500 text-purple-200 animate-pulse'
                  : 'bg-slate-800 border-slate-600 text-white hover:border-purple-500'
              }`}>
              {speakingPanel === 'all' ? '⏹ Stop' : '🔊 Read All'}
            </button>
          )}
          <button onClick={triggerBriefing} disabled={running}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              running
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                : 'bg-purple-600 hover:bg-purple-700 text-white'
            }`}>
            {running ? (
              <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Agents working...</>
            ) : '▶ Run Briefing'}
          </button>
        </div>
      </div>

      {/* Running indicator */}
      {running && (
        <div className="flex items-center gap-4 bg-slate-800/70 border border-purple-700/40 rounded-xl p-4 backdrop-blur">
          <div className="flex gap-1">
            {['#3b82f6', '#f59e0b', '#a855f7'].map((c, i) => (
              <span key={i} className="w-2 h-2 rounded-full animate-bounce"
                style={{ background: c, animationDelay: `${i * 150}ms` }} />
            ))}
          </div>
          <div>
            <p className="text-white text-sm font-medium">AI agents are analyzing your tasks and schedule...</p>
            <p className="text-slate-400 text-xs">Planner → Scheduler → Coach (takes ~30–60 seconds)</p>
          </div>
        </div>
      )}

      {/* No briefing yet */}
      {noData && !running && (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-10 text-center">
          <p className="text-5xl mb-4">🌅</p>
          <p className="text-white font-semibold text-lg mb-2">Start your day with an AI briefing</p>
          <p className="text-slate-400 text-sm mb-5">
            Add tasks and schedule entries, then click <strong>Run Briefing</strong>.<br />
            Three agents will analyze your day and give you a personalized plan.
          </p>
          <button onClick={triggerBriefing}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-semibold transition-all">
            ▶ Run My First Briefing
          </button>
        </div>
      )}

      {/* Briefing panels */}
      {briefing && (
        <>
          <div className="flex items-center gap-3 bg-slate-800/50 border border-slate-700/40 rounded-xl px-4 py-2.5">
            <span className="text-emerald-400 text-sm">●</span>
            <span className="text-slate-400 text-sm">
              Briefing for <strong className="text-white">
                {new Date(briefing.briefing_date + 'T00:00:00').toLocaleDateString('en', { weekday: 'long', month: 'short', day: 'numeric' })}
              </strong>
            </span>
            <span className="ml-auto text-xs text-slate-600">
              {briefing.status === 'completed' ? '✓ complete' : briefing.status}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <BriefPanel
              icon="📋" title="Planner — Alex" color="#3b82f6"
              content={briefing.planner_output}
              speaking={speakingPanel === 'planner'}
              onSpeak={() => readPanel(briefing.planner_output, 'dev', 'planner')}
            />
            <BriefPanel
              icon="🗓" title="Scheduler — Sam" color="#f59e0b"
              content={briefing.scheduler_output}
              speaking={speakingPanel === 'scheduler'}
              onSpeak={() => readPanel(briefing.scheduler_output, 'qa', 'scheduler')}
            />
            <BriefPanel
              icon="🎯" title="Coach — Jordan" color="#a855f7"
              content={briefing.coach_output}
              speaking={speakingPanel === 'coach'}
              onSpeak={() => readPanel(briefing.coach_output, 'pm', 'coach')}
            />
          </div>
        </>
      )}
    </div>
  )
}
