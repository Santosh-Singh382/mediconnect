import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import AppHeader from '../components/AppHeader.jsx'
import LoadingState from '../components/LoadingState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import { getDoctorDashboard } from '../lib/doctorApi.js'
import { getApiErrorMessage } from '../lib/apiError.js'
import { homePathFor, homeLinksFor } from '../lib/homePath.js'

const COMING_SOON_LABEL = 'Coming in a later module'

const QUICK_ACTIONS = [
  { title: 'Appointments', to: '/doctor/appointments' },
  { title: 'Patients' },
  { title: 'Prescriptions', to: '/prescriptions' },
  { title: 'Schedule' },
  { title: 'Consultations' },
]

const VERIFICATION_STYLES = {
  PENDING: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
}

function VerificationBadge({ status }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
        VERIFICATION_STYLES[status] || VERIFICATION_STYLES.PENDING
      }`}
    >
      {status}
    </span>
  )
}

export default function DoctorDashboardPage() {
  const { user } = useAuth()
  const [state, setState] = useState({
    loading: true,
    error: null,
    data: null,
  })

  const load = useCallback(() => {
    getDoctorDashboard()
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
          <LoadingState label="Loading your dashboard…" />
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

  const { user: account, profile, profileCompletion, verificationStatus, stats } =
    state.data
  const firstName = account.name.split(' ')[0]

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader home={homePathFor(user)} links={homeLinksFor(user)} />

      <main className="mx-auto max-w-5xl px-6 py-10">
        <section className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Welcome back, {firstName}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Manage your practice profile and upcoming doctor services.
            </p>
          </div>
          {profile ? (
            <VerificationBadge status={verificationStatus} />
          ) : null}
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
                Complete your specialization, qualification, experience,
                registration, clinic, languages, and availability to finish
                your profile.
              </p>
            ) : (
              <p className="mt-3 text-sm text-slate-600">
                Your practice profile is complete and awaiting platform
                verification.
              </p>
            )}
            <div className="mt-4">
              <Link
                to="/doctor/profile"
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

        <section className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">Upcoming appointments</p>
            <p className="mt-1 text-3xl font-semibold text-slate-900">
              {stats.upcomingAppointments}
            </p>
            <p className="mt-2 text-xs text-slate-400">
              {COMING_SOON_LABEL}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">Completed consultations</p>
            <p className="mt-1 text-3xl font-semibold text-slate-900">
              {stats.completedConsultations}
            </p>
            <p className="mt-2 text-xs text-slate-400">
              {COMING_SOON_LABEL}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">Prescriptions created</p>
            <p className="mt-1 text-3xl font-semibold text-slate-900">
              {stats.prescriptionsCreated}
            </p>
            <p className="mt-2 text-xs text-slate-400">
              {COMING_SOON_LABEL}
            </p>
          </div>
        </section>

        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            Practice summary
          </h2>
          {profile ? (
            <dl className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <dt className="text-sm text-slate-500">Specialization</dt>
                <dd className="mt-0.5 text-sm font-medium text-slate-900">
                  {profile.specialization || 'Not provided'}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-slate-500">Qualification</dt>
                <dd className="mt-0.5 text-sm font-medium text-slate-900">
                  {profile.qualification || 'Not provided'}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-slate-500">Experience</dt>
                <dd className="mt-0.5 text-sm font-medium text-slate-900">
                  {profile.experience !== null
                    ? `${profile.experience} years`
                    : 'Not provided'}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-slate-500">Consultation fee</dt>
                <dd className="mt-0.5 text-sm font-medium text-slate-900">
                  {profile.consultationFee !== null
                    ? `₹${profile.consultationFee}`
                    : 'Not provided'}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-slate-500">Clinic</dt>
                <dd className="mt-0.5 text-sm font-medium text-slate-900">
                  {profile.clinicName || 'Not provided'}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-slate-500">Languages</dt>
                <dd className="mt-0.5 text-sm font-medium text-slate-900">
                  {profile.languages.length > 0
                    ? profile.languages.join(', ')
                    : 'Not provided'}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-slate-600">
              No practice information added yet. Once you set up your profile
              it will appear here.
            </p>
          )}
          <div className="mt-4">
            <Link
              to="/doctor/profile"
              className="text-sm font-medium text-brand-600 transition hover:text-brand-700"
            >
              {profile ? 'Manage practice profile' : 'Add practice information'}
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
                {action.to ? (
                  <div className="mt-3">
                    <Link
                      to={action.to}
                      className="inline-block rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-brand-700"
                    >
                      Open
                    </Link>
                  </div>
                ) : (
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full bg-slate-300"
                      aria-hidden="true"
                    />
                    {COMING_SOON_LABEL}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}