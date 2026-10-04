import { NavLink } from 'react-router-dom'
import {
  Bell,
  HelpCircle,
  LayoutDashboard,
  Radio,
  SlidersHorizontal,
  Menu,
} from 'lucide-react'

const links = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/watches', label: 'Watches', icon: Radio, end: false },
  { to: '/alerts', label: 'Alerts', icon: Bell, end: false },
  { to: '/notify', label: 'Notify', icon: SlidersHorizontal, end: false },
  { to: '/help', label: 'Help', icon: HelpCircle, end: false },
]

type Props = {
  collapsed?: boolean
  onToggle?: () => void
}

export function Sidebar({ collapsed = false, onToggle }: Props) {
  return (
    <aside
      className={`relative flex shrink-0 flex-col border-r border-border bg-card py-5 transition-all duration-300 ease-in-out ${
        collapsed ? 'w-[68px] px-2 items-center' : 'w-[232px] px-4'
      }`}
    >
      {/* Sidebar Header with Hamburger Icon */}
      {collapsed ? (
        <div className="mb-6 flex flex-col items-center gap-2.5">
          <button
            type="button"
            onClick={onToggle}
            title="Expand sidebar"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-canvas/60 text-muted hover:bg-accent-soft hover:text-accent transition shadow-2xs group"
          >
            <Menu size={18} className="group-hover:scale-110 transition-transform" />
          </button>
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-xs font-bold text-white dark:text-canvas shadow-xs">
            S
          </div>
        </div>
      ) : (
        <div className="mb-6 flex items-center justify-between px-2">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white dark:text-canvas shadow-xs">
              S
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-ink leading-tight">SFTP AI</div>
              <div className="text-[11px] text-muted truncate">File arrival ops</div>
            </div>
          </div>

          <button
            type="button"
            onClick={onToggle}
            title="Collapse sidebar"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-canvas hover:text-ink transition"
          >
            <Menu size={18} />
          </button>
        </div>
      )}

      {/* Navigation Links */}
      <nav className={`flex flex-1 flex-col gap-1.5 ${collapsed ? 'w-full items-center' : ''}`}>
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              `group relative flex items-center transition ${
                collapsed
                  ? 'h-10 w-10 justify-center rounded-xl'
                  : 'gap-2.5 rounded-full px-3 py-2 text-sm'
              } font-medium ${
                isActive
                  ? 'bg-accent-soft text-accent font-semibold shadow-2xs'
                  : 'text-muted hover:bg-canvas hover:text-ink'
              }`
            }
          >
            <Icon size={18} className="shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}

            {/* Hover Tooltip when collapsed */}
            {collapsed && (
              <span className="pointer-events-none absolute left-full ml-3 z-50 whitespace-nowrap rounded-md bg-ink px-2.5 py-1 text-xs font-semibold text-canvas shadow-md opacity-0 group-hover:opacity-100 transition-opacity">
                {label}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User Profile Footer */}
      {collapsed ? (
        <div
          title="Nitesh (ops@sftp.ai)"
          className="mt-4 flex justify-center"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent shadow-xs cursor-pointer hover:ring-2 hover:ring-accent/40 transition">
            N
          </div>
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-2.5 rounded-2xl border border-border bg-canvas/40 px-3 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent shadow-xs">
            N
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-ink">Nitesh</div>
            <div className="truncate text-[11px] text-muted">ops@sftp.ai</div>
          </div>
        </div>
      )}
    </aside>
  )
}
