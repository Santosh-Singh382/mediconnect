import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import AppHeader from '../components/AppHeader.jsx'
import LoadingState from '../components/LoadingState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import OrderStatusBadge from '../components/OrderStatusBadge.jsx'
import PaymentStatusBadge from '../components/PaymentStatusBadge.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { getOrders } from '../lib/orderApi.js'
import { getApiErrorMessage } from '../lib/apiError.js'
import {
  formatOrderDate,
  ORDER_SORT_OPTIONS,
  ORDER_STATUS_OPTIONS,
  paymentMethodLabel,
} from '../lib/orderFormat.js'
import { formatMedicinePrice } from '../lib/medicineFormat.js'
import { inputClass } from '../lib/formStyles.js'
import { homePathFor, homeLinksFor } from '../lib/homePath.js'

const PAGE_LIMIT = 10

export default function MyOrdersPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const [draft, setDraft] = useState({
    status: searchParams.get('status') || '',
    sort: searchParams.get('sort') || 'newest',
  })
  const [state, setState] = useState({
    loading: true,
    error: null,
    data: null,
  })

  const load = useCallback(() => {
    const params = {
      limit: PAGE_LIMIT,
      sort: searchParams.get('sort') || 'newest',
    }
    const status = searchParams.get('status')
    const page = searchParams.get('page')

    if (status) params.status = status
    if (page) params.page = page

    getOrders(params)
      .then((response) => {
        setState({ loading: false, error: null, data: response.data.data })
      })
      .catch((error) => {
        setState({
          loading: false,
          error: getApiErrorMessage(
            error,
            'Unable to load your orders right now.',
          ),
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

  function handleApply(event) {
    event.preventDefault()
    const next = new URLSearchParams()
    if (draft.status) next.set('status', draft.status)
    if (draft.sort) next.set('sort', draft.sort)
    next.set('page', '1')
    beginLoading()
    setSearchParams(next)
  }

  function handleClear() {
    setDraft({ status: '', sort: 'newest' })
    beginLoading()
    setSearchParams({})
  }

  function changePage(page) {
    const next = new URLSearchParams(searchParams)
    next.set('page', String(page))
    beginLoading()
    setSearchParams(next)
  }

  function hasFilters() {
    return Boolean(searchParams.get('status')) || Boolean(searchParams.get('sort'))
  }

  const currentPage = Number(searchParams.get('page')) || 1
  const { orders, pagination } = state.data || {
    orders: [],
    pagination: null,
  }
  const { total, totalPages } = pagination || { total: 0, totalPages: 0 }

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader home={homePathFor(user)} links={homeLinksFor(user)} />

      <main className="mx-auto max-w-4xl px-6 py-10">
        <section>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            My Orders
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Review pharmacy orders placed with your patient account.
          </p>
        </section>

        <form
          onSubmit={handleApply}
          className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="status"
                className="block text-sm font-medium text-slate-700"
              >
                Status
              </label>
              <select
                id="status"
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
                htmlFor="sort"
                className="block text-sm font-medium text-slate-700"
              >
                Sort by
              </label>
              <select
                id="sort"
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
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
            >
              Apply filters
            </button>
            {hasFilters() ? (
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
            <LoadingState label="Loading your orders…" />
          </div>
        ) : state.error ? (
          <div className="mt-8">
            <ErrorState message={state.error} onRetry={retry} />
          </div>
        ) : orders.length === 0 ? (
          <div className="mt-8 rounded-lg border border-slate-200 bg-white p-10 text-center shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">
              No orders found
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
              {hasFilters()
                ? 'Try adjusting your filters to see more results.'
                : 'You have not placed any pharmacy orders yet.'}
            </p>
            {hasFilters() ? (
              <button
                type="button"
                onClick={handleClear}
                className="mt-5 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
              >
                Clear filters
              </button>
            ) : (
              <Link
                to="/medicines"
                className="mt-5 inline-block rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
              >
                Browse medicines
              </Link>
            )}
          </div>
        ) : (
          <>
            <p className="mt-6 text-sm text-slate-500">
              {total} {total === 1 ? 'order' : 'orders'} found
            </p>
            <section className="mt-3 space-y-4">
              {orders.map((order) => {
                const unitCount = order.items.reduce(
                  (sum, item) => sum + item.quantity,
                  0,
                )
                const location = [
                  [order.pharmacy.city, order.pharmacy.state]
                    .filter(Boolean)
                    .join(', '),
                  order.pharmacy.pincode
                    ? `PIN ${order.pharmacy.pincode}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')

                return (
                  <article
                    key={order.orderId}
                    className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          {formatOrderDate(order.placedAt, { withTime: true })}
                        </p>
                        <h2 className="mt-1 text-base font-semibold text-slate-900">
                          {order.pharmacy.pharmacyName || 'Pharmacy'}
                        </h2>
                        <p className="mt-0.5 text-sm text-slate-500">
                          {location || 'Location not listed'}
                        </p>
                      </div>
                      <OrderStatusBadge status={order.orderStatus} />
                    </div>

                    <dl className="mt-4 grid gap-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-3">
                      <div>
                        <dt className="text-slate-500">Total</dt>
                        <dd className="mt-0.5 font-semibold text-slate-900">
                          {formatMedicinePrice(order.totalAmount)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Items</dt>
                        <dd className="mt-0.5 font-medium text-slate-900">
                          {order.items.length}{' '}
                          {order.items.length === 1 ? 'medicine' : 'medicines'} ·{' '}
                          {unitCount} {unitCount === 1 ? 'unit' : 'units'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Payment</dt>
                        <dd className="mt-1 flex flex-wrap items-center gap-1.5 text-sm font-medium text-slate-900">
                          <span>{paymentMethodLabel(order.paymentMethod)}</span>
                          <span aria-hidden="true" className="text-slate-400">
                            ·
                          </span>
                          <PaymentStatusBadge status={order.paymentStatus} />
                        </dd>
                      </div>
                    </dl>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <p className="break-all text-xs text-slate-400">
                        Order {order.orderId}
                      </p>
                      <Link
                        to={`/orders/${order.orderId}`}
                        className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-brand-700"
                      >
                        View order
                      </Link>
                    </div>
                  </article>
                )
              })}
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
      </main>
    </div>
  )
}
