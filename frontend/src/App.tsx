import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Navbar } from './components/Navbar'
import { Dashboard } from './pages/Dashboard'
import { ReportsHistory } from './pages/ReportsHistory'
import { ReportDetailPage } from './pages/ReportDetailPage'
import { CommitsPage } from './pages/CommitsPage'
import { IssuesPage } from './pages/IssuesPage'
import { OfficePage } from './pages/OfficePage'
import { TasksPage } from './pages/TasksPage'
import { SchedulePage } from './pages/SchedulePage'
import { BriefingPage } from './pages/BriefingPage'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-900 flex flex-col">
        <Navbar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/office" element={<OfficePage />} />
            <Route path="/reports" element={<ReportsHistory />} />
            <Route path="/reports/:id" element={<ReportDetailPage />} />
            <Route path="/commits" element={<CommitsPage />} />
            <Route path="/issues"    element={<IssuesPage />} />
            <Route path="/tasks"    element={<TasksPage />} />
            <Route path="/schedule" element={<SchedulePage />} />
            <Route path="/briefing" element={<BriefingPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
