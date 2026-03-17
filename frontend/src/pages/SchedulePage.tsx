import { useState, useCallback } from 'react'
import { getSchedule, createEntry, deleteEntry, type ScheduleEntry, type EntryCreate } from '../api/personalClient'
import { usePolling } from '../hooks/usePolling'

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7) // 07:00 – 20:00

const CAT_COLORS: Record<string, string> = {
  work:     'bg-blue-900/70 border-blue-600/60 text-blue-200',
  personal: 'bg-purple-900/70 border-purple-600/60 text-purple-200',
  health:   'bg-emerald-900/70 border-emerald-600/60 text-emerald-200',
  learning: 'bg-amber-900/70 border-amber-600/60 text-amber-200',
  meeting:  'bg-red-900/70 border-red-600/60 text-red-200',
}

function pad(n: number) { return String(n).padStart(2, '0') }
function timeToMin(t: string) { const [h, m] = t.split(':').map(Number); return h * 60 + m }
function minToTime(m: number) { return `${pad(Math.floor(m / 60))}:${pad(m % 60)}` }

function CalendarColumn({ date, entries, onDelete }: {
  date: string; entries: ScheduleEntry[]; onDelete: (id: number) => void
}) {
  const d = new Date(date + 'T00:00:00')
  const isToday = date === new Date().toISOString().slice(0, 10)
  const dayName = d.toLocaleDateString('en', { weekday: 'short' })
  const dayNum  = d.getDate()

  return (
    <div className="flex-1 min-w-0">
      {/* Header */}
      <div className={`text-center py-2 mb-1 rounded-t-lg ${isToday ? 'bg-purple-800/40' : ''}`}>
        <p className="text-slate-400 text-xs uppercase">{dayName}</p>
        <p className={`text-lg font-bold ${isToday ? 'text-purple-300' : 'text-white'}`}>{dayNum}</p>
      </div>
      {/* Time slots */}
      <div className="relative" style={{ height: HOURS.length * 52 }}>
        {entries.map(e => {
          const top  = (timeToMin(e.start_time) - 7 * 60) / 60 * 52
          const h    = Math.max((timeToMin(e.end_time) - timeToMin(e.start_time)) / 60 * 52, 26)
          const col  = CAT_COLORS[e.category] ?? CAT_COLORS.personal
          return (
            <div key={e.id}
              className={`absolute left-1 right-1 rounded-lg border px-2 py-1 cursor-default group ${col}`}
              style={{ top, height: h }}>
              <p className="text-xs font-semibold leading-tight truncate">{e.title}</p>
              <p className="text-xs opacity-70">{e.start_time}–{e.end_time}</p>
              <button onClick={() => onDelete(e.id)}
                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-xs text-white/60 hover:text-white">✕</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AddEntryModal({ onSave, onCancel }: { onSave: (e: EntryCreate) => void; onCancel: () => void }) {
  const [form, setForm] = useState<EntryCreate>({
    title: '', date: new Date().toISOString().slice(0, 10),
    start_time: '09:00', end_time: '10:00', category: 'work',
  })
  const set = (k: keyof EntryCreate, v: string) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-600 rounded-2xl p-6 w-full max-w-md space-y-4">
        <h2 className="text-white font-semibold text-lg">Add Event</h2>
        <input value={form.title} onChange={e => set('title', e.target.value)}
          placeholder="Event title *"
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500" />
        <div className="grid grid-cols-3 gap-2">
          <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-white text-sm col-span-3 sm:col-span-1" />
          <input type="time" value={form.start_time} onChange={e => set('start_time', e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-white text-sm" />
          <input type="time" value={form.end_time} onChange={e => set('end_time', e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-white text-sm" />
        </div>
        <select value={form.category} onChange={e => set('category', e.target.value)}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-white text-sm">
          <option value="work">💼 Work</option>
          <option value="personal">🏠 Personal</option>
          <option value="health">💪 Health</option>
          <option value="learning">📚 Learning</option>
          <option value="meeting">📋 Meeting</option>
        </select>
        <textarea value={form.notes ?? ''} onChange={e => set('notes', e.target.value)}
          placeholder="Notes (optional)" rows={2}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-purple-500" />
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-slate-400 hover:text-white">Cancel</button>
          <button onClick={() => form.title.trim() && onSave({
            ...form,
            notes: form.notes?.trim() || undefined,
            recurring: form.recurring?.trim() || undefined,
          })}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg font-medium">Save</button>
        </div>
      </div>
    </div>
  )
}

export function SchedulePage() {
  const [weekOffset, setWeekOffset] = useState(0)
  const [showModal, setShowModal] = useState(false)

  // Compute week dates
  const today = new Date()
  const monday = new Date(today)
  monday.setDate(today.getDate() - today.getDay() + 1 + weekOffset * 7)
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d.toISOString().slice(0, 10)
  })

  const fetch = useCallback(() =>
    getSchedule({ date_from: weekDates[0], date_to: weekDates[6] }), [weekOffset])
  const { data: entries, refetch } = usePolling(fetch, 60000)

  const handleAdd = async (body: EntryCreate) => {
    await createEntry(body)
    setShowModal(false)
    refetch()
  }
  const handleDelete = async (id: number) => {
    await deleteEntry(id)
    refetch()
  }

  const monthLabel = monday.toLocaleDateString('en', { month: 'long', year: 'numeric' })

  return (
    <div className="p-5 space-y-4">
      {showModal && <AddEntryModal onSave={handleAdd} onCancel={() => setShowModal(false)} />}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">🗓 Schedule</h1>
          <p className="text-slate-400 text-sm mt-1">{monthLabel}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setWeekOffset(w => w - 1)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm hover:bg-slate-700">← Prev</button>
          <button onClick={() => setWeekOffset(0)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 text-slate-300 rounded-lg text-sm hover:bg-slate-700">Today</button>
          <button onClick={() => setWeekOffset(w => w + 1)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg text-sm hover:bg-slate-700">Next →</button>
          <button onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg font-semibold">+ Add Event</button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl overflow-hidden">
        {/* Time axis + columns */}
        <div className="flex">
          {/* Time labels */}
          <div className="w-12 shrink-0 pt-14">
            {HOURS.map(h => (
              <div key={h} className="h-[52px] flex items-start justify-end pr-2">
                <span className="text-slate-600 text-xs">{pad(h)}:00</span>
              </div>
            ))}
          </div>
          {/* Horizontal lines layer */}
          <div className="flex-1 relative overflow-x-auto">
            <div className="flex min-w-0">
              {weekDates.map(date => (
                <CalendarColumn
                  key={date} date={date}
                  entries={entries?.filter(e => e.date === date) ?? []}
                  onDelete={handleDelete}
                />
              ))}
            </div>
            {/* Grid lines */}
            <div className="absolute inset-0 pointer-events-none pt-[56px]">
              {HOURS.map(h => (
                <div key={h} className="h-[52px] border-t border-slate-700/30" />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 flex-wrap text-xs text-slate-500">
        {Object.entries(CAT_COLORS).map(([cat, cls]) => (
          <span key={cat} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-sm border ${cls}`} />
            {cat}
          </span>
        ))}
      </div>
    </div>
  )
}
