import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import AppHeader from '../components/AppHeader.jsx'
import LoadingState from '../components/LoadingState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import { getDoctorProfile, saveDoctorProfile } from '../lib/doctorApi.js'
import { getApiErrorMessage } from '../lib/apiError.js'
import { inputClass } from '../lib/formStyles.js'
import { homePathFor, homeLinksFor } from '../lib/homePath.js'

const DAYS = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
]

const VERIFICATION_STYLES = {
  PENDING: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
}

function formatEnum(value) {
  return value.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())
}

function draftFrom(profile) {
  const clinicAddress = profile?.clinicAddress || {}
  const availabilityByDay = new Map(
    (profile?.availability || []).map((day) => [day.dayOfWeek, day]),
  )

  return {
    specialization: profile?.specialization || '',
    qualification: profile?.qualification || '',
    registrationNumber: profile?.registrationNumber || '',
    experience:
      typeof profile?.experience === 'number' ? String(profile.experience) : '',
    consultationFee:
      typeof profile?.consultationFee === 'number'
        ? String(profile.consultationFee)
        : '',
    bio: profile?.bio || '',
    clinicName: profile?.clinicName || '',
    clinicAddress: {
      street: clinicAddress.street || '',
      city: clinicAddress.city || '',
      state: clinicAddress.state || '',
      postalCode: clinicAddress.postalCode || '',
      country: clinicAddress.country || '',
    },
    languages: profile?.languages ? [...profile.languages] : [],
    availability: DAYS.map((day) => {
      const existing = availabilityByDay.get(day)
      return {
        dayOfWeek: day,
        enabled: existing?.enabled || false,
        startTime: existing?.startTime || '',
        endTime: existing?.endTime || '',
      }
    }),
  }
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

function ArrayField({
  label,
  items,
  inputValue,
  onInputChange,
  onAdd,
  onRemove,
  placeholder,
}) {
  return (
    <div>
      <span className="block text-sm font-medium text-slate-700">{label}</span>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">None added yet.</p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-2">
          {items.map((item, index) => (
            <li
              key={`${item}-${index}`}
              className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700"
            >
              {item}
              <button
                type="button"
                onClick={() => onRemove(index)}
                aria-label={`Remove ${item}`}
                className="text-slate-400 transition hover:text-red-600"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(event) => onInputChange(event.target.value)}
          placeholder={placeholder}
          className={`${inputClass} max-w-xs py-1.5`}
        />
        <button
          type="button"
          onClick={onAdd}
          className="shrink-0 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Add
        </button>
      </div>
    </div>
  )
}

export default function DoctorProfilePage() {
  const { user } = useAuth()
  const [loadState, setLoadState] = useState({
    loading: true,
    error: null,
    data: null,
  })
  const [mode, setMode] = useState('view')
  const [draft, setDraft] = useState(null)
  const [newLanguage, setNewLanguage] = useState('')
  const [saveState, setSaveState] = useState('idle')
  const [formErrors, setFormErrors] = useState([])
  const [saveError, setSaveError] = useState(null)
  const [serverDetails, setServerDetails] = useState([])

  const load = useCallback(() => {
    getDoctorProfile()
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
    setDraft(draftFrom(loadState.data.profile))
    setMode('edit')
    setSaveState('idle')
    setFormErrors([])
    setSaveError(null)
    setServerDetails([])
    setNewLanguage('')
  }

  function updateField(field, value) {
    setDraft((d) => ({ ...d, [field]: value }))
  }

  function updateNested(group, field, value) {
    setDraft((d) => ({ ...d, [group]: { ...d[group], [field]: value } }))
  }

  function updateAvailability(index, field, value) {
    setDraft((d) => ({
      ...d,
      availability: d.availability.map((day, i) =>
        i === index ? { ...day, [field]: value } : day,
      ),
    }))
  }

  function handleAddLanguage() {
    const value = newLanguage.trim()
    if (!value) return
    if (draft.languages.includes(value)) {
      setFormErrors([`"${value}" is already in your languages.`])
      return
    }
    setDraft((d) => ({ ...d, languages: [...d.languages, value] }))
    setNewLanguage('')
  }

  function handleRemoveLanguage(index) {
    setDraft((d) => ({
      ...d,
      languages: d.languages.filter((_, i) => i !== index),
    }))
  }

  function validateDraft() {
    const errors = []
    for (const [key, label] of [
      ['specialization', 'Specialization'],
      ['qualification', 'Qualification'],
      ['registrationNumber', 'Registration number'],
    ]) {
      if (!draft[key].trim()) {
        errors.push(`${label} is required.`)
      }
    }

    for (const [key, label] of [
      ['experience', 'Experience'],
      ['consultationFee', 'Consultation fee'],
    ]) {
      if (draft[key] !== '') {
        const numberValue = Number(draft[key])
        if (!Number.isFinite(numberValue) || numberValue < 0) {
          errors.push(`${label} must be a positive number.`)
        } else if (
          (key === 'experience' && numberValue > 80) ||
          (key === 'consultationFee' && numberValue > 100000)
        ) {
          errors.push(
            `${label} is out of the accepted range.`,
          )
        }
      }
    }

    for (const day of draft.availability) {
      if (!day.enabled) continue
      if (!day.startTime || !day.endTime) {
        errors.push(
          `${formatEnum(day.dayOfWeek)} is enabled but is missing a start or end time.`,
        )
      } else if (day.startTime >= day.endTime) {
        errors.push(
          `${formatEnum(day.dayOfWeek)} start time must be earlier than end time.`,
        )
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

    try {
      const response = await saveDoctorProfile({
        specialization: draft.specialization.trim() || null,
        qualification: draft.qualification.trim() || null,
        registrationNumber: draft.registrationNumber.trim() || null,
        experience: draft.experience === '' ? null : Number(draft.experience),
        consultationFee:
          draft.consultationFee === '' ? null : Number(draft.consultationFee),
        bio: draft.bio || null,
        clinicName: draft.clinicName || null,
        clinicAddress: {
          street: draft.clinicAddress.street || null,
          city: draft.clinicAddress.city || null,
          state: draft.clinicAddress.state || null,
          postalCode: draft.clinicAddress.postalCode || null,
          country: draft.clinicAddress.country || null,
        },
        languages: draft.languages,
        availability: draft.availability.map((day) => ({
          dayOfWeek: day.dayOfWeek,
          enabled: day.enabled,
          startTime: day.enabled ? day.startTime : null,
          endTime: day.enabled ? day.endTime : null,
        })),
      })
      setLoadState({ loading: false, error: null, data: response.data.data })
      setSaveState('saved')
      setMode('view')
    } catch (error) {
      const data = error.response?.data
      setSaveState('error')
      setSaveError(
        getApiErrorMessage(error, 'Could not save your profile.'),
      )
      setServerDetails(data?.details || [])
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
          <LoadingState label="Loading your profile…" />
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

  const { profile, profileCompletion } = loadState.data
  const hasProfile = profile !== null
  const enabledDays = hasProfile
    ? profile.availability.filter((day) => day.enabled)
    : []

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader home={homePathFor(user)} links={homeLinksFor(user)} />

      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              My profile
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Your practice details help patients find and understand you.
            </p>
          </div>
          {profile ? (
            <div className="text-right">
              <VerificationBadge status={profile.verificationStatus} />
              <p className="mt-1 text-xs text-slate-500">
                Profile completion {profileCompletion}%
              </p>
            </div>
          ) : null}
        </div>

        {saveState === 'saved' && (
          <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-medium text-green-700">
              Profile saved successfully.
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
            {profile?.verificationStatus === 'PENDING' && (
              <Card title="Verification">
                <p className="text-sm text-slate-600">
                  Your profile is <VerificationBadge status="PENDING" /> and
                  will be reviewed by the platform. Verification status is
                  managed by MediConnect and cannot be changed here.
                </p>
              </Card>
            )}

            <Card title="Practice information">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Specialization"
                  htmlFor="specialization"
                  required
                >
                  <input
                    id="specialization"
                    type="text"
                    value={draft.specialization}
                    onChange={(event) =>
                      updateField('specialization', event.target.value)
                    }
                    className={inputClass}
                    placeholder="e.g. Cardiologist"
                  />
                </Field>
                <Field
                  label="Qualification"
                  htmlFor="qualification"
                  required
                >
                  <input
                    id="qualification"
                    type="text"
                    value={draft.qualification}
                    onChange={(event) =>
                      updateField('qualification', event.target.value)
                    }
                    className={inputClass}
                    placeholder="e.g. MBBS, MD"
                  />
                </Field>
                <Field
                  label="Registration number"
                  htmlFor="registrationNumber"
                  required
                >
                  <input
                    id="registrationNumber"
                    type="text"
                    value={draft.registrationNumber}
                    onChange={(event) =>
                      updateField('registrationNumber', event.target.value)
                    }
                    className={inputClass}
                    placeholder="e.g. MCI-12345"
                  />
                </Field>
                <Field label="Experience (years)" htmlFor="experience">
                  <input
                    id="experience"
                    type="number"
                    min="0"
                    max="80"
                    value={draft.experience}
                    onChange={(event) =>
                      updateField('experience', event.target.value)
                    }
                    className={inputClass}
                    placeholder="e.g. 8"
                  />
                </Field>
                <Field
                  label="Consultation fee (₹)"
                  htmlFor="consultationFee"
                >
                  <input
                    id="consultationFee"
                    type="number"
                    min="0"
                    max="100000"
                    value={draft.consultationFee}
                    onChange={(event) =>
                      updateField('consultationFee', event.target.value)
                    }
                    className={inputClass}
                    placeholder="e.g. 500"
                  />
                </Field>
              </div>
            </Card>

            <Card title="Clinic information">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Clinic name" htmlFor="clinicName">
                  <input
                    id="clinicName"
                    type="text"
                    value={draft.clinicName}
                    onChange={(event) =>
                      updateField('clinicName', event.target.value)
                    }
                    className={inputClass}
                    placeholder="e.g. Aarogya Clinic"
                  />
                </Field>
                <Field label="Street" htmlFor="clinicStreet">
                  <input
                    id="clinicStreet"
                    type="text"
                    value={draft.clinicAddress.street}
                    onChange={(event) =>
                      updateNested('clinicAddress', 'street', event.target.value)
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="City" htmlFor="clinicCity">
                  <input
                    id="clinicCity"
                    type="text"
                    value={draft.clinicAddress.city}
                    onChange={(event) =>
                      updateNested('clinicAddress', 'city', event.target.value)
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="State" htmlFor="clinicState">
                  <input
                    id="clinicState"
                    type="text"
                    value={draft.clinicAddress.state}
                    onChange={(event) =>
                      updateNested('clinicAddress', 'state', event.target.value)
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Postal code" htmlFor="clinicPostalCode">
                  <input
                    id="clinicPostalCode"
                    type="text"
                    value={draft.clinicAddress.postalCode}
                    onChange={(event) =>
                      updateNested(
                        'clinicAddress',
                        'postalCode',
                        event.target.value,
                      )
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Country" htmlFor="clinicCountry">
                  <input
                    id="clinicCountry"
                    type="text"
                    value={draft.clinicAddress.country}
                    onChange={(event) =>
                      updateNested('clinicAddress', 'country', event.target.value)
                    }
                    className={inputClass}
                  />
                </Field>
              </div>
            </Card>

            <Card title="About">
              <Field label="Bio" htmlFor="bio">
                <textarea
                  id="bio"
                  rows="4"
                  value={draft.bio}
                  onChange={(event) => updateField('bio', event.target.value)}
                  className={inputClass}
                  placeholder="A short introduction patients will see."
                />
              </Field>
            </Card>

            <Card title="Languages">
              <ArrayField
                label="Languages spoken"
                items={draft.languages}
                inputValue={newLanguage}
                onInputChange={setNewLanguage}
                onAdd={handleAddLanguage}
                onRemove={handleRemoveLanguage}
                placeholder="e.g. Hindi"
              />
            </Card>

            <Card title="Availability">
              <p className="text-sm text-slate-600">
                Set your typical weekly consultation hours. Times use the
                HH:mm 24-hour format.
              </p>
              <ul className="mt-4 space-y-3">
                {draft.availability.map((day, index) => (
                  <li
                    key={day.dayOfWeek}
                    className="flex flex-wrap items-center gap-3 rounded-md border border-slate-200 p-3"
                  >
                    <label className="flex min-w-[10rem] items-center gap-2 text-sm font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={day.enabled}
                        onChange={(event) =>
                          updateAvailability(index, 'enabled', event.target.checked)
                        }
                        className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      />
                      {formatEnum(day.dayOfWeek)}
                    </label>
                    {day.enabled ? (
                      <>
                        <input
                          type="time"
                          aria-label={`${formatEnum(day.dayOfWeek)} start time`}
                          value={day.startTime}
                          onChange={(event) =>
                            updateAvailability(index, 'startTime', event.target.value)
                          }
                          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        />
                        <span className="text-sm text-slate-500">to</span>
                        <input
                          type="time"
                          aria-label={`${formatEnum(day.dayOfWeek)} end time`}
                          value={day.endTime}
                          onChange={(event) =>
                            updateAvailability(index, 'endTime', event.target.value)
                          }
                          className="rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        />
                      </>
                    ) : (
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Unavailable
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </Card>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={saveState === 'saving'}
                className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saveState === 'saving' ? 'Saving…' : 'Save profile'}
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
              You haven&apos;t set up your practice profile yet
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
              Add your specialization, qualifications, clinic details,
              languages, and consultation availability so patients can find
              you.
            </p>
            <button
              type="button"
              onClick={startEditing}
              className="mt-5 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
            >
              Create practice profile
            </button>
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            <Card title="Verification">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-600">
                  Your profile is currently{' '}
                  <VerificationBadge status={profile.verificationStatus} />.
                  {profile.verificationStatus === 'PENDING'
                    ? ' Platform verification will confirm your practice details.'
                    : ''}
                </p>
                <button
                  type="button"
                  onClick={startEditing}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Edit profile
                </button>
              </div>
            </Card>

            <Card title="Practice information">
              <dl className="grid gap-4 sm:grid-cols-2">
                <InfoRow
                  label="Specialization"
                  value={profile.specialization}
                />
                <InfoRow label="Qualification" value={profile.qualification} />
                <InfoRow
                  label="Registration number"
                  value={profile.registrationNumber}
                />
                <InfoRow
                  label="Experience"
                  value={
                    profile.experience !== null
                      ? `${profile.experience} years`
                      : ''
                  }
                />
                <InfoRow
                  label="Consultation fee"
                  value={
                    profile.consultationFee !== null
                      ? `₹${profile.consultationFee}`
                      : ''
                  }
                />
              </dl>
            </Card>

            <Card title="Clinic information">
              <dl className="grid gap-4 sm:grid-cols-2">
                <InfoRow label="Clinic name" value={profile.clinicName} />
                <InfoRow label="Street" value={profile.clinicAddress.street} />
                <InfoRow label="City" value={profile.clinicAddress.city} />
                <InfoRow label="State" value={profile.clinicAddress.state} />
                <InfoRow
                  label="Postal code"
                  value={profile.clinicAddress.postalCode}
                />
                <InfoRow label="Country" value={profile.clinicAddress.country} />
              </dl>
            </Card>

            <Card title="Bio">
              <p className="text-sm text-slate-700">
                {profile.bio || 'Not provided'}
              </p>
            </Card>

            <Card title="Languages">
              {profile.languages.length > 0 ? (
                <ul className="flex flex-wrap gap-2">
                  {profile.languages.map((language) => (
                    <li
                      key={language}
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700"
                    >
                      {language}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-600">No languages added yet.</p>
              )}
            </Card>

            <Card title="Availability">
              {enabledDays.length > 0 ? (
                <dl className="grid gap-3 sm:grid-cols-2">
                  {enabledDays.map((day) => (
                    <div
                      key={day.dayOfWeek}
                      className="flex items-center justify-between rounded-md border border-slate-200 px-4 py-2.5"
                    >
                      <dt className="text-sm font-medium text-slate-700">
                        {formatEnum(day.dayOfWeek)}
                      </dt>
                      <dd className="text-sm text-slate-600">
                        {day.startTime} – {day.endTime}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-sm text-slate-600">
                  You haven&apos;t set any consultation hours yet.
                </p>
              )}
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}