import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import WorkspaceShell from '../components/WorkspaceShell.jsx'
import LoadingState from '../components/LoadingState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import AppointmentStatusBadge from '../components/AppointmentStatusBadge.jsx'
import { getMyAppointments, cancelAppointment } from '../lib/appointmentApi.js'
import { getApiErrorMessage } from '../lib/apiError.js'
import { inputClass } from '../lib/formStyles.js'
import {
  formatAppointmentDate,
  formatTimeRange,
  typeLabel,
  STATUS_OPTIONS,
} from '../lib/appointmentFormat.js'
import { consultationActionFor } from '../lib/consultation.js'

function initials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
}

function avatarColor(id) {
  const palette = [
    'bg-blue-100 text-blue-700',
    'bg-teal-100 text-teal-700',
    'bg-indigo-100 text-indigo-700',
    'bg-rose-100 text-rose-700',
    'bg-emerald-100 text-emerald-700',
    'bg-violet-100 text-violet-700',
  ]
  let hash = 0
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) % 997
  return palette[hash % palette.length]
}

export default function MyAppointmentsPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const [draft, setDraft] = useState({
    status: searchParams.get('status') || '',
    date: searchParams.get('date') || '',
  })
  const [state, setState] = useState({
    loading: true,
    error: null,
    data: null,
  })
  const [expandedId, setExpandedId] = useState(null)
  const [cancelArmedId, setCancelArmedId] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [actionError, setActionError] = useState(null)

  const load = useCallback(() => {
    const params = new URLSearchParams()
    const status = searchParams.get('status')
    const date = searchParams.get('date')
    const page = searchParams.get('page')
    if (status) params.set('status', status)
    if (date) params.set('date', date)
    if (page) params.set('page', page)
    getMyAppointments(Object.fromEntries(params.entries()))
      .then((response) => {
        setState({ loading: false, error: null, data: response.data.data })
      })
      .catch((error) => {
        setState({
          loading: false,
          error: getApiErrorMessage(error, 'Unable to load your appointments right now.'),
          data: null,
        })
      })
  }, [searchParams])

  useEffect(() => {
    load()
  }, [load])

  function beginLoading() {
    setState({ loading: true, error: null, data: null })
  }

  function retry() {
    beginLoading()
    load()
  }

  function handleApply(event) {
    event.preventDefault()
    const next = new URLSearchParams()
    if (draft.status) next.set('status', draft.status)
    if (draft.date) next.set('date', draft.date)
    next.set('page', '1')
    beginLoading()
    setSearchParams(next)
  }

  function handleClear() {
    setDraft({ status: '', date: '' })
    beginLoading()
    setSearchParams({})
  }

  function changePage(page) {
    const next = new URLSearchParams(searchParams)
    next.set('page', String(page))
    beginLoading()
    setSearchParams(next)
  }

  function hasFilters() {
    return searchParams.get('status') || searchParams.get('date')
  }

  function handleCancel(id) {
    setBusyId(id)
    setActionError(null)
    cancelAppointment(id)
      .then(() => {
        setCancelArmedId(null)
        setExpandedId(null)
        beginLoading()
        load()
      })
      .catch((error) => {
        setActionError(getApiErrorMessage(error, 'Unable to cancel this appointment.'))
      })
      .finally(() => {
        setBusyId(null)
      })
  }

  const currentPage = Number(searchParams.get('page')) || 1
  const { appointments, pagination } = state.data || {
    appointments: [],
    pagination: null,
  }
  const { total, totalPages } = pagination || { total: 0, totalPages: 0 }

  return (
    <WorkspaceShell user={user}>
      <div className="py-2 lg:py-4">
        <section className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-8 text-white shadow-xl sm:px-10">
          <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-blue-600/30 blur-3xl" aria-hidden="true" />
          <div className="relative">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-300">Your care schedule</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight">My Appointments</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
              Review, filter, and manage your upcoming and completed consultations.
            </p>
          </div>
        </section>

        <form
          onSubmit={handleApply}
          className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="status"
                className="block text-sm font-medium text-slate-700"
              >
                Status
              </label>
              <select
                id="status"
                value={draft.status}
                onChange={(event) =>
                  setDraft((d) => ({ ...d, status: event.target.value }))
                }
                className={inputClass}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="date" className="block text-sm font-medium text-slate-700">
                Date
              </label>
              <input
                id="date"
                type="date"
                value={draft.date}
                onChange={(event) =>
                  setDraft((d) => ({ ...d, date: event.target.value }))
                }
                className={inputClass}
              />
            </div>
          </div>
          <div className="mt-5 flex items-center gap-3">
            <button
              type="submit"
              className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-brand-700"
            >
              Apply filters
            </button>
            {hasFilters() ? (
              <button
                type="button"
                onClick={handleClear}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              >
                Clear filters
              </button>
            ) : null}
          </div>
        </form>

        {actionError && (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {actionError}
          </p>
        )}

        {state.loading ? (
          <div className="mt-8">
            <LoadingState label="Loading your appointments…" />
          </div>
        ) : state.error ? (
          <div className="mt-8">
            <ErrorState message={state.error} onRetry={retry} />
          </div>
        ) : appointments.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">
              No appointments found
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
              {hasFilters()
                ? 'Try adjusting your filters to see more results.'
                : 'You have not booked any appointments yet. Find a doctor to get started.'}
            </p>
            {hasFilters() ? (
              <button
                type="button"
                onClick={handleClear}
                className="mt-5 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
              >
                Clear filters
              </button>
            ) : (
              <Link
                to="/doctors"
                className="mt-5 inline-block rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
              >
                Find a Doctor
              </Link>
            )}
          </div>
        ) : (
          <>
            <p className="mt-6 text-sm text-slate-500">
              {total} {total === 1 ? 'appointment' : 'appointments'} found
            </p>
            <section className="mt-3 space-y-4">
              {appointments.map((appointment) => {
                const expanded = expandedId === appointment.id
                const canCancel =
                  appointment.status === 'PENDING' ||
                  appointment.status === 'CONFIRMED'
                const canView = !canCancel
                const consultationAction = consultationActionFor(appointment)
                const armed = cancelArmedId === appointment.id
                const busy = busyId === appointment.id
                return (
                  <article
                    key={appointment.id}
                    className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div
                          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${avatarColor(appointment.doctor.id || appointment.doctorId)}`}
                          aria-hidden="true"
                        >
                          {initials(appointment.doctor.name)}
                        </div>
                        <div>
                          <h2 className="text-base font-semibold text-slate-900">
                            {appointment.doctor.name}
                          </h2>
                          <p className="text-sm font-medium text-brand-700">
                            {appointment.doctor.specialization || 'Doctor'}
                          </p>
                          <p className="mt-0.5 text-sm text-slate-500">
                            {formatAppointmentDate(appointment.appointmentDate)} ·{' '}
                            {formatTimeRange(
                              appointment.startTime,
                              appointment.endTime,
                            )}
                          </p>
                          <p className="mt-0.5 text-sm text-slate-500">
                            {typeLabel(appointment.type)} consultation
                            {appointment.doctor.consultationFee !== null
                              ? ` · ₹${appointment.doctor.consultationFee}`
                              : ''}
                          </p>
                        </div>
                      </div>
                      <AppointmentStatusBadge status={appointment.status} />
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {canCancel &&
                        (armed ? (
                          <>
                            <span className="text-sm text-slate-600">
                              Cancel this appointment?
                            </span>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleCancel(appointment.id)}
                              className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {busy ? 'Cancelling…' : 'Yes, cancel'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setCancelArmedId(null)
                                setActionError(null)
                              }}
                              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                            >
                              Keep it
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setCancelArmedId(appointment.id)
                              setActionError(null)
                            }}
                            className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
                          >
                            Cancel appointment
                          </button>
                        ))}
                      {consultationAction && (
                        <Link
                          to={consultationAction.to}
                          className={consultationAction.className}
                        >
                          {consultationAction.label}
                        </Link>
                      )}
                      {appointment.prescriptionId && (
                        <Link
                          to={`/prescriptions/${appointment.prescriptionId}`}
                          className="rounded-md border border-brand-200 px-3 py-1.5 text-sm font-medium text-brand-700 transition hover:bg-brand-50"
                        >
                          View Prescription
                        </Link>
                      )}
                      {canView && (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedId(expanded ? null : appointment.id)
                          }
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                        >
                          {expanded ? 'Hide details' : 'View details'}
                        </button>
                      )}
                    </div>

                    {expanded && (
                      <dl className="mt-4 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
                        <div className="flex justify-between gap-4">
                          <dt className="text-slate-500">Reason</dt>
                          <dd className="max-w-[65%] text-right font-medium text-slate-900">
                            {appointment.reason}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt className="text-slate-500">Appointment ID</dt>
                          <dd className="break-all font-medium text-slate-700">
                            {appointment.id}
                          </dd>
                        </div>
                        {appointment.notes && (
                          <div className="flex justify-between gap-4">
                            <dt className="text-slate-500">Doctor's notes</dt>
                            <dd className="max-w-[65%] text-right font-medium text-slate-900">
                              {appointment.notes}
                            </dd>
                          </div>
                        )}
                      </dl>
                    )}
                  </article>
                )
              })}
            </section>

            {totalPages > 1 && (
              <nav
                className="mt-8 flex flex-wrap items-center justify-between gap-3"
                aria-label="Pagination"
              >
                <p className="text-sm text-slate-500">
                  Showing page {currentPage} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => changePage(currentPage - 1)}
                    disabled={currentPage <= 1}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => changePage(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </nav>
            )}
          </>
        )}
      </div>
    </WorkspaceShell>
  )
}