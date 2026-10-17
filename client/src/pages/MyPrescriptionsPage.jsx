import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import AppHeader from '../components/AppHeader.jsx'
import LoadingState from '../components/LoadingState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import PrescriptionStatusBadge from '../components/PrescriptionStatusBadge.jsx'
import {
  getMyPrescriptions,
  getDoctorPrescriptions,
} from '../lib/prescriptionApi.js'
import { getApiErrorMessage } from '../lib/apiError.js'
import { homePathFor, homeLinksFor } from '../lib/homePath.js'
import { formatTimestamp } from '../lib/prescriptionFormat.js'

function initials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
}

export default function MyPrescriptionsPage() {
  const { user } = useAuth()
  const isDoctor = user?.role === 'DOCTOR'

  const [state, setState] = useState({
    loading: true,
    error: null,
    prescriptions: [],
  })

  const load = useCallback(() => {
    const request = isDoctor ? getDoctorPrescriptions : getMyPrescriptions
    request()
      .then((response) => {
        setState({
          loading: false,
          error: null,
          prescriptions: response.data.data.prescriptions,
        })
      })
      .catch((error) => {
        setState({
          loading: false,
          error: getApiErrorMessage(error, 'Unable to load prescriptions right now.'),
          prescriptions: [],
        })
      })
  }, [isDoctor])

  useEffect(() => {
    load()
  }, [load])

  function retry() {
    setState({ loading: true, error: null, prescriptions: [] })
    load()
  }

  const emptyMessage = isDoctor
    ? 'No prescriptions yet. Prescriptions you issue after completed consultations will appear here.'
    : 'No prescriptions yet. Prescriptions issued after completed consultations will appear here.'

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader home={homePathFor(user)} links={homeLinksFor(user)} />

      <main className="mx-auto max-w-4xl px-6 py-10">
        <section>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            Prescriptions
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {isDoctor
              ? 'Review the prescriptions you have issued to your patients.'
              : 'View prescriptions issued to you after completed consultations.'}
          </p>
        </section>

        {state.loading ? (
          <div className="mt-8">
            <LoadingState label="Loading prescriptions…" />
          </div>
        ) : state.error ? (
          <div className="mt-8">
            <ErrorState message={state.error} onRetry={retry} />
          </div>
        ) : state.prescriptions.length === 0 ? (
          <div className="mt-8 rounded-lg border border-slate-200 bg-white p-10 text-center shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">
              No prescriptions yet
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
              {emptyMessage}
            </p>
            {isDoctor ? (
              <Link
                to="/doctor/appointments"
                className="mt-5 inline-block rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
              >
                Go to appointments
              </Link>
            ) : (
              <Link
                to="/appointments"
                className="mt-5 inline-block rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
              >
                View my appointments
              </Link>
            )}
          </div>
        ) : (
          <section className="mt-6 space-y-4">
            {state.prescriptions.map((prescription) => {
              const counterpart = isDoctor
                ? prescription.patient
                : prescription.doctor
              return (
                <article
                  key={prescription.id}
                  className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-teal-100 text-sm font-semibold text-teal-700"
                        aria-hidden="true"
                      >
                        {initials(counterpart.name)}
                      </div>
                      <div>
                        <h2 className="text-base font-semibold text-slate-900">
                          {counterpart.name}
                        </h2>
                        {!isDoctor && (
                          <p className="text-sm font-medium text-brand-700">
                            {prescription.doctor.specialization || 'Doctor'}
                          </p>
                        )}
                        <p className="mt-0.5 text-sm text-slate-500">
                          Issued {formatTimestamp(prescription.createdAt)}
                        </p>
                      </div>
                    </div>
                    <PrescriptionStatusBadge status={prescription.status} />
                  </div>

                  <dl className="mt-4 space-y-1 text-sm">
                    {prescription.diagnosis && (
                      <div className="flex gap-2">
                        <dt className="shrink-0 text-slate-500">Diagnosis:</dt>
                        <dd className="font-medium text-slate-900">
                          {prescription.diagnosis}
                        </dd>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <dt className="shrink-0 text-slate-500">Medicines:</dt>
                      <dd className="text-slate-900">
                        {prescription.medicines
                          .map((item) => item.medicineName)
                          .join(', ')}
                      </dd>
                    </div>
                    {prescription.followUpDate && (
                      <div className="flex gap-2">
                        <dt className="shrink-0 text-slate-500">Follow-up:</dt>
                        <dd className="font-medium text-slate-900">
                          {prescription.followUpDate}
                        </dd>
                      </div>
                    )}
                  </dl>

                  <div className="mt-4">
                    <Link
                      to={`/prescriptions/${prescription.id}`}
                      className="inline-block rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-brand-700"
                    >
                      View prescription
                    </Link>
                  </div>
                </article>
              )
            })}
          </section>
        )}
      </main>
    </div>
  )
}
