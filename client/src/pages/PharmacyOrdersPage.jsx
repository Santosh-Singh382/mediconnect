import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import WorkspaceShell from '../components/WorkspaceShell.jsx'
import LoadingState from '../components/LoadingState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import OrderStatusBadge from '../components/OrderStatusBadge.jsx'
import PaymentStatusBadge from '../components/PaymentStatusBadge.jsx'
import PharmacyOrderAccessNotice from '../components/PharmacyOrderAccessNotice.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { getPharmacyOrders } from '../lib/orderApi.js'
import { getApiErrorMessage } from '../lib/apiError.js'
import { pharmacyOrderAccessState } from '../lib/pharmacyOrderAccess.js'
import {
  formatOrderDate,
  ORDER_SORT_OPTIONS,
  ORDER_STATUS_OPTIONS,
} from '../lib/orderFormat.js'
import { formatMedicinePrice } from '../lib/medicineFormat.js'
import { inputClass } from '../lib/formStyles.js'

const PAGE_LIMIT = 20

function itemSummary(order) {
  const unitCount = order.items.reduce((sum, item) => sum + item.quantity, 0)
  return `${order.items.length} ${
    order.items.length === 1 ? 'medicine' : 'medicines'
  } | ${unitCount} ${unitCount === 1 ? 'unit' : 'units'}`
}

export default function PharmacyOrdersPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [draft, setDraft] = useState({
    q: searchParams.get('q') || '',
    status: searchParams.get('status') || '',
    sort: searchParams.get('sort') || 'newest',
  })
  const [state, setState] = useState({
    loading: true,
    error: null,
    accessCode: null,
    data: null,
  })

  const load = useCallback(() => {
    const params = {
      limit: PAGE_LIMIT,
      sort: searchParams.get('sort') || 'newest',
    }
    const q = searchParams.get('q')
    const status = searchParams.get('status')
    const page = searchParams.get('page')

    if (q) params.q = q
    if (status) params.status = status
    if (page) params.page = page

    getPharmacyOrders(params)
      .then((response) => {
        setState({
          loading: false,
          error: null,
          accessCode: null,
          data: response.data.data,
        })
      })
      .catch((error) => {
        const code = error?.response?.data?.code
        const access = pharmacyOrderAccessState(code)
        setState({
          loading: false,
          error: access
            ? null
            : getApiErrorMessage(
                error,
                'Unable to load pharmacy orders right now.',
              ),
          accessCode: access ? code : null,
          data: null,
        })
      })
  }, [searchParams])

  function beginLoading() {
    setState({
      loading: true,
      error: null,
      accessCode: null,
      data: null,
    })
  }

  function retry() {
    beginLoading()
    load()
  }

  useEffect(() => {
    load()
  }, [load])

  function handleApply(event) {
    event.preventDefault()
    const next = new URLSearchParams()
    const q = draft.q.trim()
    if (q) next.set('q', q)
    if (draft.status) next.set('status', draft.status)
    if (draft.sort) next.set('sort', draft.sort)
    next.set('page', '1')
    beginLoading()
    setSearchParams(next)
  }

  function handleClear() {
    setDraft({ q: '', status: '', sort: 'newest' })
    beginLoading()
    setSearchParams({})
  }

  function changePage(page) {
    const next = new URLSearchParams(searchParams)
    next.set('page', String(page))
    beginLoading()
    setSearchParams(next)
  }

  const hasFilters = Boolean(
    searchParams.get('q') ||
      searchParams.get('status') ||
      (searchParams.get('sort') && searchParams.get('sort') !== 'newest'),
  )
  const currentPage = Number(searchParams.get('page')) || 1
  const { orders = [], pagination = null } = state.data || {}
  const total = pagination?.total || 0
  const totalPages = pagination?.totalPages || 0

  return (
    <WorkspaceShell user={user} contentClassName="max-w-6xl">
      <div className="py-2 lg:py-4">
        <section className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-8 text-white shadow-xl sm:px-10">
          <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-emerald-600/25 blur-3xl" aria-hidden="true" />
          <div className="relative">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">Pharmacy operations</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Orders</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
              Search, review, and update orders placed with your pharmacy.
            </p>
          </div>
        </section>

        {state.accessCode ? (
          <div className="mt-8">
            <PharmacyOrderAccessNotice code={state.accessCode} />
          </div>
        ) : (
          <>
            <form
              onSubmit={handleApply}
              className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5"
            >
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="sm:col-span-2">
                  <label
                    htmlFor="order-search"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Search
                  </label>
                  <input
                    id="order-search"
                    type="search"
                    value={draft.q}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        q: event.target.value,
                      }))
                    }
                    placeholder="Order ID, customer, or medicine"
                    maxLength={100}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label
                    htmlFor="order-status"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Status
                  </label>
                  <select
                    id="order-status"
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
                    htmlFor="order-sort"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Sort by
                  </label>
                  <select
                    id="order-sort"
                    value={draft.sort}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        sort: event.target.value,
                      }))
                    }
                    className={inputClass}
                  >
                    {ORDER_SORT_OPTIONS.map((option) => (
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
                <LoadingState label="Loading orders..." />
              </div>
            ) : state.error ? (
              <div className="mt-8">
                <ErrorState message={state.error} onRetry={retry} />
              </div>
            ) : orders.length === 0 ? (
              <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm sm:p-10">
                <h2 className="text-base font-semibold text-slate-900">
                  {searchParams.get('q')
                    ? 'No orders match your search.'
                    : 'No orders found.'}
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
                  {hasFilters
                    ? 'Try adjusting your search or filters to see more results.'
                    : 'New pharmacy orders will appear here when patients check out.'}
                </p>
                {hasFilters ? (
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
                <p className="mt-6 text-sm text-slate-500">
                  {total} {total === 1 ? 'order' : 'orders'} found
                </p>

                <div className="mt-3 hidden overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-sm lg:block">
                  <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 font-medium text-slate-600">
                          Order
                        </th>
                        <th className="px-4 py-3 font-medium text-slate-600">
                          Customer
                        </th>
                        <th className="px-4 py-3 font-medium text-slate-600">
                          Items
                        </th>
                        <th className="px-4 py-3 font-medium text-slate-600">
                          Total
                        </th>
                        <th className="px-4 py-3 font-medium text-slate-600">
                          Payment
                        </th>
                        <th className="px-4 py-3 font-medium text-slate-600">
                          Status
                        </th>
                        <th className="px-4 py-3 font-medium text-slate-600">
                          Placed
                        </th>
                        <th className="px-4 py-3 text-right font-medium text-slate-600">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {orders.map((order) => (
                        <tr key={order.orderId} className="align-top">
                          <td className="max-w-[160px] px-4 py-4">
                            <p
                              className="break-all text-xs font-medium text-slate-900"
                              title={order.orderId}
                            >
                              {order.orderId}
                            </p>
                          </td>
                          <td className="px-4 py-4 text-slate-900">
                            {order.deliveryAddress.fullName}
                          </td>
                          <td className="px-4 py-4 text-slate-600">
                            {itemSummary(order)}
                          </td>
                          <td className="px-4 py-4 font-medium text-slate-900">
                            {formatMedicinePrice(order.totalAmount)}
                          </td>
                          <td className="px-4 py-4">
                            <PaymentStatusBadge status={order.paymentStatus} />
                          </td>
                          <td className="px-4 py-4">
                            <OrderStatusBadge status={order.orderStatus} />
                          </td>
                          <td className="px-4 py-4 text-slate-600">
                            {formatOrderDate(order.placedAt)}
                          </td>
                          <td className="px-4 py-4 text-right">
                            <Link
                              to={`/pharmacy/orders/${order.orderId}`}
                              aria-label={`View order ${order.orderId}`}
                              className="rounded-xl bg-brand-600 px-3 py-2 text-sm font-bold text-white transition hover:bg-brand-700"
                            >
                              View
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <section className="mt-3 space-y-4 lg:hidden">
                  {orders.map((order) => (
                    <article
                      key={order.orderId}
                      className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg sm:p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p
                            className="break-all text-xs font-medium text-slate-500"
                            title={order.orderId}
                          >
                            {order.orderId}
                          </p>
                          <h2 className="mt-1 text-base font-semibold text-slate-900">
                            {order.deliveryAddress.fullName}
                          </h2>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {formatOrderDate(order.placedAt, {
                              withTime: true,
                            })}
                          </p>
                        </div>
                        <OrderStatusBadge status={order.orderStatus} />
                      </div>

                      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-sm">
                        <div>
                          <dt className="text-slate-500">Items</dt>
                          <dd className="mt-0.5 font-medium text-slate-900">
                            {itemSummary(order)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Total</dt>
                          <dd className="mt-0.5 font-semibold text-slate-900">
                            {formatMedicinePrice(order.totalAmount)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Payment</dt>
                          <dd className="mt-1">
                            <PaymentStatusBadge status={order.paymentStatus} />
                          </dd>
                        </div>
                      </dl>

                      <Link
                        to={`/pharmacy/orders/${order.orderId}`}
                        aria-label={`View order ${order.orderId}`}
                        className="mt-4 inline-block rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-brand-700"
                      >
                        View order
                      </Link>
                    </article>
                  ))}
                </section>

                {totalPages > 1 ? (
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
                ) : null}
              </>
            )}
          </>
        )}
      </div>
    </WorkspaceShell>
  )
}
