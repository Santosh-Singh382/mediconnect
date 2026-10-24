import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import AppHeader from '../components/AppHeader.jsx'
import LoadingState from '../components/LoadingState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import OrderStatusBadge from '../components/OrderStatusBadge.jsx'
import PaymentStatusBadge from '../components/PaymentStatusBadge.jsx'
import PharmacyOrderAccessNotice from '../components/PharmacyOrderAccessNotice.jsx'
import { useAuth } from '../hooks/useAuth.js'
import {
  getPharmacyOrder,
  updatePharmacyOrderStatus,
} from '../lib/orderApi.js'
import { getApiErrorMessage } from '../lib/apiError.js'
import { pharmacyOrderAccessState } from '../lib/pharmacyOrderAccess.js'
import {
  addressLines,
  formatOrderDate,
  orderStatusLabel,
  paymentMethodLabel,
  PHARMACY_ORDER_STATUS_ACTIONS,
  prescriptionStatusLabel,
} from '../lib/orderFormat.js'
import { formatMedicinePrice } from '../lib/medicineFormat.js'
import { homePathFor, homeLinksFor } from '../lib/homePath.js'

function ItemRow({ item, index }) {
  const details = [
    item.genericName,
    item.brandName,
    item.strength,
    item.dosageForm,
    item.packSize,
  ]
    .filter(Boolean)
    .join(' | ')

  return (
    <li className="border-b border-slate-100 py-4 first:pt-0 last:border-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900">{item.name}</h3>
          {details ? (
            <p className="mt-0.5 text-xs text-slate-500">{details}</p>
          ) : null}
          <p className="mt-1 text-sm text-slate-600">
            {item.quantity} x {formatMedicinePrice(item.unitPrice)}
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

function ConfirmationDialog({ action, updating, onCancel, onConfirm }) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape' && !updating) onCancel()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onCancel, updating])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="status-dialog-title"
        className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-xl sm:p-6"
      >
        <h2
          id="status-dialog-title"
          className="text-base font-semibold text-slate-900"
        >
          {action.confirmTitle}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          {action.confirmDescription}
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={updating}
            autoFocus
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Keep order unchanged
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={updating}
            className={`rounded-md px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
              action.danger
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-brand-600 hover:bg-brand-700'
            }`}
          >
            {updating ? 'Updating...' : action.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PharmacyOrderDetailsPage() {
  const { user } = useAuth()
  const { orderId } = useParams()
  const [state, setState] = useState({
    loading: true,
    error: null,
    accessCode: null,
    order: null,
  })
  const [pendingAction, setPendingAction] = useState(null)
  const [updating, setUpdating] = useState(false)
  const [notice, setNotice] = useState(null)

  const load = useCallback(() => {
    getPharmacyOrder(orderId)
      .then((response) => {
        setState({
          loading: false,
          error: null,
          accessCode: null,
          order: response.data.data.order,
        })
      })
      .catch((error) => {
        const code = error?.response?.data?.code
        const access = pharmacyOrderAccessState(code)
        setState({
          loading: false,
          error: access
            ? null
            : getApiErrorMessage(error, 'Unable to load this order.'),
          accessCode: access ? code : null,
          order: null,
        })
      })
  }, [orderId])

  function retry() {
    setState({
      loading: true,
      error: null,
      accessCode: null,
      order: null,
    })
    load()
  }

  useEffect(() => {
    load()
  }, [load])

  function confirmStatusUpdate() {
    if (!pendingAction) return
    setUpdating(true)
    setNotice(null)

    updatePharmacyOrderStatus(orderId, pendingAction.status)
      .then((response) => {
        setState({
          loading: false,
          error: null,
          accessCode: null,
          order: response.data.data.order,
        })
        setNotice({
          type: 'success',
          message: `Order status updated to ${orderStatusLabel(
            pendingAction.status,
          )}.`,
        })
        setPendingAction(null)
      })
      .catch((error) => {
        const code = error?.response?.data?.code
        setNotice({
          type: 'error',
          message: getApiErrorMessage(
            error,
            'Unable to update this order status.',
          ),
        })
        setPendingAction(null)
        if (code === 'INVALID_STATUS_TRANSITION') load()
      })
      .finally(() => {
        setUpdating(false)
      })
  }

  const order = state.order
  const actions = order
    ? PHARMACY_ORDER_STATUS_ACTIONS[order.orderStatus] || []
    : []

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader home={homePathFor(user)} links={homeLinksFor(user)} />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <Link
          to="/pharmacy/orders"
          className="text-sm font-medium text-brand-600 transition hover:text-brand-700"
        >
          &larr; Back to orders
        </Link>

        {state.loading ? (
          <div className="mt-8">
            <LoadingState label="Loading order details..." />
          </div>
        ) : state.accessCode ? (
          <div className="mt-8">
            <PharmacyOrderAccessNotice code={state.accessCode} />
          </div>
        ) : state.error ? (
          <div className="mt-8">
            <ErrorState message={state.error} onRetry={retry} />
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
                <p className="mt-1 break-all text-xs text-slate-400">
                  {order.orderId}
                </p>
              </div>
              <OrderStatusBadge status={order.orderStatus} />
            </header>

            {notice ? (
              <div
                role={notice.type === 'error' ? 'alert' : 'status'}
                className={`mt-5 rounded-md border px-4 py-3 text-sm ${
                  notice.type === 'error'
                    ? 'border-red-200 bg-red-50 text-red-700'
                    : 'border-green-200 bg-green-50 text-green-800'
                }`}
              >
                {notice.message}
              </div>
            ) : null}

            <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
              <div className="space-y-6">
                <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <h2 className="text-base font-semibold text-slate-900">
                    Items
                  </h2>
                  <ul className="mt-4">
                    {order.items.map((item, index) => (
                      <ItemRow
                        key={`${item.name}-${index}`}
                        item={item}
                        index={index}
                      />
                    ))}
                  </ul>
                </section>

                <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <h2 className="text-base font-semibold text-slate-900">
                    Customer
                  </h2>
                  <div className="mt-3 text-sm text-slate-700">
                    <p className="font-medium text-slate-900">
                      {order.deliveryAddress.fullName}
                    </p>
                    <p>{order.deliveryAddress.phone}</p>
                  </div>
                </section>

                <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <h2 className="text-base font-semibold text-slate-900">
                    Delivery address
                  </h2>
                  <div className="mt-3 text-sm text-slate-700">
                    {addressLines(order.deliveryAddress).map((line, index) => (
                      <p key={`${line}-${index}`}>{line}</p>
                    ))}
                  </div>
                </section>
              </div>

              <aside className="space-y-6">
                <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <h2 className="text-base font-semibold text-slate-900">
                    Update status
                  </h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Current status: {orderStatusLabel(order.orderStatus)}
                  </p>
                  {actions.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      {actions.map((action) => (
                        <button
                          key={action.status}
                          type="button"
                          onClick={() => {
                            setNotice(null)
                            setPendingAction(action)
                          }}
                          className={`w-full rounded-md px-4 py-2 text-sm font-medium text-white transition ${
                            action.danger
                              ? 'bg-red-600 hover:bg-red-700'
                              : 'bg-brand-600 hover:bg-brand-700'
                          }`}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-slate-500">
                      No further status actions are available for this order.
                    </p>
                  )}
                  <p className="mt-4 text-xs text-slate-500">
                    Order status changes do not modify stock, totals, addresses,
                    or payment status.
                  </p>
                </section>

                <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
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

                <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
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

      {pendingAction ? (
        <ConfirmationDialog
          action={pendingAction}
          updating={updating}
          onCancel={() => setPendingAction(null)}
          onConfirm={confirmStatusUpdate}
        />
      ) : null}
    </div>
  )
}
