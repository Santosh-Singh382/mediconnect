import { NavLink, Outlet } from 'react-router-dom'
import AppHeader from './AppHeader.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { homePathFor } from '../lib/homePath.js'

const ADMIN_NAV_ITEMS = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/doctors', label: 'Doctors' },
  { to: '/admin/pharmacies', label: 'Pharmacies' },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/medicines', label: 'Medicines' },
  { to: '/admin/orders', label: 'Orders' },
  { to: '/notifications', label: 'Notifications' },
]

export default function AdminLayout() {
  const { user } = useAuth()

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader
        home={homePathFor(user)}
        links={[
          { to: '/admin', label: 'Admin' },
          { to: '/notifications', label: 'Notifications' },
        ]}
      />

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8">
          <aside aria-label="Admin navigation" className="mb-5 lg:mb-0">
            <nav className="flex gap-2 overflow-x-auto pb-1 lg:sticky lg:top-6 lg:flex-col lg:overflow-visible lg:pb-0">
              {ADMIN_NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `shrink-0 rounded-md px-3 py-2 text-sm font-medium transition ${
                      isActive
                        ? 'bg-brand-600 text-white'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </aside>

          <main className="min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
