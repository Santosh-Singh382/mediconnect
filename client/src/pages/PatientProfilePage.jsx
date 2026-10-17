import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth.js'
import AppHeader from '../components/AppHeader.jsx'
import LoadingState from '../components/LoadingState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import { getPatientProfile, savePatientProfile } from '../lib/patientApi.js'
import { getApiErrorMessage } from '../lib/apiError.js'
import { inputClass } from '../lib/formStyles.js'
import { homePathFor, homeLinksFor } from '../lib/homePath.js'

const GENDERS = ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

const PHONE_PATTERN = /^\+?[0-9\s()-]{7,20}$/

function formatEnum(value) {
  return value.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())
}

function draftFrom(profile) {
  const address = profile?.address || {}
  const emergencyContact = profile?.emergencyContact || {}

  return {
    dateOfBirth: profile?.dateOfBirth || '',
    gender: profile?.gender || '',
    bloodGroup: profile?.bloodGroup || '',
    address: {
      street: address.street || '',
      city: address.city || '',
      state: address.state || '',
      postalCode: address.postalCode || '',
      country: address.country || '',
    },
    emergencyContact: {
      name: emergencyContact.name || '',
      relationship: emergencyContact.relationship || '',
      phone: emergencyContact.phone || '',
    },
    allergies: profile?.allergies ? [...profile.allergies] : [],
    existingConditions: profile?.existingConditions
      ? [...profile.existingConditions]
      : [],
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

function ChipList({ items, emptyText }) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-600">{emptyText}</p>
  }
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li
          key={item}
          className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700"
        >
          {item}
        </li>
      ))}
    </ul>
  )
}

function Field({ label, htmlFor, children }) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-slate-700"
      >
        {label}
      </label>
      {children}
    </div>
  )
}

function ArrayField({
  label,
  group,
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
                onClick={() => onRemove(group, index)}
                aria-label={`Remove ${item}`}
                className="text-slate-400 transition hover:text-red-600"
              >
                Ã—
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(event) => onInputChange(group, event.target.value)}
          placeholder={placeholder}
          className={`${inputClass} max-w-xs py-1.5`}
        />
        <button
          type="button"
          onClick={() => onAdd(group)}
          className="shrink-0 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Add
        </button>
      </div>
    </div>
  )
}

export default function PatientProfilePage() {
  const { user } = useAuth()
  const [loadState, setLoadState] = useState({
    loading: true,
    error: null,
    data: null,
  })
  const [mode, setMode] = useState('view')
  const [draft, setDraft] = useState(null)
  const [newItem, setNewItem] = useState({ allergies: '', existingConditions: '' })
  const [saveState, setSaveState] = useState('idle')
  const [formErrors, setFormErrors] = useState([])
  const [saveError, setSaveError] = useState(null)
  const [serverDetails, setServerDetails] = useState([])

  const load = useCallback(() => {
    getPatientProfile()
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
    setNewItem({ allergies: '', existingConditions: '' })
  }

  function updateField(field, value) {
    setDraft((d) => ({ ...d, [field]: value }))
  }

  function updateNested(group, field, value) {
    setDraft((d) => ({ ...d, [group]: { ...d[group], [field]: value } }))
  }

  function handleInputChange(group, value) {
    setNewItem((n) => ({ ...n, [group]: value }))
  }

  function handleAdd(group) {
    const value = newItem[group].trim()
    if (!value) return
    setDraft((d) => ({ ...d, [group]: [...d[group], value] }))
    setNewItem((n) => ({ ...n, [group]: '' }))
  }

  function handleRemove(group, index) {
    setDraft((d) => ({
      ...d,
      [group]: d[group].filter((_, i) => i !== index),
    }))
  }

  function validateDraft() {
    const errors = []
    if (draft.dateOfBirth) {
      const dob = new Date(draft.dateOfBirth)
      if (Number.isNaN(dob.getTime())) {
        errors.push('Date of birth is not a valid date.')
      } else if (dob.getTime() > Date.now()) {
        errors.push('Date of birth cannot be in the future.')
      }
    }
    if (
      draft.emergencyContact.phone &&
      !PHONE_PATTERN.test(draft.emergencyContact.phone)
    ) {
      errors.push('Emergency contact phone number is not valid.')
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
      const response = await savePatientProfile({
        dateOfBirth: draft.dateOfBirth || null,
        gender: draft.gender || null,
        bloodGroup: draft.bloodGroup || null,
        address: {
          street: draft.address.street || null,
          city: draft.address.city || null,
          state: draft.address.state || null,
          postalCode: draft.address.postalCode || null,
          country: draft.address.country || null,
        },
        emergencyContact: {
          name: draft.emergencyContact.name || null,
          relationship: draft.emergencyContact.relationship || null,
          phone: draft.emergencyContact.phone || null,
        },
        allergies: draft.allergies,
        existingConditions: draft.existingConditions,
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
          <LoadingState label="Loading your profileâ€¦" />
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
        <h1 className="text-2xl font-semibold text-slate-900">
          My profile
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Your health profile helps doctors understand you before a
          consultation.
        </p>

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
            <Card title="Basic information">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Date of birth" htmlFor="dateOfBirth">
                  <input
                    id="dateOfBirth"
                    type="date"
                    value={draft.dateOfBirth}
                    onChange={(event) =>
                      updateField('dateOfBirth', event.target.value)
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Gender" htmlFor="gender">
                  <select
                    id="gender"
                    value={draft.gender}
                    onChange={(event) =>
                      updateField('gender', event.target.value)
                    }
                    className={inputClass}
                  >
                    <option value="">Not specified</option>
                    {GENDERS.map((gender) => (
                      <option key={gender} value={gender}>
                        {formatEnum(gender)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Blood group" htmlFor="bloodGroup">
                  <select
                    id="bloodGroup"
                    value={draft.bloodGroup}
                    onChange={(event) =>
                      updateField('bloodGroup', event.target.value)
                    }
                    className={inputClass}
                  >
                    <option value="">Not specified</option>
                    {BLOOD_GROUPS.map((group) => (
                      <option key={group} value={group}>
                        {group}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </Card>

            <Card title="Address">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Street" htmlFor="street">
                  <input
                    id="street"
                    type="text"
                    value={draft.address.street}
                    onChange={(event) =>
                      updateNested('address', 'street', event.target.value)
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="City" htmlFor="city">
                  <input
                    id="city"
                    type="text"
                    value={draft.address.city}
                    onChange={(event) =>
                      updateNested('address', 'city', event.target.value)
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="State" htmlFor="state">
                  <input
                    id="state"
                    type="text"
                    value={draft.address.state}
                    onChange={(event) =>
                      updateNested('address', 'state', event.target.value)
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Postal code" htmlFor="postalCode">
                  <input
                    id="postalCode"
                    type="text"
                    value={draft.address.postalCode}
                    onChange={(event) =>
                      updateNested('address', 'postalCode', event.target.value)
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Country" htmlFor="country">
                  <input
                    id="country"
                    type="text"
                    value={draft.address.country}
                    onChange={(event) =>
                      updateNested('address', 'country', event.target.value)
                    }
                    className={inputClass}
                  />
                </Field>
              </div>
            </Card>

            <Card title="Emergency contact">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name" htmlFor="emergencyName">
                  <input
                    id="emergencyName"
                    type="text"
                    value={draft.emergencyContact.name}
                    onChange={(event) =>
                      updateNested(
                        'emergencyContact',
                        'name',
                        event.target.value,
                      )
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Relationship" htmlFor="emergencyRelationship">
                  <input
                    id="emergencyRelationship"
                    type="text"
                    value={draft.emergencyContact.relationship}
                    onChange={(event) =>
                      updateNested(
                        'emergencyContact',
                        'relationship',
                        event.target.value,
                      )
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Phone" htmlFor="emergencyPhone">
                  <input
                    id="emergencyPhone"
                    type="tel"
                    value={draft.emergencyContact.phone}
                    onChange={(event) =>
                      updateNested(
                        'emergencyContact',
                        'phone',
                        event.target.value,
                      )
                    }
                    className={inputClass}
                  />
                </Field>
              </div>
            </Card>

            <Card title="Health information">
              <div className="space-y-5">
                <ArrayField
                  label="Allergies"
                  group="allergies"
                  items={draft.allergies}
                  inputValue={newItem.allergies}
                  onInputChange={handleInputChange}
                  onAdd={handleAdd}
                  onRemove={handleRemove}
                  placeholder="e.g. Penicillin"
                />
                <ArrayField
                  label="Existing conditions"
                  group="existingConditions"
                  items={draft.existingConditions}
                  inputValue={newItem.existingConditions}
                  onInputChange={handleInputChange}
                  onAdd={handleAdd}
                  onRemove={handleRemove}
                  placeholder="e.g. Asthma"
                />
              </div>
            </Card>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={saveState === 'saving'}
                className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saveState === 'saving' ? 'Savingâ€¦' : 'Save profile'}
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
              You haven&apos;t added a health profile yet
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
              Add your basic information, address, emergency contact, and any
              allergies or existing conditions you want doctors to know about.
            </p>
            <button
              type="button"
              onClick={startEditing}
              className="mt-5 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
            >
              Add health profile
            </button>
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            <Card title="Basic information">
              <dl className="grid gap-4 sm:grid-cols-3">
                <InfoRow label="Date of birth" value={profile.dateOfBirth} />
                <InfoRow
                  label="Gender"
                  value={profile.gender ? formatEnum(profile.gender) : ''}
                />
                <InfoRow label="Blood group" value={profile.bloodGroup} />
              </dl>
            </Card>

            <Card title="Address">
              <dl className="grid gap-4 sm:grid-cols-2">
                <InfoRow label="Street" value={profile.address.street} />
                <InfoRow label="City" value={profile.address.city} />
                <InfoRow label="State" value={profile.address.state} />
                <InfoRow label="Postal code" value={profile.address.postalCode} />
                <InfoRow label="Country" value={profile.address.country} />
              </dl>
            </Card>

            <Card title="Emergency contact">
              <dl className="grid gap-4 sm:grid-cols-3">
                <InfoRow label="Name" value={profile.emergencyContact.name} />
                <InfoRow
                  label="Relationship"
                  value={profile.emergencyContact.relationship}
                />
                <InfoRow label="Phone" value={profile.emergencyContact.phone} />
              </dl>
            </Card>

            <Card
              title="Health information"
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
              <div className="space-y-5">
                <div>
                  <span className="text-sm font-medium text-slate-700">
                    Allergies
                  </span>
                  <div className="mt-2">
                    <ChipList
                      items={profile.allergies}
                      emptyText="No known allergies added"
                    />
                  </div>
                </div>
                <div>
                  <span className="text-sm font-medium text-slate-700">
                    Existing conditions
                  </span>
                  <div className="mt-2">
                    <ChipList
                      items={profile.existingConditions}
                      emptyText="No existing conditions added"
                    />
                  </div>
                </div>
              </div>
              <div className="mt-5">
                <button
                  type="button"
                  onClick={startEditing}
                  className="text-sm font-medium text-brand-600 transition hover:text-brand-700"
                >
                  Edit profile
                </button>
              </div>
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}
