import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader.jsx'
import Button from '../components/Button.jsx'
import Input from '../components/Input.jsx'
import Select from '../components/Select.jsx'
import Table from '../components/Table.jsx'
import Alert from '../components/Alert.jsx'
import AdminPagination from '../components/AdminPagination.jsx'
import LoadingState from '../components/LoadingState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import EmptyState from '../components/EmptyState.jsx'
import AdminIcon from '../components/AdminIcon.jsx'
import OrderStatusBadge from '../components/OrderStatusBadge.jsx'
import PaymentStatusBadge from '../components/PaymentStatusBadge.jsx'
import { getAdminOrders, getAdminPharmacies } from '../lib/adminApi.js'
import { getApiErrorMessage } from '../lib/apiError.js'
import {
  formatOrderDate,
  ORDER_STATUS_OPTIONS,
  PAYMENT_STATUS_LABELS,
  shortOrderId,
} from '../lib/orderFormat.js'
import { formatMedicinePrice } from '../lib/medicineFormat.js'

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

const VIEW_LINK_CLASS =
  'inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50'

function itemSummary(order) {
  return `${order.itemCount} ${
    order.itemCount === 1 ? 'medicine' : 'medicines'
  }`
}

const COLUMNS = [
  {
    key: 'orderId',
    header: 'Order',
    render: (order) => (
      <div>
        <Link
          to={`/admin/orders/${order.orderId}`}
          title={order.orderId}
          className="font-mono text-sm font-semibold text-blue-700 hover:text-blue-800"
        >
          {shortOrderId(order.orderId)}
        </Link>
        <p className="mb-0 mt-0.5 text-xs text-slate-400">Order reference</p>
      </div>
    ),
  },
  {
    key: 'customer',
    header: 'Customer',
    render: (order) => (
      <div>
        <p className="mb-0 text-slate-700">
          {order.customerName || 'Customer'}
        </p>
        <p className="mb-0 mt-0.5 text-xs text-slate-400">
          {order.deliveryCity || 'Location unavailable'}
        </p>
      </div>
    ),
  },
  {
    key: 'pharmacy',
    header: 'Pharmacy',
    render: (order) => (
      <span className="text-slate-700">
        {order.pharmacy.pharmacyName || 'Unknown pharmacy'}
      </span>
    ),
  },
  {
    key: 'items',
    header: 'Items',
    render: (order) => (
      <div>
        <p className="mb-0 text-slate-700">{itemSummary(order)}</p>
        <p className="mb-0 mt-0.5 text-xs text-slate-400">
          {order.unitCount} {order.unitCount === 1 ? 'unit' : 'units'}
        </p>
      </div>
    ),
  },
  {
    key: 'totalAmount',
    header: 'Total',
    align: 'right',
    noWrap: true,
    render: (order) => (
      <span className="font-medium text-slate-900">
        {formatMedicinePrice(order.totalAmount)}
      </span>
    ),
  },
  {
    key: 'paymentStatus',
    header: 'Payment',
    render: (order) => (
      <PaymentStatusBadge status={order.paymentStatus} />
    ),
  },
  {
    key: 'orderStatus',
    header: 'Status',
    render: (order) => <OrderStatusBadge status={order.orderStatus} />,
  },
  {
    key: 'placedAt',
    header: 'Placed',
    noWrap: true,
    render: (order) => (
      <span className="text-slate-600">
        {formatOrderDate(order.placedAt) || '—'}
      </span>
    ),
  },
  {
    key: 'actions',
    header: 'Action',
    align: 'right',
    render: (order) => (
      <Link
        to={`/admin/orders/${order.orderId}`}
        className={VIEW_LINK_CLASS}
      >
        View order
      </Link>
    ),
  },
]

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
      for (const key of ['q', 'status', 'paymentStatus', 'pharmacyId', 'page']) {
        const value = searchParams.get(key)
        if (value) params[key] = value
      }

      return getAdminOrders(params)
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
              'Unable to load orders right now.',
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
      status: searchParams.get('status') || '',
      paymentStatus: searchParams.get('paymentStatus') || '',
      pharmacyId: searchParams.get('pharmacyId') || '',
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
      <PageHeader
        title="Orders"
        description="Read-only order oversight with minimized customer information."
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
          Admins can inspect order progress but cannot change order or payment
          status. Customer phone numbers, street addresses, and prescription
          documents are not exposed in this view.
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
        <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-6">
          <Input
            type="search"
            label="Search"
            containerClassName="sm:col-span-2"
            value={draft.q}
            onChange={(event) =>
              setDraft((current) => ({ ...current, q: event.target.value }))
            }
            placeholder="Order ID, medicine, generic name, or pharmacy"
            maxLength={100}
            leadingIcon={<AdminIcon name="search" className="h-4 w-4" />}
          />
          <Select
            label="Order status"
            value={draft.status}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                status: event.target.value,
              }))
            }
            options={ORDER_STATUS_OPTIONS}
          />
          <Select
            label="Payment"
            value={draft.paymentStatus}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                paymentStatus: event.target.value,
              }))
            }
            options={PAYMENT_OPTIONS}
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
          <LoadingState label="Loading orders…" />
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

          {orders.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                title="No orders found"
                description="Try changing the search, status, payment, or pharmacy filters."
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
                    Order activity
                  </h2>
                  <p className="mb-0 mt-0.5 text-xs text-slate-500">
                    {pagination?.total ?? orders.length}{' '}
                    {pagination?.total === 1 ? 'order' : 'orders'}
                  </p>
                </div>
                <span className="hidden items-center gap-1.5 text-xs text-slate-400 sm:flex">
                  <AdminIcon name="eye" className="h-3.5 w-3.5" />
                  Read-only
                </span>
              </div>
              <Table
                columns={COLUMNS}
                data={orders}
                rowKey="orderId"
                minWidthClass="min-w-[1120px]"
                caption="Order activity"
              />
              <AdminPagination
                pagination={pagination}
                currentPage={currentPage}
                onChange={changePage}
                label="Order pagination"
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
