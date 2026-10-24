import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import LoadingState from '../components/LoadingState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import { getAdminDashboard } from '../lib/adminApi.js'
import { getApiErrorMessage } from '../lib/apiError.js'

const METRIC_CARDS = [
  {
    key: 'totalUsers',
    label: 'Total users',
    to: '/admin/users',
    tone: 'border-slate-200 bg-white',
    valueTone: 'text-slate-900',
  },
  {
    key: 'totalDoctors',
    label: 'Doctor profiles',
    to: '/admin/doctors',
    tone: 'border-indigo-200 bg-indigo-50',
    valueTone: 'text-indigo-900',
  },
  {
    key: 'pendingDoctorVerifications',
    label: 'Pending doctors',
    to: '/admin/doctors?status=PENDING',
    tone: 'border-amber-200 bg-amber-50',
    valueTone: 'text-amber-900',
  },
  {
    key: 'totalPharmacies',
    label: 'Pharmacies',
    to: '/admin/pharmacies',
    tone: 'border-emerald-200 bg-emerald-50',
    valueTone: 'text-emerald-900',
  },
  {
    key: 'pendingPharmacyVerifications',
    label: 'Pending pharmacies',
    to: '/admin/pharmacies?status=PENDING',
    tone: 'border-amber-200 bg-amber-50',
    valueTone: 'text-amber-900',
  },
  {
    key: 'totalMedicines',
    label: 'Medicines',
    to: '/admin/medicines',
    tone: 'border-sky-200 bg-sky-50',
    valueTone: 'text-sky-900',
  },
  {
    key: 'totalOrders',
    label: 'Orders',
    to: '/admin/orders',
    tone: 'border-violet-200 bg-violet-50',
    valueTone: 'text-violet-900',
  },
]

export default function AdminDashboardPage() {
  const [state, setState] = useState({
    loading: true,
    error: null,
    metrics: null,
  })

  const load = useCallback(() => {
    getAdminDashboard()
      .then((response) => {
        setState({
          loading: false,
          error: null,
          metrics: response.data.data.metrics,
        })
      })
      .catch((error) => {
        setState({
          loading: false,
          error: getApiErrorMessage(
            error,
            'Unable to load the admin dashboard right now.',
          ),
          metrics: null,
        })
      })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function retry() {
    setState({ loading: true, error: null, metrics: null })
    load()
  }

  const pendingDoctors = state.metrics?.pendingDoctorVerifications || 0
  const pendingPharmacies = state.metrics?.pendingPharmacyVerifications || 0

  return (
    <div>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          Admin dashboard
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Monitor platform activity, verification queues, and marketplace health.
        </p>
      </header>

      {state.loading ? (
        <div className="mt-8">
          <LoadingState label="Loading platform metrics…" />
        </div>
      ) : state.error ? (
        <div className="mt-8">
          <ErrorState message={state.error} onRetry={retry} />
        </div>
      ) : (
        <>
          <section aria-label="Platform metrics" className="mt-6">
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {METRIC_CARDS.map((card) => (
                <Link
                  key={card.key}
                  to={card.to}
                  className={`rounded-lg border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${card.tone}`}
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-600">
                    {card.label}
                  </p>
                  <p
                    className={`mt-2 text-2xl font-semibold ${card.valueTone}`}
                  >
                    {state.metrics?.[card.key] ?? 0}
                  </p>
                </Link>
              ))}
            </div>
          </section>

          <section className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-amber-950">
                    Doctor verification queue
                  </h2>
                  <p className="mt-1 text-sm text-amber-800">
                    {pendingDoctors === 0
                      ? 'No doctor profiles are waiting for review.'
                      : `${pendingDoctors} doctor ${
                          pendingDoctors === 1 ? 'profile is' : 'profiles are'
                        } waiting for review.`}
                  </p>
                </div>
                <Link
                  to="/admin/doctors?status=PENDING"
                  className="rounded-md bg-amber-700 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-amber-800"
                >
                  Review doctors
                </Link>
              </div>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-amber-950">
                    Pharmacy verification queue
                  </h2>
                  <p className="mt-1 text-sm text-amber-800">
                    {pendingPharmacies === 0
                      ? 'No pharmacy profiles are waiting for review.'
                      : `${pendingPharmacies} pharmacy ${
                          pendingPharmacies === 1 ? 'profile is' : 'profiles are'
                        } waiting for review.`}
                  </p>
                </div>
                <Link
                  to="/admin/pharmacies?status=PENDING"
                  className="rounded-md bg-amber-700 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-amber-800"
                >
                  Review pharmacies
                </Link>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
