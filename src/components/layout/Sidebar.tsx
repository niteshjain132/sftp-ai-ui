import { NavLink } from 'react-router-dom'
import { Bell, HelpCircle, LayoutDashboard, Radio, SlidersHorizontal } from 'lucide-react'

const links = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/watches', label: 'Watches', icon: Radio, end: false },
  { to: '/alerts', label: 'Alerts', icon: Bell, end: false },
  { to: '/notify', label: 'Notify', icon: SlidersHorizontal, end: false },
  { to: '/help', label: 'Help', icon: HelpCircle, end: false },
]

export function Sidebar() {
  return (
    <aside className="flex w-[232px] shrink-0 flex-col border-r border-border bg-card px-4 py-5">
      <div className="mb-8 flex items-center gap-2 px-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white dark:text-canvas">
          S
        </div>
        <div>
          <div className="text-sm font-semibold text-ink">SFTP AI</div>
          <div className="text-[11px] text-muted">File arrival ops</div>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition ${
                isActive
                  ? 'bg-accent-soft text-ink'
                  : 'text-muted hover:bg-canvas hover:text-ink'
              }`
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-4 flex items-center gap-2 rounded-2xl border border-border px-3 py-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold">
          N
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-ink">Nitesh</div>
          <div className="truncate text-[11px] text-muted">ops@sftp.ai</div>
        </div>
      </div>
    </aside>
  )
}
