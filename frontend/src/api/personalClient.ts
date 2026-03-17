import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
  timeout: 30000,
})

// ── Types ─────────────────────────────────────────────────────────────────────
export type Priority = 'high' | 'medium' | 'low'
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'blocked'
export type Category = 'work' | 'personal' | 'health' | 'learning'

export interface PersonalTask {
  id:                number
  title:             string
  description:       string | null
  priority:          Priority
  category:          Category
  status:            TaskStatus
  due_date:          string | null
  estimated_minutes: number | null
  notes:             string | null
  created_at:        string
  updated_at:        string
}

export interface TaskCreate {
  title:             string
  description?:      string
  priority?:         Priority
  category?:         Category
  status?:           TaskStatus
  due_date?:         string
  estimated_minutes?: number
  notes?:            string
}

export interface ScheduleEntry {
  id:         number
  title:      string
  date:       string
  start_time: string
  end_time:   string
  category:   string
  notes:      string | null
  recurring:  string | null
  task_id:    number | null
}

export interface EntryCreate {
  title:      string
  date:       string
  start_time: string
  end_time:   string
  category?:  string
  notes?:     string
  recurring?: string
  task_id?:   number
}

export interface Briefing {
  id:               number
  briefing_date:    string
  status:           string
  planner_output:   string | null
  scheduler_output: string | null
  coach_output:     string | null
  combined_output:  string | null
  error_message:    string | null
}

// ── Tasks ──────────────────────────────────────────────────────────────────
export const getTasks  = (params?: Record<string, string>) =>
  api.get<PersonalTask[]>('/tasks', { params }).then(r => r.data)
export const createTask = (body: TaskCreate) =>
  api.post<PersonalTask>('/tasks', body).then(r => r.data)
export const updateTask = (id: number, body: Partial<TaskCreate> & { status?: TaskStatus }) =>
  api.patch<PersonalTask>(`/tasks/${id}`, body).then(r => r.data)
export const deleteTask = (id: number) =>
  api.delete(`/tasks/${id}`)

// ── Schedule ───────────────────────────────────────────────────────────────
export const getSchedule = (params?: { date_from?: string; date_to?: string }) =>
  api.get<ScheduleEntry[]>('/schedule', { params }).then(r => r.data)
export const createEntry = (body: EntryCreate) =>
  api.post<ScheduleEntry>('/schedule', body).then(r => r.data)
export const deleteEntry = (id: number) =>
  api.delete(`/schedule/${id}`)

// ── Briefing ───────────────────────────────────────────────────────────────
export const getLatestBriefing = () =>
  api.get<Briefing>('/briefing/latest').then(r => r.data)
export const runBriefing = () =>
  api.post<{ status: string; briefing_id: number }>('/briefing/run').then(r => r.data)
export const getBriefingStatus = (id: number) =>
  api.get<{ briefing_id: number; status: string; error_message: string | null }>(`/briefing/status/${id}`).then(r => r.data)
