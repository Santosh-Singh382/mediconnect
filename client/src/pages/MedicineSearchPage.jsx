import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import PublicHeader from '../components/PublicHeader.jsx'
import LoadingState from '../components/LoadingState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { useCart } from '../hooks/useCart.js'
import { searchPublicMedicines } from '../lib/publicMedicineApi.js'
import { getApiErrorMessage } from '../lib/apiError.js'
import { inputClass } from '../lib/formStyles.js'
import {
  MEDICINE_CATEGORY_FILTER_OPTIONS,
  formatMedicinePrice,
  formatExpiryDate,
  medicineCategoryLabel,
} from '../lib/medicineFormat.js'

const SORT_OPTIONS = [
  { value: 'name_asc', label: 'Name (A-Z)' },
  { value: 'name_desc', label: 'Name (Z-A)' },
  { value: 'price_asc', label: 'Price (low to high)' },
  { value: 'price_desc', label: 'Price (high to low)' },
  { value: 'expiry_asc', label: 'Expiry (soonest first)' },
  { value: 'expiry_desc', label: 'Expiry (latest first)' },
  { value: 'stock_desc', label: 'Most in stock' },
  { value: 'newest', label: 'Recently added' },
]

const FILTER_KEYS = [
  'q',
  'category',
  'minPrice',
  'maxPrice',
  'prescriptionRequired',
  'inStock',
]

function emptyDraft() {
  return {
    q: '',
    category: '',
    minPrice: '',
    maxPrice: '',
    prescriptionRequired: '',
    inStock: '',
  }
}

function draftFromParams(params) {
  return {
    q: params.get('q') || '',
    category: params.get('category') || '',
    minPrice: params.get('minPrice') || '',
    maxPrice: params.get('maxPrice') || '',
    prescriptionRequired: params.get('prescriptionRequired') || '',
    inStock: params.get('inStock') || '',
  }
}

function searchErrorMessage(error) {
  const detail = error?.response?.data?.details?.[0]?.message
  return (
    detail ||
    getApiErrorMessage(error, 'Unable to load medicines right now.')
  )
}

function StockBadge({ inStock, stockQuantity }) {
  if (!inStock) {
    return (
      <span className="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
        Out of stock
      </span>
    )
  }
  return (
    <span className="inline-block rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
      {stockQuantity > 0 ? `${stockQuantity} in stock` : 'In stock'}
    </span>
  )
}

function PrescriptionBadge({ required }) {
  return required ? (
    <span className="inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
      Prescription required
    </span>
  ) : (
    <span className="inline-block rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-800">
      Over the counter
    </span>
  )
}

function MedicineCard({ medicine, canAdd, adding, feedback, onAdd }) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:border-brand-200 hover:shadow-xl hover:shadow-blue-100/60">
      <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50/60 px-5 py-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-base font-black text-brand-700 shadow-sm ring-1 ring-blue-100">
          {medicine.name.charAt(0).toUpperCase()}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
          Verified listing
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-brand-700">
            {medicineCategoryLabel(medicine.category)}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">
            <Link
              to={`/medicines/${medicine.id}`}
              className="transition hover:text-brand-700"
            >
              {medicine.name}
            </Link>
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {[medicine.strength, medicine.dosageForm]
              .filter(Boolean)
              .join(' · ') || 'Strength not listed'}
          </p>
        </div>
        <p className="shrink-0 text-xl font-black tracking-tight text-slate-950">
          {formatMedicinePrice(medicine.price)}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <StockBadge
          inStock={medicine.inStock}
          stockQuantity={medicine.stockQuantity}
        />
        <PrescriptionBadge required={medicine.prescriptionRequired} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <dt className="text-slate-500">Generic</dt>
          <dd className="font-medium text-slate-800">
            {medicine.genericName || 'Not listed'}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Brand</dt>
          <dd className="font-medium text-slate-800">
            {medicine.brandName || 'Not listed'}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Pack size</dt>
          <dd className="font-medium text-slate-800">
            {medicine.packSize || 'Not listed'}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Expiry</dt>
          <dd className="font-medium text-slate-800">
            {formatExpiryDate(medicine.expiryDate)}
          </dd>
        </div>
      </dl>

      <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 transition group-hover:border-blue-100 group-hover:bg-blue-50/40">
        <p className="text-sm font-medium text-slate-900">
          {medicine.pharmacy.pharmacyName}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          {[medicine.pharmacy.city, medicine.pharmacy.state]
            .filter(Boolean)
            .join(', ') || 'Location not listed'}
        </p>
      </div>

      <div className="mt-auto pt-4">
        {canAdd ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onAdd(medicine)}
              disabled={adding || !medicine.inStock}
              className="flex-1 rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {adding
                ? 'Adding…'
                : medicine.inStock
                  ? 'Add to cart'
                  : 'Out of stock'}
            </button>
            <Link
              to={`/medicines/${medicine.id}`}
              className="flex-1 rounded-md border border-brand-600 px-3 py-1.5 text-center text-sm font-medium text-brand-700 transition hover:bg-brand-50"
            >
              Details
            </Link>
          </div>
        ) : (
          <Link
            to={`/medicines/${medicine.id}`}
            className="inline-block w-full rounded-md border border-brand-600 px-3 py-1.5 text-center text-sm font-medium text-brand-700 transition hover:bg-brand-50"
          >
            View details
          </Link>
        )}
        {feedback ? (
          <p
            role={feedback.success ? 'status' : 'alert'}
            className={`mt-2 text-xs ${
              feedback.success ? 'text-green-700' : 'text-red-600'
            }`}
          >
            {feedback.message}
            {feedback.success ? (
              <>
                {' '}
                <Link
                  to="/cart"
                  className="font-semibold underline"
                >
                  View cart
                </Link>
              </>
            ) : null}
          </p>
        ) : null}
      </div>
      </div>
    </article>
  )
}

export default function MedicineSearchPage() {
  const { user } = useAuth()
  const { addItem } = useCart()
  const [searchParams, setSearchParams] = useSearchParams()
  const [draft, setDraft] = useState(() => draftFromParams(searchParams))
  const [state, setState] = useState({
    loading: true,
    error: null,
    data: null,
  })
  const [addingId, setAddingId] = useState(null)
  const [addFeedback, setAddFeedback] = useState(null)

  const load = useCallback(() => {
    searchPublicMedicines(Object.fromEntries(searchParams.entries()))
      .then((response) => {
        setState({ loading: false, error: null, data: response.data.data })
      })
      .catch((error) => {
        setState({
          loading: false,
          error: searchErrorMessage(error),
          data: null,
        })
      })
  }, [searchParams])

  useEffect(() => {
    load()
  }, [load])

  function beginLoading() {
    setState({ loading: true, error: null, data: null })
  }

  function retry() {
    beginLoading()
    load()
  }

  function handleSearch(event) {
    event.preventDefault()

    const minPrice = draft.minPrice.trim()
    const maxPrice = draft.maxPrice.trim()
    if (minPrice && maxPrice && Number(minPrice) > Number(maxPrice)) {
      setState({
        loading: false,
        error: 'Minimum price cannot exceed maximum price.',
        data: null,
      })
      return
    }

    const next = new URLSearchParams()
    for (const [key, value] of Object.entries(draft)) {
      const trimmed = String(value).trim()
      if (trimmed !== '') next.set(key, trimmed)
    }
    const sort = searchParams.get('sort')
    if (sort) next.set('sort', sort)
    next.set('page', '1')
    beginLoading()
    setSearchParams(next)
  }

  function handleClear() {
    setDraft(emptyDraft())
    beginLoading()
    setSearchParams({})
  }

  function changeSort(sort) {
    const next = new URLSearchParams(searchParams)
    next.set('sort', sort)
    next.set('page', '1')
    beginLoading()
    setSearchParams(next)
  }

  function changePage(page) {
    const next = new URLSearchParams(searchParams)
    next.set('page', String(page))
    beginLoading()
    setSearchParams(next)
  }

  function hasFilters() {
    return (
      FILTER_KEYS.some((key) => searchParams.get(key)) ||
      Boolean(searchParams.get('sort'))
    )
  }

  async function handleAdd(medicine) {
    if (addingId || !medicine.inStock) return

    setAddingId(medicine.id)
    setAddFeedback(null)
    try {
      await addItem(medicine.id, 1)
      setAddFeedback({
        medicineId: medicine.id,
        success: true,
        message: 'Added to your cart.',
      })
    } catch (error) {
      setAddFeedback({
        medicineId: medicine.id,
        success: false,
        message: getApiErrorMessage(
          error,
          'Unable to add this medicine to your cart.',
        ),
      })
    } finally {
      setAddingId(null)
    }
  }

  const currentSort = searchParams.get('sort') || 'name_asc'
  const currentPage = Number(searchParams.get('page')) || 1
  const { medicines, pagination } = state.data || {
    medicines: [],
    pagination: null,
  }
  const { total, totalPages } = pagination || { total: 0, totalPages: 0 }
  const activeFilterCount = FILTER_KEYS.filter((key) => searchParams.get(key)).length

  return (
    <div className="min-h-screen bg-slate-50">
      <PublicHeader />

      <main className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-10">
        <section className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-8 text-white shadow-xl sm:px-8 sm:py-10">
          <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-blue-600/30 blur-3xl" aria-hidden="true" />
          <div className="absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-cyan-500/15 blur-3xl" aria-hidden="true" />
          <div className="relative flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-300">
                MediConnect pharmacy
              </p>
              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                Find the right medicine
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
                Compare trusted pharmacy listings, transparent prices, stock availability,
                and prescription requirements in one secure place.
              </p>
            </div>
            <div className="grid w-full max-w-sm grid-cols-3 gap-2">
              {[
                ['01', 'Verified pharmacies'],
                ['02', 'Clear pricing'],
                ['03', 'Secure checkout'],
              ].map(([number, label]) => (
                <div key={number} className="rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur">
                  <p className="text-lg font-black text-white">{number}</p>
                  <p className="mt-1 text-[10px] leading-4 text-slate-300">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <form
          onSubmit={handleSearch}
          className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5"
        >
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Search pharmacy inventory</h2>
              <p className="mt-1 text-xs text-slate-500">Filter by price, category, stock, or prescription type.</p>
            </div>
            {activeFilterCount > 0 ? (
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                {activeFilterCount} filter{activeFilterCount === 1 ? '' : 's'} active
              </span>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2">
              <label
                htmlFor="medicineSearch"
                className="block text-sm font-medium text-slate-700"
              >
                Search
              </label>
              <input
                id="medicineSearch"
                type="search"
                value={draft.q}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, q: event.target.value }))
                }
                className={inputClass}
                placeholder="Medicine, generic, brand, or strength"
              />
            </div>

            <div>
              <label
                htmlFor="medicineCategory"
                className="block text-sm font-medium text-slate-700"
              >
                Category
              </label>
              <select
                id="medicineCategory"
                value={draft.category}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    category: event.target.value,
                  }))
                }
                className={inputClass}
              >
                {MEDICINE_CATEGORY_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="prescriptionRequired"
                className="block text-sm font-medium text-slate-700"
              >
                Prescription
              </label>
              <select
                id="prescriptionRequired"
                value={draft.prescriptionRequired}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    prescriptionRequired: event.target.value,
                  }))
                }
                className={inputClass}
              >
                <option value="">Any</option>
                <option value="true">Prescription required</option>
                <option value="false">Over the counter</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="minPrice"
                className="block text-sm font-medium text-slate-700"
              >
                Min price (₹)
              </label>
              <input
                id="minPrice"
                type="number"
                min="0"
                max="1000000"
                step="0.01"
                value={draft.minPrice}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    minPrice: event.target.value,
                  }))
                }
                className={inputClass}
                placeholder="0"
              />
            </div>

            <div>
              <label
                htmlFor="maxPrice"
                className="block text-sm font-medium text-slate-700"
              >
                Max price (₹)
              </label>
              <input
                id="maxPrice"
                type="number"
                min="0"
                max="1000000"
                step="0.01"
                value={draft.maxPrice}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    maxPrice: event.target.value,
                  }))
                }
                className={inputClass}
                placeholder="Any"
              />
            </div>

            <div>
              <label
                htmlFor="inStock"
                className="block text-sm font-medium text-slate-700"
              >
                Availability
              </label>
              <select
                id="inStock"
                value={draft.inStock}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    inStock: event.target.value,
                  }))
                }
                className={inputClass}
              >
                <option value="">Any availability</option>
                <option value="true">In stock</option>
                <option value="false">Out of stock</option>
              </select>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm shadow-blue-200 transition hover:-translate-y-0.5 hover:bg-brand-700"
              >
                Search medicines
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              >
                Clear filters
              </button>
            </div>

            <div className="flex items-center gap-2">
              <label
                htmlFor="medicineSort"
                className="text-sm font-medium text-slate-700"
              >
                Sort by
              </label>
              <select
                id="medicineSort"
                value={currentSort}
                onChange={(event) => changeSort(event.target.value)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </form>

        {state.loading ? (
          <div className="mt-8">
            <LoadingState label="Loading medicines…" />
          </div>
        ) : state.error ? (
          <div className="mt-8">
            <ErrorState message={state.error} onRetry={retry} />
          </div>
        ) : medicines.length === 0 ? (
          <div className="mt-8 rounded-lg border border-slate-200 bg-white p-10 text-center shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">
              No medicines found
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
              {hasFilters()
                ? 'Try changing your search or filters to see more available medicines.'
                : 'No medicines are available from verified pharmacies right now.'}
            </p>
            {hasFilters() ? (
              <button
                type="button"
                onClick={handleClear}
                className="mt-5 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
              >
                Clear filters
              </button>
            ) : null}
          </div>
        ) : (
          <>
            <div className="mt-8 flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Available now</p>
                <p className="mt-1 text-sm text-slate-500">
                  {total} {total === 1 ? 'medicine' : 'medicines'} found
                </p>
              </div>
            </div>

            <section className="mt-3 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {medicines.map((medicine) => (
                <MedicineCard
                  key={medicine.id}
                  medicine={medicine}
                  canAdd={user?.role === 'PATIENT'}
                  adding={addingId === medicine.id}
                  feedback={
                    addFeedback?.medicineId === medicine.id
                      ? addFeedback
                      : null
                  }
                  onAdd={handleAdd}
                />
              ))}
            </section>

            {totalPages > 1 && (
              <nav
                className="mt-8 flex flex-wrap items-center justify-between gap-3"
                aria-label="Pagination"
              >
                <p className="text-sm text-slate-500">
                  Showing page {currentPage} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => changePage(currentPage - 1)}
                    disabled={currentPage <= 1}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => changePage(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </nav>
            )}
          </>
        )}
      </main>
    </div>
  )
}
