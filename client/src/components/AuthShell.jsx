import { Link } from 'react-router-dom'

export default function AuthShell({ title, subtitle, children }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-md">
        <div className="text-center">
          <Link
            to="/"
            className="text-xl font-semibold tracking-tight text-slate-900"
          >
            MediConnect
          </Link>
          <h1 className="mt-6 text-2xl font-semibold text-slate-900">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-2 text-sm text-slate-600">{subtitle}</p>
          ) : null}
        </div>
        <div className="mt-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          {children}
        </div>
      </div>
    </div>
  )
}