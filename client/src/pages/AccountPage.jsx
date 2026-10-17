import { useAuth } from '../hooks/useAuth.js'
import AppHeader from '../components/AppHeader.jsx'
import { homePathFor, homeLinksFor } from '../lib/homePath.js'

const ROLE_LABELS = {
  PATIENT: 'Patient',
  DOCTOR: 'Doctor',
  PHARMACY: 'Pharmacy',
  ADMIN: 'Administrator',
}

export default function AccountPage() {
  const { user } = useAuth()

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

  const links = [
    ...homeLinksFor(user),
    { to: '/account', label: 'Account' },
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader home={homePathFor(user)} links={links} />

      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-semibold text-slate-900">
          Welcome, {user.name.split(' ')[0]}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          This is your account overview. Role-specific features arrive in
          upcoming releases.
        </p>

        <div className="mt-8 rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-base font-semibold text-slate-900">
              Account details
            </h2>
          </div>
          <dl className="divide-y divide-slate-100">
            {details.map((detail) => (
              <div
                key={detail.label}
                className="flex items-center justify-between px-6 py-3"
              >
                <dt className="text-sm text-slate-500">{detail.label}</dt>
                <dd className="text-sm font-medium text-slate-900">
                  {detail.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </main>
    </div>
  )
}