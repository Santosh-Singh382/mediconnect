import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader.jsx'
import Alert from '../components/Alert.jsx'
import Badge from '../components/Badge.jsx'
import AdminIcon from '../components/AdminIcon.jsx'
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

function Panel({ title, description, icon, action, children, className = '' }) {
  return (
    <section
      className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          {icon ? (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
              <AdminIcon name={icon} className="h-4 w-4" />
            </span>
          ) : null}
          <div className="min-w-0">
            <h2 className="mb-0 text-sm font-semibold text-slate-900">{title}</h2>
            {description ? (
              <p className="mb-0 mt-0.5 text-xs text-slate-500">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

function DetailRow({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-right text-sm font-medium text-slate-900">
        {children}
      </dd>
    </div>
  )
}

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
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="mb-0 text-sm font-semibold text-slate-900">
              {item.name || 'Medicine'}
            </h3>
            {item.prescriptionRequired ? (
              <Badge variant="warning" size="sm">
                Rx required
              </Badge>
            ) : null}
          </div>
          {details ? (
            <p className="mb-0 mt-0.5 text-xs text-slate-500">{details}</p>
          ) : null}
          <p className="mb-0 mt-1.5 text-sm text-slate-500">
            {item.quantity} × {formatMedicinePrice(item.unitPrice)}
          </p>
        </div>
        <p className="mb-0 shrink-0 text-sm font-semibold text-slate-900">
          {formatMedicinePrice(item.lineTotal)}
        </p>
      </div>
    </li>
  )
}

export default function AdminOrderDetailsPage() {
  const { orderId } = useParams()
  const [state, setState] = useState({
    loading: true,
    error: null,
    order: null,
  })
  const requestVersion = useRef(0)

  const load = useCallback(() => {
    requestVersion.current += 1
    const version = requestVersion.current
    setState({ loading: true, error: null, order: null })
    getAdminOrder(orderId)
      .then((response) => {
        if (requestVersion.current !== version) return
        setState({
          loading: false,
          error: null,
          order: response.data.data.order,
        })
      })
      .catch((error) => {
        if (requestVersion.current !== version) return
        setState({
          loading: false,
          error: getApiErrorMessage(error, 'Unable to load this order.'),
          order: null,
        })
      })
  }, [orderId])

  useEffect(() => {
    load()
    return () => {
      requestVersion.current += 1
    }
  }, [load])

  const order = state.order

  if (state.loading) {
    return (
      <div>
        <PageHeader
          title="Order details"
          breadcrumb={
            <Link
              to="/admin/orders"
              className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-700"
            >
              <AdminIcon
                name="chevronRight"
                className="h-3.5 w-3.5 rotate-180"
              />
              Orders
            </Link>
          }
        />
        <div className="mt-6">
          <LoadingState label="Loading order details…" />
        </div>
      </div>
    )
  }

  if (state.error || !order) {
    return (
      <div>
        <PageHeader
          title="Order details"
          breadcrumb={
            <Link
              to="/admin/orders"
              className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-700"
            >
              <AdminIcon
                name="chevronRight"
                className="h-3.5 w-3.5 rotate-180"
              />
              Orders
            </Link>
          }
        />
        <div className="mt-6">
          <ErrorState
            message={state.error || 'Order not found.'}
            onRetry={load}
          />
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Order details"
        breadcrumb={
          <Link
            to="/admin/orders"
            className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-700"
          >
            <AdminIcon
              name="chevronRight"
              className="h-3.5 w-3.5 rotate-180"
            />
            Orders
          </Link>
        }
        description={
          <>
            Order{' '}
            <span className="break-all font-mono text-xs text-slate-600">
              {order.orderId}
            </span>{' '}
            · Placed {formatOrderDate(order.placedAt, { withTime: true })}
          </>
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={order.orderStatus} />
            <PaymentStatusBadge status={order.paymentStatus} />
          </div>
        }
      />

      <Alert variant="info" className="mt-4">
        This admin view hides customer phone numbers, street addresses, and
        prescription documents.
      </Alert>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Panel
            title="Items"
            description={`${order.itemCount} ${
              order.itemCount === 1 ? 'medicine' : 'medicines'
            } · ${order.unitCount} ${
              order.unitCount === 1 ? 'unit' : 'units'
            }`}
            icon="medicines"
          >
            {order.items.length > 0 ? (
              <ul>
                {order.items.map((item, index) => (
                  <ItemRow key={`${item.name}-${index}`} item={item} />
                ))}
              </ul>
            ) : (
              <p className="mb-0 text-sm text-slate-500">
                No item details are available for this order.
              </p>
            )}
          </Panel>

          <Panel
            title="Status timeline"
            description="Recorded progress for this order."
            icon="clock"
          >
            <OrderStatusTimeline
              status={order.orderStatus}
              statusHistory={order.statusHistory}
            />
          </Panel>
        </div>

        <aside className="space-y-6">
          <Panel title="Customer" icon="account">
            <dl className="space-y-3">
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
            <p className="mb-0 mt-4 border-t border-slate-100 pt-3 text-xs leading-5 text-slate-400">
              Contact details are hidden for privacy.
            </p>
          </Panel>

          <Panel title="Pharmacy" icon="building">
            <dl className="space-y-3">
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
          </Panel>

          <Panel title="Payment" icon="shield">
            <dl className="space-y-3">
              <DetailRow label="Method">
                {paymentMethodLabel(order.paymentMethod)}
              </DetailRow>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-sm text-slate-500">Status</dt>
                <dd>
                  <PaymentStatusBadge status={order.paymentStatus} />
                </dd>
              </div>
              <DetailRow label="Prescription">
                {prescriptionStatusLabel(order.prescriptionStatus)}
              </DetailRow>
            </dl>
          </Panel>

          <Panel title="Order total" icon="orders">
            <dl className="space-y-3">
              <DetailRow label="Subtotal">
                {formatMedicinePrice(order.subtotal)}
              </DetailRow>
              <DetailRow label="Delivery fee">
                {formatMedicinePrice(order.deliveryFee)}
              </DetailRow>
              <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-3">
                <dt className="text-sm font-semibold text-slate-900">Total</dt>
                <dd className="text-lg font-semibold text-slate-900">
                  {formatMedicinePrice(order.totalAmount)}
                </dd>
              </div>
            </dl>
          </Panel>
        </aside>
      </div>
    </div>
  )
}
