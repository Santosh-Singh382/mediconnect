import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import AppHeader from '../components/AppHeader.jsx'
import LoadingState from '../components/LoadingState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import OrderStatusBadge from '../components/OrderStatusBadge.jsx'
import OrderStatusTimeline from '../components/OrderStatusTimeline.jsx'
import PaymentStatusBadge from '../components/PaymentStatusBadge.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { getOrder } from '../lib/orderApi.js'
import { getApiErrorMessage } from '../lib/apiError.js'
import {
  addressLines,
  formatOrderDate,
  paymentMethodLabel,
  prescriptionStatusLabel,
} from '../lib/orderFormat.js'
import { formatMedicinePrice } from '../lib/medicineFormat.js'
import { homePathFor, homeLinksFor } from '../lib/homePath.js'

function ItemRow({ item }) {
  const details = [
    item.genericName,
    item.brandName,
    item.strength,
    item.dosageForm,
    item.packSize,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <li className="border-b border-slate-100 py-4 first:pt-0 last:border-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900">{item.name}</h3>
          {details ? (
            <p className="mt-0.5 text-xs text-slate-500">{details}</p>
          ) : null}
          <p className="mt-1 text-sm text-slate-600">
            {item.quantity} × {formatMedicinePrice(item.unitPrice)}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {item.prescriptionRequired ? (
              <span className="inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                Prescription required
              </span>
            ) : null}
            {item.prescriptionId ? (
              <Link
                to={`/prescriptions/${item.prescriptionId}`}
                className="text-xs font-medium text-brand-600 transition hover:text-brand-700"
              >
                View prescription
              </Link>
            ) : null}
          </div>
        </div>
        <p className="shrink-0 text-sm font-semibold text-slate-900">
          {formatMedicinePrice(item.lineTotal)}
        </p>
      </div>
    </li>
  )
}

export default function OrderDetailsPage() {
  const { user } = useAuth()
  const { orderId } = useParams()
  const [state, setState] = useState({
    loading: true,
    error: null,
    order: null,
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
    load()
  }, [load])

  function retry() {
    setState({ loading: true, error: null, order: null })
    load()
  }

  const order = state.order

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader home={homePathFor(user)} links={homeLinksFor(user)} />

      <main className="mx-auto max-w-4xl px-6 py-10">
        <Link
          to="/orders"
          className="text-sm font-medium text-brand-600 transition hover:text-brand-700"
        >
          &larr; Back to my orders
        </Link>

        {state.loading ? (
          <div className="mt-8">
            <LoadingState label="Loading order details…" />
          </div>
        ) : state.error ? (
          <div className="mt-8">
            <ErrorState message={state.error} onRetry={retry} />
          </div>
        ) : (
          <>
            <header className="mt-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
                  Order details
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  Placed {formatOrderDate(order.placedAt, { withTime: true })}
                </p>
                <p className="mt-1 break-all text-xs text-slate-400">
                  {order.orderId}
                </p>
              </div>
              <OrderStatusBadge status={order.orderStatus} />
            </header>

            <section
              aria-labelledby="order-status-heading"
              className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
            >
              <h2
                id="order-status-heading"
                className="text-base font-semibold text-slate-900"
              >
                Order status
              </h2>
              <h3 className="mt-1 text-sm font-medium text-slate-500">
                Order status timeline
              </h3>
              <div className="mt-5">
                <OrderStatusTimeline
                  status={order.orderStatus}
                  statusHistory={order.statusHistory}
                />
              </div>
            </section>

            <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="space-y-6">
                <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-base font-semibold text-slate-900">
                    Medicines
                  </h2>
                  <ul className="mt-4">
                    {order.items.map((item) => (
                      <ItemRow key={item.medicineId} item={item} />
                    ))}
                  </ul>
                </section>

                <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-base font-semibold text-slate-900">
                    Delivery address
                  </h2>
                  <div className="mt-3 text-sm text-slate-700">
                    <p className="font-medium text-slate-900">
                      {order.deliveryAddress.fullName}
                    </p>
                    <p>{order.deliveryAddress.phone}</p>
                    {addressLines(order.deliveryAddress).map((line, index) => (
                      <p key={`${line}-${index}`}>{line}</p>
                    ))}
                  </div>
                </section>
              </div>

              <aside className="space-y-6">
                <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-base font-semibold text-slate-900">
                    Pharmacy
                  </h2>
                  <p className="mt-2 text-sm font-medium text-slate-900">
                    {order.pharmacy.pharmacyName || 'Pharmacy'}
                  </p>
                  {order.pharmacy.pharmacistName ? (
                    <p className="mt-0.5 text-sm text-slate-600">
                      Pharmacist: {order.pharmacy.pharmacistName}
                    </p>
                  ) : null}
                  {[order.pharmacy.address, order.pharmacy.city, order.pharmacy.state]
                    .filter(Boolean)
                    .map((line, index) => (
                      <p
                        key={`${line}-${index}`}
                        className="mt-0.5 text-sm text-slate-600"
                      >
                        {line}
                      </p>
                    ))}
                  {order.pharmacy.pincode ? (
                    <p className="mt-0.5 text-sm text-slate-600">
                      PIN {order.pharmacy.pincode}
                    </p>
                  ) : null}
                </section>

                <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-base font-semibold text-slate-900">
                    Payment
                  </h2>
                  <dl className="mt-3 space-y-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-slate-500">Method</dt>
                      <dd className="text-right font-medium text-slate-900">
                        {paymentMethodLabel(order.paymentMethod)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-slate-500">Status</dt>
                      <dd className="text-right">
                        <PaymentStatusBadge status={order.paymentStatus} />
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-slate-500">Amount</dt>
                      <dd className="text-right font-medium text-slate-900">
                        {formatMedicinePrice(order.totalAmount)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-slate-500">Prescription</dt>
                      <dd className="text-right font-medium text-slate-900">
                        {prescriptionStatusLabel(order.prescriptionStatus)}
                      </dd>
                    </div>
                  </dl>
                </section>

                <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-base font-semibold text-slate-900">
                    Order total
                  </h2>
                  <dl className="mt-3 space-y-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-slate-500">Subtotal</dt>
                      <dd className="font-medium text-slate-900">
                        {formatMedicinePrice(order.subtotal)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-slate-500">Delivery fee</dt>
                      <dd className="font-medium text-slate-900">
                        {formatMedicinePrice(order.deliveryFee)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-base">
                      <dt className="font-semibold text-slate-900">Total</dt>
                      <dd className="font-semibold text-slate-900">
                        {formatMedicinePrice(order.totalAmount)}
                      </dd>
                    </div>
                  </dl>
                </section>
              </aside>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
