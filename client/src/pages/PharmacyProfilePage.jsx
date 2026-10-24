import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import AppHeader from '../components/AppHeader.jsx'
import LoadingState from '../components/LoadingState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import {
  getMyPharmacy,
  createMyPharmacy,
  updateMyPharmacy,
} from '../lib/pharmacyApi.js'
import { getApiErrorMessage } from '../lib/apiError.js'
import { inputClass } from '../lib/formStyles.js'
import { homePathFor, homeLinksFor } from '../lib/homePath.js'

const PINCODE_PATTERN = /^[1-9][0-9]{5}$/
const PHONE_PATTERN = /^\+?[0-9\s()-]{7,20}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

const REQUIRED_FIELDS = [
  ['pharmacyName', 'Pharmacy name'],
  ['pharmacistName', 'Pharmacist name'],
  ['licenseNumber', 'Licence number'],
  ['phone', 'Phone number'],
  ['address', 'Address'],
  ['city', 'City'],
  ['state', 'State'],
  ['pincode', 'Pincode'],
]

const VERIFICATION_STYLES = {
  PENDING: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
}

function VerificationBadge({ status }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
        VERIFICATION_STYLES[status] || VERIFICATION_STYLES.PENDING
      }`}
    >
      {status}
    </span>
  )
}

function draftFrom(profile, user) {
  return {
    pharmacyName: profile?.pharmacyName || '',
    pharmacistName: profile?.pharmacistName || '',
    licenseNumber: profile?.licenseNumber || '',
    phone: profile?.phone || (profile ? '' : user?.phone || ''),
    email: profile?.email || (profile ? '' : user?.email || ''),
    address: profile?.address || '',
    city: profile?.city || '',
    state: profile?.state || '',
    pincode: profile?.pincode || '',
    description: profile?.description || '',
    openingTime: profile?.openingTime || '',
    closingTime: profile?.closingTime || '',
  }
}

function Card({ title, children, action }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {action}
      </div>
      <div className="px-6 py-5">{children}</div>
    </section>
  )
}

function Field({ label, htmlFor, children, required }) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-slate-700"
      >
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      {children}
    </div>
  )
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

export default function PharmacyProfilePage() {
  const { user } = useAuth()
  const [loadState, setLoadState] = useState({
    loading: true,
    error: null,
    data: null,
  })
  const [mode, setMode] = useState('view')
  const [draft, setDraft] = useState(null)
  const [saveState, setSaveState] = useState('idle')
  const [formErrors, setFormErrors] = useState([])
  const [saveError, setSaveError] = useState(null)
  const [serverDetails, setServerDetails] = useState([])

  const load = useCallback(() => {
    getMyPharmacy()
      .then((response) => {
        setLoadState({ loading: false, error: null, data: response.data.data })
      })
      .catch((error) => {
        setLoadState({
          loading: false,
          error: getApiErrorMessage(error),
          data: null,
        })
      })
  }, [])

  function retry() {
    setLoadState({ loading: true, error: null, data: null })
    load()
  }

  useEffect(() => {
    load()
  }, [load])

  function startEditing() {
    setDraft(draftFrom(loadState.data.profile, loadState.data.user))
    setMode('edit')
    setSaveState('idle')
    setFormErrors([])
    setSaveError(null)
    setServerDetails([])
  }

  function updateField(field, value) {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  function validateDraft() {
    const errors = []
    const maxLengths = {
      pharmacyName: 120,
      pharmacistName: 100,
      licenseNumber: 60,
      address: 200,
      city: 100,
      state: 100,
    }

    for (const [key, label] of REQUIRED_FIELDS) {
      const value = draft[key].trim()
      if (!value) {
        errors.push(`${label} is required.`)
      } else if (maxLengths[key] && value.length > maxLengths[key]) {
        errors.push(`${label} cannot exceed ${maxLengths[key]} characters.`)
      }
    }

    if (draft.phone.trim() && !PHONE_PATTERN.test(draft.phone.trim())) {
      errors.push('Phone number is not valid.')
    }
    if (draft.pincode.trim() && !PINCODE_PATTERN.test(draft.pincode.trim())) {
      errors.push('Pincode must be a valid 6-digit Indian pincode.')
    }
    if (draft.email.trim() && !EMAIL_PATTERN.test(draft.email.trim())) {
      errors.push('Email address is not valid.')
    }
    if (draft.description.length > 1000) {
      errors.push('Description cannot exceed 1000 characters.')
    }

    const openingTime = draft.openingTime.trim()
    const closingTime = draft.closingTime.trim()
    if (Boolean(openingTime) !== Boolean(closingTime)) {
      errors.push('Opening and closing time must be provided together.')
    } else if (openingTime && closingTime) {
      if (
        !TIME_PATTERN.test(openingTime) ||
        !TIME_PATTERN.test(closingTime)
      ) {
        errors.push('Opening and closing times must use HH:mm format.')
      } else if (openingTime >= closingTime) {
        errors.push('Opening time must be earlier than closing time.')
      }
    }

    return errors
  }

  async function handleSave() {
    const errors = validateDraft()
    if (errors.length > 0) {
      setFormErrors(errors)
      return
    }

    setFormErrors([])
    setSaveError(null)
    setServerDetails([])
    setSaveState('saving')

    const payload = {
      pharmacyName: draft.pharmacyName.trim(),
      pharmacistName: draft.pharmacistName.trim(),
      licenseNumber: draft.licenseNumber.trim(),
      phone: draft.phone.trim(),
      email: draft.email.trim().toLowerCase() || null,
      address: draft.address.trim(),
      city: draft.city.trim(),
      state: draft.state.trim(),
      pincode: draft.pincode.trim(),
      description: draft.description.trim() || null,
      openingTime: draft.openingTime.trim() || null,
      closingTime: draft.closingTime.trim() || null,
    }

    try {
      const response = loadState.data.profile
        ? await updateMyPharmacy(payload)
        : await createMyPharmacy(payload)
      setLoadState({ loading: false, error: null, data: response.data.data })
      setSaveState('saved')
      setMode('view')
    } catch (error) {
      setSaveState('error')
      setSaveError(getApiErrorMessage(error, 'Could not save your pharmacy profile.'))
      setServerDetails(error.response?.data?.details || [])
    }
  }

  function handleCancel() {
    setMode('view')
    setSaveState('idle')
    setFormErrors([])
    setSaveError(null)
    setServerDetails([])
  }

  if (loadState.loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <AppHeader home={homePathFor(user)} links={homeLinksFor(user)} />
        <main className="mx-auto max-w-3xl px-6 py-12">
          <LoadingState label="Loading your pharmacy profile…" />
        </main>
      </div>
    )
  }

  if (loadState.error) {
    return (
      <div className="min-h-screen bg-slate-50">
        <AppHeader home={homePathFor(user)} links={homeLinksFor(user)} />
        <main className="mx-auto max-w-3xl px-6 py-12">
          <ErrorState message={loadState.error} onRetry={retry} />
        </main>
      </div>
    )
  }

  const { profile } = loadState.data
  const hasProfile = profile !== null

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader home={homePathFor(user)} links={homeLinksFor(user)} />

      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              My pharmacy profile
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              These details identify your pharmacy across MediConnect.
            </p>
          </div>
          {profile ? (
            <VerificationBadge status={profile.verificationStatus} />
          ) : null}
        </div>

        {saveState === 'saved' && (
          <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-medium text-green-700">
              Pharmacy profile saved successfully.
            </p>
          </div>
        )}

        {formErrors.length > 0 && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4">
            <ul className="list-inside list-disc space-y-1 text-sm text-red-700">
              {formErrors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {saveState === 'error' && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-700">{saveError}</p>
            {serverDetails.length > 0 && (
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-red-700">
                {serverDetails.map((detail) => (
                  <li key={`${detail.field}-${detail.message}`}>
                    {detail.field}: {detail.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {mode === 'edit' && draft ? (
          <div className="mt-8 space-y-6">
            {profile ? (
              <Card title="Verification">
                <p className="text-sm text-slate-600">
                  Your profile is <VerificationBadge status={profile.verificationStatus} />.
                  Verification is managed by MediConnect and cannot be changed
                  here.
                </p>
              </Card>
            ) : (
              <Card title="Verification">
                <p className="text-sm text-slate-600">
                  New pharmacy profiles start as{' '}
                  <VerificationBadge status="PENDING" />. Verification is
                  managed by MediConnect and cannot be changed here.
                </p>
              </Card>
            )}

            <Card title="Business information">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Pharmacy name" htmlFor="pharmacyName" required>
                  <input
                    id="pharmacyName"
                    type="text"
                    value={draft.pharmacyName}
                    onChange={(event) =>
                      updateField('pharmacyName', event.target.value)
                    }
                    className={inputClass}
                    placeholder="e.g. Aarogya Pharmacy"
                  />
                </Field>
                <Field
                  label="Pharmacist name"
                  htmlFor="pharmacistName"
                  required
                >
                  <input
                    id="pharmacistName"
                    type="text"
                    value={draft.pharmacistName}
                    onChange={(event) =>
                      updateField('pharmacistName', event.target.value)
                    }
                    className={inputClass}
                    placeholder="e.g. Ravi Kumar"
                  />
                </Field>
                <Field
                  label="Licence number"
                  htmlFor="licenseNumber"
                  required
                >
                  <input
                    id="licenseNumber"
                    type="text"
                    value={draft.licenseNumber}
                    onChange={(event) =>
                      updateField('licenseNumber', event.target.value)
                    }
                    className={inputClass}
                    placeholder="e.g. OD-PH-2026-001"
                  />
                </Field>
              </div>
            </Card>

            <Card title="Contact">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Phone" htmlFor="pharmacyPhone" required>
                  <input
                    id="pharmacyPhone"
                    type="tel"
                    value={draft.phone}
                    onChange={(event) => updateField('phone', event.target.value)}
                    className={inputClass}
                    placeholder="9876543210"
                  />
                </Field>
                <Field label="Email" htmlFor="pharmacyEmail">
                  <input
                    id="pharmacyEmail"
                    type="email"
                    value={draft.email}
                    onChange={(event) => updateField('email', event.target.value)}
                    className={inputClass}
                    placeholder="contact@pharmacy.in"
                  />
                </Field>
              </div>
            </Card>

            <Card title="Location">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field label="Address" htmlFor="pharmacyAddress" required>
                    <input
                      id="pharmacyAddress"
                      type="text"
                      value={draft.address}
                      onChange={(event) =>
                        updateField('address', event.target.value)
                      }
                      className={inputClass}
                      placeholder="Street, building, area"
                    />
                  </Field>
                </div>
                <Field label="City" htmlFor="pharmacyCity" required>
                  <input
                    id="pharmacyCity"
                    type="text"
                    value={draft.city}
                    onChange={(event) => updateField('city', event.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="State" htmlFor="pharmacyState" required>
                  <input
                    id="pharmacyState"
                    type="text"
                    value={draft.state}
                    onChange={(event) => updateField('state', event.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="Pincode" htmlFor="pharmacyPincode" required>
                  <input
                    id="pharmacyPincode"
                    type="text"
                    inputMode="numeric"
                    value={draft.pincode}
                    onChange={(event) =>
                      updateField('pincode', event.target.value)
                    }
                    className={inputClass}
                    placeholder="760001"
                  />
                </Field>
              </div>
            </Card>

            <Card title="Opening hours">
              <p className="mb-4 text-sm text-slate-600">
                Leave both fields empty if your hours are not listed. Times use
                the HH:mm 24-hour format.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Opening time" htmlFor="openingTime">
                  <input
                    id="openingTime"
                    type="time"
                    value={draft.openingTime}
                    onChange={(event) =>
                      updateField('openingTime', event.target.value)
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Closing time" htmlFor="closingTime">
                  <input
                    id="closingTime"
                    type="time"
                    value={draft.closingTime}
                    onChange={(event) =>
                      updateField('closingTime', event.target.value)
                    }
                    className={inputClass}
                  />
                </Field>
              </div>
            </Card>

            <Card title="About">
              <Field label="Description" htmlFor="pharmacyDescription">
                <textarea
                  id="pharmacyDescription"
                  rows="4"
                  value={draft.description}
                  onChange={(event) =>
                    updateField('description', event.target.value)
                  }
                  className={inputClass}
                  placeholder="A short description of your pharmacy."
                />
              </Field>
            </Card>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={saveState === 'saving'}
                className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saveState === 'saving'
                  ? 'Saving…'
                  : hasProfile
                    ? 'Save changes'
                    : 'Create profile'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={saveState === 'saving'}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : !hasProfile ? (
          <div className="mt-8 rounded-lg border border-slate-200 bg-white p-10 text-center shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">
              You haven&apos;t created your pharmacy profile yet
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
              Add your pharmacy and pharmacist details so the platform can
              verify your business. New profiles start with PENDING
              verification.
            </p>
            <button
              type="button"
              onClick={startEditing}
              className="mt-5 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
            >
              Create pharmacy profile
            </button>
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            <Card
              title="Business information"
              action={
                <button
                  type="button"
                  onClick={startEditing}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Edit profile
                </button>
              }
            >
              <dl className="grid gap-4 sm:grid-cols-2">
                <InfoRow label="Pharmacy name" value={profile.pharmacyName} />
                <InfoRow label="Pharmacist name" value={profile.pharmacistName} />
                <InfoRow label="Licence number" value={profile.licenseNumber} />
                <InfoRow
                  label="Verification status"
                  value={profile.verificationStatus}
                />
                <InfoRow
                  label="Account state"
                  value={profile.isActive ? 'Active' : 'Inactive'}
                />
              </dl>
            </Card>

            <Card title="Contact">
              <dl className="grid gap-4 sm:grid-cols-2">
                <InfoRow label="Phone" value={profile.phone} />
                <InfoRow label="Email" value={profile.email} />
              </dl>
            </Card>

            <Card title="Location">
              <dl className="grid gap-4 sm:grid-cols-2">
                <InfoRow label="Address" value={profile.address} />
                <InfoRow label="City" value={profile.city} />
                <InfoRow label="State" value={profile.state} />
                <InfoRow label="Pincode" value={profile.pincode} />
              </dl>
            </Card>

            <Card title="Opening hours">
              {profile.openingTime && profile.closingTime ? (
                <p className="text-sm text-slate-700">
                  {profile.openingTime} – {profile.closingTime}
                </p>
              ) : (
                <p className="text-sm text-slate-600">Not provided</p>
              )}
            </Card>

            <Card title="About">
              <p className="text-sm text-slate-700">
                {profile.description || 'Not provided'}
              </p>
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}
