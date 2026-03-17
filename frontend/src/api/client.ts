import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
  timeout: 30000,
})

export interface Commit {
  id: number
  sha: string
  author: string
  message: string
  url: string
  committed_at: string | null
}

export interface Issue {
  id: number
  jira_key: string
  summary: string
  status: string
  assignee: string | null
  priority: string | null
  issue_type: string | null
  updated_at: string | null
}

export interface ReportSummary {
  id: number
  run_date: string
  status: string
  pm_summary: string | null
}

export interface ReportDetail extends ReportSummary {
  developer_summary: string | null
  qa_summary: string | null
  combined_output: string | null
  error_message: string | null
  created_at: string
  commits: Commit[]
  issues: Issue[]
}

export interface RunResponse {
  status: string
  report_id: number
  message: string
}

export interface RunStatus {
  report_id: number
  status: string
  error_message: string | null
}

export const fetchLatestReport = (): Promise<ReportDetail> =>
  api.get<ReportDetail>('/reports/latest').then(r => r.data)

export const fetchReports = (page = 1): Promise<ReportSummary[]> =>
  api.get<ReportSummary[]>('/reports', { params: { page, limit: 20 } }).then(r => r.data)

export const fetchReport = (id: number): Promise<ReportDetail> =>
  api.get<ReportDetail>(`/reports/${id}`).then(r => r.data)

export const fetchCommits = (reportId?: number): Promise<Commit[]> =>
  api.get<Commit[]>('/commits', { params: { report_id: reportId } }).then(r => r.data)

export const fetchIssues = (params?: { report_id?: number; status?: string; priority?: string }): Promise<Issue[]> =>
  api.get<Issue[]>('/issues', { params }).then(r => r.data)

export const triggerRun = (): Promise<RunResponse> =>
  api.post<RunResponse>('/run/now').then(r => r.data)

export const fetchRunStatus = (reportId: number): Promise<RunStatus> =>
  api.get<RunStatus>(`/run/status/${reportId}`).then(r => r.data)
