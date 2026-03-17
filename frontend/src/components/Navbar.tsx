import { Link, useLocation } from 'react-router-dom'

const links = [
  { to: '/',         label: 'Dashboard' },
  { to: '/briefing', label: '🤖 Briefing' },
  { to: '/tasks',    label: '📝 Tasks' },
  { to: '/schedule', label: '🗓 Schedule' },
  { to: '/office',   label: '🏢 Office' },
  { to: '/reports',  label: 'Reports' },
]

export function Navbar() {
  const { pathname } = useLocation()

  return (
    <nav className="bg-slate-900 border-b border-slate-700 px-6 py-4 flex items-center gap-8">
      <div className="flex items-center gap-2">
        <span className="text-purple-400 text-xl font-bold">⚡</span>
        <span className="text-white font-semibold tracking-tight">AI Agent Office</span>
      </div>
      <div className="flex gap-6 ml-8">
        {links.map(({ to, label }) => (
          <Link
            key={to}
            to={to}
            className={`text-sm font-medium transition-colors ${
              pathname === to
                ? 'text-purple-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
