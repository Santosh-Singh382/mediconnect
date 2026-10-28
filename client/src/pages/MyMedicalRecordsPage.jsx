import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import WorkspaceShell from '../components/WorkspaceShell.jsx'
import LoadingState from '../components/LoadingState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import MedicalDocumentsSection from '../components/MedicalDocumentsSection.jsx'
import { getMedicalRecords } from '../lib/medicalRecordApi.js'
import { getApiErrorMessage } from '../lib/apiError.js'
import { inputClass } from '../lib/formStyles.js'
import {
  recordTypeLabel,
  recordTypeClass,
  formatRecordDate,
  RECORD_TYPE_OPTIONS,
} from '../lib/medicalRecordFormat.js'

export default function MyMedicalRecordsPage() {
  const { user } = useAuth()
  const isDoctor = user?.role === 'DOCTOR'
  const [searchParams, setSearchParams] = useSearchParams()

  const [draft, setDraft] = useState({
    recordType: searchParams.get('recordType') || '',
  })
  const [state, setState] = useState({
    loading: true,
    error: null,
    data: null,
  })

  const load = useCallback(() => {
    const params = new URLSearchParams()
    const recordType = searchParams.get('recordType')
    const page = searchParams.get('page')
    if (recordType) params.set('recordType', recordType)
    if (page) params.set('page', page)
    getMedicalRecords(Object.fromEntries(params.entries()))
      .then((response) => {
        setState({ loading: false, error: null, data: response.data.data })
      })
      .catch((error) => {
        setState({
          loading: false,
          error: getApiErrorMessage(error, 'Unable to load medical records right now.'),
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
    if (draft.recordType) next.set('recordType', draft.recordType)
    next.set('page', '1')
    beginLoading()
    setSearchParams(next)
  }

  function handleClear() {
    setDraft({ recordType: '' })
    beginLoading()
    setSearchParams({})
  }

  function changePage(page) {
    const next = new URLSearchParams(searchParams)
    next.set('page', String(page))
    beginLoading()
    setSearchParams(next)
  }

  const currentPage = Number(searchParams.get('page')) || 1
  const { records, pagination } = state.data || { records: [], pagination: null }
  const { total, totalPages } = pagination || { total: 0, totalPages: 0 }

  const emptyMessage = isDoctor
    ? 'No medical records yet. Records you create after completed consultations will appear here.'
    : 'No medical records yet. Your doctor can create a record after a completed consultation and it will appear here.'

  return (
    <WorkspaceShell user={user}>
      <div className="py-2 lg:py-4">
        <section className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-8 text-white shadow-xl sm:px-10 sm:py-10">
          <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-blue-600/30 blur-3xl" aria-hidden="true" />
          <div className="absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-teal-500/15 blur-3xl" aria-hidden="true" />
          <div className="relative flex flex-col justify-between gap-7 lg:flex-row lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-300">
                Your health library
              </p>
              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                Medical Records
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
                {isDoctor
                  ? 'Review the medical records you have created for your patients.'
                  : 'Keep your reports, diagnoses, and consultation history organized in one private place.'}
              </p>
            </div>
            {!isDoctor && (
              <Link
                to="/medical-records/upload"
                className="inline-flex w-fit items-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-950/30 transition hover:-translate-y-0.5 hover:bg-blue-500"
              >
                + Upload document
              </Link>
            )}
          </div>
        </section>

        {!isDoctor && <MedicalDocumentsSection />}

        <form
          onSubmit={handleApply}
          className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5"
        >
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Browse your records</h2>
              <p className="mt-1 text-xs text-slate-500">Filter your health history by record type.</p>
            </div>
            {searchParams.get('recordType') ? (
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">Filter active</span>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="recordType"
                className="block text-sm font-medium text-slate-700"
              >
                Record type
              </label>
              <select
                id="recordType"
                value={draft.recordType}
                onChange={(event) =>
                  setDraft((d) => ({ ...d, recordType: event.target.value }))
                }
                className={inputClass}
              >
                {RECORD_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-5 flex items-center gap-3">
            <button
              type="submit"
              className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm shadow-blue-200 transition hover:-translate-y-0.5 hover:bg-brand-700"
            >
              Apply filter
            </button>
            {searchParams.get('recordType') ? (
              <button
                type="button"
                onClick={handleClear}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              >
                Clear filter
              </button>
            ) : null}
          </div>
        </form>

        {state.loading ? (
          <div className="mt-8">
            <LoadingState label="Loading medical records…" />
          </div>
        ) : state.error ? (
          <div className="mt-8">
            <ErrorState message={state.error} onRetry={retry} />
          </div>
        ) : records.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">
              No medical records
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
              {emptyMessage}
            </p>
            <div className="mt-5">
              {isDoctor ? (
                <Link
                  to="/doctor/appointments"
                  className="inline-block rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700"
                >
                  Go to appointments
                </Link>
              ) : (
                <Link
                  to="/appointments"
                  className="inline-block rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
                >
                  View my appointments
                </Link>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="mt-8">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Health history</p>
              <p className="mt-1 text-sm text-slate-500">
                {total} record{total === 1 ? '' : 's'} available
              </p>
            </div>

            <section className="mt-3 space-y-4">
              {records.map((record) => {
                const counterpart = isDoctor ? record.patient : record.doctor
                return (
                  <article
                    key={record.id}
                    className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${recordTypeClass(record.recordType)}`}
                          >
                            {recordTypeLabel(record.recordType)}
                          </span>
                          <span className="text-xs text-slate-400">
                            {formatRecordDate(record.recordDate)}
                          </span>
                        </div>
                        <h2 className="mt-2 text-base font-semibold text-slate-900">
                          {record.title}
                        </h2>
                        <p className="mt-0.5 text-sm font-medium text-brand-700">
                          {counterpart.name}
                          {!isDoctor && record.doctor.specialization
                            ? ` · ${record.doctor.specialization}`
                            : ''}
                        </p>
                      </div>
                      <Link
                        to={`/medical-records/${record.id}`}
                        className="inline-block shrink-0 rounded-xl bg-brand-600 px-3 py-2 text-sm font-bold text-white transition hover:bg-brand-700"
                      >
                        View record
                      </Link>
                    </div>

                    <p className="mt-3 text-sm text-slate-600">{record.summary}</p>

                    <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-1 text-sm">
                      <div className="flex gap-2">
                        <dt className="shrink-0 text-slate-500">Consultation:</dt>
                        <dd className="text-slate-900">
                          {record.appointment
                            ? `${formatRecordDate(record.appointment.appointmentDate)} · ${record.appointment.startTime}`
                            : 'Not available'}
                        </dd>
                      </div>
                      {record.prescription ? (
                        <div className="flex gap-2">
                          <dt className="shrink-0 text-slate-500">Prescription:</dt>
                          <dd className="text-slate-900">Linked</dd>
                        </div>
                      ) : null}
                    </dl>
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
