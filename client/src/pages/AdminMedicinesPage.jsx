import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import LoadingState from '../components/LoadingState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import AdminPagination from '../components/AdminPagination.jsx'
import { getAdminMedicines, getAdminPharmacies } from '../lib/adminApi.js'
import { getApiErrorMessage } from '../lib/apiError.js'
import {
  formatExpiryDate,
  formatMedicinePrice,
  MEDICINE_CATEGORY_FILTER_OPTIONS,
  medicineCategoryLabel,
} from '../lib/medicineFormat.js'
import { inputClass } from '../lib/formStyles.js'

const PAGE_LIMIT = 20

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'name_asc', label: 'Name A–Z' },
  { value: 'name_desc', label: 'Name Z–A' },
  { value: 'expiry_asc', label: 'Expiry soonest' },
  { value: 'stock_desc', label: 'Stock high to low' },
]

const BOOLEAN_OPTIONS = [
  { value: '', label: 'Any' },
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
]

function MedicineFlags({ medicine }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {medicine.isExpired ? (
        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
          Expired
        </span>
      ) : null}
      {!medicine.inStock ? (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
          Out of stock
        </span>
      ) : null}
      {!medicine.isActive ? (
        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">
          Inactive
        </span>
      ) : null}
      {medicine.prescriptionRequired ? (
        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800">
          Rx
        </span>
      ) : null}
    </div>
  )
}

export default function AdminMedicinesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [draft, setDraft] = useState({
    q: searchParams.get('q') || '',
    category: searchParams.get('category') || '',
    pharmacyId: searchParams.get('pharmacyId') || '',
    isActive: searchParams.get('isActive') || '',
    expired: searchParams.get('expired') || '',
    inStock: searchParams.get('inStock') || '',
    sort: searchParams.get('sort') || 'newest',
  })
  const [state, setState] = useState({
    loading: true,
    error: null,
    data: null,
  })
  const [pharmacies, setPharmacies] = useState([])

  useEffect(() => {
    getAdminPharmacies({ limit: 50, sort: 'name_asc' })
      .then((response) => setPharmacies(response.data.data.pharmacies || []))
      .catch(() => setPharmacies([]))
  }, [])

  const load = useCallback(() => {
    setState({ loading: true, error: null, data: null })
    const params = {
      limit: PAGE_LIMIT,
      sort: searchParams.get('sort') || 'newest',
    }
    for (const key of [
      'q',
      'category',
      'pharmacyId',
      'isActive',
      'expired',
      'inStock',
      'page',
    ]) {
      const value = searchParams.get(key)
      if (value) params[key] = value
    }

    return getAdminMedicines(params)
      .then((response) => {
        setState({
          loading: false,
          error: null,
          data: response.data.data,
        })
      })
      .catch((error) => {
        setState({
          loading: false,
          error: getApiErrorMessage(
            error,
            'Unable to load medicine inventory right now.',
          ),
          data: null,
        })
      })
  }, [searchParams])

  useEffect(() => {
    setDraft({
      q: searchParams.get('q') || '',
      category: searchParams.get('category') || '',
      pharmacyId: searchParams.get('pharmacyId') || '',
      isActive: searchParams.get('isActive') || '',
      expired: searchParams.get('expired') || '',
      inStock: searchParams.get('inStock') || '',
      sort: searchParams.get('sort') || 'newest',
    })
  }, [searchParams])

  useEffect(() => {
    load()
  }, [load])

  function handleApply(event) {
    event.preventDefault()
    const next = new URLSearchParams()
    const q = draft.q.trim()
    if (q) next.set('q', q)
    for (const key of [
      'category',
      'pharmacyId',
      'isActive',
      'expired',
      'inStock',
    ]) {
      if (draft[key]) next.set(key, draft[key])
    }
    if (draft.sort && draft.sort !== 'newest') next.set('sort', draft.sort)
    setSearchParams(next)
  }

  function handleClear() {
    setDraft({
      q: '',
      category: '',
      pharmacyId: '',
      isActive: '',
      expired: '',
      inStock: '',
      sort: 'newest',
    })
    setSearchParams({})
  }

  function changePage(page) {
    const next = new URLSearchParams(searchParams)
    next.set('page', String(page))
    setSearchParams(next)
  }

  const hasFilters = Boolean(
    searchParams.get('q') ||
      searchParams.get('category') ||
      searchParams.get('pharmacyId') ||
      searchParams.get('isActive') ||
      searchParams.get('expired') ||
      searchParams.get('inStock') ||
      (searchParams.get('sort') && searchParams.get('sort') !== 'newest'),
  )
  const currentPage = Number(searchParams.get('page')) || 1
  const medicines = state.data?.medicines || []
  const pagination = state.data?.pagination || null

  return (
    <div>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          Medicine monitoring
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Read-only platform inventory with stock, expiry, and pharmacy context.
        </p>
      </header>

      <p className="mt-4 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
        Admin medicine records are read-only. Pharmacies remain responsible for
        their inventory.
      </p>

      <form
        onSubmit={handleApply}
        className="mt-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <label
              htmlFor="admin-medicine-search"
              className="block text-sm font-medium text-slate-700"
            >
              Search
            </label>
            <input
              id="admin-medicine-search"
              type="search"
              value={draft.q}
              onChange={(event) =>
                setDraft((current) => ({ ...current, q: event.target.value }))
              }
              placeholder="Medicine name, generic name, or brand"
              maxLength={100}
              className={inputClass}
            />
          </div>
          <div>
            <label
              htmlFor="admin-medicine-category"
              className="block text-sm font-medium text-slate-700"
            >
              Category
            </label>
            <select
              id="admin-medicine-category"
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
              htmlFor="admin-medicine-pharmacy"
              className="block text-sm font-medium text-slate-700"
            >
              Pharmacy
            </label>
            <select
              id="admin-medicine-pharmacy"
              value={draft.pharmacyId}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  pharmacyId: event.target.value,
                }))
              }
              className={inputClass}
            >
              <option value="">All pharmacies</option>
              {pharmacies.map((pharmacy) => (
                <option key={pharmacy.id} value={pharmacy.id}>
                  {pharmacy.pharmacyName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="admin-medicine-active"
              className="block text-sm font-medium text-slate-700"
            >
              Active
            </label>
            <select
              id="admin-medicine-active"
              value={draft.isActive}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  isActive: event.target.value,
                }))
              }
              className={inputClass}
            >
              {BOOLEAN_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="admin-medicine-expired"
              className="block text-sm font-medium text-slate-700"
            >
              Expired
            </label>
            <select
              id="admin-medicine-expired"
              value={draft.expired}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  expired: event.target.value,
                }))
              }
              className={inputClass}
            >
              {BOOLEAN_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="admin-medicine-stock"
              className="block text-sm font-medium text-slate-700"
            >
              In stock
            </label>
            <select
              id="admin-medicine-stock"
              value={draft.inStock}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  inStock: event.target.value,
                }))
              }
              className={inputClass}
            >
              {BOOLEAN_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="admin-medicine-sort"
              className="block text-sm font-medium text-slate-700"
            >
              Sort by
            </label>
            <select
              id="admin-medicine-sort"
              value={draft.sort}
              onChange={(event) =>
                setDraft((current) => ({ ...current, sort: event.target.value }))
              }
              className={inputClass}
            >
              {SORT_OPTIONS.map((option) => (
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
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            Apply filters
          </button>
          {hasFilters ? (
            <button
              type="button"
              onClick={handleClear}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
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
          <ErrorState message={state.error} onRetry={load} />
        </div>
      ) : medicines.length === 0 ? (
        <div className="mt-8 rounded-lg border border-slate-200 bg-white p-10 text-center shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            No medicines found
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Try changing the search, pharmacy, expiry, or stock filters.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-6 hidden overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm lg:block">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  {[
                    'Medicine',
                    'Category',
                    'Pharmacy',
                    'Price',
                    'Stock',
                    'Expiry',
                    'Flags',
                  ].map((label) => (
                    <th
                      key={label}
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {medicines.map((medicine) => (
                  <tr key={medicine.id} className="align-top">
                    <td className="px-4 py-4">
                      <p className="text-sm font-semibold text-slate-900">
                        {medicine.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {[
                          medicine.genericName,
                          medicine.strength,
                          medicine.packSize,
                        ]
                          .filter(Boolean)
                          .join(' · ') || 'No additional details'}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      {medicineCategoryLabel(medicine.category)}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      {medicine.pharmacy.pharmacyName || 'Unknown pharmacy'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-900">
                      {formatMedicinePrice(medicine.price)}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-900">
                      {medicine.stockQuantity}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-700">
                      {formatExpiryDate(medicine.expiryDate)}
                    </td>
                    <td className="px-4 py-4">
                      <MedicineFlags medicine={medicine} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 space-y-3 lg:hidden">
            {medicines.map((medicine) => (
              <article
                key={medicine.id}
                className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-slate-900">
                      {medicine.name}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {medicine.pharmacy.pharmacyName || 'Unknown pharmacy'}
                    </p>
                  </div>
                  <MedicineFlags medicine={medicine} />
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-slate-500">Category</dt>
                    <dd className="font-medium text-slate-800">
                      {medicineCategoryLabel(medicine.category)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Price</dt>
                    <dd className="font-medium text-slate-800">
                      {formatMedicinePrice(medicine.price)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Stock</dt>
                    <dd className="font-medium text-slate-800">
                      {medicine.stockQuantity}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Expiry</dt>
                    <dd className="font-medium text-slate-800">
                      {formatExpiryDate(medicine.expiryDate)}
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>

          <AdminPagination
            pagination={pagination}
            currentPage={currentPage}
            onChange={changePage}
            label="Medicine pagination"
          />
        </>
      )}
    </div>
  )
}
