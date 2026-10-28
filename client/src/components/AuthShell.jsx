import { Link } from 'react-router-dom'
import { BRAND_NAME, PROJECT_NAME } from '../lib/branding.js'

export default function AuthShell({ title, subtitle, children }) {
  return (
    <div className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[minmax(20rem,0.85fr)_minmax(28rem,1.15fr)]">
      <aside className="relative hidden overflow-hidden bg-slate-950 px-10 py-10 text-white lg:flex lg:flex-col lg:justify-between xl:px-16">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-blue-600/30 blur-3xl" aria-hidden="true" />
        <div className="absolute -bottom-40 -left-32 h-96 w-96 rounded-full bg-cyan-400/10 blur-3xl" aria-hidden="true" />
        <Link to="/" className="relative flex items-center gap-2.5 text-lg font-bold tracking-tight">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-xl">+</span>
          {BRAND_NAME}
        </Link>

        <div className="relative max-w-md">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-300">{PROJECT_NAME}</p>
          <h2 className="mt-5 text-4xl font-bold leading-tight tracking-tight xl:text-5xl">
            Healthcare that feels a little more human.
          </h2>
          <p className="mt-6 max-w-sm text-base leading-7 text-slate-300">
            Find trusted doctors, manage your records, and stay on top of your health—all in one secure place.
          </p>
          <div className="mt-10 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-2xl font-bold">10k+</p>
              <p className="mt-1 text-xs text-slate-400">Appointments made</p>
            </div>
            <div className="mt-5 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-300">✓</span>
              <div>
                <p className="text-sm font-bold">Your privacy matters</p>
                <p className="mt-1 text-xs text-slate-400">Your health data stays protected.</p>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-2xl font-bold">24/7</p>
              <p className="mt-1 text-xs text-slate-400">Access to your care</p>
            </div>
          </div>
        </div>

        <p className="relative text-xs text-slate-500">Simple, secure healthcare for everyone.</p>
      </aside>

      <main className="flex min-h-screen flex-col px-5 py-7 sm:px-8 lg:px-12 xl:px-20">
        <div className="flex items-center justify-between lg:justify-end">
          <Link to="/" className="flex items-center gap-2 text-base font-bold tracking-tight text-slate-900 lg:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-lg text-white">+</span>
            {BRAND_NAME}
          </Link>
          <Link to="/" className="text-sm font-semibold text-slate-500 transition hover:text-blue-600">
            Back to home <span aria-hidden="true">↗</span>
          </Link>
        </div>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-600">Welcome to {BRAND_NAME}</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">{title}</h1>
            {subtitle ? <p className="mt-3 text-base leading-7 text-slate-600">{subtitle}</p> : null}
          </div>
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 sm:p-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
