import { useEffect, useRef, useCallback, useState } from 'react'
import Phaser from 'phaser'
import { OfficeScene } from '../office/OfficeScene'
import { triggerRun, fetchRunStatus } from '../api/client'
import { getTasks, getSchedule } from '../api/personalClient'
import { Link } from 'react-router-dom'
import {
  speak,
  stopSpeech,
  setVoiceEnabled,
  isVoiceEnabled,
  buildLiveScript,
} from '../office/voice'

// ── Voice status indicator ───────────────────────────────────────────────────
function VoiceBar({ speaking, agent }: { speaking: boolean; agent: string }) {
  if (!speaking) return null
  const colors: Record<string, string> = {
    narrator: '#94a3b8',
    dev:      '#3b82f6',
    qa:       '#f59e0b',
    pm:       '#a855f7',
  }
  const color = colors[agent] ?? '#94a3b8'
  return (
    <div className="flex items-center gap-3 bg-slate-800/90 border rounded-xl px-4 py-2.5 backdrop-blur"
      style={{ borderColor: color + '60' }}>
      {/* Waveform bars */}
      <div className="flex items-end gap-0.5 h-5">
        {[1, 2, 3, 4, 3, 2, 1].map((h, i) => (
          <span key={i}
            className="w-1 rounded-full animate-pulse"
            style={{
              background: color,
              height: `${h * 20}%`,
              animationDelay: `${i * 80}ms`,
              minHeight: 3,
            }} />
        ))}
      </div>
      <span className="text-sm font-medium capitalize" style={{ color }}>
        {agent === 'narrator' ? '🔊 Narrator' :
         agent === 'dev' ? '👨‍💻 Alex (Dev)' :
         agent === 'qa'  ? '🔍 Sam (QA)' :
                           '📊 Jordan (PM)'}
        &nbsp;speaking...
      </span>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export function OfficePage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const gameRef      = useRef<Phaser.Game | null>(null)
  const sceneRef     = useRef<OfficeScene | null>(null)

  const [voiceOn,    setVoiceOn]    = useState(true)
  const [narrating,  setNarrating]  = useState(false)
  const [speaking,   setSpeaking]   = useState(false)
  const [activeAgent, setActiveAgent] = useState('narrator')
  const [running,    setRunning]    = useState(false)

  const handleRunNow = useCallback(async () => {
    if (running) return
    setRunning(true)
    // Trigger the in-scene standup animation
    sceneRef.current?.triggerStandup()
    try {
      const resp = await triggerRun()
      const poll = setInterval(async () => {
        const status = await fetchRunStatus(resp.report_id)
        if (status.status === 'completed' || status.status === 'failed') {
          clearInterval(poll)
          setRunning(false)
        }
      }, 5000)
    } catch (e) {
      console.error('Run failed:', e)
      setRunning(false)
    }
  }, [running])

  // Toggle voice on/off
  const toggleVoice = () => {
    const next = !voiceOn
    setVoiceOn(next)
    setVoiceEnabled(next)
    sceneRef.current?.setVoiceEnabled(next)
    if (!next) { stopSpeech(); setSpeaking(false) }
  }

  // Narrate live tasks + schedule
  const narrateWorkflow = async () => {
    if (narrating) { stopSpeech(); setNarrating(false); setSpeaking(false); return }
    if (!voiceOn) { setVoiceOn(true); setVoiceEnabled(true) }
    setNarrating(true)

    // Fetch real data
    const today = new Date().toISOString().slice(0, 10)
    const [tasks, schedule] = await Promise.all([
      getTasks().catch(() => []),
      getSchedule({ date_from: today, date_to: today }).catch(() => []),
    ])

    const script = buildLiveScript({ tasks, scheduleToday: schedule })

    for (const line of script) {
      if (!isVoiceEnabled()) break
      setSpeaking(true)
      setActiveAgent(line.agent)
      await speak(line.text, line.agent)
    }
    setSpeaking(false)
    setNarrating(false)
  }

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return

    const scene = new OfficeScene()
    scene.setRunCallback(handleRunNow)
    scene.setVoiceEnabled(voiceOn)
    sceneRef.current = scene

    gameRef.current = new Phaser.Game({
      type: Phaser.AUTO,
      width: 800,
      height: 520,
      backgroundColor: '#1a2035',
      parent: containerRef.current,
      scene: scene,
      antialias: true,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    })

    return () => {
      stopSpeech()
      gameRef.current?.destroy(true)
      gameRef.current = null
      sceneRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleRunNow])

  // Keep scene in sync if voiceOn changes after mount
  useEffect(() => {
    sceneRef.current?.setVoiceEnabled(voiceOn)
  }, [voiceOn])

  return (
    <div className="p-5 space-y-4"
      style={{ backgroundImage: 'radial-gradient(ellipse at 50% 0%, #1e1b4b18 0%, transparent 70%)' }}>

      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">🏢 Office Simulation</h1>
          <p className="text-slate-400 text-sm mt-1">
            AI agents hold a live standup, walk to their desks, and generate reports.
          </p>
        </div>
        <Link to="/" className="text-sm text-purple-400 hover:text-purple-300 mt-1">
          ← Dashboard
        </Link>
      </div>

      {/* ── Controls ── */}
      <div className="flex flex-wrap items-center gap-3">

        {/* Run Now */}
        <button
          onClick={handleRunNow}
          disabled={running}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
            running
              ? 'bg-purple-900/40 border-purple-700 text-purple-300 cursor-not-allowed'
              : 'bg-purple-600 border-purple-500 text-white hover:bg-purple-700 hover:border-purple-400'
          }`}
        >
          {running ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-purple-300 border-t-transparent rounded-full animate-spin" />
              Running...
            </>
          ) : (
            <>▶ Run Now</>
          )}
        </button>

        <div className="w-px h-6 bg-slate-700" />

        {/* Explain Workflow */}
        <button
          onClick={narrateWorkflow}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
            narrating
              ? 'bg-purple-900/60 border-purple-500 text-purple-200'
              : 'bg-slate-800 border-slate-600 text-white hover:border-purple-500 hover:bg-purple-900/30'
          }`}
        >
          {narrating ? (
            <>
              <span className="w-4 h-4 flex items-center justify-center">⏹</span>
              Stop Narration
            </>
          ) : (
            <>
              <span>🔊</span>
              Explain Workflow
            </>
          )}
        </button>

        {/* Voice on/off toggle */}
        <button
          onClick={toggleVoice}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${
            voiceOn
              ? 'bg-slate-700 border-slate-600 text-white'
              : 'bg-slate-900 border-slate-700 text-slate-500'
          }`}
        >
          {voiceOn ? '🔈 Voice On' : '🔇 Voice Off'}
        </button>

        {/* Speaking indicator */}
        <VoiceBar speaking={speaking} agent={activeAgent} />

        {/* Hint */}
        {!speaking && !narrating && (
          <p className="text-slate-600 text-xs ml-auto hidden lg:block">
            Tip: click "Run Now" in the simulation to hear agents speak during standup
          </p>
        )}
      </div>

      {/* ── Workflow explanation cards (shown while narrating) ── */}
      {narrating && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { id: 'dev', icon: '👨‍💻', name: 'Alex — Task Summary', color: '#3b82f6',
              desc: 'Reads your task list → Reports high-priority & overdue items → Highlights what\'s in progress' },
            { id: 'qa',  icon: '🔍', name: 'Sam — Schedule Check', color: '#f59e0b',
              desc: 'Reads today\'s calendar → Spots back-to-back meetings → Suggests time to protect' },
            { id: 'pm',  icon: '📊', name: 'Jordan — Daily Advice', color: '#a855f7',
              desc: 'Picks your #1 priority → Notices neglected categories → Gives one actionable focus' },
          ].map(a => (
            <div key={a.id}
              className="bg-slate-800/70 border rounded-xl p-4 backdrop-blur transition-all"
              style={{
                borderColor: activeAgent === a.id ? a.color : '#334155',
                boxShadow: activeAgent === a.id ? `0 0 20px ${a.color}30` : 'none',
              }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{a.icon}</span>
                <span className="text-white text-sm font-semibold">{a.name}</span>
                {activeAgent === a.id && (
                  <span className="ml-auto text-xs rounded-full px-2 py-0.5 font-medium"
                    style={{ background: a.color + '30', color: a.color }}>
                    speaking
                  </span>
                )}
              </div>
              <p className="text-slate-400 text-xs leading-relaxed">{a.desc}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Game canvas ── */}
      <div className="flex justify-center">
        <div
          className="rounded-2xl overflow-hidden border border-slate-700/60 shadow-2xl"
          style={{ width: 800, height: 520, boxShadow: '0 0 60px #7c3aed18' }}
          ref={containerRef}
        />
      </div>

      {/* ── Legend ── */}
      <div className="flex flex-wrap gap-5 justify-center text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block" /> Alex — Developer
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" /> Sam — QA Engineer
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-purple-500 inline-block" /> Jordan — Product Manager
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-green-800 inline-block" /> Meeting Table
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-indigo-700 inline-block" /> Sofa Lounge
        </span>
      </div>

    </div>
  )
}
