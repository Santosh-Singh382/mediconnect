import { NavLink } from 'react-router-dom'

const ICONS = ['⌂', '◎', '◷', '▣', '⌁', '▤', '✚', '🛒', '•']

export default function DashboardSidebar({ links = [], role = 'Workspace' }) {
  return (
    <aside className="dashboard-sidebar min-w-0 w-full rounded-2xl border border-slate-200 bg-white p-3 shadow-sm lg:fixed lg:inset-y-0 lg:left-0 lg:z-20 lg:flex lg:w-[272px] lg:flex-col lg:rounded-none lg:border-y-0 lg:border-l-0 lg:border-r lg:p-5 lg:pt-24 lg:shadow-xl">
      <div className="sidebar-heading mb-3 flex items-center gap-3 px-3 py-2 lg:mb-6">
        <span className="sidebar-brand-mark flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-lg font-black text-white shadow-lg shadow-blue-200">+</span>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-600">{role}</p>
          <p className="mt-1 text-sm font-bold text-slate-900">Workspace menu</p>
        </div>
      </div>
      <nav aria-label={`${role} navigation`} className="sidebar-nav flex min-w-0 max-w-full gap-1 overflow-x-auto lg:flex-1 lg:flex-col lg:overflow-y-auto lg:overflow-x-hidden">
        {links.map((item, index) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to.endsWith('dashboard') || item.to === '/admin'}
            className={({ isActive }) =>
              `sidebar-nav-item group relative flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                isActive
                  ? 'is-active bg-blue-600 text-white shadow-md shadow-blue-100'
                  : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'
              }`
            }
            style={{ '--sidebar-delay': `${index * 45}ms` }}
          >
            <span className="sidebar-nav-icon flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-sm text-slate-500 transition">
              {ICONS[index % ICONS.length]}
            </span>
            <span className="truncate">{item.label}</span>
            <span className="sidebar-active-dot ml-auto h-1.5 w-1.5 rounded-full bg-white opacity-0 transition-opacity" aria-hidden="true" />
          </NavLink>
        ))}
      </nav>
      <div className="mt-5 hidden rounded-2xl border border-blue-100 bg-blue-50/70 p-3 lg:block">
        <p className="text-xs font-bold text-blue-900">Your care, connected.</p>
        <p className="mt-1 text-[11px] leading-4 text-blue-700">Everything you need for a healthier day.</p>
      </div>
    </aside>
  )
}
