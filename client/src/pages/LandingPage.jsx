import { Link } from 'react-router-dom'
import SystemStatus from '../components/SystemStatus.jsx'

const ROLES = [
  {
    name: 'Patients',
    description:
      'Find specialists, book appointments, consult over chat or video, and order prescribed medicines.',
  },
  {
    name: 'Doctors',
    description:
      'Publish availability, manage appointments, run consultations, and issue digital prescriptions.',
  },
  {
    name: 'Pharmacies',
    description:
      'Maintain a medicine catalogue and inventory, verify prescriptions, and fulfil orders.',
  },
  {
    name: 'Administrators',
    description:
      'Verify clinicians, oversee pharmacies, and monitor platform activity.',
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <span className="text-lg font-semibold tracking-tight text-slate-900">
            MediConnect
          </span>
          <nav className="flex items-center gap-3">
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
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-16">
        <section className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">
            Connected care
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Healthcare consultations and prescriptions in one workflow
          </h1>
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            MediConnect brings patients, doctors, pharmacies, and administrators
            together. Book a consultation, meet your clinician online, receive a
            prescription, and collect the medicines you need.
          </p>
        </section>

        <section className="mt-12 grid gap-4 sm:grid-cols-2">
          {ROLES.map((role) => (
            <article
              key={role.name}
              className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
            >
              <h2 className="text-base font-semibold text-slate-900">
                {role.name}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {role.description}
              </p>
            </article>
          ))}
        </section>

        <div className="mt-12 max-w-2xl">
          <SystemStatus />
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-6 text-sm text-slate-500">
          MediConnect &mdash; telemedicine and pharmacy platform.
        </div>
      </footer>
    </div>
  )
}
