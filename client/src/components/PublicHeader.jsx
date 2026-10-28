import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { useCart } from '../hooks/useCart.js'
import NotificationBell from './NotificationBell.jsx'
import { BRAND_NAME } from '../lib/branding.js'

export default function PublicHeader() {
  const { user } = useAuth()
  const { summary } = useCart()
  const cartCount = summary.itemCount

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-3">
        <Link
          to="/"
          className="text-lg font-semibold tracking-tight text-slate-900"
        >
          {BRAND_NAME}
        </Link>
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link
            to="/doctors"
            className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
          >
            Find a Doctor
          </Link>
          <Link
            to="/medicines"
            className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
          >
            Medicines
          </Link>
          {user ? (
            <>
              {user.role === 'PATIENT' ? (
                <Link
                  to="/cart"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 transition hover:text-slate-900"
                >
                  Cart
                  {cartCount > 0 ? (
                    <span className="rounded-full bg-brand-100 px-1.5 py-0.5 text-xs font-semibold text-brand-700">
                      {cartCount > 99 ? '99+' : cartCount}
                    </span>
                  ) : null}
                </Link>
              ) : null}
              <NotificationBell />
              <Link
                to="/account"
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                My account
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
              >
                Sign in
              </Link>
              <Link
                to="/register"
                className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-brand-700"
              >
                Create account
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}