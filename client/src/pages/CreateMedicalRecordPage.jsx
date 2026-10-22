import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import AppHeader from '../components/AppHeader.jsx'
import LoadingState from '../components/LoadingState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import { getAppointment } from '../lib/appointmentApi.js'
import { createMedicalRecord } from '../lib/medicalRecordApi.js'
import { getApiErrorMessage } from '../lib/apiError.js'
import { homePathFor, homeLinksFor } from '../lib/homePath.js'
import { inputClass } from '../lib/formStyles.js'
import {
  formatAppointmentDate,
  formatTimeRange,
  typeLabel,
  todayLocal,
} from '../lib/appointmentFormat.js'
import { RECORD_TYPE_OPTIONS } from '../lib/medicalRecordFormat.js'

function fieldError(errors, field) {
  const message = errors[field]
  return message ? (
    <p className="mt-1 text-xs text-red-600">{message}</p>
  ) : null
}

export default function CreateMedicalRecordPage() {
  const { user } = useAuth()
  const { appointmentId } = useParams()
  const navigate = useNavigate()

  const [appointment, setAppointment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const [form, setForm] = useState({
    recordType: 'CONSULTATION',
    title: '',
    diagnosis: '',
    summary: '',
    notes: '',
    recordDate: todayLocal(),
  })
  const [linkPrescription, setLinkPrescription] = useState(true)
  const [errors, setErrors] = useState({})
  const [generalError, setGeneralError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [created, setCreated] = useState(null)

  useEffect(() => {
    getAppointment(appointmentId)
      .then((response) => {
        setAppointment(response.data.data.appointment)
        setLoading(false)
      })
      .catch((error) => {
        setLoadError(
          getApiErrorMessage(error, 'Unable to load this appointment.'),
        )
        setLoading(false)
      })
  }, [appointmentId])

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (submitting) return

    setSubmitting(true)
    setErrors({})
    setGeneralError(null)

    const payload = {
      appointmentId,
      recordType: form.recordType,
      title: form.title,
      summary: form.summary,
      recordDate: form.recordDate,
      diagnosis: form.diagnosis,
      notes: form.notes,
    }

    if (linkPrescription && appointment?.prescriptionId) {
      payload.prescriptionId = appointment.prescriptionId
    }

    createMedicalRecord(payload)
      .then((response) => {
        setCreated(response.data.data.record)
      })
      .catch((error) => {
        const data = error?.response?.data
        const fieldErrors = {}
        if (Array.isArray(data?.details)) {
          for (const detail of data.details) {
            fieldErrors[detail.field] = detail.message
          }
        }
        setErrors(fieldErrors)
        setGeneralError(getApiErrorMessage(error, 'Unable to create this medical record.'))
      })
      .finally(() => {
        setSubmitting(false)
      })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <AppHeader home={homePathFor(user)} links={homeLinksFor(user)} />
        <main className="mx-auto max-w-3xl px-6 py-10">
          <LoadingState label="Loading appointment…" />
        </main>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-slate-50">
        <AppHeader home={homePathFor(user)} links={homeLinksFor(user)} />
        <main className="mx-auto max-w-3xl px-6 py-10">
          <ErrorState message={loadError} />
        </main>
      </div>
    )
  }

  if (created) {
    return (
      <div className="min-h-screen bg-slate-50">
        <AppHeader home={homePathFor(user)} links={homeLinksFor(user)} />
        <main className="mx-auto max-w-2xl px-6 py-12">
          <div className="rounded-lg border border-green-200 bg-green-50 p-8 text-center">
            <h1 className="text-xl font-semibold text-green-900">
              Medical record created
            </h1>
            <p className="mt-2 text-sm text-green-800">
              The record has been added to {created.patient.name}&apos;s medical
              history and is now available to them.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                to={`/medical-records/${created.id}`}
                className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
              >
                View record
              </Link>
              <Link
                to="/medical-records"
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Back to medical records
              </Link>
            </div>
          </div>
        </main>
      </div>
    )
  }

  const notCompleted = appointment && appointment.status !== 'COMPLETED'

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader home={homePathFor(user)} links={homeLinksFor(user)} />

      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link
          to="/doctor/appointments"
          className="text-sm font-medium text-brand-600 transition hover:text-brand-700"
        >
          &larr; Back to appointments
        </Link>

        <section className="mt-6">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            Create medical record
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Document the outcome of this completed consultation for the patient
           &apos;s medical history.
          </p>
        </section>

        {notCompleted && (
          <p className="mt-6 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            A medical record can only be created after the consultation is
            completed.
          </p>
        )}

        {generalError && (
          <p className="mt-6 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {generalError}
          </p>
        )}

        {appointment && (
          <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">
              Consultation
            </h2>
            <dl className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-slate-500">Patient</dt>
                <dd className="mt-0.5 text-sm font-medium text-slate-900">
                  {appointment.patient?.name || 'Patient'}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-slate-500">Date &amp; time</dt>
                <dd className="mt-0.5 text-sm font-medium text-slate-900">
                  {formatAppointmentDate(appointment.appointmentDate)} ·{' '}
                  {formatTimeRange(appointment.startTime, appointment.endTime)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-slate-500">Type</dt>
                <dd className="mt-0.5 text-sm font-medium text-slate-900">
                  {typeLabel(appointment.type)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-slate-500">Reason</dt>
                <dd className="mt-0.5 text-sm font-medium text-slate-900">
                  {appointment.reason || 'Not provided'}
                </dd>
              </div>
            </dl>
          </section>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-6" noValidate>
          <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Record details</h2>

            <label
              htmlFor="recordType"
              className="mt-4 block text-sm font-medium text-slate-700"
            >
              Record type
            </label>
            <select
              id="recordType"
              value={form.recordType}
              onChange={(event) => updateField('recordType', event.target.value)}
              className={inputClass}
            >
              {RECORD_TYPE_OPTIONS.filter((option) => option.value !== '').map(
                (option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ),
              )}
            </select>
            {fieldError(errors, 'recordType')}

            <label
              htmlFor="title"
              className="mt-4 block text-sm font-medium text-slate-700"
            >
              Title
            </label>
            <input
              id="title"
              type="text"
              value={form.title}
              onChange={(event) => updateField('title', event.target.value)}
              className={inputClass}
              maxLength={200}
              placeholder="e.g. Follow-up consultation"
            />
            {fieldError(errors, 'title')}

            <label
              htmlFor="recordDate"
              className="mt-4 block text-sm font-medium text-slate-700"
            >
              Record date
            </label>
            <input
              id="recordDate"
              type="date"
              value={form.recordDate}
              onChange={(event) => updateField('recordDate', event.target.value)}
              className={inputClass}
            />
            {fieldError(errors, 'recordDate')}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Clinical notes</h2>

            <label
              htmlFor="diagnosis"
              className="mt-4 block text-sm font-medium text-slate-700"
            >
              Diagnosis (optional)
            </label>
            <textarea
              id="diagnosis"
              rows={2}
              value={form.diagnosis}
              onChange={(event) => updateField('diagnosis', event.target.value)}
              className={inputClass}
              maxLength={1000}
            />
            {fieldError(errors, 'diagnosis')}

            <label
              htmlFor="summary"
              className="mt-4 block text-sm font-medium text-slate-700"
            >
              Summary
            </label>
            <textarea
              id="summary"
              rows={3}
              value={form.summary}
              onChange={(event) => updateField('summary', event.target.value)}
              className={inputClass}
              maxLength={2000}
            />
            {fieldError(errors, 'summary')}

            <label
              htmlFor="notes"
              className="mt-4 block text-sm font-medium text-slate-700"
            >
              Notes (optional)
            </label>
            <textarea
              id="notes"
              rows={3}
              value={form.notes}
              onChange={(event) => updateField('notes', event.target.value)}
              className={inputClass}
              maxLength={4000}
            />
            {fieldError(errors, 'notes')}
          </section>

          {appointment?.prescriptionId && (
            <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">
                Linked prescription
              </h2>
              <label className="mt-4 flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={linkPrescription}
                  onChange={(event) => setLinkPrescription(event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="text-sm text-slate-700">
                  Link the prescription issued for this consultation so the
                  patient can find it alongside this record.
                </span>
              </label>
              <p className="mt-2">
                <Link
                  to={`/prescriptions/${appointment.prescriptionId}`}
                  className="text-sm font-medium text-brand-600 transition hover:text-brand-700"
                >
                  View prescription
                </Link>
              </p>
            </section>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={submitting || notCompleted}
              className="rounded-md bg-brand-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Creating…' : 'Create medical record'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/doctor/appointments')}
              className="rounded-md border border-slate-300 px-5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
