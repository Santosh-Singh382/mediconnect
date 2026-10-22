import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import AppHeader from '../components/AppHeader.jsx'
import LoadingState from '../components/LoadingState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import { getMedicalRecord } from '../lib/medicalRecordApi.js'
import { getApiErrorMessage } from '../lib/apiError.js'
import { homePathFor, homeLinksFor } from '../lib/homePath.js'
import {
  recordTypeLabel,
  recordTypeClass,
  formatRecordDate,
} from '../lib/medicalRecordFormat.js'
import {
  formatAppointmentDate,
  formatTimeRange,
  typeLabel,
} from '../lib/appointmentFormat.js'

export default function MedicalRecordDetailsPage() {
  const { user } = useAuth()
  const { recordId } = useParams()

  const [state, setState] = useState({
    loading: true,
    error: null,
    record: null,
  })

  const load = useCallback(() => {
    getMedicalRecord(recordId)
      .then((response) => {
        setState({
          loading: false,
          error: null,
          record: response.data.data.record,
        })
      })
      .catch((error) => {
        setState({
          loading: false,
          error: getApiErrorMessage(error, 'Unable to load this medical record.'),
          record: null,
        })
      })
  }, [recordId])

  useEffect(() => {
    load()
  }, [load])

  function retry() {
    setState({ loading: true, error: null, record: null })
    load()
  }

  const record = state.record

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader home={homePathFor(user)} links={homeLinksFor(user)} />

      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link
          to="/medical-records"
          className="text-sm font-medium text-brand-600 transition hover:text-brand-700"
        >
          &larr; Back to medical records
        </Link>

        {state.loading ? (
          <div className="mt-8">
            <LoadingState label="Loading medical record…" />
          </div>
        ) : state.error ? (
          <div className="mt-8">
            <ErrorState message={state.error} onRetry={retry} />
          </div>
        ) : (
          <>
            <header className="mt-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <span
                  className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${recordTypeClass(record.recordType)}`}
                >
                  {recordTypeLabel(record.recordType)}
                </span>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                  {record.title}
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Recorded {formatRecordDate(record.recordDate)}
                </p>
              </div>
            </header>

            <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">
                Consultation parties
              </h2>
              <dl className="mt-3 grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm text-slate-500">Doctor</dt>
                  <dd className="mt-0.5 text-sm font-medium text-slate-900">
                    {record.doctor.name}
                    {record.doctor.specialization
                      ? ` · ${record.doctor.specialization}`
                      : ''}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-slate-500">Patient</dt>
                  <dd className="mt-0.5 text-sm font-medium text-slate-900">
                    {record.patient.name}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">Consultation</h2>
              {record.appointment ? (
                <dl className="mt-3 grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm text-slate-500">Date</dt>
                    <dd className="mt-0.5 text-sm font-medium text-slate-900">
                      {formatAppointmentDate(record.appointment.appointmentDate)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500">Time</dt>
                    <dd className="mt-0.5 text-sm font-medium text-slate-900">
                      {formatTimeRange(
                        record.appointment.startTime,
                        record.appointment.endTime,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-slate-500">Type</dt>
                    <dd className="mt-0.5 text-sm font-medium text-slate-900">
                      {typeLabel(record.appointment.type)}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-2 text-sm text-slate-600">
                  Consultation details are not available for this record.
                </p>
              )}
            </section>

            <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">Diagnosis</h2>
              <p className="mt-2 text-sm text-slate-700">
                {record.diagnosis || 'Not specified'}
              </p>
            </section>

            <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">Summary</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                {record.summary}
              </p>
            </section>

            <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">Notes</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                {record.notes || 'No additional notes'}
              </p>
            </section>

            <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">
                Linked prescription
              </h2>
              {record.prescription ? (
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="text-sm text-slate-700">
                    This record references the prescription issued for the same
                    consultation.
                  </p>
                  <Link
                    to={`/prescriptions/${record.prescription.id}`}
                    className="inline-block shrink-0 rounded-md border border-brand-200 px-3 py-1.5 text-sm font-medium text-brand-700 transition hover:bg-brand-50"
                  >
                    View prescription
                  </Link>
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-600">
                  No prescription linked to this record.
                </p>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  )
}
