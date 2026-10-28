import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader.jsx'
import Button from '../components/Button.jsx'
import Input from '../components/Input.jsx'
import Select from '../components/Select.jsx'
import Table from '../components/Table.jsx'
import Badge from '../components/Badge.jsx'
import Alert from '../components/Alert.jsx'
import AdminPagination from '../components/AdminPagination.jsx'
import LoadingState from '../components/LoadingState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import EmptyState from '../components/EmptyState.jsx'
import AdminIcon from '../components/AdminIcon.jsx'
import { getAdminMedicines, getAdminPharmacies } from '../lib/adminApi.js'
import { getApiErrorMessage } from '../lib/apiError.js'
import {
  formatExpiryDate,
  formatMedicinePrice,
  MEDICINE_CATEGORY_FILTER_OPTIONS,
  medicineCategoryLabel,
} from '../lib/medicineFormat.js'
import { formatAdminDate } from '../lib/adminFormat.js'

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
  const hasFlags =
    medicine.isExpired ||
    !medicine.inStock ||
    !medicine.isActive ||
    medicine.prescriptionRequired

  if (!hasFlags) {
    return <span className="text-xs text-slate-400">—</span>
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {medicine.isExpired ? (
        <Badge variant="danger" size="sm">
          Expired
        </Badge>
      ) : null}
      {!medicine.inStock ? (
        <Badge variant="warning" size="sm">
          Out of stock
        </Badge>
      ) : null}
      {!medicine.isActive ? (
        <Badge variant="neutral" size="sm">
          Inactive
        </Badge>
      ) : null}
      {medicine.prescriptionRequired ? (
        <Badge variant="primary" size="sm">
          Rx required
        </Badge>
      ) : null}
    </div>
  )
}

const COLUMNS = [
  {
    key: 'name',
    header: 'Medicine',
    render: (medicine) => (
      <div className="min-w-0">
        <p className="mb-0 font-medium text-slate-900">{medicine.name}</p>
        <p className="mb-0 mt-0.5 text-xs text-slate-500">
          {[
            medicine.genericName,
            medicine.strength,
            medicine.packSize,
          ]
            .filter(Boolean)
            .join(' · ') || 'No additional details'}
        </p>
      </div>
    ),
  },
  {
    key: 'category',
    header: 'Category',
    render: (medicine) => (
      <Badge variant="secondary">
        {medicineCategoryLabel(medicine.category)}
      </Badge>
    ),
  },
  {
    key: 'pharmacy',
    header: 'Pharmacy',
    render: (medicine) => (
      <div className="min-w-0">
        <p className="mb-0 truncate text-slate-700">
          {medicine.pharmacy.pharmacyName || 'Unknown pharmacy'}
        </p>
        <p className="mb-0 mt-0.5 text-xs text-slate-400">
          Added {formatAdminDate(medicine.createdAt) || '—'}
        </p>
      </div>
    ),
  },
  {
    key: 'price',
    header: 'Price',
    align: 'right',
    noWrap: true,
    render: (medicine) => (
      <span className="font-medium text-slate-900">
        {formatMedicinePrice(medicine.price)}
      </span>
    ),
  },
  {
    key: 'stockQuantity',
    header: 'Stock',
    align: 'right',
    noWrap: true,
    render: (medicine) => (
      <span
        className={
          medicine.inStock
            ? 'font-medium text-slate-900'
            : 'font-medium text-amber-700'
        }
      >
        {medicine.stockQuantity}
      </span>
    ),
  },
  {
    key: 'expiryDate',
    header: 'Expiry',
    noWrap: true,
    render: (medicine) => (
      <span className={medicine.isExpired ? 'text-red-600' : 'text-slate-600'}>
        {formatExpiryDate(medicine.expiryDate)}
      </span>
    ),
  },
  {
    key: 'flags',
    header: 'Flags',
    render: (medicine) => <MedicineFlags medicine={medicine} />,
  },
]

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
  const requestVersion = useRef(0)

  useEffect(() => {
    getAdminPharmacies({ limit: 50, sort: 'name_asc' })
      .then((response) => setPharmacies(response.data.data.pharmacies || []))
      .catch(() => setPharmacies([]))
  }, [])

  const load = useCallback(
    ({ showLoading = true } = {}) => {
      requestVersion.current += 1
      const version = requestVersion.current

      if (showLoading) {
        setState({ loading: true, error: null, data: null })
      }

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
          if (requestVersion.current !== version) return
          setState({
            loading: false,
            error: null,
            data: response.data.data,
          })
        })
        .catch((error) => {
          if (requestVersion.current !== version) return
          setState((current) => ({
            loading: false,
            error: getApiErrorMessage(
              error,
              'Unable to load medicine inventory right now.',
            ),
            data: showLoading ? null : current.data,
          }))
        })
    },
    [searchParams],
  )

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
    return () => {
      requestVersion.current += 1
    }
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
      <PageHeader
        title="Medicines"
        description="Monitor medicine listings across pharmacies. This inventory view is read-only."
        action={
          <Button
            variant="secondary"
            onClick={() => load()}
            disabled={state.loading}
          >
            <AdminIcon name="refresh" className="h-4 w-4" />
            Refresh
          </Button>
        }
      />

      <div className="mt-4 flex items-start gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
          <AdminIcon name="shield" className="h-4 w-4" />
        </span>
        <p className="mb-0 text-xs leading-5 text-slate-600">
          Admin medicine records are read-only. Pharmacies remain responsible
          for prices, stock levels, expiry dates, and listing availability.
        </p>
      </div>

      <form
        onSubmit={handleApply}
        className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
      >
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
          <AdminIcon name="filter" className="h-4 w-4 text-slate-400" />
          <h2 className="mb-0 text-sm font-semibold text-slate-900">Filters</h2>
          {hasFilters ? (
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
              Active
            </span>
          ) : null}
        </div>
        <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4">
          <Input
            type="search"
            label="Search"
            containerClassName="sm:col-span-2"
            value={draft.q}
            onChange={(event) =>
              setDraft((current) => ({ ...current, q: event.target.value }))
            }
            placeholder="Medicine name, generic name, or brand"
            maxLength={100}
            leadingIcon={<AdminIcon name="search" className="h-4 w-4" />}
          />
          <Select
            label="Category"
            value={draft.category}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                category: event.target.value,
              }))
            }
            options={MEDICINE_CATEGORY_FILTER_OPTIONS}
          />
          <Select
            label="Pharmacy"
            value={draft.pharmacyId}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                pharmacyId: event.target.value,
              }))
            }
            options={[
              { value: '', label: 'All pharmacies' },
              ...pharmacies.map((pharmacy) => ({
                value: pharmacy.id,
                label: pharmacy.pharmacyName,
              })),
            ]}
          />
          <Select
            label="Active listing"
            value={draft.isActive}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                isActive: event.target.value,
              }))
            }
            options={BOOLEAN_OPTIONS}
          />
          <Select
            label="Expired"
            value={draft.expired}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                expired: event.target.value,
              }))
            }
            options={BOOLEAN_OPTIONS}
          />
          <Select
            label="In stock"
            value={draft.inStock}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                inStock: event.target.value,
              }))
            }
            options={BOOLEAN_OPTIONS}
          />
          <Select
            label="Sort by"
            value={draft.sort}
            onChange={(event) =>
              setDraft((current) => ({ ...current, sort: event.target.value }))
            }
            options={SORT_OPTIONS}
          />
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/70 px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
          <Button variant="secondary" onClick={handleClear} disabled={!hasFilters}>
            Clear filters
          </Button>
          <Button type="submit">Apply filters</Button>
        </div>
      </form>

      {state.loading && !state.data ? (
        <div className="mt-6">
          <LoadingState label="Loading medicine inventory…" />
        </div>
      ) : state.error && !state.data ? (
        <div className="mt-6">
          <ErrorState message={state.error} onRetry={() => load()} />
        </div>
      ) : (
        <>
          {state.error ? (
            <Alert
              variant="danger"
              className="mt-4"
              action={
                <Button size="xs" variant="secondary" onClick={() => load()}>
                  Try again
                </Button>
              }
            >
              {state.error}
            </Alert>
          ) : null}

          {medicines.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                title="No medicines found"
                description="Try changing the search, pharmacy, expiry, or stock filters."
                action={
                  hasFilters ? (
                    <Button variant="secondary" onClick={handleClear}>
                      Clear filters
                    </Button>
                  ) : null
                }
              />
            </div>
          ) : (
            <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
                <div>
                  <h2 className="mb-0 text-sm font-semibold text-slate-900">
                    Medicine inventory
                  </h2>
                  <p className="mb-0 mt-0.5 text-xs text-slate-500">
                    {pagination?.total ?? medicines.length}{' '}
                    {pagination?.total === 1 ? 'listing' : 'listings'}
                  </p>
                </div>
                <span className="hidden items-center gap-1.5 text-xs text-slate-400 sm:flex">
                  <AdminIcon name="eye" className="h-3.5 w-3.5" />
                  Read-only
                </span>
              </div>
              <Table
                columns={COLUMNS}
                data={medicines}
                rowKey="id"
                minWidthClass="min-w-[1040px]"
                caption="Medicine inventory"
              />
              <AdminPagination
                pagination={pagination}
                currentPage={currentPage}
                onChange={changePage}
                label="Medicine pagination"
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
