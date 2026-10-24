import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import AppHeader from '../components/AppHeader.jsx'
import LoadingState from '../components/LoadingState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import { getPatientDashboard } from '../lib/patientApi.js'
import { getApiErrorMessage } from '../lib/apiError.js'
import { homePathFor, homeLinksFor } from '../lib/homePath.js'

const QUICK_ACTIONS = [
  { title: 'Find a Doctor', to: '/doctors' },
  { title: 'Appointments', to: '/appointments' },
  { title: 'My Orders', to: '/orders' },
  { title: 'Prescriptions', to: '/prescriptions' },
  { title: 'Medical Records', to: '/medical-records' },
  { title: 'Pharmacy', to: '/medicines' },
  { title: 'My Cart', to: '/cart' },
]

const PROFILE_LABELS = [
  { key: 'dateOfBirth', label: 'Date of birth' },
  { key: 'gender', label: 'Gender' },
  { key: 'bloodGroup', label: 'Blood group' },
]

export default function PatientDashboardPage() {
  const { user } = useAuth()
  const [state, setState] = useState({
    loading: true,
    error: null,
    data: null,
  })

  const load = useCallback(() => {
    getPatientDashboard()
      .then((response) => {
        setState({ loading: false, error: null, data: response.data.data })
      })
      .catch((error) => {
        setState({
          loading: false,
          error: getApiErrorMessage(error),
          data: null,
        })
      })
  }, [])

  function retry() {
    setState({ loading: true, error: null, data: null })
    load()
  }

  useEffect(() => {
    load()
  }, [load])

  if (state.loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <AppHeader home={homePathFor(user)} links={homeLinksFor(user)} />
        <main className="mx-auto max-w-5xl px-6 py-12">
          <LoadingState label="Loading your dashboardâ€¦" />
        </main>
      </div>
    )
  }

  if (state.error) {
    return (
      <div className="min-h-screen bg-slate-50">
        <AppHeader home={homePathFor(user)} links={homeLinksFor(user)} />
        <main className="mx-auto max-w-5xl px-6 py-12">
          <ErrorState message={state.error} onRetry={retry} />
        </main>
      </div>
    )
  }

  const { user: account, profile, profileCompletion } = state.data
  const firstName = account.name.split(' ')[0]
  const hasHealthInfo =
    profile &&
    (profile.dateOfBirth || profile.gender || profile.bloodGroup)

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader home={homePathFor(user)} links={homeLinksFor(user)} />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <section>
          <h1 className="text-2xl font-semibold text-slate-900">
            Welcome back, {firstName}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage your health profile and upcoming patient services.
          </p>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
            <div className="flex items-baseline justify-between">
              <h2 className="text-base font-semibold text-slate-900">
                Profile completion
              </h2>
              <span className="text-sm font-medium text-slate-700">
                {profileCompletion}%
              </span>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-brand-600"
                style={{ width: `${profileCompletion}%` }}
              />
            </div>
            {profileCompletion < 100 ? (
              <p className="mt-3 text-sm text-slate-600">
                Add a few details to make your health profile complete.
              </p>
            ) : (
              <p className="mt-3 text-sm text-slate-600">
                Your health profile is complete.
              </p>
            )}
            <div className="mt-4">
              <Link
                to="/patient/profile"
                className="inline-block rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-brand-700"
              >
                {profile ? 'Update profile' : 'Create profile'}
              </Link>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">
              Account
            </h2>
            <dl className="mt-3 space-y-3 text-sm">
              <div>
                <dt className="text-slate-500">Name</dt>
                <dd className="mt-0.5 font-medium text-slate-900">
                  {account.name}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Email</dt>
                <dd className="mt-0.5 font-medium text-slate-900">
                  {account.email}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Phone</dt>
                <dd className="mt-0.5 font-medium text-slate-900">
                  {account.phone || 'Not provided'}
                </dd>
              </div>
            </dl>
            <Link
              to="/account"
              className="mt-4 inline-block text-sm font-medium text-brand-600 transition hover:text-brand-700"
            >
              View account details
            </Link>
          </div>
        </section>

        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            Health profile summary
          </h2>
          {hasHealthInfo ? (
            <dl className="mt-3 grid gap-4 sm:grid-cols-3">
              {PROFILE_LABELS.map((item) => (
                <div key={item.key}>
                  <dt className="text-sm text-slate-500">{item.label}</dt>
                  <dd className="mt-0.5 text-sm font-medium text-slate-900">
                    {profile?.[item.key] || 'Not provided'}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-3 text-sm text-slate-600">
              No health information added yet. Once you add your profile you
              will see it here.
            </p>
          )}
          <div className="mt-4">
            <Link
              to="/patient/profile"
              className="text-sm font-medium text-brand-600 transition hover:text-brand-700"
            >
              {profile ? 'Manage health profile' : 'Add health information'}
            </Link>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-base font-semibold text-slate-900">
            Quick actions
          </h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {QUICK_ACTIONS.map((action) => (
              <div
                key={action.title}
                className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
              >
                <h3 className="text-base font-medium text-slate-900">
                  {action.title}
                </h3>
                <div className="mt-3">
                  <Link
                    to={action.to}
                    className="inline-block rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-brand-700"
                  >
                    Open
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
