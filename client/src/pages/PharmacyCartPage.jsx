import { useState } from 'react'
import { Link } from 'react-router-dom'
import WorkspaceShell from '../components/WorkspaceShell.jsx'
import LoadingState from '../components/LoadingState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { useCart } from '../hooks/useCart.js'
import { getApiErrorMessage } from '../lib/apiError.js'
import {
  formatMedicinePrice,
  medicineCategoryLabel,
} from '../lib/medicineFormat.js'
import { cartCheckoutBlocker } from '../lib/orderFormat.js'

const STATUS_STYLES = {
  available: 'bg-green-100 text-green-800',
  lowStock: 'bg-amber-100 text-amber-800',
  quantityExceeded: 'bg-red-100 text-red-700',
  outOfStock: 'bg-slate-100 text-slate-600',
  expired: 'bg-red-100 text-red-700',
  pharmacyUnavailable: 'bg-red-100 text-red-700',
  unavailable: 'bg-slate-100 text-slate-600',
}

function availabilityLabel(item) {
  if (item.availabilityStatus === 'lowStock') {
    return `Only ${item.currentStock} left`
  }
  if (item.availabilityStatus === 'quantityExceeded') {
    return 'Quantity exceeds stock'
  }
  if (item.availabilityStatus === 'outOfStock') return 'Out of stock'
  if (item.availabilityStatus === 'expired') return 'Expired'
  if (item.availabilityStatus === 'pharmacyUnavailable') {
    return 'Pharmacy unavailable'
  }
  if (item.availabilityStatus === 'unavailable') return 'Unavailable'
  return 'Available'
}

function itemNotice(item) {
  if (item.availabilityStatus === 'quantityExceeded') {
    return `Only ${item.currentStock} unit${
      item.currentStock === 1 ? '' : 's'
    } currently available. Reduce the quantity to continue.`
  }
  if (item.availabilityStatus === 'outOfStock') {
    return 'This medicine is out of stock. Remove it or check back later.'
  }
  if (item.availabilityStatus === 'expired') {
    return 'This medicine has expired. Remove it from your cart.'
  }
  if (item.availabilityStatus === 'unavailable') {
    return 'This medicine is no longer available. Remove it from your cart.'
  }
  if (item.availabilityStatus === 'pharmacyUnavailable') {
    return 'This pharmacy is not currently available. Remove this item or try another pharmacy.'
  }
  return null
}

function AvailabilityBadge({ item }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
        STATUS_STYLES[item.availabilityStatus] || STATUS_STYLES.unavailable
      }`}
    >
      {availabilityLabel(item)}
    </span>
  )
}

function PrescriptionBadge({ required }) {
  return required ? (
    <span className="inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
      Prescription required
    </span>
  ) : (
    <span className="inline-block rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-800">
      Over the counter
    </span>
  )
}

function CartItem({ cart, item, busy, busyKey, onQuantity, onRemove }) {
  const itemKey = `${cart.cartId}:${item.medicineId}`
  const updating = busyKey === `update:${itemKey}`
  const removing = busyKey === `remove:${itemKey}`
  const notice = itemNotice(item)
  const detailLink =
    item.active && !item.expired && cart.pharmacyAvailable
      ? `/medicines/${item.medicineId}`
      : null
  const decreaseTarget = item.quantityExceeded
    ? Math.min(item.quantity - 1, item.currentStock)
    : item.quantity - 1
  const canDecrease = !busy && item.quantity > 1 && decreaseTarget >= 1
  const canIncrease =
    !busy &&
    item.available &&
    item.quantity < item.currentStock &&
    item.quantity < 100

  return (
    <li className="border-b border-slate-100 p-5 last:border-0 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-brand-700">
            {medicineCategoryLabel(item.category)}
          </p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">
            {detailLink ? (
              <Link
                to={detailLink}
                className="transition hover:text-brand-700"
              >
                {item.name}
              </Link>
            ) : (
              item.name
            )}
          </h3>
          <p className="mt-0.5 text-sm text-slate-500">
            {[item.genericName, item.strength, item.dosageForm, item.packSize]
              .filter(Boolean)
              .join(' · ') || 'Details not listed'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <AvailabilityBadge item={item} />
            <PrescriptionBadge required={item.prescriptionRequired} />
          </div>
        </div>

        <div className="shrink-0 text-left sm:text-right">
          <p className="text-sm font-medium text-slate-900">
            {formatMedicinePrice(item.unitPrice)} each
          </p>
          <p className="mt-1 text-base font-semibold text-slate-900">
            {formatMedicinePrice(item.subtotal)}
          </p>
        </div>
      </div>

      {notice ? (
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
          {notice}
        </p>
      ) : null}

      {item.priceChanged ? (
        <p className="mt-3 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-relaxed text-sky-800">
          The pharmacy price is now{' '}
          {formatMedicinePrice(item.currentUnitPrice)}. This cart item remains at{' '}
          {formatMedicinePrice(item.unitPrice)} per unit.
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-700">Quantity</span>
          <div className="inline-flex items-center overflow-hidden rounded-md border border-slate-300 bg-white">
            <button
              type="button"
              aria-label={`Decrease ${item.name} quantity`}
              onClick={() => onQuantity(cart, item, decreaseTarget)}
              disabled={!canDecrease}
              className="h-9 w-9 text-lg font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              &minus;
            </button>
            <span
              aria-live="polite"
              className="flex h-9 w-11 items-center justify-center border-x border-slate-200 text-sm font-semibold text-slate-900"
            >
              {updating ? '…' : item.quantity}
            </span>
            <button
              type="button"
              aria-label={`Increase ${item.name} quantity`}
              onClick={() => onQuantity(cart, item, item.quantity + 1)}
              disabled={!canIncrease}
              className="h-9 w-9 text-lg font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              +
            </button>
          </div>
          <span className="text-xs text-slate-500">
            {item.currentStock} in stock
          </span>
        </div>

        <button
          type="button"
          onClick={() => onRemove(item)}
          disabled={busy}
          className="text-sm font-medium text-red-600 transition hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {removing ? 'Removing…' : 'Remove'}
        </button>
      </div>
    </li>
  )
}

export default function PharmacyCartPage() {
  const { user } = useAuth()
  const { carts, summary, loading, error, refresh, updateItem, removeItem, clearCart } =
    useCart()
  const [busyKey, setBusyKey] = useState(null)
  const [actionError, setActionError] = useState(null)

  async function runAction(key, action, fallbackMessage) {
    setBusyKey(key)
    setActionError(null)
    try {
      await action()
    } catch (actionFailure) {
      setActionError(getApiErrorMessage(actionFailure, fallbackMessage))
    } finally {
      setBusyKey(null)
    }
  }

  function handleQuantity(cart, item, quantity) {
    if (quantity < 1 || quantity > 100) return
    const key = `update:${cart.cartId}:${item.medicineId}`
    runAction(
      key,
      () => updateItem(item.medicineId, quantity),
      'Unable to update this cart item.',
    )
  }

  function handleRemove(cart, item) {
    const key = `remove:${cart.cartId}:${item.medicineId}`
    runAction(
      key,
      () => removeItem(item.medicineId, cart.cartId),
      'Unable to remove this cart item.',
    )
  }

  function handleClear(cart) {
    runAction(
      `clear:${cart.cartId}`,
      () => clearCart(cart.cartId),
      'Unable to clear this cart.',
    )
  }

  if (loading && carts.length === 0) {
    return (
      <WorkspaceShell user={user}>
        <div className="py-6 lg:py-10">
          <LoadingState label="Loading your cart…" />
        </div>
      </WorkspaceShell>
    )
  }

  if (error && carts.length === 0) {
    return (
      <WorkspaceShell user={user}>
        <div className="py-6 lg:py-10">
          <ErrorState message={error} onRetry={refresh} />
        </div>
      </WorkspaceShell>
    )
  }

  return (
    <WorkspaceShell user={user}>
      <div className="py-2 lg:py-4">
        <section>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            Pharmacy cart
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Review medicines grouped by pharmacy, update quantities, and confirm
            current availability before ordering.
          </p>
        </section>

        {actionError ? (
          <div
            role="alert"
            className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {actionError}
          </div>
        ) : null}

        {carts.length === 0 ? (
          <section className="mt-6 rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Your cart is empty
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">
              Browse medicines listed by approved pharmacies and add what you
              need. Items from different pharmacies stay in separate carts.
            </p>
            <Link
              to="/medicines"
              className="mt-5 inline-block rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
            >
              Browse medicines
            </Link>
          </section>
        ) : (
          <>
            <div className="mt-6 space-y-6">
              {carts.map((cart) => {
                const pharmacy = cart.pharmacy
                const checkoutBlocker = cartCheckoutBlocker(cart)
                const location = [
                  [pharmacy.city, pharmacy.state].filter(Boolean).join(', '),
                  pharmacy.pincode ? `PIN ${pharmacy.pincode}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')

                return (
                  <section
                    key={cart.cartId}
                    className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-base font-semibold text-slate-900">
                            {pharmacy.pharmacyName || 'Pharmacy unavailable'}
                          </h2>
                          <span
                            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              cart.pharmacyAvailable
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {cart.pharmacyAvailable
                              ? 'Verified pharmacy'
                              : 'Unavailable'}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                          {location || 'Location not listed'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleClear(cart)}
                        disabled={busyKey !== null}
                        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {busyKey === `clear:${cart.cartId}`
                          ? 'Clearing…'
                          : 'Clear cart'}
                      </button>
                    </div>

                    {!cart.pharmacyAvailable ? (
                      <p className="border-b border-red-100 bg-red-50 px-5 py-3 text-sm text-red-700 sm:px-6">
                        This pharmacy is no longer available. Clear this cart or
                        remove its items before adding medicines from another
                        pharmacy.
                      </p>
                    ) : null}

                    <ul>
                      {cart.items.map((item) => (
                        <CartItem
                          key={item.medicineId}
                          cart={cart}
                          item={item}
                          busy={busyKey !== null}
                          busyKey={busyKey}
                          onQuantity={handleQuantity}
                          onRemove={(selectedItem) =>
                            handleRemove(cart, selectedItem)
                          }
                        />
                      ))}
                    </ul>

                    <div className="border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm text-slate-600">
                          {cart.itemCount}{' '}
                          {cart.itemCount === 1 ? 'medicine' : 'medicines'} ·{' '}
                          {cart.totalQuantity}{' '}
                          {cart.totalQuantity === 1 ? 'unit' : 'units'}
                        </p>
                        <p className="text-sm font-semibold text-slate-900">
                          Subtotal {formatMedicinePrice(cart.subtotal)}
                        </p>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                        {checkoutBlocker ? (
                          <p className="max-w-xl text-xs leading-relaxed text-amber-700">
                            {checkoutBlocker}
                          </p>
                        ) : (
                          <p className="text-xs text-slate-500">
                            Cash on Delivery · this pharmacy is ordered
                            separately from other carts.
                          </p>
                        )}
                        {checkoutBlocker ? (
                          <span className="cursor-not-allowed rounded-md bg-slate-300 px-4 py-2 text-sm font-medium text-white">
                            Proceed to checkout
                          </span>
                        ) : (
                          <Link
                            to={`/checkout/${cart.cartId}`}
                            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
                          >
                            Proceed to checkout
                          </Link>
                        )}
                      </div>
                    </div>
                  </section>
                )
              })}
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-3">
              <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
                <h2 className="text-base font-semibold text-slate-900">
                  Before you order
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  Cart totals use the price recorded when each medicine was
                  added. Pharmacy stock and prices can change, so availability
                  is checked again before an order is placed.
                </p>
                <p className="mt-3 rounded-md bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-500">
                  Orders use Cash on Delivery in this phase. No online payment
                  is collected and delivery tracking is not available. Each
                  pharmacy cart becomes a separate order.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-4">
                  <Link
                    to="/medicines"
                    className="text-sm font-medium text-brand-600 transition hover:text-brand-700"
                  >
                    Continue shopping
                  </Link>
                  <Link
                    to="/orders"
                    className="text-sm font-medium text-brand-600 transition hover:text-brand-700"
                  >
                    View my orders
                  </Link>
                </div>
              </section>

              <aside className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-base font-semibold text-slate-900">
                  Cart summary
                </h2>
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-slate-500">Pharmacies</dt>
                    <dd className="font-medium text-slate-900">
                      {summary.cartCount}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-slate-500">Medicines</dt>
                    <dd className="font-medium text-slate-900">
                      {summary.itemCount}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-slate-500">Total units</dt>
                    <dd className="font-medium text-slate-900">
                      {summary.totalQuantity}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-3">
                    <dt className="font-medium text-slate-900">Subtotal</dt>
                    <dd className="text-lg font-semibold text-slate-900">
                      {formatMedicinePrice(summary.subtotal)}
                    </dd>
                  </div>
                </dl>
              </aside>
            </div>
          </>
        )}
      </div>
    </WorkspaceShell>
  )
}
