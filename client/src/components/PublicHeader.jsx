import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'

export default function PublicHeader() {
  const { user } = useAuth()

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
        <Link
          to="/"
          className="text-lg font-semibold tracking-tight text-slate-900"
        >
          MediConnect
        </Link>
        <nav className="flex items-center gap-3">
          <Link
            to="/doctors"
            className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
          >
            Find a Doctor
          </Link>
          {user ? (
            <Link
              to="/account"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              My account
            </Link>
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