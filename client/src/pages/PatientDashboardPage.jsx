import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import AppHeader from '../components/AppHeader.jsx'
import LoadingState from '../components/LoadingState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import EmptyState from '../components/EmptyState.jsx'
import { getPatientDashboard } from '../lib/patientApi.js'
import { getApiErrorMessage } from '../lib/apiError.js'
import { homePathFor, homeLinksFor } from '../lib/homePath.js'
import DashboardSidebar from '../components/DashboardSidebar.jsx'

const QUICK_ACTIONS = [
  { title: 'Find a Doctor', to: '/doctors' },
  { title: 'Appointments', to: '/appointments' },
  { title: 'My Orders', to: '/orders' },
  { title: 'Prescriptions', to: '/prescriptions' },
  { title: 'Medical Records', to: '/medical-records' },
  { title: 'Pharmacy', to: '/medicines' },
  { title: 'My Cart', to: '/cart' },
]

export default function PatientDashboardPage() {
  const navigate = useNavigate()
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
        <AppHeader home={homePathFor(user)} links={[]} />
        <main className="mx-auto max-w-5xl px-6 py-12">
          <LoadingState label="Loading your dashboard…" />
        </main>
      </div>
    )
  }

  if (state.error) {
    return (
      <div className="min-h-screen bg-slate-50">
        <AppHeader home={homePathFor(user)} links={[]} />
        <main className="mx-auto max-w-5xl px-6 py-12">
          <ErrorState message={state.error} onRetry={retry} />
        </main>
      </div>
    )
  }

  const {
    user: account,
    _profile,
    _profileCompletion,
    upcomingAppointments,
    prescriptions,
    medicalRecords,
    orders,
    _notifications,
  } = state.data

  const firstName = account.name.split(' ')[0]

  function goTo(path) {
    navigate(path, { replace: true })
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <AppHeader home={homePathFor(user)} links={[]} />

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:pl-[308px] lg:pr-8 lg:py-12">
        <DashboardSidebar links={homeLinksFor(user)} role="Patient" />
        <main className="min-w-0">
        <section className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-8 text-white shadow-xl sm:px-10 sm:py-10">
          <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-blue-600/30 blur-3xl" aria-hidden="true" />
          <div className="relative flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-300">Patient overview</p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                Good morning, {firstName}
              </h1>
              <p className="mt-3 max-w-lg text-sm leading-6 text-slate-300">
                Stay on top of your appointments, prescriptions, and health records from one calm, connected space.
              </p>
            </div>
            <Link to="/doctors" className="inline-flex w-fit items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-500">
              Book a consultation <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Shortcuts</p>
              <h2 className="mt-1 text-xl font-bold text-slate-950">What do you need today?</h2>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
            {QUICK_ACTIONS.map((action, index) => (
              <Link
                key={action.to}
                to={action.to}
                className={`group rounded-2xl border p-4 text-sm font-bold transition hover:-translate-y-1 hover:shadow-lg ${
                  index === 0
                    ? 'border-blue-600 bg-blue-600 text-white shadow-lg shadow-blue-100'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:text-blue-700'
                }`}
              >
                <span className={`mb-4 flex h-9 w-9 items-center justify-center rounded-xl text-base ${index === 0 ? 'bg-white/15' : 'bg-blue-50 text-blue-600'}`}>
                  {['+', '◷', '▣', '⌁', '▤', '✚', '🛒'][index]}
                </span>
                <span className="block leading-5">{action.title}</span>
                <span className={`mt-2 block text-xs ${index === 0 ? 'text-blue-100' : 'text-slate-400'}`}>Open →</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="hidden">
            <h2 className="text-xl font-semibold text-text mb-4">
              What would you like to do today?
            </h2>
          </div>
          {upcomingAppointments && upcomingAppointments.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold text-text mb-3">Upcoming appointment</h2>
              <div className="rounded-lg border border-border bg-surface p-5">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 rounded-full border border-border bg-surface w-12 h-12 flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-primary"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      aria-hidden="true"
                    >
                      <path d="M8 7l-2 2h4l2-2h2l2 2h4l-2 2H5l-5-5H8z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-text truncate">
                      {upcomingAppointments[0].doctorName || 'Doctor'}
                    </p>
                    <p className="text-muted-text text-sm truncate">
                      {upcomingAppointments[0].specialization
                        ? upcomingAppointments[0].specialization
                        : ''}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-muted-text text-xs">
                        {upcomingAppointments[0].date}
                      </span>
                      <span className="text-muted-text text-xs">
                        {upcomingAppointments[0].startTime} –{
                          upcomingAppointments[0].endTime
                        }
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-medium text-primary">
                      {upcomingAppointments[0].consultationType &&
                        getConsultationTypeLabel(
                          upcomingAppointments[0].consultationType
                        )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {upcomingAppointments && upcomingAppointments.length === 0 && (
            <div>
              <h2 className="text-xl font-semibold text-text mb-3">Upcoming appointment</h2>
              <EmptyState
                title="No upcoming appointments"
                description="Find a doctor and book your next consultation."
                action={() => goTo('/doctors')}
                actionLabel="Find a Doctor"
              />
            </div>
          )}

          {prescriptions && prescriptions.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold text-text mb-3">Recent prescriptions</h2>
              <div className="space-y-2">
                {prescriptions.slice(0, 3).map((rx) => (
                  <div
                    key={rx.id}
                    className="flex items-center gap-3 rounded-lg bg-surface p-3 hover:border-border transition-colors"
                  >
                    <div className="flex-shrink-0 rounded-full border border-border bg-surface w-10 h-10 flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-primary"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        aria-hidden="true"
                      >
                        <path d="M14 2H6a2 2 0 0 0-2 2v3.5l4.5 3L18 3v2.5l-4 3L14 2Z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-text line-clamp-1">
                        {rx.doctorName || 'Doctor'}
                      </p>
                      <p className="text-muted-text text-xs line-clamp-1">
                        {rx.date || 'No date'}
                      </p>
                    </div>
                    <span
                      className="inline-flex items-center gap-1 px-2 rounded-md text-xs font-medium text-primary bg-primary-50"
                    >
                      {rx.status}
                    </span>
                  </div>
                ))}
              </div>
              <Link
                to="/prescriptions"
                className="mt-3 inline-block text-sm font-medium text-primary hover:text-primary-dark"
              >
                View prescriptions
              </Link>
            </div>
          )}

          {prescriptions && prescriptions.length === 0 && (
            <div>
              <h2 className="text-xl font-semibold text-text mb-3">Recent prescriptions</h2>
              <EmptyState
                title="No prescriptions yet"
                description="Book a consultation and receive a prescription."
                action={() => goTo('/doctors')}
                actionLabel="Find a Doctor"
              />
            </div>
          )}

          {medicalRecords && medicalRecords.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold text-text mb-3">Medical records</h2>
              <div className="space-y-2">
                {medicalRecords.slice(0, 3).map((record) => (
                  <div
                    key={record.id}
                    className="flex items-center gap-3 rounded-lg bg-surface p-3 hover:border-border transition-colors"
                  >
                    <div
                      className="flex-shrink-0 rounded-full border border-border bg-surface w-10 h-10 flex items-center justify-center"
                    >
                      <svg
                        className="w-5 h-5 text-primary"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        aria-hidden="true"
                      >
                        <path d="M14 2H6a2 2 0 0 0-2 2v3.5l4.5 3L18 3v2.5l-4 3L14 2Z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-text line-clamp-1">
                        {record.title || 'Untitled'}
                      </p>
                      <p className="text-muted-text text-xs line-clamp-1">
                        {record.date || 'No date'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <Link
                to="/medical-records"
                className="mt-3 inline-block text-sm font-medium text-primary hover:text-primary-dark"
              >
                View medical records
              </Link>
            </div>
          )}

          {medicalRecords && medicalRecords.length === 0 && (
            <div>
              <h2 className="text-xl font-semibold text-text mb-3">Medical records</h2>
              <EmptyState
                title="No medical records yet"
                description="Records from completed consultations will appear here."
              />
            </div>
          )}

          {orders && orders.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold text-text mb-3">Order summary</h2>
              <div className="space-y-2">
                {orders.slice(0, 1).map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center gap-3 rounded-lg bg-surface p-3 hover:border-border transition-colors"
                  >
                    <div className="flex-shrink-0 rounded-md bg-primary-50 p-2">
                      <svg
                        className="w-5 h-5 text-primary"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        aria-hidden="true"
                      >
                        <path d="M22 2H6l-6 6h12l-6 6" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-text line-clamp-1">
                        {order.pharmacyName || 'Pharmacy'}
                      </p>
                      <p className="text-muted-text text-xs line-clamp-1">
                        {order.orderStatus || 'PLACED'}
                      </p>
                    </div>
                    <span className="text-muted-text text-sm">
                      {order.placedAt ? new Date(order.placedAt).toLocaleDateString() : ''}
                    </span>
                  </div>
                ))}
              </div>
              <Link
                to="/orders"
                className="mt-3 inline-block text-sm font-medium text-primary hover:text-primary-dark"
              >
                My Orders
              </Link>
            </div>
          )}

          {orders && orders.length === 0 && (
            <div>
              <h2 className="text-xl font-semibold text-text mb-3">Order summary</h2>
              <EmptyState
                title="No orders yet"
                description="Order medicines from your preferred pharmacy."
                action={() => goTo('/medicines')}
                actionLabel="Browse Medicines"
              />
            </div>
          )}
        </section>
        </main>
      </div>
    </div>
  )
}

function getConsultationTypeLabel(type) {
  const map = {
    VIDEO: 'Video consultation',
    AUDIO: 'Audio consultation',
    CHAT: 'Chat',
  }
  return map[type] || 'Consultation'
}