import { useAuth } from '../hooks/useAuth.js'
import WorkspaceShell from '../components/WorkspaceShell.jsx'

const ROLE_LABELS = {
  PATIENT: 'Patient',
  DOCTOR: 'Doctor',
  PHARMACY: 'Pharmacy',
  ADMIN: 'Administrator',
}

export default function AccountPage() {
  const { user } = useAuth()
  const firstName = user.name.split(' ')[0]
  const initials = user.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

  const details = [
    { label: 'Name', value: user.name },
    { label: 'Email', value: user.email },
    { label: 'Phone', value: user.phone || 'Not provided' },
    { label: 'Role', value: ROLE_LABELS[user.role] || user.role },
    {
      label: 'Account status',
      value: user.isVerified ? 'Verified' : 'Pending verification',
    },
    {
      label: 'Member since',
      value: new Date(user.createdAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    },
  ]

  return (
    <WorkspaceShell user={user} contentClassName="max-w-5xl">
      <div className="py-2 lg:py-4">
        <section className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-8 text-white shadow-xl sm:px-10 sm:py-10">
          <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-blue-600/30 blur-3xl" aria-hidden="true" />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-xl font-black text-white shadow-lg shadow-blue-950/30">
                {initials}
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-300">MediConnect account</p>
                <h1 className="mt-2 text-3xl font-black tracking-tight">Welcome, {firstName}</h1>
                <p className="mt-2 text-sm text-slate-300">Your personal account overview and security status.</p>
              </div>
            </div>
            <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold ${user.isVerified ? 'bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-300/20' : 'bg-amber-400/15 text-amber-200 ring-1 ring-amber-300/20'}`}>
              {user.isVerified ? 'Account verified' : 'Verification pending'}
            </span>
          </div>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Account type</p>
            <p className="mt-2 text-xl font-black text-slate-950">{ROLE_LABELS[user.role] || user.role}</p>
            <p className="mt-1 text-xs text-slate-500">Your current workspace role</p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Security</p>
            <p className="mt-2 text-xl font-black text-slate-950">{user.isVerified ? 'Protected' : 'Action needed'}</p>
            <p className="mt-1 text-xs text-slate-500">Identity verification status</p>
          </div>
          <div className="rounded-2xl border border-violet-100 bg-violet-50/70 p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-violet-700">Member since</p>
            <p className="mt-2 text-lg font-black text-slate-950">
              {new Date(user.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
            </p>
            <p className="mt-1 text-xs text-slate-500">Thank you for choosing MediConnect</p>
          </div>
        </section>

        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50/50 px-5 py-5 sm:px-6">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Profile snapshot</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">Account details</h2>
            <p className="mt-1 text-sm text-slate-500">Your registered information at a glance.</p>
          </div>
          <dl className="grid gap-x-8 divide-y divide-slate-100 px-5 sm:grid-cols-2 sm:divide-y-0 sm:px-6">
            {details.map((detail) => (
              <div
                key={detail.label}
                className="flex min-w-0 items-center justify-between gap-4 border-b border-slate-100 py-4 last:border-0"
              >
                <dt className="text-sm text-slate-500">{detail.label}</dt>
                <dd className="max-w-[62%] truncate text-right text-sm font-bold text-slate-900">
                  {detail.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </WorkspaceShell>
  )
}