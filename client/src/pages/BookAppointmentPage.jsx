import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import AppHeader from '../components/AppHeader.jsx'
import LoadingState from '../components/LoadingState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import { getDoctorById } from '../lib/doctorsApi.js'
import { createAppointment, getAvailability } from '../lib/appointmentApi.js'
import { getApiErrorMessage } from '../lib/apiError.js'
import { homePathFor, homeLinksFor } from '../lib/homePath.js'
import {
  formatAppointmentDate,
  todayLocal,
  typeLabel,
} from '../lib/appointmentFormat.js'
import { inputClass } from '../lib/formStyles.js'

const STEPS = [
  { number: 1, label: 'Date' },
  { number: 2, label: 'Time' },
  { number: 3, label: 'Type' },
  { number: 4, label: 'Reason' },
  { number: 5, label: 'Review' },
]

const TYPES = [
  { value: 'VIDEO', label: 'Video' },
  { value: 'AUDIO', label: 'Audio' },
  { value: 'CHAT', label: 'Chat' },
]

const MAX_REASON_LENGTH = 500

function AvailabilitySlots({ doctorId, date, selected, onSelect }) {
  const [state, setState] = useState({ loading: true, error: null, data: null })
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    getAvailability(doctorId, date)
      .then((response) => {
        if (cancelled) return
        setState({ loading: false, error: null, data: response.data.data })
      })
      .catch((error) => {
        if (cancelled) return
        setState({
          loading: false,
          error: getApiErrorMessage(error, 'Unable to load availability right now.'),
          data: null,
        })
      })
    return () => {
      cancelled = true
    }
  }, [doctorId, date, retryKey])

  if (state.loading) {
    return <LoadingState label="Loading availability…" />
  }

  if (state.error) {
    return (
      <ErrorState
        message={state.error}
        onRetry={() => {
          setState({ loading: true, error: null, data: null })
          setRetryKey((value) => value + 1)
        }}
      />
    )
  }

  const availableSlots = state.data ? state.data.slots.filter((slot) => slot.available) : []

  if (availableSlots.length === 0) {
    return (
      <p className="mt-4 text-sm text-slate-600">
        No available slots on this day. Choose another date.
      </p>
    )
  }

  return (
    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
      {state.data.slots.map((slot) => {
        const isSelected = selected && selected.startTime === slot.startTime
        const disabled = !slot.available
        return (
          <button
            key={slot.startTime}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(slot)}
            title={disabled ? 'This slot is already booked' : undefined}
            className={`rounded-md px-3 py-2 text-sm font-medium transition ${
              isSelected
                ? 'bg-brand-600 text-white'
                : disabled
                  ? 'cursor-not-allowed bg-slate-100 text-slate-400 line-through'
                  : 'border border-slate-300 bg-white text-slate-700 hover:border-brand-500 hover:text-brand-700'
            }`}
          >
            {slot.startTime} – {slot.endTime}
          </button>
        )
      })}
    </div>
  )
}

export default function BookAppointmentPage() {
  const { doctorId } = useParams()
  const { user } = useAuth()

  const [doctorState, setDoctorState] = useState({
    loading: true,
    error: null,
    data: null,
  })

  const [step, setStep] = useState(1)
  const [date, setDate] = useState('')
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [type, setType] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [createdAppointment, setCreatedAppointment] = useState(null)
  const [availabilityRefresh, setAvailabilityRefresh] = useState(0)

  const loadDoctor = useCallback(() => {
    getDoctorById(doctorId)
      .then((response) => {
        setDoctorState({ loading: false, error: null, data: response.data.data })
      })
      .catch((error) => {
        setDoctorState({
          loading: false,
          error: getApiErrorMessage(error, 'Unable to load this doctor right now.'),
          data: null,
        })
      })
  }, [doctorId])

  useEffect(() => {
    loadDoctor()
  }, [loadDoctor])

  function retryDoctor() {
    setDoctorState({ loading: true, error: null, data: null })
    loadDoctor()
  }

  function handleDateChange(value) {
    setDate(value)
    setSelectedSlot(null)
    setSubmitError(null)
  }

  function selectSlot(slot) {
    setSelectedSlot(slot)
    setSubmitError(null)
  }

  function resetBooking() {
    setStep(1)
    setDate('')
    setSelectedSlot(null)
    setType('')
    setReason('')
    setSubmitting(false)
    setSubmitError(null)
    setCreatedAppointment(null)
  }

  function handleConfirm() {
    if (submitting || !date || !selectedSlot || !type || !reason.trim()) {
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    createAppointment({
      doctorId,
      appointmentDate: date,
      startTime: selectedSlot.startTime,
      type,
      reason: reason.trim(),
    })
      .then((response) => {
        setSubmitting(false)
        setCreatedAppointment(response.data.data.appointment)
        setStep(6)
      })
      .catch((error) => {
        setSubmitting(false)
        const isConflict =
          error?.response?.status === 409 || error?.response?.data?.code === 'CONFLICT'
        if (isConflict) {
          setSubmitError(
            'Selected appointment slot is no longer available. Please choose another slot.',
          )
          setSelectedSlot(null)
          setStep(2)
          setAvailabilityRefresh((value) => value + 1)
          return
        }
        setSubmitError(getApiErrorMessage(error, 'Unable to book this appointment.'))
      })
  }

  if (doctorState.loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <AppHeader home={homePathFor(user)} links={homeLinksFor(user)} />
        <main className="mx-auto max-w-3xl px-6 py-12">
          <LoadingState label="Loading doctor details…" />
        </main>
      </div>
    )
  }

  if (doctorState.error) {
    return (
      <div className="min-h-screen bg-slate-50">
        <AppHeader home={homePathFor(user)} links={homeLinksFor(user)} />
        <main className="mx-auto max-w-3xl px-6 py-12">
          <ErrorState message={doctorState.error} onRetry={retryDoctor} />
        </main>
      </div>
    )
  }

  const { doctor } = doctorState.data
  const today = todayLocal()

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader home={homePathFor(user)} links={homeLinksFor(user)} />

      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link
          to={`/doctors/${doctorId}`}
          className="text-sm font-medium text-brand-600 transition hover:text-brand-700"
        >
          ← Back to doctor profile
        </Link>

        <section className="mt-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              Book with {doctor.name}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {doctor.specialization} · {doctor.qualification}
            </p>
            <dl className="mt-3 grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
              <div className="text-slate-600">
                <span className="font-medium text-slate-900">Experience:</span>{' '}
                {doctor.experience !== null ? `${doctor.experience} years` : 'Not listed'}
              </div>
              <div className="text-slate-600">
                <span className="font-medium text-slate-900">Fee:</span>{' '}
                {doctor.consultationFee !== null
                  ? `₹${doctor.consultationFee}`
                  : 'Not listed'}
              </div>
              <div className="text-slate-600">
                <span className="font-medium text-slate-900">Languages:</span>{' '}
                {doctor.languages.length > 0 ? doctor.languages.join(', ') : 'Not listed'}
              </div>
              <div className="text-slate-600">
                <span className="font-medium text-slate-900">Clinic:</span>{' '}
                {doctor.clinicName || 'Not listed'}
              </div>
            </dl>
          </div>
        </section>

        {step < 6 && (
          <nav className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <ol className="flex min-w-max items-center gap-2 text-sm">
              {STEPS.map((item) => (
                <li key={item.number} className="flex items-center gap-2">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                      step === item.number
                        ? 'bg-brand-600 text-white'
                        : step > item.number
                          ? 'bg-brand-100 text-brand-700'
                          : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {item.number}
                  </span>
                  <span
                    className={
                      step === item.number
                        ? 'font-medium text-slate-900'
                        : 'text-slate-500'
                    }
                  >
                    {item.label}
                  </span>
                  {item.number < STEPS.length && (
                    <span className="mx-1 h-px w-4 bg-slate-200" aria-hidden="true" />
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}

        {step === 6 && createdAppointment ? (
          <section className="mt-6 rounded-lg border border-green-200 bg-green-50 p-8 text-center">
            <h2 className="text-lg font-semibold text-green-900">
              Appointment booked successfully
            </h2>
            <p className="mt-1 text-sm text-green-800">
              Your booking request is pending the doctor's confirmation.
            </p>
            <dl className="mx-auto mt-5 max-w-sm space-y-2 rounded-lg border border-green-200 bg-white p-5 text-left text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Doctor</dt>
                <dd className="font-medium text-slate-900">{doctor.name}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Date</dt>
                <dd className="font-medium text-slate-900">
                  {formatAppointmentDate(createdAppointment.appointmentDate)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Time</dt>
                <dd className="font-medium text-slate-900">
                  {createdAppointment.startTime} – {createdAppointment.endTime}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Type</dt>
                <dd className="font-medium text-slate-900">
                  {typeLabel(createdAppointment.type)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Status</dt>
                <dd className="font-medium text-slate-900">
                  {createdAppointment.status}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Appointment ID</dt>
                <dd className="break-all font-medium text-slate-700">
                  {createdAppointment.id}
                </dd>
              </div>
            </dl>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/appointments"
                className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
              >
                View My Appointments
              </Link>
              <button
                type="button"
                onClick={resetBooking}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Book another appointment
              </button>
            </div>
          </section>
        ) : (
          <div className="mt-6 space-y-6">
            <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">
                1. Choose a date
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Past dates cannot be selected. Pick a day to see the doctor's
                availability.
              </p>
              <input
                type="date"
                min={today}
                value={date}
                onChange={(event) => handleDateChange(event.target.value)}
                className={inputClass}
              />
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-sm text-slate-600">
                  {date ? formatAppointmentDate(date) : ''}
                </span>
                <button
                  type="button"
                  disabled={!date}
                  onClick={() => setStep(2)}
                  className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Continue
                </button>
              </div>
            </section>

            {step >= 2 && (
              <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">
                      2. Choose a time
                    </h2>
                    {date && (
                      <p className="mt-1 text-sm text-slate-600">
                        {formatAppointmentDate(date)} · 30-minute slots
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSubmitError(null)
                      setStep(1)
                    }}
                    className="text-sm font-medium text-brand-600 transition hover:text-brand-700"
                  >
                    ← Back
                  </button>
                </div>
                {submitError && (
                  <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {submitError}
                  </p>
                )}
                {date ? (
                  <AvailabilitySlots
                    key={`${date}-${availabilityRefresh}`}
                    doctorId={doctorId}
                    date={date}
                    selected={selectedSlot}
                    onSelect={selectSlot}
                  />
                ) : null}
                <div className="mt-4 flex items-center justify-end">
                  <button
                    type="button"
                    disabled={!selectedSlot}
                    onClick={() => {
                      setSubmitError(null)
                      setStep(3)
                    }}
                    className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Continue
                  </button>
                </div>
              </section>
            )}

            {step >= 3 && (
              <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-slate-900">
                    3. Choose consultation type
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      setSubmitError(null)
                      setStep(2)
                    }}
                    className="text-sm font-medium text-brand-600 transition hover:text-brand-700"
                  >
                    ← Back
                  </button>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {TYPES.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setType(option.value)}
                      className={`rounded-md border px-4 py-3 text-sm font-medium transition ${
                        type === option.value
                          ? 'border-brand-600 bg-brand-50 text-brand-700'
                          : 'border-slate-300 bg-white text-slate-700 hover:border-brand-500'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-end">
                  <button
                    type="button"
                    disabled={!type}
                    onClick={() => setStep(4)}
                    className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Continue
                  </button>
                </div>
              </section>
            )}

            {step >= 4 && (
              <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-slate-900">
                    4. Reason for consultation
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      setSubmitError(null)
                      setStep(3)
                    }}
                    className="text-sm font-medium text-brand-600 transition hover:text-brand-700"
                  >
                    ← Back
                  </button>
                </div>
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  maxLength={MAX_REASON_LENGTH}
                  rows={4}
                  placeholder="Briefly describe why you need this consultation (required)."
                  className={`${inputClass} mt-4 resize-y`}
                />
                <div className="mt-1 flex items-center justify-between">
                  <button
                    type="button"
                    disabled={!reason.trim()}
                    onClick={() => setStep(5)}
                    className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Continue
                  </button>
                  <p className="text-xs text-slate-400">
                    {reason.length} / {MAX_REASON_LENGTH}
                  </p>
                </div>
              </section>
            )}

            {step === 5 && (
              <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-slate-900">
                    5. Review and confirm
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      setSubmitError(null)
                      setStep(4)
                    }}
                    className="text-sm font-medium text-brand-600 transition hover:text-brand-700"
                  >
                    ← Back
                  </button>
                </div>
                <dl className="mt-4 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Doctor</dt>
                    <dd className="font-medium text-slate-900">{doctor.name}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Date</dt>
                    <dd className="font-medium text-slate-900">
                      {formatAppointmentDate(date)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Time</dt>
                    <dd className="font-medium text-slate-900">
                      {selectedSlot.startTime} – {selectedSlot.endTime}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Consultation type</dt>
                    <dd className="font-medium text-slate-900">{typeLabel(type)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Reason</dt>
                    <dd className="max-w-[60%] text-right font-medium text-slate-900">
                      {reason.trim()}
                    </dd>
                  </div>
                </dl>

                {submitError && (
                  <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {submitError}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={submitting}
                  className="mt-5 w-full rounded-md bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? 'Booking…' : 'Confirm Appointment'}
                </button>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  )
}