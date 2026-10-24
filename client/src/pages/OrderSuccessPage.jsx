import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import AppHeader from '../components/AppHeader.jsx'
import LoadingState from '../components/LoadingState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import OrderStatusBadge from '../components/OrderStatusBadge.jsx'
import PaymentStatusBadge from '../components/PaymentStatusBadge.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { getOrder } from '../lib/orderApi.js'
import { getApiErrorMessage } from '../lib/apiError.js'
import {
  formatOrderDate,
  paymentMethodLabel,
} from '../lib/orderFormat.js'
import { formatMedicinePrice } from '../lib/medicineFormat.js'
import { homePathFor, homeLinksFor } from '../lib/homePath.js'

export default function OrderSuccessPage() {
  const { user } = useAuth()
  const { orderId } = useParams()
  const location = useLocation()
  const initialOrder =
    location.state?.order?.orderId === orderId
      ? location.state.order
      : null

  const [state, setState] = useState({
    loading: !initialOrder,
    error: null,
    order: initialOrder,
  })

  const load = useCallback(() => {
    getOrder(orderId)
      .then((response) => {
        setState({
          loading: false,
          error: null,
          order: response.data.data.order,
        })
      })
      .catch((error) => {
        setState({
          loading: false,
          error: getApiErrorMessage(error, 'Unable to load this order.'),
          order: null,
        })
      })
  }, [orderId])

  useEffect(() => {
    if (initialOrder) return
    load()
  }, [initialOrder, load])

  function retry() {
    setState({ loading: true, error: null, order: null })
    load()
  }

  const header = (
    <AppHeader home={homePathFor(user)} links={homeLinksFor(user)} />
  )

  if (state.loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        {header}
        <main className="mx-auto max-w-3xl px-6 py-12">
          <LoadingState label="Loading your order…" />
        </main>
      </div>
    )
  }

  if (state.error || !state.order) {
    return (
      <div className="min-h-screen bg-slate-50">
        {header}
        <main className="mx-auto max-w-3xl px-6 py-12">
          <ErrorState
            message={state.error || 'Unable to load this order.'}
            onRetry={retry}
          />
          <div className="mt-4 text-center">
            <Link
              to="/orders"
              className="text-sm font-medium text-brand-600 transition hover:text-brand-700"
            >
              Back to my orders
            </Link>
          </div>
        </main>
      </div>
    )
  }

  const order = state.order
  const itemCount = order.items.reduce(
    (total, item) => total + item.quantity,
    0,
  )

  return (
    <div className="min-h-screen bg-slate-50">
      {header}

      <main className="mx-auto max-w-3xl px-6 py-10">
        <section className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-700"
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-7 w-7"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m5 12 4 4L19 6"
              />
            </svg>
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-slate-900">
            Order placed successfully
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">
            Your order has been placed. Payment will be collected on delivery.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <OrderStatusBadge status={order.orderStatus} />
            <span className="text-sm text-slate-500">
              {formatOrderDate(order.placedAt, { withTime: true })}
            </span>
          </div>
        </section>

        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            Order summary
          </h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-slate-500">Order ID</dt>
              <dd className="mt-0.5 break-all text-sm font-medium text-slate-900">
                {order.orderId}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Pharmacy</dt>
              <dd className="mt-0.5 text-sm font-medium text-slate-900">
                {order.pharmacy.pharmacyName || 'Pharmacy'}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Items</dt>
              <dd className="mt-0.5 text-sm font-medium text-slate-900">
                {itemCount} {itemCount === 1 ? 'unit' : 'units'}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Total</dt>
              <dd className="mt-0.5 text-sm font-semibold text-slate-900">
                {formatMedicinePrice(order.totalAmount)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Payment method</dt>
              <dd className="mt-0.5 text-sm font-medium text-slate-900">
                {paymentMethodLabel(order.paymentMethod)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Payment status</dt>
              <dd className="mt-0.5">
                <PaymentStatusBadge status={order.paymentStatus} />
              </dd>
            </div>
          </dl>
        </section>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            to={`/orders/${order.orderId}`}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            View order details
          </Link>
          <Link
            to="/orders"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            My orders
          </Link>
          <Link
            to="/medicines"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Continue shopping
          </Link>
        </div>
      </main>
    </div>
  )
}
