import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import WorkspaceShell from '../components/WorkspaceShell.jsx'
import LoadingState from '../components/LoadingState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import AppointmentStatusBadge from '../components/AppointmentStatusBadge.jsx'
import {
  getDoctorAppointments,
  confirmAppointment,
  rejectAppointment,
  cancelAppointment,
  completeAppointment,
} from '../lib/appointmentApi.js'
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

export default function DoctorAppointmentsPage() {
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
  const [actionState, setActionState] = useState({
    busyId: null,
    error: null,
  })

  const load = useCallback(() => {
    const params = new URLSearchParams()
    const status = searchParams.get('status')
    const date = searchParams.get('date')
    const page = searchParams.get('page')
    if (status) params.set('status', status)
    if (date) params.set('date', date)
    if (page) params.set('page', page)
    getDoctorAppointments(Object.fromEntries(params.entries()))
      .then((response) => {
        setState({ loading: false, error: null, data: response.data.data })
      })
      .catch((error) => {
        setState({
          loading: false,
          error: getApiErrorMessage(
            error,
            'Unable to load your appointments right now.',
          ),
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

  function runAction(id, promiseFactory) {
    setActionState({ busyId: id, error: null })
    promiseFactory(id)
      .then(() => {
        setActionState({ busyId: null, error: null })
        beginLoading()
        load()
      })
      .catch((error) => {
        setActionState({ busyId: null, error: getApiErrorMessage(error, 'Action failed.') })
      })
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
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-300">Doctor workspace</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight">Appointments</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
              Review patient booking requests and manage every consultation status.
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

        {actionState.error && (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {actionState.error}
          </p>
        )}

        {state.loading ? (
          <div className="mt-8">
            <LoadingState label="Loading appointments…" />
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
                : 'You do not have any appointment bookings yet.'}
            </p>
            {hasFilters() ? (
              <button
                type="button"
                onClick={handleClear}
                className="mt-5 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
              >
                Clear filters
              </button>
            ) : null}
          </div>
        ) : (
          <>
            <p className="mt-6 text-sm text-slate-500">
              {total} {total === 1 ? 'appointment' : 'appointments'} found
            </p>
            <section className="mt-3 space-y-4">
              {appointments.map((appointment) => {
                const expanded = expandedId === appointment.id
                const busy = actionState.busyId === appointment.id
                const status = appointment.status
                const consultationAction = consultationActionFor(appointment)
                return (
                  <article
                    key={appointment.id}
                    className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div
                          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${avatarColor(appointment.patient.id || appointment.patientId)}`}
                          aria-hidden="true"
                        >
                          {initials(appointment.patient.name)}
                        </div>
                        <div>
                          <h2 className="text-base font-semibold text-slate-900">
                            {appointment.patient.name}
                          </h2>
                          <p className="text-sm text-slate-500">
                            {formatAppointmentDate(appointment.appointmentDate)} ·{' '}
                            {formatTimeRange(
                              appointment.startTime,
                              appointment.endTime,
                            )}
                          </p>
                          <p className="mt-0.5 text-sm text-slate-500">
                            {typeLabel(appointment.type)} consultation
                            {appointment.patient.phone
                              ? ` · ${appointment.patient.phone}`
                              : ''}
                          </p>
                        </div>
                      </div>
                      <AppointmentStatusBadge status={status} />
                    </div>

                    <p className="mt-3 text-sm text-slate-600">
                      <span className="font-medium text-slate-900">Reason: </span>
                      {appointment.reason}
                    </p>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {status === 'PENDING' && (
                        <>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              runAction(appointment.id, confirmAppointment)
                            }
                            className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {busy ? 'Updating…' : 'Confirm'}
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              runAction(appointment.id, rejectAppointment)
                            }
                            className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              runAction(appointment.id, cancelAppointment)
                            }
                            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                      {status === 'CONFIRMED' && (
                        <>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              runAction(appointment.id, completeAppointment)
                            }
                            className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {busy ? 'Updating…' : 'Mark as completed'}
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              runAction(appointment.id, cancelAppointment)
                            }
                            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                      {consultationAction && (
                        <Link
                          to={consultationAction.to}
                          className={consultationAction.className}
                        >
                          {consultationAction.label}
                        </Link>
                      )}
                      {status === 'COMPLETED' && (
                        <>
                          {appointment.prescriptionId ? (
                            <Link
                              to={`/prescriptions/${appointment.prescriptionId}`}
                              className="rounded-md border border-brand-200 px-3 py-1.5 text-sm font-medium text-brand-700 transition hover:bg-brand-50"
                            >
                              View Prescription
                            </Link>
                          ) : (
                            <Link
                              to={`/doctor/appointments/${appointment.id}/prescription`}
                              className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-brand-700"
                            >
                              Create Prescription
                            </Link>
                          )}
                          <Link
                            to={`/appointments/${appointment.id}/medical-record/new`}
                            className="rounded-md border border-teal-200 px-3 py-1.5 text-sm font-medium text-teal-700 transition hover:bg-teal-50"
                          >
                            Create Medical Record
                          </Link>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : appointment.id)}
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        {expanded ? 'Hide details' : 'View details'}
                      </button>
                    </div>

                    {expanded && (
                      <dl className="mt-4 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
                        <div className="flex justify-between gap-4">
                          <dt className="text-slate-500">Appointment ID</dt>
                          <dd className="break-all font-medium text-slate-700">
                            {appointment.id}
                          </dd>
                        </div>
                        {appointment.notes && (
                          <div className="flex justify-between gap-4">
                            <dt className="text-slate-500">Notes</dt>
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