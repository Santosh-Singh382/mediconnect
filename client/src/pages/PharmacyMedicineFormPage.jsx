import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import AppHeader from '../components/AppHeader.jsx'
import LoadingState from '../components/LoadingState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import {
  getMedicine,
  createMedicine,
  updateMedicine,
} from '../lib/medicineApi.js'
import { getApiErrorMessage } from '../lib/apiError.js'
import { inputClass } from '../lib/formStyles.js'
import { homePathFor, homeLinksFor } from '../lib/homePath.js'
import {
  MEDICINE_CATEGORY_OPTIONS,
  formatMedicinePrice,
  formatExpiryDate,
} from '../lib/medicineFormat.js'

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const MAX_PRICE = 1000000
const MAX_STOCK = 1000000

const EMPTY_DRAFT = {
  name: '',
  genericName: '',
  brandName: '',
  category: 'TABLET',
  description: '',
  dosageForm: '',
  strength: '',
  packSize: '',
  price: '',
  stockQuantity: '',
  prescriptionRequired: true,
  expiryDate: '',
}

function draftFrom(medicine) {
  return {
    name: medicine.name || '',
    genericName: medicine.genericName || '',
    brandName: medicine.brandName || '',
    category: medicine.category || 'TABLET',
    description: medicine.description || '',
    dosageForm: medicine.dosageForm || '',
    strength: medicine.strength || '',
    packSize: medicine.packSize || '',
    price: String(medicine.price ?? ''),
    stockQuantity: String(medicine.stockQuantity ?? ''),
    prescriptionRequired: medicine.prescriptionRequired !== false,
    expiryDate: medicine.expiryDate || '',
  }
}

function isValidDateOnly(value) {
  if (!DATE_PATTERN.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  if (year < 1900 || year > 2200) return false
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  )
}

function Field({ label, htmlFor, required, error, children }) {
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
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  )
}

function SuccessView({ medicine, isEdit, onAddAnother }) {
  const { user } = useAuth()
  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader home={homePathFor(user)} links={homeLinksFor(user)} />
      <main className="mx-auto max-w-2xl px-6 py-12">
        <div className="rounded-lg border border-green-200 bg-green-50 p-8 text-center">
          <h1 className="text-xl font-semibold text-green-900">
            {isEdit ? 'Medicine updated' : 'Medicine added'}
          </h1>
          <p className="mt-2 text-sm text-green-800">
            {medicine.name}
            {medicine.strength ? ` ${medicine.strength}` : ''} is now in your
            inventory at {formatMedicinePrice(medicine.price)} with{' '}
            {medicine.stockQuantity} in stock. Expiry:{' '}
            {formatExpiryDate(medicine.expiryDate)}.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              to="/pharmacy/inventory"
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
            >
              Back to inventory
            </Link>
            {!isEdit ? (
              <button
                type="button"
                onClick={onAddAnother}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Add another medicine
              </button>
            ) : (
              <Link
                to={`/pharmacy/inventory/${medicine.id}/edit`}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Edit again
              </Link>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default function PharmacyMedicineFormPage() {
  const { user } = useAuth()
  const { medicineId } = useParams()
  const isEdit = Boolean(medicineId)

  const [loadState, setLoadState] = useState({
    loading: isEdit,
    error: null,
  })
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [fieldErrors, setFieldErrors] = useState({})
  const [generalError, setGeneralError] = useState(null)
  const [submitState, setSubmitState] = useState('idle')
  const [savedMedicine, setSavedMedicine] = useState(null)

  const loadMedicine = useCallback(() => {
    if (!isEdit) return

    getMedicine(medicineId)
      .then((response) => {
        setDraft(draftFrom(response.data.data.medicine))
        setLoadState({ loading: false, error: null })
      })
      .catch((error) => {
        setLoadState({
          loading: false,
          error: getApiErrorMessage(error, 'Unable to load this medicine.'),
        })
      })
  }, [isEdit, medicineId])

  function retryLoad() {
    setLoadState({ loading: true, error: null })
    loadMedicine()
  }

  useEffect(() => {
    if (isEdit) loadMedicine()
  }, [isEdit, loadMedicine])

  function updateField(field, value) {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  function validateDraft() {
    const errors = {}

    const name = draft.name.trim()
    if (!name) {
      errors.name = 'Medicine name is required.'
    } else if (name.length > 200) {
      errors.name = 'Medicine name cannot exceed 200 characters.'
    }

    if (!draft.category) {
      errors.category = 'Category is required.'
    }

    const priceRaw = draft.price.trim()
    if (!priceRaw) {
      errors.price = 'Price is required.'
    } else {
      const price = Number(priceRaw)
      if (!Number.isFinite(price)) {
        errors.price = 'Price must be a valid number.'
      } else if (price < 0) {
        errors.price = 'Price cannot be negative.'
      } else if (price > MAX_PRICE) {
        errors.price = `Price cannot exceed ${MAX_PRICE}.`
      } else if (Math.abs(price * 100 - Math.round(price * 100)) > 1e-9) {
        errors.price = 'Price cannot have more than 2 decimal places.'
      }
    }

    const stockRaw = draft.stockQuantity.trim()
    if (!stockRaw) {
      errors.stockQuantity = 'Stock quantity is required.'
    } else {
      const stock = Number(stockRaw)
      if (!Number.isInteger(stock)) {
        errors.stockQuantity = 'Stock quantity must be a whole number.'
      } else if (stock < 0) {
        errors.stockQuantity = 'Stock quantity cannot be negative.'
      } else if (stock > MAX_STOCK) {
        errors.stockQuantity = `Stock quantity cannot exceed ${MAX_STOCK}.`
      }
    }

    if (!draft.expiryDate) {
      errors.expiryDate = 'Expiry date is required.'
    } else if (!isValidDateOnly(draft.expiryDate)) {
      errors.expiryDate = 'Expiry date must be a valid date.'
    }

    const optionalLimits = {
      genericName: ['Generic name', 200],
      brandName: ['Brand name', 200],
      description: ['Description', 1000],
      dosageForm: ['Dosage form', 100],
      strength: ['Strength', 100],
      packSize: ['Pack size', 100],
    }

    for (const [field, [label, max]] of Object.entries(optionalLimits)) {
      if (draft[field].trim().length > max) {
        errors[field] = `${label} cannot exceed ${max} characters.`
      }
    }

    return errors
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitState === 'submitting') return

    const errors = validateDraft()
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      setGeneralError('Please correct the highlighted fields and try again.')
      return
    }

    setFieldErrors({})
    setGeneralError(null)
    setSubmitState('submitting')

    const payload = {
      name: draft.name.trim(),
      genericName: draft.genericName.trim() || null,
      brandName: draft.brandName.trim() || null,
      category: draft.category,
      description: draft.description.trim() || null,
      dosageForm: draft.dosageForm.trim() || null,
      strength: draft.strength.trim() || null,
      packSize: draft.packSize.trim() || null,
      price: Number(draft.price),
      stockQuantity: Number(draft.stockQuantity),
      prescriptionRequired: draft.prescriptionRequired,
      expiryDate: draft.expiryDate,
    }

    try {
      const response = isEdit
        ? await updateMedicine(medicineId, payload)
        : await createMedicine(payload)
      setSavedMedicine(response.data.data.medicine)
      setSubmitState('saved')
    } catch (error) {
      const details = error.response?.data?.details
      const nextErrors = {}
      if (Array.isArray(details)) {
        for (const detail of details) {
          if (detail.field && !nextErrors[detail.field]) {
            nextErrors[detail.field] = detail.message
          }
        }
      }
      setFieldErrors(nextErrors)
      setGeneralError(
        getApiErrorMessage(error, 'Unable to save this medicine. Please try again.'),
      )
      setSubmitState('error')
    }
  }

  function handleAddAnother() {
    setDraft(EMPTY_DRAFT)
    setSavedMedicine(null)
    setSubmitState('idle')
    setFieldErrors({})
    setGeneralError(null)
  }

  if (loadState.loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <AppHeader home={homePathFor(user)} links={homeLinksFor(user)} />
        <main className="mx-auto max-w-3xl px-6 py-10">
          <LoadingState label="Loading medicine…" />
        </main>
      </div>
    )
  }

  if (loadState.error) {
    return (
      <div className="min-h-screen bg-slate-50">
        <AppHeader home={homePathFor(user)} links={homeLinksFor(user)} />
        <main className="mx-auto max-w-3xl px-6 py-10">
          <ErrorState message={loadState.error} onRetry={retryLoad} />
        </main>
      </div>
    )
  }

  if (submitState === 'saved' && savedMedicine) {
    return (
      <SuccessView
        medicine={savedMedicine}
        isEdit={isEdit}
        onAddAnother={handleAddAnother}
      />
    )
  }

  const submitting = submitState === 'submitting'

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader home={homePathFor(user)} links={homeLinksFor(user)} />

      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link
          to="/pharmacy/inventory"
          className="text-sm font-medium text-brand-600 transition hover:text-brand-700"
        >
          &larr; Back to inventory
        </Link>

        <section className="mt-6">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            {isEdit ? 'Edit medicine' : 'Add medicine'}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {isEdit
              ? 'Update the details, price, stock, or expiry date for this medicine.'
              : 'Add a medicine to your pharmacy inventory.'}
          </p>
        </section>

        {generalError && (
          <p className="mt-6 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {generalError}
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-6" noValidate>
          <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">
              Medicine information
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Medicine name" htmlFor="medicineName" required error={fieldErrors.name}>
                <input
                  id="medicineName"
                  type="text"
                  value={draft.name}
                  onChange={(event) => updateField('name', event.target.value)}
                  className={inputClass}
                  maxLength={200}
                  placeholder="e.g. Paracetamol"
                />
              </Field>
              <Field label="Generic name" htmlFor="genericName" error={fieldErrors.genericName}>
                <input
                  id="genericName"
                  type="text"
                  value={draft.genericName}
                  onChange={(event) =>
                    updateField('genericName', event.target.value)
                  }
                  className={inputClass}
                  maxLength={200}
                  placeholder="e.g. Acetaminophen"
                />
              </Field>
              <Field label="Brand name" htmlFor="brandName" error={fieldErrors.brandName}>
                <input
                  id="brandName"
                  type="text"
                  value={draft.brandName}
                  onChange={(event) =>
                    updateField('brandName', event.target.value)
                  }
                  className={inputClass}
                  maxLength={200}
                  placeholder="e.g. Dolo"
                />
              </Field>
              <Field label="Category" htmlFor="category" required error={fieldErrors.category}>
                <select
                  id="category"
                  value={draft.category}
                  onChange={(event) =>
                    updateField('category', event.target.value)
                  }
                  className={inputClass}
                >
                  {MEDICINE_CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="sm:col-span-2">
                <Field label="Description" htmlFor="description" error={fieldErrors.description}>
                  <textarea
                    id="description"
                    rows={3}
                    value={draft.description}
                    onChange={(event) =>
                      updateField('description', event.target.value)
                    }
                    className={inputClass}
                    maxLength={1000}
                    placeholder="Optional notes about this medicine."
                  />
                </Field>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">
              Pack details
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Field label="Dosage form" htmlFor="dosageForm" error={fieldErrors.dosageForm}>
                <input
                  id="dosageForm"
                  type="text"
                  value={draft.dosageForm}
                  onChange={(event) =>
                    updateField('dosageForm', event.target.value)
                  }
                  className={inputClass}
                  maxLength={100}
                  placeholder="e.g. Tablet"
                />
              </Field>
              <Field label="Strength" htmlFor="strength" error={fieldErrors.strength}>
                <input
                  id="strength"
                  type="text"
                  value={draft.strength}
                  onChange={(event) =>
                    updateField('strength', event.target.value)
                  }
                  className={inputClass}
                  maxLength={100}
                  placeholder="e.g. 500 mg"
                />
              </Field>
              <Field label="Pack size" htmlFor="packSize" error={fieldErrors.packSize}>
                <input
                  id="packSize"
                  type="text"
                  value={draft.packSize}
                  onChange={(event) =>
                    updateField('packSize', event.target.value)
                  }
                  className={inputClass}
                  maxLength={100}
                  placeholder="e.g. 10 tablets"
                />
              </Field>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">
              Price, stock, and expiry
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Price (₹)" htmlFor="price" required error={fieldErrors.price}>
                <input
                  id="price"
                  type="number"
                  min="0"
                  max={MAX_PRICE}
                  step="0.01"
                  value={draft.price}
                  onChange={(event) => updateField('price', event.target.value)}
                  className={inputClass}
                  placeholder="e.g. 25.50"
                />
              </Field>
              <Field label="Stock quantity" htmlFor="stockQuantity" required error={fieldErrors.stockQuantity}>
                <input
                  id="stockQuantity"
                  type="number"
                  min="0"
                  max={MAX_STOCK}
                  step="1"
                  value={draft.stockQuantity}
                  onChange={(event) =>
                    updateField('stockQuantity', event.target.value)
                  }
                  className={inputClass}
                  placeholder="e.g. 100"
                />
              </Field>
              <Field label="Expiry date" htmlFor="expiryDate" required error={fieldErrors.expiryDate}>
                <input
                  id="expiryDate"
                  type="date"
                  value={draft.expiryDate}
                  onChange={(event) =>
                    updateField('expiryDate', event.target.value)
                  }
                  className={inputClass}
                />
              </Field>
              <div className="flex items-start gap-3 sm:mt-7">
                <input
                  id="prescriptionRequired"
                  type="checkbox"
                  checked={draft.prescriptionRequired}
                  onChange={(event) =>
                    updateField('prescriptionRequired', event.target.checked)
                  }
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <label
                  htmlFor="prescriptionRequired"
                  className="text-sm text-slate-700"
                >
                  Prescription required
                  <span className="mt-1 block text-xs text-slate-500">
                    Keep this enabled for medicines that need a doctor&apos;s
                    prescription.
                  </span>
                </label>
              </div>
            </div>
            <p className="mt-4 text-xs text-slate-500">
              Expired medicines remain visible and can be deactivated rather
              than deleted.
            </p>
          </section>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-brand-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting
                ? 'Saving…'
                : isEdit
                  ? 'Save changes'
                  : 'Add medicine'}
            </button>
            <Link
              to="/pharmacy/inventory"
              className="rounded-md border border-slate-300 px-5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </Link>
          </div>
        </form>
      </main>
    </div>
  )
}
