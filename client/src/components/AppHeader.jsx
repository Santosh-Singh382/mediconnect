import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { useCart } from '../hooks/useCart.js'
import NotificationBell from './NotificationBell.jsx'

export default function AppHeader({ home, links }) {
  const { logout } = useAuth()
  const { summary } = useCart()
  const navigate = useNavigate()
  const cartCount = summary.itemCount

  function handleLogout() {
    logout()
    navigate('/', { replace: true })
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3">
        <Link
          to={home}
          className="text-lg font-semibold tracking-tight text-slate-900"
        >
          MediConnect
        </Link>

        {links.length > 0 && (
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {links.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `text-sm font-medium transition hover:text-slate-900 ${
                    isActive ? 'text-brand-600' : 'text-slate-600'
                  }`
                }
              >
                {item.label}
                {item.to === '/cart' && cartCount > 0 ? (
                  <span className="ml-1.5 rounded-full bg-brand-100 px-1.5 py-0.5 text-xs font-semibold text-brand-700">
                    {cartCount > 99 ? '99+' : cartCount}
                  </span>
                ) : null}
              </NavLink>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-2">
          <NotificationBell />
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  )
}