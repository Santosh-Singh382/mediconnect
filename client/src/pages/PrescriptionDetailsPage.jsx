import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import AppHeader from '../components/AppHeader.jsx'
import LoadingState from '../components/LoadingState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import PrescriptionStatusBadge from '../components/PrescriptionStatusBadge.jsx'
import { getPrescription } from '../lib/prescriptionApi.js'
import { getApiErrorMessage } from '../lib/apiError.js'
import { homePathFor, homeLinksFor } from '../lib/homePath.js'
import {
  routeLabel,
  timingLabel,
  formatTimestamp,
} from '../lib/prescriptionFormat.js'

export default function PrescriptionDetailsPage() {
  const { user } = useAuth()
  const { prescriptionId } = useParams()

  const [state, setState] = useState({
    loading: true,
    error: null,
    prescription: null,
  })

  const load = useCallback(() => {
    getPrescription(prescriptionId)
      .then((response) => {
        setState({
          loading: false,
          error: null,
          prescription: response.data.data.prescription,
        })
      })
      .catch((error) => {
        setState({
          loading: false,
          error: getApiErrorMessage(error, 'Unable to load this prescription.'),
          prescription: null,
        })
      })
  }, [prescriptionId])

  useEffect(() => {
    load()
  }, [load])

  function retry() {
    setState({ loading: true, error: null, prescription: null })
    load()
  }

  const prescription = state.prescription

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader home={homePathFor(user)} links={homeLinksFor(user)} />

      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link
          to="/prescriptions"
          className="text-sm font-medium text-brand-600 transition hover:text-brand-700"
        >
          &larr; Back to prescriptions
        </Link>

        {state.loading ? (
          <div className="mt-8">
            <LoadingState label="Loading prescription…" />
          </div>
        ) : state.error ? (
          <div className="mt-8">
            <ErrorState message={state.error} onRetry={retry} />
          </div>
        ) : (
          <>
            <header className="mt-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
                  Prescription
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Issued {formatTimestamp(prescription.createdAt)}
                </p>
              </div>
              <PrescriptionStatusBadge status={prescription.status} />
            </header>

            <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">
                Consultation parties
              </h2>
              <dl className="mt-3 grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm text-slate-500">Doctor</dt>
                  <dd className="mt-0.5 text-sm font-medium text-slate-900">
                    {prescription.doctor.name}
                    {prescription.doctor.specialization
                      ? ` · ${prescription.doctor.specialization}`
                      : ''}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-slate-500">Patient</dt>
                  <dd className="mt-0.5 text-sm font-medium text-slate-900">
                    {prescription.patient.name}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">
                Diagnosis
              </h2>
              <p className="mt-2 text-sm text-slate-700">
                {prescription.diagnosis || 'Not specified'}
              </p>
            </section>

            <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">
                Medicines
              </h2>
              <ul className="mt-3 space-y-4">
                {prescription.medicines.map((item, index) => (
                  <li
                    key={item.id || index}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="text-sm font-semibold text-slate-900">
                        {index + 1}. {item.medicineName}
                      </h3>
                      <span className="text-sm text-slate-600">
                        Qty {item.quantity}
                      </span>
                    </div>
                    <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-slate-500">Dosage</dt>
                        <dd className="font-medium text-slate-900">
                          {item.dosage}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Frequency</dt>
                        <dd className="font-medium text-slate-900">
                          {item.frequency}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Duration</dt>
                        <dd className="font-medium text-slate-900">
                          {item.duration}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Route</dt>
                        <dd className="font-medium text-slate-900">
                          {routeLabel(item.route)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Timing</dt>
                        <dd className="font-medium text-slate-900">
                          {timingLabel(item.timing)}
                        </dd>
                      </div>
                    </dl>
                    {item.instructions && (
                      <p className="mt-2 text-sm text-slate-700">
                        <span className="text-slate-500">Instructions: </span>
                        {item.instructions}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>

            <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">
                General instructions
              </h2>
              <p className="mt-2 text-sm text-slate-700">
                {prescription.instructions || 'None provided'}
              </p>
              {prescription.followUpDate && (
                <p className="mt-3 text-sm text-slate-700">
                  <span className="text-slate-500">Follow-up date: </span>
                  <span className="font-medium text-slate-900">
                    {prescription.followUpDate}
                  </span>
                </p>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  )
}
