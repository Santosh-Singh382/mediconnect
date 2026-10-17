import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import AppHeader from '../components/AppHeader.jsx'
import { createPrescription } from '../lib/prescriptionApi.js'
import { getApiErrorMessage } from '../lib/apiError.js'
import { homePathFor, homeLinksFor } from '../lib/homePath.js'
import { inputClass } from '../lib/formStyles.js'
import {
  MEDICINE_ROUTE_OPTIONS,
  MEDICINE_TIMING_OPTIONS,
} from '../lib/prescriptionFormat.js'

function blankMedicine() {
  return {
    medicineName: '',
    dosage: '',
    frequency: '',
    duration: '',
    route: '',
    timing: '',
    quantity: '1',
    instructions: '',
  }
}

function fieldError(errors, field) {
  const message = errors[field]
  return message ? (
    <p className="mt-1 text-xs text-red-600">{message}</p>
  ) : null
}

export default function CreatePrescriptionPage() {
  const { user } = useAuth()
  const { appointmentId } = useParams()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    diagnosis: '',
    instructions: '',
    followUpDate: '',
    medicines: [blankMedicine()],
  })
  const [errors, setErrors] = useState({})
  const [generalError, setGeneralError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [created, setCreated] = useState(null)

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function updateMedicine(index, key, value) {
    setForm((prev) => {
      const medicines = prev.medicines.map((item, i) =>
        i === index ? { ...item, [key]: value } : item,
      )
      return { ...prev, medicines }
    })
  }

  function addMedicine() {
    setForm((prev) => ({ ...prev, medicines: [...prev.medicines, blankMedicine()] }))
  }

  function removeMedicine(index) {
    setForm((prev) => ({
      ...prev,
      medicines: prev.medicines.filter((_, i) => i !== index),
    }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (submitting) return

    setSubmitting(true)
    setErrors({})
    setGeneralError(null)

    const payload = {
      appointmentId,
      diagnosis: form.diagnosis,
      instructions: form.instructions,
      followUpDate: form.followUpDate,
      medicines: form.medicines.map((item) => ({
        ...item,
        route: item.route || undefined,
        timing: item.timing || undefined,
        quantity: Number(item.quantity),
      })),
    }

    createPrescription(payload)
      .then((response) => {
        setCreated(response.data.data.prescription)
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
        setGeneralError(
          getApiErrorMessage(error, 'Unable to create this prescription.'),
        )
      })
      .finally(() => {
        setSubmitting(false)
      })
  }

  if (created) {
    return (
      <div className="min-h-screen bg-slate-50">
        <AppHeader home={homePathFor(user)} links={homeLinksFor(user)} />
        <main className="mx-auto max-w-2xl px-6 py-12">
          <div className="rounded-lg border border-green-200 bg-green-50 p-8 text-center">
            <h1 className="text-xl font-semibold text-green-900">
              Prescription created
            </h1>
            <p className="mt-2 text-sm text-green-800">
              The prescription has been issued to {created.patient.name} and is
              now available to them.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                to={`/prescriptions/${created.id}`}
                className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
              >
                View prescription
              </Link>
              <Link
                to="/doctor/appointments"
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Back to appointments
              </Link>
            </div>
          </div>
        </main>
      </div>
    )
  }

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
            Create prescription
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Issue a structured prescription for this completed consultation.
          </p>
        </section>

        {generalError && (
          <p className="mt-6 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {generalError}
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-6" noValidate>
          <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Diagnosis</h2>
            <label
              htmlFor="diagnosis"
              className="mt-3 block text-sm font-medium text-slate-700"
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
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">
                Medicines
              </h2>
              <button
                type="button"
                onClick={addMedicine}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Add medicine
              </button>
            </div>
            {fieldError(errors, 'medicines')}

            <div className="mt-4 space-y-5">
              {form.medicines.map((medicine, index) => (
                <fieldset
                  key={index}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                >
                  <legend className="px-1 text-sm font-medium text-slate-700">
                    Medicine {index + 1}
                  </legend>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label
                        htmlFor={`med-name-${index}`}
                        className="block text-sm font-medium text-slate-700"
                      >
                        Medicine name
                      </label>
                      <input
                        id={`med-name-${index}`}
                        type="text"
                        value={medicine.medicineName}
                        onChange={(event) =>
                          updateMedicine(index, 'medicineName', event.target.value)
                        }
                        className={inputClass}
                        maxLength={200}
                      />
                      {fieldError(errors, `medicines[${index}].medicineName`)}
                    </div>

                    <div>
                      <label
                        htmlFor={`med-dosage-${index}`}
                        className="block text-sm font-medium text-slate-700"
                      >
                        Dosage
                      </label>
                      <input
                        id={`med-dosage-${index}`}
                        type="text"
                        value={medicine.dosage}
                        onChange={(event) =>
                          updateMedicine(index, 'dosage', event.target.value)
                        }
                        className={inputClass}
                        maxLength={100}
                      />
                      {fieldError(errors, `medicines[${index}].dosage`)}
                    </div>

                    <div>
                      <label
                        htmlFor={`med-frequency-${index}`}
                        className="block text-sm font-medium text-slate-700"
                      >
                        Frequency
                      </label>
                      <input
                        id={`med-frequency-${index}`}
                        type="text"
                        value={medicine.frequency}
                        onChange={(event) =>
                          updateMedicine(index, 'frequency', event.target.value)
                        }
                        className={inputClass}
                        maxLength={100}
                      />
                      {fieldError(errors, `medicines[${index}].frequency`)}
                    </div>

                    <div>
                      <label
                        htmlFor={`med-duration-${index}`}
                        className="block text-sm font-medium text-slate-700"
                      >
                        Duration
                      </label>
                      <input
                        id={`med-duration-${index}`}
                        type="text"
                        value={medicine.duration}
                        onChange={(event) =>
                          updateMedicine(index, 'duration', event.target.value)
                        }
                        className={inputClass}
                        maxLength={100}
                      />
                      {fieldError(errors, `medicines[${index}].duration`)}
                    </div>

                    <div>
                      <label
                        htmlFor={`med-quantity-${index}`}
                        className="block text-sm font-medium text-slate-700"
                      >
                        Quantity
                      </label>
                      <input
                        id={`med-quantity-${index}`}
                        type="number"
                        min="1"
                        step="1"
                        value={medicine.quantity}
                        onChange={(event) =>
                          updateMedicine(index, 'quantity', event.target.value)
                        }
                        className={inputClass}
                      />
                      {fieldError(errors, `medicines[${index}].quantity`)}
                    </div>

                    <div>
                      <label
                        htmlFor={`med-route-${index}`}
                        className="block text-sm font-medium text-slate-700"
                      >
                        Route
                      </label>
                      <select
                        id={`med-route-${index}`}
                        value={medicine.route}
                        onChange={(event) =>
                          updateMedicine(index, 'route', event.target.value)
                        }
                        className={inputClass}
                      >
                        {MEDICINE_ROUTE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      {fieldError(errors, `medicines[${index}].route`)}
                    </div>

                    <div>
                      <label
                        htmlFor={`med-timing-${index}`}
                        className="block text-sm font-medium text-slate-700"
                      >
                        Timing
                      </label>
                      <select
                        id={`med-timing-${index}`}
                        value={medicine.timing}
                        onChange={(event) =>
                          updateMedicine(index, 'timing', event.target.value)
                        }
                        className={inputClass}
                      >
                        {MEDICINE_TIMING_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      {fieldError(errors, `medicines[${index}].timing`)}
                    </div>

                    <div className="sm:col-span-2">
                      <label
                        htmlFor={`med-instructions-${index}`}
                        className="block text-sm font-medium text-slate-700"
                      >
                        Medicine instructions (optional)
                      </label>
                      <input
                        id={`med-instructions-${index}`}
                        type="text"
                        value={medicine.instructions}
                        onChange={(event) =>
                          updateMedicine(index, 'instructions', event.target.value)
                        }
                        className={inputClass}
                        maxLength={500}
                      />
                      {fieldError(errors, `medicines[${index}].instructions`)}
                    </div>
                  </div>

                  {form.medicines.length > 1 && (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => removeMedicine(index)}
                        className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </fieldset>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">
              Instructions &amp; follow-up
            </h2>
            <label
              htmlFor="instructions"
              className="mt-3 block text-sm font-medium text-slate-700"
            >
              General instructions (optional)
            </label>
            <textarea
              id="instructions"
              rows={3}
              value={form.instructions}
              onChange={(event) => updateField('instructions', event.target.value)}
              className={inputClass}
              maxLength={2000}
            />
            {fieldError(errors, 'instructions')}

            <label
              htmlFor="followUpDate"
              className="mt-4 block text-sm font-medium text-slate-700"
            >
              Follow-up date (optional)
            </label>
            <input
              id="followUpDate"
              type="date"
              value={form.followUpDate}
              onChange={(event) => updateField('followUpDate', event.target.value)}
              className={inputClass}
            />
            {fieldError(errors, 'followUpDate')}
          </section>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-brand-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Creating…' : 'Create prescription'}
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
