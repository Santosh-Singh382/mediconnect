import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import PublicHeader from '../components/PublicHeader.jsx'
import LoadingState from '../components/LoadingState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import { getDoctorById } from '../lib/doctorsApi.js'
import { getApiErrorMessage } from '../lib/apiError.js'

const DAY_SHORT = {
  MONDAY: 'Mon',
  TUESDAY: 'Tue',
  WEDNESDAY: 'Wed',
  THURSDAY: 'Thu',
  FRIDAY: 'Fri',
  SATURDAY: 'Sat',
  SUNDAY: 'Sun',
}

const DAY_ORDER = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
]

function initials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
}

function InfoRow({ label, value }) {
  return (
    <div>
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-900">
        {value || 'Not provided'}
      </dd>
    </div>
  )
}

export default function DoctorDetailsPage() {
  const { doctorId } = useParams()
  const { user } = useAuth()
  const [state, setState] = useState({
    loading: true,
    error: null,
    data: null,
  })

  const load = useCallback(() => {
    getDoctorById(doctorId)
      .then((response) => {
        setState({ loading: false, error: null, data: response.data.data })
      })
      .catch((error) => {
        const message =
          error?.response?.status === 404
            ? 'We could not find that doctor. The profile may not be available yet.'
            : getApiErrorMessage(error, 'Unable to load this doctor right now.')
        setState({ loading: false, error: message, data: null })
      })
  }, [doctorId])

  useEffect(() => {
    load()
  }, [load])

  function retry() {
    setState({ loading: true, error: null, data: null })
    load()
  }

  if (state.loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <PublicHeader />
        <main className="mx-auto max-w-3xl px-6 py-12">
          <LoadingState label="Loading doctor profile…" />
        </main>
      </div>
    )
  }

  if (state.error) {
    return (
      <div className="min-h-screen bg-slate-50">
        <PublicHeader />
        <main className="mx-auto max-w-3xl px-6 py-12">
          <ErrorState message={state.error} onRetry={retry} />
        </main>
      </div>
    )
  }

  const { doctor } = state.data
  const enabledDays = DAY_ORDER.filter((day) =>
    doctor.availability.some(
      (entry) => entry.dayOfWeek === day && entry.enabled,
    ),
  ).map((day) =>
    doctor.availability.find(
      (entry) => entry.dayOfWeek === day && entry.enabled,
    ),
  )

  return (
    <div className="min-h-screen bg-slate-50">
      <PublicHeader />

      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link
          to="/doctors"
          className="text-sm font-medium text-brand-600 transition hover:text-brand-700"
        >
          ← Back to search
        </Link>

        <section className="mt-4 flex flex-wrap items-start justify-between gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-100 text-lg font-semibold text-brand-700">
              {initials(doctor.name)}
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">
                {doctor.name}
              </h1>
              <p className="text-sm font-medium text-brand-700">
                {doctor.specialization}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {doctor.qualification} ·{' '}
                {doctor.experience !== null
                  ? `${doctor.experience} years experience`
                  : 'Experience not listed'}
              </p>
            </div>
          </div>
          <span className="inline-block rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
            APPROVED
          </span>
        </section>

        <section className="mt-6 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Book an appointment
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Choose a 30-minute slot and send a booking request to this doctor.
            </p>
          </div>
          {user?.role === 'PATIENT' ? (
            <Link
              to={`/doctors/${doctorId}/book`}
              className="shrink-0 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
            >
              Book Appointment
            </Link>
          ) : user ? (
            <p className="shrink-0 text-sm text-slate-600">
              Only patient accounts can book appointments.
            </p>
          ) : (
            <Link
              to="/login"
              state={{ from: { pathname: `/doctors/${doctorId}` } }}
              className="shrink-0 rounded-md border border-brand-600 px-4 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-50"
            >
              Sign in to book
            </Link>
          )}
        </section>

        <section className="mt-6 grid gap-6 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">
              Professional information
            </h2>
            <dl className="mt-4 space-y-3">
              <InfoRow label="Specialization" value={doctor.specialization} />
              <InfoRow label="Qualification" value={doctor.qualification} />
              <InfoRow
                label="Experience"
                value={
                  doctor.experience !== null
                    ? `${doctor.experience} years`
                    : ''
                }
              />
              <InfoRow
                label="Consultation fee"
                value={
                  doctor.consultationFee !== null
                    ? `₹${doctor.consultationFee}`
                    : ''
                }
              />
              <InfoRow
                label="Registration number"
                value={doctor.registrationNumber}
              />
            </dl>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Languages</h2>
            {doctor.languages.length > 0 ? (
              <ul className="mt-4 flex flex-wrap gap-2">
                {doctor.languages.map((language) => (
                  <li
                    key={language}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700"
                  >
                    {language}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-slate-600">
                Not provided
              </p>
            )}
          </div>
        </section>

        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            Clinic information
          </h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <InfoRow label="Clinic name" value={doctor.clinicName} />
            <InfoRow label="Street" value={doctor.clinicAddress.street} />
            <InfoRow label="City" value={doctor.clinicAddress.city} />
            <InfoRow label="State" value={doctor.clinicAddress.state} />
            <InfoRow label="Postal code" value={doctor.clinicAddress.postalCode} />
            <InfoRow label="Country" value={doctor.clinicAddress.country} />
          </dl>
        </section>

        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            Weekly availability
          </h2>
          {enabledDays.length > 0 ? (
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              {enabledDays.map((day) => (
                <div
                  key={day.dayOfWeek}
                  className="flex items-center justify-between rounded-md border border-slate-200 px-4 py-2.5"
                >
                  <dt className="text-sm font-medium text-slate-700">
                    {day.dayOfWeek.charAt(0) + day.dayOfWeek.slice(1).toLowerCase()}
                  </dt>
                  <dd className="text-sm text-slate-600">
                    {day.startTime} – {day.endTime}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-4 text-sm text-slate-600">
              No consultation hours set yet.
            </p>
          )}
        </section>

        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">About</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-700">
            {doctor.bio || 'The doctor has not added a bio yet.'}
          </p>
        </section>

        <p className="mt-6 text-xs text-slate-400">
          Availability shown as {enabledDays.map((d) => DAY_SHORT[d.dayOfWeek]).join(', ') || 'not set'}
        </p>
      </main>
    </div>
  )
}