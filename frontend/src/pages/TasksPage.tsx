import { useState, useCallback } from 'react'
import { getTasks, createTask, updateTask, deleteTask, type PersonalTask, type TaskCreate, type Priority, type TaskStatus, type Category } from '../api/personalClient'
import { usePolling } from '../hooks/usePolling'

const PRIORITY_COLORS: Record<string, string> = {
  high:   'text-red-400 bg-red-900/30 border-red-700/50',
  medium: 'text-yellow-400 bg-yellow-900/30 border-yellow-700/50',
  low:    'text-slate-400 bg-slate-800 border-slate-700',
}
const STATUS_COLORS: Record<string, string> = {
  todo:        'bg-slate-700 text-slate-300',
  in_progress: 'bg-blue-900/60 text-blue-300',
  done:        'bg-emerald-900/60 text-emerald-300',
  blocked:     'bg-red-900/60 text-red-300',
}
const CATEGORY_ICONS: Record<string, string> = {
  work: '💼', personal: '🏠', health: '💪', learning: '📚',
}

const EMPTY: TaskCreate = {
  title: '', description: '', priority: 'medium',
  category: 'personal', status: 'todo', due_date: '', estimated_minutes: undefined,
}

/** Strip empty strings / undefined so the backend never sees "" for optional fields */
function cleanForm(form: TaskCreate): TaskCreate {
  return {
    ...form,
    description:       form.description?.trim()   || undefined,
    due_date:          form.due_date?.trim()        || undefined,
    notes:             form.notes?.trim()           || undefined,
    estimated_minutes: form.estimated_minutes || undefined,
  }
}

function TaskForm({ onSave, onCancel }: { onSave: (t: TaskCreate) => void; onCancel: () => void }) {
  const [form, setForm] = useState<TaskCreate>(EMPTY)
  const set = (k: keyof TaskCreate, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="bg-slate-800 border border-slate-600 rounded-xl p-5 space-y-3">
      <input value={form.title} onChange={e => set('title', e.target.value)}
        placeholder="Task title *" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500" />
      <textarea value={form.description ?? ''} onChange={e => set('description', e.target.value)}
        placeholder="Description (optional)" rows={2}
        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500 resize-none" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <select value={form.priority} onChange={e => set('priority', e.target.value as Priority)}
          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-white text-sm">
          <option value="high">🔴 High</option>
          <option value="medium">🟡 Medium</option>
          <option value="low">⚪ Low</option>
        </select>
        <select value={form.category} onChange={e => set('category', e.target.value as Category)}
          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-white text-sm">
          <option value="work">💼 Work</option>
          <option value="personal">🏠 Personal</option>
          <option value="health">💪 Health</option>
          <option value="learning">📚 Learning</option>
        </select>
        <input type="date" value={form.due_date ?? ''} onChange={e => set('due_date', e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-white text-sm" />
        <input type="number" value={form.estimated_minutes ?? ''} onChange={e => set('estimated_minutes', Number(e.target.value) || undefined)}
          placeholder="Est. minutes"
          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-white text-sm" />
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-4 py-2 text-sm text-slate-400 hover:text-white">Cancel</button>
        <button onClick={() => form.title.trim() && onSave(cleanForm(form))}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg font-medium">
          Add Task
        </button>
      </div>
    </div>
  )
}

function TaskRow({ task, onStatusChange, onDelete }: {
  task: PersonalTask
  onStatusChange: (id: number, s: TaskStatus) => void
  onDelete: (id: number) => void
}) {
  const isOverdue = task.due_date && task.status !== 'done' && new Date(task.due_date) < new Date()

  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
      task.status === 'done'
        ? 'border-slate-800 opacity-50'
        : `border-slate-700/60 hover:border-slate-600`
    }`}>
      {/* Status toggle */}
      <button
        onClick={() => onStatusChange(task.id, task.status === 'done' ? 'todo' : 'done')}
        className={`mt-0.5 w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${
          task.status === 'done' ? 'bg-emerald-600 border-emerald-600' : 'border-slate-600 hover:border-purple-500'
        }`}>
        {task.status === 'done' && <span className="text-white text-xs">✓</span>}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-medium ${task.status === 'done' ? 'line-through text-slate-500' : 'text-white'}`}>
            {task.title}
          </span>
          <span className="text-xs">{CATEGORY_ICONS[task.category]}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded border ${PRIORITY_COLORS[task.priority]}`}>
            {task.priority}
          </span>
          <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_COLORS[task.status]}`}>
            {task.status.replace('_', ' ')}
          </span>
          {isOverdue && <span className="text-xs text-red-400 font-medium">⚠ overdue</span>}
        </div>
        {task.description && (
          <p className="text-slate-400 text-xs mt-0.5 truncate">{task.description}</p>
        )}
        <div className="flex gap-3 mt-1 text-xs text-slate-600">
          {task.due_date && <span>📅 {task.due_date}</span>}
          {task.estimated_minutes && <span>⏱ {task.estimated_minutes}min</span>}
        </div>
      </div>

      {/* Status cycle button */}
      <select
        value={task.status}
        onChange={e => onStatusChange(task.id, e.target.value as TaskStatus)}
        className="bg-slate-900 border border-slate-700 rounded text-xs text-slate-300 px-1 py-1 shrink-0">
        <option value="todo">To Do</option>
        <option value="in_progress">In Progress</option>
        <option value="done">Done</option>
        <option value="blocked">Blocked</option>
      </select>

      <button onClick={() => onDelete(task.id)} className="text-slate-700 hover:text-red-400 text-sm shrink-0">✕</button>
    </div>
  )
}

export function TasksPage() {
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState<string>('')
  const [catFilter, setCatFilter] = useState<string>('')

  const fetch = useCallback(() => getTasks(), [])
  const { data: tasks, refetch } = usePolling(fetch, 60000)

  const handleCreate = async (body: TaskCreate) => {
    await createTask(body)
    setShowForm(false)
    refetch()
  }

  const handleStatus = async (id: number, status: TaskStatus) => {
    await updateTask(id, { status })
    refetch()
  }

  const handleDelete = async (id: number) => {
    await deleteTask(id)
    refetch()
  }

  const filtered = tasks?.filter(t => {
    if (filter && t.status !== filter) return false
    if (catFilter && t.category !== catFilter) return false
    return true
  }) ?? []

  const stats = {
    total:   tasks?.length ?? 0,
    done:    tasks?.filter(t => t.status === 'done').length ?? 0,
    blocked: tasks?.filter(t => t.status === 'blocked').length ?? 0,
    overdue: tasks?.filter(t => t.due_date && t.status !== 'done' && new Date(t.due_date) < new Date()).length ?? 0,
  }

  return (
    <div className="p-5 space-y-5 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">📝 My Tasks</h1>
          <p className="text-slate-400 text-sm mt-1">
            {stats.done}/{stats.total} done
            {stats.overdue > 0 && <span className="text-red-400 ml-2">· {stats.overdue} overdue</span>}
            {stats.blocked > 0 && <span className="text-yellow-400 ml-2">· {stats.blocked} blocked</span>}
          </p>
        </div>
        <button onClick={() => setShowForm(s => !s)}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-xl font-semibold transition-all">
          + Add Task
        </button>
      </div>

      {/* Progress bar */}
      {stats.total > 0 && (
        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full transition-all"
            style={{ width: `${(stats.done / stats.total) * 100}%` }} />
        </div>
      )}

      {showForm && <TaskForm onSave={handleCreate} onCancel={() => setShowForm(false)} />}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {['', 'todo', 'in_progress', 'done', 'blocked'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1 text-xs rounded-full border transition-all ${
              filter === s ? 'bg-purple-600 border-purple-500 text-white' : 'border-slate-700 text-slate-400 hover:border-slate-500'
            }`}>
            {s || 'All'}
          </button>
        ))}
        <div className="h-5 w-px bg-slate-700 self-center" />
        {['', 'work', 'personal', 'health', 'learning'].map(c => (
          <button key={c} onClick={() => setCatFilter(c)}
            className={`px-3 py-1 text-xs rounded-full border transition-all ${
              catFilter === c ? 'bg-blue-700 border-blue-500 text-white' : 'border-slate-700 text-slate-400 hover:border-slate-500'
            }`}>
            {c ? `${CATEGORY_ICONS[c]} ${c}` : 'All categories'}
          </button>
        ))}
      </div>

      {/* Task list */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-600">
            <p className="text-4xl mb-3">📭</p>
            <p>No tasks yet. Add one above!</p>
          </div>
        ) : filtered.map(t => (
          <TaskRow key={t.id} task={t} onStatusChange={handleStatus} onDelete={handleDelete} />
        ))}
      </div>
    </div>
  )
}
