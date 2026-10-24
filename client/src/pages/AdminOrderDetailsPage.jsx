import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import LoadingState from '../components/LoadingState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import OrderStatusBadge from '../components/OrderStatusBadge.jsx'
import OrderStatusTimeline from '../components/OrderStatusTimeline.jsx'
import PaymentStatusBadge from '../components/PaymentStatusBadge.jsx'
import { getAdminOrder } from '../lib/adminApi.js'
import { getApiErrorMessage } from '../lib/apiError.js'
import {
  formatOrderDate,
  paymentMethodLabel,
  prescriptionStatusLabel,
} from '../lib/orderFormat.js'
import { formatMedicinePrice } from '../lib/medicineFormat.js'

function ItemRow({ item, index }) {
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
          <h3 className="text-sm font-semibold text-slate-900">
            {item.name || 'Medicine'}
          </h3>
          {details ? (
            <p className="mt-0.5 text-xs text-slate-500">{details}</p>
          ) : null}
          <p className="mt-1 text-sm text-slate-600">
            {item.quantity} × {formatMedicinePrice(item.unitPrice)}
          </p>
          {item.prescriptionRequired ? (
            <span className="mt-2 inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
              Prescription required
            </span>
          ) : null}
        </div>
        <p className="shrink-0 text-sm font-semibold text-slate-900">
          {formatMedicinePrice(item.lineTotal)}
        </p>
      </div>
      <span className="sr-only">Item {index + 1}</span>
    </li>
  )
}

function DetailRow({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-900">{children}</dd>
    </div>
  )
}

export default function AdminOrderDetailsPage() {
  const { orderId } = useParams()
  const [state, setState] = useState({
    loading: true,
    error: null,
    order: null,
  })

  const load = useCallback(() => {
    setState({ loading: true, error: null, order: null })
    getAdminOrder(orderId)
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

  const order = state.order

  return (
    <div>
      <Link
        to="/admin/orders"
        className="text-sm font-medium text-brand-600 transition hover:text-brand-700"
      >
        &larr; Back to orders
      </Link>

      {state.loading ? (
        <div className="mt-8">
          <LoadingState label="Loading order details…" />
        </div>
      ) : state.error ? (
        <div className="mt-8">
          <ErrorState message={state.error} onRetry={load} />
        </div>
      ) : (
        <>
          <header className="mt-6 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                Order details
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Placed {formatOrderDate(order.placedAt, { withTime: true })}
              </p>
              <p className="mt-1 break-all font-mono text-xs text-slate-400">
                {order.orderId}
              </p>
            </div>
            <OrderStatusBadge status={order.orderStatus} />
          </header>

          <p className="mt-4 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
            Admin order details omit phone numbers, street addresses, and
            prescription documents.
          </p>

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-6">
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-base font-semibold text-slate-900">
                  Items
                </h2>
                {order.items.length > 0 ? (
                  <ul className="mt-4">
                    {order.items.map((item, index) => (
                      <ItemRow
                        key={`${item.name}-${index}`}
                        item={item}
                        index={index}
                      />
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">
                    No item details are available for this order.
                  </p>
                )}
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-base font-semibold text-slate-900">
                  Status timeline
                </h2>
                <div className="mt-4">
                  <OrderStatusTimeline
                    status={order.orderStatus}
                    statusHistory={order.statusHistory}
                  />
                </div>
              </section>
            </div>

            <aside className="space-y-6">
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-base font-semibold text-slate-900">
                  Customer
                </h2>
                <dl className="mt-3 space-y-2 text-sm">
                  <DetailRow label="Name">
                    {order.customer.name || 'Customer'}
                  </DetailRow>
                  <DetailRow label="City">
                    {order.customer.city || '—'}
                  </DetailRow>
                  <DetailRow label="State">
                    {order.customer.state || '—'}
                  </DetailRow>
                  <DetailRow label="Pincode">
                    {order.customer.pincode || '—'}
                  </DetailRow>
                </dl>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-base font-semibold text-slate-900">
                  Pharmacy
                </h2>
                <dl className="mt-3 space-y-2 text-sm">
                  <DetailRow label="Name">
                    {order.pharmacy.pharmacyName || 'Unknown pharmacy'}
                  </DetailRow>
                  <DetailRow label="City">
                    {order.pharmacy.city || '—'}
                  </DetailRow>
                  <DetailRow label="State">
                    {order.pharmacy.state || '—'}
                  </DetailRow>
                </dl>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-base font-semibold text-slate-900">
                  Payment
                </h2>
                <dl className="mt-3 space-y-2 text-sm">
                  <DetailRow label="Method">
                    {paymentMethodLabel(order.paymentMethod)}
                  </DetailRow>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-slate-500">Status</dt>
                    <dd className="text-right">
                      <PaymentStatusBadge status={order.paymentStatus} />
                    </dd>
                  </div>
                  <DetailRow label="Prescription">
                    {prescriptionStatusLabel(order.prescriptionStatus)}
                  </DetailRow>
                </dl>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-base font-semibold text-slate-900">
                  Order total
                </h2>
                <dl className="mt-3 space-y-2 text-sm">
                  <DetailRow label="Subtotal">
                    {formatMedicinePrice(order.subtotal)}
                  </DetailRow>
                  <DetailRow label="Delivery fee">
                    {formatMedicinePrice(order.deliveryFee)}
                  </DetailRow>
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
    </div>
  )
}
