import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import AppHeader from '../components/AppHeader.jsx'
import LoadingState from '../components/LoadingState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import PaymentStatusBadge from '../components/PaymentStatusBadge.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { useCart } from '../hooks/useCart.js'
import { getApiErrorMessage } from '../lib/apiError.js'
import { checkoutOrder, createIdempotencyKey } from '../lib/orderApi.js'
import {
  cartCheckoutBlocker,
  DEFAULT_PAYMENT_METHOD,
  formatOrderDate,
  matchingPrescriptions,
} from '../lib/orderFormat.js'
import { getMyPrescriptions } from '../lib/prescriptionApi.js'
import { formatMedicinePrice } from '../lib/medicineFormat.js'
import { inputClass } from '../lib/formStyles.js'
import { homePathFor, homeLinksFor } from '../lib/homePath.js'

const PHONE_PATTERN = /^\+?[0-9\s()-]{7,20}$/
const PINCODE_PATTERN = /^[1-9][0-9]{5}$/

const EMPTY_ADDRESS = {
  fullName: '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  pincode: '',
  landmark: '',
}

function Field({ id, label, error, children }) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-slate-700"
      >
        {label}
      </label>
      {children}
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  )
}

function validationDetails(error) {
  const details = error?.response?.data?.details
  return Array.isArray(details) ? details : []
}

function validateAddress(address) {
  const errors = {}
  const fullName = address.fullName.trim()
  const phone = address.phone.trim()
  const addressLine1 = address.addressLine1.trim()
  const addressLine2 = address.addressLine2.trim()
  const city = address.city.trim()
  const state = address.state.trim()
  const pincode = address.pincode.trim()
  const landmark = address.landmark.trim()

  if (!fullName) {
    errors.fullName = 'Full name is required.'
  } else if (fullName.length > 200) {
    errors.fullName = 'Full name cannot exceed 200 characters.'
  }

  if (!phone) {
    errors.phone = 'Phone number is required.'
  } else if (!PHONE_PATTERN.test(phone) || phone.length > 20) {
    errors.phone = 'Enter a valid phone number.'
  }

  if (!addressLine1) {
    errors.addressLine1 = 'Address line 1 is required.'
  } else if (addressLine1.length > 200) {
    errors.addressLine1 = 'Address line 1 cannot exceed 200 characters.'
  }

  if (addressLine2.length > 200) {
    errors.addressLine2 = 'Address line 2 cannot exceed 200 characters.'
  }

  if (!city) {
    errors.city = 'City is required.'
  } else if (city.length > 100) {
    errors.city = 'City cannot exceed 100 characters.'
  }

  if (!state) {
    errors.state = 'State is required.'
  } else if (state.length > 100) {
    errors.state = 'State cannot exceed 100 characters.'
  }

  if (!PINCODE_PATTERN.test(pincode)) {
    errors.pincode = 'Pincode must be a valid 6-digit Indian pincode.'
  }

  if (landmark.length > 200) {
    errors.landmark = 'Landmark cannot exceed 200 characters.'
  }

  return {
    errors,
    value: {
      fullName,
      phone,
      addressLine1,
      addressLine2: addressLine2 || null,
      city,
      state,
      pincode,
      landmark: landmark || null,
    },
  }
}

export default function PharmacyCheckoutPage() {
  const { user } = useAuth()
  const { cartId } = useParams()
  const navigate = useNavigate()
  const {
    carts,
    loading: cartLoading,
    error: cartError,
    refresh,
  } = useCart()

  const cart = carts.find((item) => item.cartId === cartId) || null
  const requiredItems = useMemo(
    () => (cart ? cart.items.filter((item) => item.prescriptionRequired) : []),
    [cart],
  )
  const blocker = cart ? cartCheckoutBlocker(cart) : null

  const [address, setAddress] = useState(() => ({
    ...EMPTY_ADDRESS,
    fullName: user?.name || '',
    phone: user?.phone || '',
  }))
  const [fieldErrors, setFieldErrors] = useState({})
  const [prescriptionState, setPrescriptionState] = useState({
    loading: true,
    error: null,
    prescriptions: [],
  })
  const [selections, setSelections] = useState({})
  const [prescriptionErrors, setPrescriptionErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [submitDetails, setSubmitDetails] = useState([])
  const submittingRef = useRef(false)
  const idempotencyKeyRef = useRef(null)

  const loadPrescriptions = useCallback(() => {
    getMyPrescriptions()
      .then((response) => {
        setPrescriptionState({
          loading: false,
          error: null,
          prescriptions: response.data.data.prescriptions || [],
        })
      })
      .catch((error) => {
        setPrescriptionState({
          loading: false,
          error: getApiErrorMessage(
            error,
            'Unable to load your prescriptions right now.',
          ),
          prescriptions: [],
        })
      })
  }, [])

  useEffect(() => {
    loadPrescriptions()
  }, [loadPrescriptions])

  function retryPrescriptions() {
    setPrescriptionState({ loading: true, error: null, prescriptions: [] })
    loadPrescriptions()
  }

  function updateAddress(field, value) {
    setAddress((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
    setSubmitError(null)
    setSubmitDetails([])
  }

  function selectPrescription(medicineId, prescriptionId) {
    setSelections((current) => ({ ...current, [medicineId]: prescriptionId }))
    setPrescriptionErrors((current) => {
      if (!current[medicineId]) return current
      const next = { ...current }
      delete next[medicineId]
      return next
    })
    setSubmitError(null)
    setSubmitDetails([])
  }

  function selectedPrescriptionId(item) {
    const options = matchingPrescriptions(prescriptionState.prescriptions, item)
    const selectedId = selections[item.medicineId]

    if (
      selectedId &&
      options.some((prescription) => prescription.id === selectedId)
    ) {
      return selectedId
    }
    return options.length === 1 ? options[0].id : ''
  }

  function validateCheckout() {
    const { errors, value } = validateAddress(address)
    const nextPrescriptionErrors = {}

    for (const item of requiredItems) {
      if (!selectedPrescriptionId(item)) {
        nextPrescriptionErrors[item.medicineId] =
          'Select an active prescription that includes this medicine.'
      }
    }

    setFieldErrors(errors)
    setPrescriptionErrors(nextPrescriptionErrors)
    return {
      valid:
        Object.keys(errors).length === 0 &&
        Object.keys(nextPrescriptionErrors).length === 0 &&
        !blocker,
      address: value,
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (submittingRef.current || !cart) return
    if (prescriptionState.loading) return

    setSubmitError(null)
    setSubmitDetails([])

    const validation = validateCheckout()
    if (!validation.valid) return

    const prescriptionSelections = requiredItems.map((item) => ({
      medicineId: item.medicineId,
      prescriptionId: selectedPrescriptionId(item),
    }))

    submittingRef.current = true
    setSubmitting(true)
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = createIdempotencyKey()
    }

    try {
      const response = await checkoutOrder(
        {
          cartId: cart.cartId,
          deliveryAddress: validation.address,
          paymentMethod: DEFAULT_PAYMENT_METHOD,
          prescriptionSelections,
        },
        idempotencyKeyRef.current,
      )
      const order = response.data.data.order
      await refresh()
      navigate(`/orders/${order.orderId}/success`, {
        replace: true,
        state: { order },
      })
    } catch (error) {
      setSubmitError(
        getApiErrorMessage(
          error,
          'Unable to place your order. Please try again.',
        ),
      )
      setSubmitDetails(validationDetails(error))
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  const missingPrescriptions = requiredItems.filter(
    (item) => !selectedPrescriptionId(item),
  )

  const allPrescriptionsSelected = missingPrescriptions.length === 0
  const submitDisabled =
    submitting ||
    prescriptionState.loading ||
    (requiredItems.length > 0 && !allPrescriptionsSelected) ||
    Boolean(blocker)

  const header = (
    <AppHeader home={homePathFor(user)} links={homeLinksFor(user)} />
  )

  if (cartLoading && !cart) {
    return (
      <div className="min-h-screen bg-slate-50">
        {header}
        <main className="mx-auto max-w-5xl px-6 py-12">
          <LoadingState label="Loading checkout…" />
        </main>
      </div>
    )
  }

  if (!cart) {
    return (
      <div className="min-h-screen bg-slate-50">
        {header}
        <main className="mx-auto max-w-3xl px-6 py-12">
          {cartError ? (
            <ErrorState message={cartError} onRetry={refresh} />
          ) : (
            <div className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
              <h1 className="text-lg font-semibold text-slate-900">
                This cart is no longer available
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                It may have already been ordered or cleared.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <Link
                  to="/orders"
                  className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
                >
                  View my orders
                </Link>
                <Link
                  to="/cart"
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Back to cart
                </Link>
              </div>
            </div>
          )}
        </main>
      </div>
    )
  }

  const pharmacy = cart.pharmacy
  const pharmacyLocation = [
    [pharmacy.city, pharmacy.state].filter(Boolean).join(', '),
    pharmacy.pincode ? `PIN ${pharmacy.pincode}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="min-h-screen bg-slate-50">
      {header}

      <main className="mx-auto max-w-5xl px-6 py-10">
        <Link
          to="/cart"
          className="text-sm font-medium text-brand-600 transition hover:text-brand-700"
        >
          &larr; Back to cart
        </Link>

        <header className="mt-4">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            Checkout
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Confirm your delivery details and prescription references. Stock
            and prices are checked again when you place the order.
          </p>
        </header>

        <section className="mt-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            {pharmacy.pharmacyName || 'Pharmacy'}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {pharmacyLocation || 'Location not listed'}
          </p>
        </section>

        {blocker ? (
          <div
            role="alert"
            className="mt-5 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
          >
            <p>{blocker}</p>
            <Link
              to="/cart"
              className="mt-2 inline-block font-medium text-amber-900 underline"
            >
              Review your cart
            </Link>
          </div>
        ) : null}

        {submitError ? (
          <div
            role="alert"
            className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            <p className="font-medium">{submitError}</p>
            {submitDetails.length > 0 ? (
              <ul className="mt-2 list-inside list-disc space-y-1 text-xs">
                {submitDetails.map((detail, index) => (
                  <li key={`${detail.field || 'detail'}-${index}`}>
                    {detail.medicineName ? `${detail.medicineName}: ` : ''}
                    {detail.message || detail.field}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <form
          onSubmit={handleSubmit}
          className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"
        >
          <div className="space-y-6">
            <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">
                Delivery address
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field
                  id="fullName"
                  label="Full name"
                  error={fieldErrors.fullName}
                >
                  <input
                    id="fullName"
                    type="text"
                    autoComplete="name"
                    value={address.fullName}
                    onChange={(event) =>
                      updateAddress('fullName', event.target.value)
                    }
                    className={inputClass}
                  />
                </Field>

                <Field
                  id="phone"
                  label="Phone number"
                  error={fieldErrors.phone}
                >
                  <input
                    id="phone"
                    type="tel"
                    autoComplete="tel"
                    value={address.phone}
                    onChange={(event) =>
                      updateAddress('phone', event.target.value)
                    }
                    className={inputClass}
                  />
                </Field>

                <div className="sm:col-span-2">
                  <Field
                    id="addressLine1"
                    label="Address line 1"
                    error={fieldErrors.addressLine1}
                  >
                    <input
                      id="addressLine1"
                      type="text"
                      autoComplete="address-line1"
                      value={address.addressLine1}
                      onChange={(event) =>
                        updateAddress('addressLine1', event.target.value)
                      }
                      className={inputClass}
                    />
                  </Field>
                </div>

                <div className="sm:col-span-2">
                  <Field
                    id="addressLine2"
                    label="Address line 2 (optional)"
                    error={fieldErrors.addressLine2}
                  >
                    <input
                      id="addressLine2"
                      type="text"
                      autoComplete="address-line2"
                      value={address.addressLine2}
                      onChange={(event) =>
                        updateAddress('addressLine2', event.target.value)
                      }
                      className={inputClass}
                    />
                  </Field>
                </div>

                <Field id="city" label="City" error={fieldErrors.city}>
                  <input
                    id="city"
                    type="text"
                    autoComplete="address-level2"
                    value={address.city}
                    onChange={(event) =>
                      updateAddress('city', event.target.value)
                    }
                    className={inputClass}
                  />
                </Field>

                <Field id="state" label="State" error={fieldErrors.state}>
                  <input
                    id="state"
                    type="text"
                    autoComplete="address-level1"
                    value={address.state}
                    onChange={(event) =>
                      updateAddress('state', event.target.value)
                    }
                    className={inputClass}
                  />
                </Field>

                <Field
                  id="pincode"
                  label="Pincode"
                  error={fieldErrors.pincode}
                >
                  <input
                    id="pincode"
                    type="text"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    maxLength={6}
                    value={address.pincode}
                    onChange={(event) =>
                      updateAddress('pincode', event.target.value)
                    }
                    className={inputClass}
                  />
                </Field>

                <Field
                  id="landmark"
                  label="Landmark (optional)"
                  error={fieldErrors.landmark}
                >
                  <input
                    id="landmark"
                    type="text"
                    value={address.landmark}
                    onChange={(event) =>
                      updateAddress('landmark', event.target.value)
                    }
                    className={inputClass}
                  />
                </Field>
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900">
                Prescriptions
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Prescription-required medicines must reference an active
                prescription issued to you. The pharmacy order stores the
                prescription reference securely.
              </p>

              {prescriptionState.loading ? (
                <p className="mt-4 text-sm text-slate-500">
                  Loading your prescriptions…
                </p>
              ) : prescriptionState.error ? (
                <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <p>{prescriptionState.error}</p>
                  <button
                    type="button"
                    onClick={retryPrescriptions}
                    className="mt-2 font-medium underline"
                  >
                    Try again
                  </button>
                </div>
              ) : requiredItems.length === 0 ? (
                <p className="mt-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
                  No prescription is required for the medicines in this cart.
                </p>
              ) : (
                <div className="mt-4 space-y-5">
                  {requiredItems.map((item) => {
                    const options = matchingPrescriptions(
                      prescriptionState.prescriptions,
                      item,
                    )
                    const selectedId = selectedPrescriptionId(item)

                    return (
                      <div
                        key={item.medicineId}
                        className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                      >
                        <label
                          htmlFor={`prescription-${item.medicineId}`}
                          className="block text-sm font-semibold text-slate-900"
                        >
                          {item.name}
                        </label>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Prescription required for this medicine.
                        </p>

                        {options.length > 0 ? (
                          <>
                            <select
                              id={`prescription-${item.medicineId}`}
                              value={selectedId}
                              onChange={(event) =>
                                selectPrescription(
                                  item.medicineId,
                                  event.target.value,
                                )
                              }
                              className={inputClass}
                            >
                              <option value="">Select a prescription</option>
                              {options.map((prescription) => (
                                <option
                                  key={prescription.id}
                                  value={prescription.id}
                                >
                                  {`${formatOrderDate(prescription.createdAt)} — ${prescription.doctor?.name || 'Doctor'}`}
                                </option>
                              ))}
                            </select>
                            {selectedId ? (
                              <Link
                                to={`/prescriptions/${selectedId}`}
                                className="mt-2 inline-block text-xs font-medium text-brand-600 transition hover:text-brand-700"
                              >
                                View selected prescription
                              </Link>
                            ) : null}
                          </>
                        ) : (
                          <p className="mt-2 text-sm text-red-700">
                            No active prescription on your account includes
                            this medicine. View your prescriptions or consult a
                            doctor before ordering it.
                          </p>
                        )}

                        {prescriptionErrors[item.medicineId] ? (
                          <p className="mt-1 text-xs text-red-600">
                            {prescriptionErrors[item.medicineId]}
                          </p>
                        ) : null}

                        {options.length === 0 ? (
                          <Link
                            to="/prescriptions"
                            className="mt-2 inline-block text-xs font-medium text-brand-600 transition hover:text-brand-700"
                          >
                            View my prescriptions
                          </Link>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </div>

          <aside className="h-fit rounded-lg border border-slate-200 bg-white p-6 shadow-sm lg:sticky lg:top-6">
            <h2 className="text-base font-semibold text-slate-900">
              Order summary
            </h2>

            <ul className="mt-4 space-y-3">
              {cart.items.map((item) => (
                <li
                  key={item.medicineId}
                  className="flex items-start justify-between gap-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-slate-900">{item.name}</p>
                    <p className="text-xs text-slate-500">
                      {item.quantity} × {formatMedicinePrice(item.unitPrice)}
                    </p>
                  </div>
                  <p className="shrink-0 font-medium text-slate-900">
                    {formatMedicinePrice(item.subtotal)}
                  </p>
                </li>
              ))}
            </ul>

            <dl className="mt-5 space-y-2 border-t border-slate-100 pt-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Subtotal</dt>
                <dd className="font-medium text-slate-900">
                  {formatMedicinePrice(cart.subtotal)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Delivery fee</dt>
                <dd className="font-medium text-slate-900">
                  {formatMedicinePrice(0)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-base">
                <dt className="font-semibold text-slate-900">Total</dt>
                <dd className="font-semibold text-slate-900">
                  {formatMedicinePrice(cart.subtotal)}
                </dd>
              </div>
            </dl>

            <div className="mt-5 rounded-md border border-brand-200 bg-brand-50 px-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-brand-900">
                  Cash on Delivery
                </p>
                <PaymentStatusBadge status="PENDING" />
              </div>
              <p className="mt-1 text-xs leading-relaxed text-brand-800">
                Online payment is not currently available. Payment will be
                collected on delivery.
              </p>
            </div>

            <button
              type="submit"
              disabled={submitDisabled}
              className="mt-5 w-full rounded-md bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Placing order…' : 'Place order'}
            </button>

            {requiredItems.length > 0 && !allPrescriptionsSelected ? (
              <p className="mt-2 text-xs text-amber-700">
                Select a prescription for every prescription-required
                medicine.
              </p>
            ) : null}

            <Link
              to="/cart"
              className="mt-3 block text-center text-sm font-medium text-slate-600 transition hover:text-slate-900"
            >
              Return to cart
            </Link>
          </aside>
        </form>
      </main>
    </div>
  )
}
