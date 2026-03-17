/**
 * Voice engine — wraps Web Speech API (SpeechSynthesis).
 * No API key needed; runs entirely in the browser.
 */

export interface VoiceProfile {
  pitch: number   // 0.5 – 2.0
  rate:  number   // 0.5 – 2.0
  lang:  string
  // preferred voice name fragment (matched case-insensitive)
  prefer?: string
}

const PROFILES: Record<string, VoiceProfile> = {
  narrator: { pitch: 1.05, rate: 0.92, lang: 'en-US', prefer: 'Samantha' },
  dev:      { pitch: 1.1,  rate: 1.05, lang: 'en-US', prefer: 'Alex'     },
  qa:       { pitch: 1.3,  rate: 1.0,  lang: 'en-US', prefer: 'Karen'    },
  pm:       { pitch: 0.95, rate: 0.95, lang: 'en-US', prefer: 'Daniel'   },
}

let _enabled = true
let _voices: SpeechSynthesisVoice[] = []
let _ready = false

function _loadVoices() {
  _voices = window.speechSynthesis.getVoices()
  _ready = _voices.length > 0
}

// Voices load asynchronously in some browsers
_loadVoices()
if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = _loadVoices
}

function _pickVoice(profile: VoiceProfile): SpeechSynthesisVoice | null {
  if (!_voices.length) _loadVoices()
  if (profile.prefer) {
    const match = _voices.find(v =>
      v.name.toLowerCase().includes(profile.prefer!.toLowerCase()) &&
      v.lang.startsWith(profile.lang.split('-')[0])
    )
    if (match) return match
  }
  return _voices.find(v => v.lang.startsWith(profile.lang.split('-')[0])) ?? _voices[0] ?? null
}

export function setVoiceEnabled(on: boolean) {
  _enabled = on
  if (!on) window.speechSynthesis.cancel()
}

export function isVoiceEnabled() { return _enabled }

/**
 * Speak text with a given agent profile.
 * Returns a Promise that resolves when speaking finishes (or immediately if disabled).
 */
export function speak(text: string, agentId: keyof typeof PROFILES = 'narrator'): Promise<void> {
  if (!_enabled || !window.speechSynthesis) return Promise.resolve()

  // Clean markdown symbols for clean speech
  const clean = text
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/`/g, '')
    .replace(/[-•]\s/g, '. ')
    .replace(/\n+/g, '. ')
    .replace(/\s{2,}/g, ' ')
    .trim()

  return new Promise(resolve => {
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(clean)
    const profile = PROFILES[agentId] ?? PROFILES.narrator
    const voice = _pickVoice(profile)
    if (voice) utter.voice = voice
    utter.pitch = profile.pitch
    utter.rate  = profile.rate
    utter.lang  = profile.lang
    utter.onend = () => resolve()
    utter.onerror = () => resolve()
    window.speechSynthesis.speak(utter)
  })
}

export function stopSpeech() {
  window.speechSynthesis?.cancel()
}

export interface LiveData {
  tasks: Array<{
    title: string
    priority: string
    status: string
    category: string
    due_date?: string | null
  }>
  scheduleToday: Array<{
    title: string
    start_time: string
    end_time: string
    category: string
  }>
}

/** Build a personalised narration script from real tasks + schedule */
export function buildLiveScript(data: LiveData) {
  const today = new Date().toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })
  const { tasks, scheduleToday } = data

  // ── Narrator: greeting + date ──────────────────────────────────────────────
  const greeting = `Good ${_timeOfDay()}! Today is ${today}.`

  // ── Alex (Dev): task summary ───────────────────────────────────────────────
  const highTasks   = tasks.filter(t => t.priority === 'high'   && t.status !== 'done')
  const blocked     = tasks.filter(t => t.status === 'blocked')
  const inProgress  = tasks.filter(t => t.status === 'in_progress')
  const overdue     = tasks.filter(t => t.due_date && t.status !== 'done' && new Date(t.due_date) < new Date())
  const totalActive = tasks.filter(t => t.status !== 'done').length

  let devText = `Hi, I'm Alex. `
  if (tasks.length === 0) {
    devText += `Your task list is empty — a great time to add today's goals!`
  } else {
    devText += `You have ${totalActive} active task${totalActive !== 1 ? 's' : ''}.`
    if (highTasks.length) devText += ` ${highTasks.length} high-priority item${highTasks.length > 1 ? 's' : ''}: ${highTasks.slice(0, 2).map(t => t.title).join(', ')}.`
    if (inProgress.length) devText += ` Currently in progress: ${inProgress.map(t => t.title).slice(0, 2).join(' and ')}.`
    if (overdue.length)    devText += ` Watch out — ${overdue.length} task${overdue.length > 1 ? 's are' : ' is'} overdue.`
    if (blocked.length)    devText += ` ${blocked.length} task${blocked.length > 1 ? 's are' : ' is'} blocked and need attention.`
  }

  // ── Sam (QA): schedule summary ─────────────────────────────────────────────
  let qaText = `Hey, I'm Sam. `
  if (scheduleToday.length === 0) {
    qaText += `Your calendar is clear today — no events scheduled. Consider blocking time for focused work.`
  } else {
    const sorted = [...scheduleToday].sort((a, b) => a.start_time.localeCompare(b.start_time))
    qaText += `You have ${scheduleToday.length} event${scheduleToday.length > 1 ? 's' : ''} today. `
    const first = sorted[0]
    qaText += `Your day starts with "${first.title}" at ${_readableTime(first.start_time)}.`
    if (sorted.length > 1) {
      const last = sorted[sorted.length - 1]
      qaText += ` It wraps up with "${last.title}" ending at ${_readableTime(last.end_time)}.`
    }
    const meetings = sorted.filter(e => e.category === 'meeting')
    if (meetings.length) qaText += ` You have ${meetings.length} meeting${meetings.length > 1 ? 's' : ''} — protect time around them for prep and recovery.`
  }

  // ── Jordan (PM): priorities + advice ──────────────────────────────────────
  let pmText = `And I'm Jordan. `
  if (tasks.length === 0 && scheduleToday.length === 0) {
    pmText += `Your slate is clean — a perfect moment to plan the week ahead and set your top 3 goals.`
  } else {
    const workTasks    = tasks.filter(t => t.category === 'work'     && t.status !== 'done')
    const healthTasks  = tasks.filter(t => t.category === 'health'   && t.status !== 'done')
    const learningTask = tasks.filter(t => t.category === 'learning' && t.status !== 'done')
    if (highTasks.length) {
      pmText += `My top recommendation: focus on "${highTasks[0].title}" first — it's your highest priority.`
    } else if (inProgress.length) {
      pmText += `Keep momentum on "${inProgress[0].title}" — finishing in-progress work beats starting new tasks.`
    } else {
      pmText += `No critical fires today. Use the time for deep work or planning.`
    }
    if (healthTasks.length === 0 && workTasks.length > 2) {
      pmText += ` Also — you have no health tasks. Don't forget to move your body today.`
    }
    if (learningTask.length) {
      pmText += ` You have ${learningTask.length} learning task${learningTask.length > 1 ? 's' : ''} — even 20 minutes of focused study compounds over time.`
    }
  }

  // ── Narrator: close ────────────────────────────────────────────────────────
  const doneTasks = tasks.filter(t => t.status === 'done').length
  let closing = `That's your briefing for today. `
  if (doneTasks > 0) closing += `You've already completed ${doneTasks} task${doneTasks > 1 ? 's' : ''} — great work! `
  closing += `Head to the Briefing page for a full AI-written plan. Have a productive day!`

  return [
    { agent: 'narrator' as const, text: greeting },
    { agent: 'dev'      as const, text: devText  },
    { agent: 'qa'       as const, text: qaText   },
    { agent: 'pm'       as const, text: pmText   },
    { agent: 'narrator' as const, text: closing  },
  ]
}

function _timeOfDay(): string {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

function _readableTime(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour   = h % 12 || 12
  return m === 0 ? `${hour} ${suffix}` : `${hour}:${String(m).padStart(2, '0')} ${suffix}`
}
