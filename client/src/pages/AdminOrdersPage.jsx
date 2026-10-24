import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import LoadingState from '../components/LoadingState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import OrderStatusBadge from '../components/OrderStatusBadge.jsx'
import PaymentStatusBadge from '../components/PaymentStatusBadge.jsx'
import AdminPagination from '../components/AdminPagination.jsx'
import { getAdminOrders, getAdminPharmacies } from '../lib/adminApi.js'
import { getApiErrorMessage } from '../lib/apiError.js'
import {
  formatOrderDate,
  ORDER_STATUS_OPTIONS,
  PAYMENT_STATUS_LABELS,
} from '../lib/orderFormat.js'
import { formatMedicinePrice } from '../lib/medicineFormat.js'
import { inputClass } from '../lib/formStyles.js'

const PAGE_LIMIT = 20

const PAYMENT_OPTIONS = [
  { value: '', label: 'All payment statuses' },
  ...Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => ({
    value,
    label,
  })),
]

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
]

function itemSummary(order) {
  return `${order.itemCount} ${
    order.itemCount === 1 ? 'medicine' : 'medicines'
  } · ${order.unitCount} ${order.unitCount === 1 ? 'unit' : 'units'}`
}

export default function AdminOrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [draft, setDraft] = useState({
    q: searchParams.get('q') || '',
    status: searchParams.get('status') || '',
    paymentStatus: searchParams.get('paymentStatus') || '',
    pharmacyId: searchParams.get('pharmacyId') || '',
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
    for (const key of ['q', 'status', 'paymentStatus', 'pharmacyId', 'page']) {
      const value = searchParams.get(key)
      if (value) params[key] = value
    }

    return getAdminOrders(params)
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
            'Unable to load orders right now.',
          ),
          data: null,
        })
      })
  }, [searchParams])

  useEffect(() => {
    setDraft({
      q: searchParams.get('q') || '',
      status: searchParams.get('status') || '',
      paymentStatus: searchParams.get('paymentStatus') || '',
      pharmacyId: searchParams.get('pharmacyId') || '',
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
    for (const key of ['status', 'paymentStatus', 'pharmacyId']) {
      if (draft[key]) next.set(key, draft[key])
    }
    if (draft.sort && draft.sort !== 'newest') next.set('sort', draft.sort)
    setSearchParams(next)
  }

  function handleClear() {
    setDraft({
      q: '',
      status: '',
      paymentStatus: '',
      pharmacyId: '',
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
      searchParams.get('status') ||
      searchParams.get('paymentStatus') ||
      searchParams.get('pharmacyId') ||
      (searchParams.get('sort') && searchParams.get('sort') !== 'newest'),
  )
  const currentPage = Number(searchParams.get('page')) || 1
  const orders = state.data?.orders || []
  const pagination = state.data?.pagination || null

  return (
    <div>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          Order monitoring
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Read-only order oversight with minimized customer information.
        </p>
      </header>

      <p className="mt-4 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
        Admins can inspect order progress but cannot change order or payment
        status.
      </p>

      <form
        onSubmit={handleApply}
        className="mt-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="sm:col-span-2">
            <label
              htmlFor="admin-order-search"
              className="block text-sm font-medium text-slate-700"
            >
              Search
            </label>
            <input
              id="admin-order-search"
              type="search"
              value={draft.q}
              onChange={(event) =>
                setDraft((current) => ({ ...current, q: event.target.value }))
              }
              placeholder="Order ID, medicine, generic name, or pharmacy"
              maxLength={100}
              className={inputClass}
            />
          </div>
          <div>
            <label
              htmlFor="admin-order-status"
              className="block text-sm font-medium text-slate-700"
            >
              Order status
            </label>
            <select
              id="admin-order-status"
              value={draft.status}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  status: event.target.value,
                }))
              }
              className={inputClass}
            >
              {ORDER_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="admin-order-payment"
              className="block text-sm font-medium text-slate-700"
            >
              Payment
            </label>
            <select
              id="admin-order-payment"
              value={draft.paymentStatus}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  paymentStatus: event.target.value,
                }))
              }
              className={inputClass}
            >
              {PAYMENT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="admin-order-pharmacy"
              className="block text-sm font-medium text-slate-700"
            >
              Pharmacy
            </label>
            <select
              id="admin-order-pharmacy"
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
              htmlFor="admin-order-sort"
              className="block text-sm font-medium text-slate-700"
            >
              Sort by
            </label>
            <select
              id="admin-order-sort"
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
          <LoadingState label="Loading orders…" />
        </div>
      ) : state.error ? (
        <div className="mt-8">
          <ErrorState message={state.error} onRetry={load} />
        </div>
      ) : orders.length === 0 ? (
        <div className="mt-8 rounded-lg border border-slate-200 bg-white p-10 text-center shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            No orders found
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Try changing the search, status, payment, or pharmacy filters.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-6 hidden overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm lg:block">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  {[
                    'Order',
                    'Customer',
                    'Pharmacy',
                    'Items',
                    'Total',
                    'Payment',
                    'Status',
                    'Placed',
                    'Action',
                  ].map((label) => (
                    <th
                      key={label}
                      scope="col"
                      className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((order) => (
                  <tr key={order.orderId} className="align-top">
                    <td className="max-w-[180px] px-3 py-4">
                      <p className="break-all font-mono text-xs text-slate-700">
                        {order.orderId}
                      </p>
                    </td>
                    <td className="px-3 py-4 text-sm text-slate-700">
                      <p>{order.customerName || 'Customer'}</p>
                      <p className="text-xs text-slate-500">
                        {order.deliveryCity || 'Location unavailable'}
                      </p>
                    </td>
                    <td className="px-3 py-4 text-sm text-slate-700">
                      {order.pharmacy.pharmacyName || 'Unknown pharmacy'}
                    </td>
                    <td className="px-3 py-4 text-sm text-slate-700">
                      {itemSummary(order)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-slate-900">
                      {formatMedicinePrice(order.totalAmount)}
                    </td>
                    <td className="px-3 py-4">
                      <PaymentStatusBadge status={order.paymentStatus} />
                    </td>
                    <td className="px-3 py-4">
                      <OrderStatusBadge status={order.orderStatus} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-slate-600">
                      {formatOrderDate(order.placedAt)}
                    </td>
                    <td className="px-3 py-4">
                      <Link
                        to={`/admin/orders/${order.orderId}`}
                        className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        View order
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 space-y-3 lg:hidden">
            {orders.map((order) => (
              <article
                key={order.orderId}
                className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="break-all font-mono text-xs text-slate-500">
                      {order.orderId}
                    </p>
                    <h2 className="mt-1 text-sm font-semibold text-slate-900">
                      {order.pharmacy.pharmacyName || 'Unknown pharmacy'}
                    </h2>
                  </div>
                  <OrderStatusBadge status={order.orderStatus} />
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-slate-500">Customer</dt>
                    <dd className="font-medium text-slate-800">
                      {order.customerName || 'Customer'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Total</dt>
                    <dd className="font-medium text-slate-800">
                      {formatMedicinePrice(order.totalAmount)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Items</dt>
                    <dd className="font-medium text-slate-800">
                      {itemSummary(order)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Payment</dt>
                    <dd className="mt-0.5">
                      <PaymentStatusBadge status={order.paymentStatus} />
                    </dd>
                  </div>
                </dl>
                <Link
                  to={`/admin/orders/${order.orderId}`}
                  className="mt-3 inline-block rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-700"
                >
                  View order
                </Link>
              </article>
            ))}
          </div>

          <AdminPagination
            pagination={pagination}
            currentPage={currentPage}
            onChange={changePage}
            label="Order pagination"
          />
        </>
      )}
    </div>
  )
}
