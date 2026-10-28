import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import WorkspaceShell from '../components/WorkspaceShell.jsx'
import LoadingState from '../components/LoadingState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import {
  listMedicines,
  deactivateMedicine,
  activateMedicine,
} from '../lib/medicineApi.js'
import { getApiErrorMessage } from '../lib/apiError.js'
import { inputClass } from '../lib/formStyles.js'
import {
  MEDICINE_CATEGORY_FILTER_OPTIONS,
  MEDICINE_SORT_OPTIONS,
  medicineCategoryLabel,
  formatMedicinePrice,
  formatExpiryDate,
} from '../lib/medicineFormat.js'

function StatusBadge({ isActive }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
        isActive
          ? 'bg-green-100 text-green-800'
          : 'bg-slate-100 text-slate-700'
      }`}
    >
      {isActive ? 'Active' : 'Inactive'}
    </span>
  )
}

function ExpiryCell({ medicine }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm text-slate-900">
        {formatExpiryDate(medicine.expiryDate)}
      </span>
      {medicine.isExpired ? (
        <span className="inline-block w-fit rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
          Expired
        </span>
      ) : null}
    </div>
  )
}

export default function PharmacyInventoryPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const [draft, setDraft] = useState({
    q: searchParams.get('q') || '',
    category: searchParams.get('category') || '',
    isActive: searchParams.get('isActive') || '',
    sort: searchParams.get('sort') || '',
  })
  const [state, setState] = useState({
    loading: true,
    error: null,
    errorCode: null,
    data: null,
  })
  const [notice, setNotice] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(() => {
    const params = new URLSearchParams()
    for (const key of ['q', 'category', 'isActive', 'sort', 'page']) {
      const value = searchParams.get(key)
      if (value) params.set(key, value)
    }

    return listMedicines(Object.fromEntries(params.entries()))
      .then((response) => {
        setState({
          loading: false,
          error: null,
          errorCode: null,
          data: response.data.data,
        })
      })
      .catch((error) => {
        setState({
          loading: false,
          error: getApiErrorMessage(
            error,
            'Unable to load your medicine inventory right now.',
          ),
          errorCode: error.response?.data?.code || null,
          data: null,
        })
      })
  }, [searchParams])

  useEffect(() => {
    load()
  }, [load])

  function beginLoading() {
    setState({
      loading: true,
      error: null,
      errorCode: null,
      data: null,
    })
  }

  function retry() {
    beginLoading()
    load()
  }

  function handleApply(event) {
    event.preventDefault()
    const next = new URLSearchParams()
    if (draft.q.trim()) next.set('q', draft.q.trim())
    if (draft.category) next.set('category', draft.category)
    if (draft.isActive) next.set('isActive', draft.isActive)
    if (draft.sort) next.set('sort', draft.sort)
    next.set('page', '1')
    beginLoading()
    setSearchParams(next)
  }

  function handleClear() {
    setDraft({ q: '', category: '', isActive: '', sort: '' })
    setNotice(null)
    beginLoading()
    setSearchParams({})
  }

  function changePage(page) {
    const next = new URLSearchParams(searchParams)
    next.set('page', String(page))
    beginLoading()
    setSearchParams(next)
  }

  async function handleToggle(medicine) {
    setBusyId(medicine.id)
    setNotice(null)

    try {
      const response = medicine.isActive
        ? await deactivateMedicine(medicine.id)
        : await activateMedicine(medicine.id)
      const updated = response.data.data.medicine
      setNotice({
        kind: 'success',
        message: `“${updated.name}” is now ${updated.isActive ? 'active' : 'inactive'}.`,
      })
      await load()
    } catch (error) {
      setNotice({
        kind: 'error',
        message: getApiErrorMessage(
          error,
          'Unable to update this medicine. Please try again.',
        ),
      })
    } finally {
      setBusyId(null)
    }
  }

  const currentPage = Number(searchParams.get('page')) || 1
  const { medicines, pagination } = state.data || {
    medicines: [],
    pagination: null,
  }
  const { total, totalPages } = pagination || { total: 0, totalPages: 0 }
  const hasFilters = Boolean(
    searchParams.get('q') ||
      searchParams.get('category') ||
      searchParams.get('isActive') ||
      searchParams.get('sort'),
  )

  return (
    <WorkspaceShell user={user} contentClassName="max-w-6xl">
      <div className="py-2 lg:py-4">
        <section className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-8 text-white shadow-xl sm:px-10">
          <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-emerald-600/25 blur-3xl" aria-hidden="true" />
          <div className="relative flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">Pharmacy operations</p>
              <h1 className="mt-3 text-3xl font-black tracking-tight">Medicine Inventory</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
                Manage medicines, pricing, stock, and expiry dates from one clear control center.
              </p>
            </div>
            <Link
              to="/pharmacy/inventory/new"
              className="shrink-0 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-950/30 transition hover:-translate-y-0.5 hover:bg-emerald-400"
            >
              + Add medicine
            </Link>
          </div>
        </section>

        {notice && (
          <p
            className={`mt-6 rounded-md border px-3 py-2 text-sm ${
              notice.kind === 'success'
                ? 'border-green-200 bg-green-50 text-green-800'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {notice.message}
          </p>
        )}

        <form
          onSubmit={handleApply}
          className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5"
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label
                htmlFor="inventorySearch"
                className="block text-sm font-medium text-slate-700"
              >
                Search
              </label>
              <input
                id="inventorySearch"
                type="search"
                value={draft.q}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, q: event.target.value }))
                }
                className={inputClass}
                placeholder="Name, generic, or brand"
              />
            </div>
            <div>
              <label
                htmlFor="inventoryCategory"
                className="block text-sm font-medium text-slate-700"
              >
                Category
              </label>
              <select
                id="inventoryCategory"
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
                htmlFor="inventoryStatus"
                className="block text-sm font-medium text-slate-700"
              >
                Status
              </label>
              <select
                id="inventoryStatus"
                value={draft.isActive}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    isActive: event.target.value,
                  }))
                }
                className={inputClass}
              >
                <option value="">All statuses</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="inventorySort"
                className="block text-sm font-medium text-slate-700"
              >
                Sort by
              </label>
              <select
                id="inventorySort"
                value={draft.sort}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    sort: event.target.value,
                  }))
                }
                className={inputClass}
              >
                {MEDICINE_SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-brand-700"
            >
              Apply filters
            </button>
            {hasFilters ? (
              <button
                type="button"
                onClick={handleClear}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
              >
                Clear filters
              </button>
            ) : null}
          </div>
        </form>

        {state.loading ? (
          <div className="mt-8">
            <LoadingState label="Loading medicine inventory…" />
          </div>
        ) : state.error ? (
          <div className="mt-8">
            {state.errorCode === 'PROFILE_REQUIRED' ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-8 text-center">
                <h2 className="text-base font-semibold text-amber-900">
                  Create your pharmacy profile first
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-amber-800">
                  Inventory belongs to a pharmacy profile. Add your pharmacy
                  details, then return here to add medicines.
                </p>
                <Link
                  to="/pharmacy/profile"
                  className="mt-5 inline-block rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
                >
                  Create pharmacy profile
                </Link>
              </div>
            ) : (
              <ErrorState message={state.error} onRetry={retry} />
            )}
          </div>
        ) : medicines.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">
              {hasFilters ? 'No matching medicines' : 'No medicines yet'}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
              {hasFilters
                ? 'Try changing your search or filters to find another medicine.'
                : 'Add your first medicine to start building your inventory.'}
            </p>
            {!hasFilters ? (
              <Link
                to="/pharmacy/inventory/new"
                className="mt-5 inline-block rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
              >
                Add medicine
              </Link>
            ) : null}
          </div>
        ) : (
          <>
            <p className="mt-6 text-sm text-slate-500">
              {total} medicine{total === 1 ? '' : 's'}
            </p>

            <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      {[
                        'Medicine',
                        'Brand',
                        'Category',
                        'Strength',
                        'Price',
                        'Stock',
                        'Expiry',
                        'Prescription',
                        'Status',
                        'Actions',
                      ].map((heading) => (
                        <th
                          key={heading}
                          scope="col"
                          className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {medicines.map((medicine) => (
                      <tr key={medicine.id} className="align-top">
                        <td className="px-4 py-4">
                          <p className="text-sm font-medium text-slate-900">
                            {medicine.name}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {medicine.genericName || 'Generic not provided'}
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
                          {medicine.brandName || '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
                          {medicineCategoryLabel(medicine.category)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
                          {medicine.strength || '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-900">
                          {formatMedicinePrice(medicine.price)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-900">
                          {medicine.stockQuantity}
                          {medicine.stockQuantity === 0 ? (
                            <span className="ml-2 text-xs font-medium text-red-600">
                              Out of stock
                            </span>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4">
                          <ExpiryCell medicine={medicine} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
                          {medicine.prescriptionRequired ? 'Required' : 'Not required'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4">
                          <StatusBadge isActive={medicine.isActive} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-4">
                          <div className="flex items-center gap-2">
                            <Link
                              to={`/pharmacy/inventory/${medicine.id}/edit`}
                              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                            >
                              Edit
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleToggle(medicine)}
                              disabled={busyId === medicine.id}
                              className={`rounded-md border px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                medicine.isActive
                                  ? 'border-red-200 text-red-600 hover:bg-red-50'
                                  : 'border-green-200 text-green-700 hover:bg-green-50'
                              }`}
                            >
                              {busyId === medicine.id
                                ? 'Updating…'
                                : medicine.isActive
                                  ? 'Deactivate'
                                  : 'Activate'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

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
      </div>
    </WorkspaceShell>
  )
}
