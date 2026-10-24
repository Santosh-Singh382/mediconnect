import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import PublicHeader from '../components/PublicHeader.jsx'
import LoadingState from '../components/LoadingState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { useCart } from '../hooks/useCart.js'
import { getPublicMedicine } from '../lib/publicMedicineApi.js'
import { getApiErrorMessage } from '../lib/apiError.js'
import {
  formatMedicinePrice,
  formatExpiryDate,
  medicineCategoryLabel,
} from '../lib/medicineFormat.js'

function InfoRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2.5 last:border-0">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-right text-sm font-medium text-slate-900">
        {value || 'Not listed'}
      </dd>
    </div>
  )
}

function StockBadge({ inStock, stockQuantity }) {
  if (!inStock) {
    return (
      <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
        Out of stock
      </span>
    )
  }
  return (
    <span className="inline-block rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
      {stockQuantity} in stock
    </span>
  )
}

function PrescriptionBadge({ required }) {
  return required ? (
    <span className="inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
      Prescription required
    </span>
  ) : (
    <span className="inline-block rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-800">
      Over the counter
    </span>
  )
}

export default function MedicineDetailsPage() {
  const { medicineId } = useParams()
  const { user } = useAuth()
  const { addItem } = useCart()
  const location = useLocation()
  const [state, setState] = useState({
    loading: true,
    error: null,
    data: null,
  })
  const [quantity, setQuantity] = useState(1)
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)
  const [addError, setAddError] = useState(null)
  const medicine = state.data?.medicine || null
  const maxQuantity = medicine ? Math.min(medicine.stockQuantity, 100) : 1

  const load = useCallback(() => {
    getPublicMedicine(medicineId)
      .then((response) => {
        setQuantity(1)
        setAdded(false)
        setAddError(null)
        setState({ loading: false, error: null, data: response.data.data })
      })
      .catch((error) => {
        const message =
          error?.response?.status === 404
            ? 'This medicine is not currently available from a verified pharmacy.'
            : getApiErrorMessage(error, 'Unable to load this medicine right now.')
        setState({ loading: false, error: message, data: null })
      })
  }, [medicineId])

  useEffect(() => {
    load()
  }, [load])

  function retry() {
    setState({ loading: true, error: null, data: null })
    load()
  }

  function changeQuantity(step) {
    setQuantity((current) =>
      Math.min(maxQuantity, Math.max(1, current + step)),
    )
    setAdded(false)
    setAddError(null)
  }

  async function handleAdd() {
    if (!medicine || !medicine.inStock || adding) return

    setAdding(true)
    setAdded(false)
    setAddError(null)
    try {
      await addItem(medicine.id, quantity)
      setAdded(true)
    } catch (error) {
      setAddError(
        getApiErrorMessage(error, 'Unable to add this medicine to your cart.'),
      )
    } finally {
      setAdding(false)
    }
  }

  if (state.loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <PublicHeader />
        <main className="mx-auto max-w-4xl px-6 py-12">
          <LoadingState label="Loading medicine…" />
        </main>
      </div>
    )
  }

  if (state.error) {
    return (
      <div className="min-h-screen bg-slate-50">
        <PublicHeader />
        <main className="mx-auto max-w-4xl px-6 py-12">
          <ErrorState message={state.error} onRetry={retry} />
          <div className="mt-4 text-center">
            <Link
              to="/medicines"
              className="text-sm font-medium text-brand-600 transition hover:text-brand-700"
            >
              Back to medicines
            </Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <PublicHeader />

      <main className="mx-auto max-w-4xl px-6 py-10">
        <Link
          to="/medicines"
          className="text-sm font-medium text-brand-600 transition hover:text-brand-700"
        >
          &larr; Back to medicines
        </Link>

        <section className="mt-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-700">
                {medicineCategoryLabel(medicine.category)}
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                {medicine.name}
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                {[medicine.genericName, medicine.brandName]
                  .filter(Boolean)
                  .join(' · ') || 'Generic and brand not listed'}
              </p>
              <p className="mt-1 text-sm font-medium text-slate-500">
                {[medicine.strength, medicine.dosageForm, medicine.packSize]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Listed price
              </p>
              <p className="mt-1 text-3xl font-semibold text-slate-900">
                {formatMedicinePrice(medicine.price)}
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <StockBadge
              inStock={medicine.inStock}
              stockQuantity={medicine.stockQuantity}
            />
            <PrescriptionBadge required={medicine.prescriptionRequired} />
          </div>

          <div className="mt-6 border-t border-slate-100 pt-5">
            {user?.role === 'PATIENT' ? (
              <div className="flex flex-wrap items-end gap-3">
                {medicine.inStock ? (
                  <div>
                    <span className="block text-sm font-medium text-slate-700">
                      Quantity
                    </span>
                    <div className="mt-1 inline-flex items-center overflow-hidden rounded-md border border-slate-300 bg-white">
                      <button
                        type="button"
                        aria-label="Decrease quantity"
                        onClick={() => changeQuantity(-1)}
                        disabled={adding || quantity <= 1}
                        className="h-9 w-9 text-lg font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        &minus;
                      </button>
                      <span className="flex h-9 w-11 items-center justify-center border-x border-slate-200 text-sm font-semibold text-slate-900">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        aria-label="Increase quantity"
                        onClick={() => changeQuantity(1)}
                        disabled={adding || quantity >= maxQuantity}
                        className="h-9 w-9 text-lg font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={adding || !medicine.inStock}
                  className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {adding
                    ? 'Adding…'
                    : medicine.inStock
                      ? 'Add to cart'
                      : 'Out of stock'}
                </button>
                <p className="pb-2 text-xs text-slate-500">
                  {medicine.inStock
                    ? `Up to ${maxQuantity} unit${
                        maxQuantity === 1 ? '' : 's'
                      } per cart item`
                    : 'This medicine is currently out of stock.'}
                </p>
              </div>
            ) : user ? (
              <p className="text-sm text-slate-600">
                Only patient accounts can add medicines to a pharmacy cart.
              </p>
            ) : (
              <p className="text-sm text-slate-600">
                <Link
                  to="/login"
                  state={{ from: location }}
                  className="font-medium text-brand-600 transition hover:text-brand-700"
                >
                  Sign in
                </Link>{' '}
                as a patient to add this medicine to your cart.
              </p>
            )}

            {added ? (
              <div
                role="status"
                className="mt-3 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800"
              >
                Added {quantity} unit{quantity === 1 ? '' : 's'} to your cart.{' '}
                <Link
                  to="/cart"
                  className="font-semibold text-green-900 underline"
                >
                  View cart
                </Link>
              </div>
            ) : null}

            {addError ? (
              <div
                role="alert"
                className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {addError}
              </div>
            ) : null}
          </div>
        </section>

        <div className="mt-6 grid gap-6 md:grid-cols-5">
          <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm md:col-span-3">
            <h2 className="text-base font-semibold text-slate-900">
              About this medicine
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              {medicine.description ||
                'The pharmacy has not added a description for this medicine.'}
            </p>

            <h2 className="mt-6 text-base font-semibold text-slate-900">
              Medicine details
            </h2>
            <dl className="mt-2">
              <InfoRow label="Generic name" value={medicine.genericName} />
              <InfoRow label="Brand name" value={medicine.brandName} />
              <InfoRow
                label="Category"
                value={medicineCategoryLabel(medicine.category)}
              />
              <InfoRow label="Dosage form" value={medicine.dosageForm} />
              <InfoRow label="Strength" value={medicine.strength} />
              <InfoRow label="Pack size" value={medicine.packSize} />
              <InfoRow
                label="Expiry date"
                value={formatExpiryDate(medicine.expiryDate)}
              />
              <InfoRow
                label="Prescription"
                value={
                  medicine.prescriptionRequired
                    ? 'Required'
                    : 'Not required'
                }
              />
              <InfoRow
                label="Availability"
                value={medicine.inStock ? 'In stock' : 'Out of stock'}
              />
            </dl>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm md:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-slate-900">
                Sold by
              </h2>
              <span className="inline-block rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                Verified pharmacy
              </span>
            </div>
            <p className="mt-4 text-sm font-semibold text-slate-900">
              {medicine.pharmacy.pharmacyName}
            </p>
            {medicine.pharmacy.pharmacistName ? (
              <p className="mt-1 text-sm text-slate-500">
                Pharmacist: {medicine.pharmacy.pharmacistName}
              </p>
            ) : null}
            <div className="mt-4 border-t border-slate-100 pt-4 text-sm leading-relaxed text-slate-600">
              <p>{medicine.pharmacy.address || 'Address not listed'}</p>
              <p className="mt-1">
                {[medicine.pharmacy.city, medicine.pharmacy.state]
                  .filter(Boolean)
                  .join(', ') || 'Location not listed'}
              </p>
              {medicine.pharmacy.pincode ? (
                <p className="mt-1">PIN {medicine.pharmacy.pincode}</p>
              ) : null}
            </div>
            <p className="mt-5 rounded-md bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-500">
              Cart totals use the listed price. Pharmacy orders can be placed
              with Cash on Delivery; delivery tracking is not available yet.
            </p>
          </section>
        </div>
      </main>
    </div>
  )
}
