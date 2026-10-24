export const ORDER_STATUS_LABELS = {
  PLACED: 'Placed',
  CONFIRMED: 'Confirmed',
  PROCESSING: 'Processing',
  READY: 'Ready',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
}

export const ORDER_STATUS_STYLES = {
  PLACED: 'bg-sky-100 text-sky-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  PROCESSING: 'bg-amber-100 text-amber-800',
  READY: 'bg-indigo-100 text-indigo-800',
  OUT_FOR_DELIVERY: 'bg-violet-100 text-violet-800',
  DELIVERED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-slate-200 text-slate-700',
}

export const ORDER_TIMELINE_STATUSES = [
  'PLACED',
  'CONFIRMED',
  'PROCESSING',
  'READY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
]

export const CANCELLED_TIMELINE_STATUSES = ['PLACED', 'CANCELLED']

export const ORDER_STATUS_DESCRIPTIONS = {
  PLACED: 'Your order has been placed successfully.',
  CONFIRMED: 'The pharmacy has confirmed your order.',
  PROCESSING: 'The pharmacy is preparing your medicines.',
  READY: 'Your order is ready for delivery.',
  OUT_FOR_DELIVERY: 'Your order is out for delivery.',
  DELIVERED: 'Your order has been delivered.',
  CANCELLED: 'Your order has been cancelled.',
}

export const ORDER_STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  ...Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => ({
    value,
    label,
  })),
]

export const ORDER_SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'total_desc', label: 'Total (high to low)' },
  { value: 'total_asc', label: 'Total (low to high)' },
]

export const PHARMACY_ORDER_STATUS_ACTIONS = {
  PLACED: [
    {
      status: 'CONFIRMED',
      label: 'Confirm order',
      confirmTitle: 'Confirm this order?',
      confirmDescription:
        'The patient will see that this order has been confirmed.',
      confirmLabel: 'Confirm order',
    },
    {
      status: 'CANCELLED',
      label: 'Cancel order',
      confirmTitle: 'Cancel this order?',
      confirmDescription:
        'This cancels the order permanently. No refund is processed and the payment status will not change.',
      confirmLabel: 'Cancel order',
      danger: true,
    },
  ],
  CONFIRMED: [
    {
      status: 'PROCESSING',
      label: 'Start processing',
      confirmTitle: 'Start processing this order?',
      confirmDescription:
        'The patient will see that this order is being prepared.',
      confirmLabel: 'Start processing',
    },
    {
      status: 'CANCELLED',
      label: 'Cancel order',
      confirmTitle: 'Cancel this order?',
      confirmDescription:
        'This cancels the order permanently. No refund is processed and the payment status will not change.',
      confirmLabel: 'Cancel order',
      danger: true,
    },
  ],
  PROCESSING: [
    {
      status: 'READY',
      label: 'Mark ready',
      confirmTitle: 'Mark this order as ready?',
      confirmDescription:
        'The patient will see that this order is ready for the next step.',
      confirmLabel: 'Mark ready',
    },
  ],
  READY: [
    {
      status: 'OUT_FOR_DELIVERY',
      label: 'Out for delivery',
      confirmTitle: 'Mark this order out for delivery?',
      confirmDescription:
        'The patient will see that this order is out for delivery.',
      confirmLabel: 'Mark out for delivery',
    },
  ],
  OUT_FOR_DELIVERY: [
    {
      status: 'DELIVERED',
      label: 'Mark delivered',
      confirmTitle: 'Mark this order as delivered?',
      confirmDescription:
        'This completes the order. The payment status will remain unchanged.',
      confirmLabel: 'Mark delivered',
    },
  ],
  DELIVERED: [],
  CANCELLED: [],
}

export const PHARMACY_ORDER_SUMMARY_CARDS = [
  {
    key: 'placed',
    status: 'PLACED',
    label: 'New Orders',
    cardClass: 'border-sky-200 bg-sky-50',
    valueClass: 'text-sky-900',
    labelClass: 'text-sky-700',
  },
  {
    key: 'confirmed',
    status: 'CONFIRMED',
    label: 'Confirmed',
    cardClass: 'border-blue-200 bg-blue-50',
    valueClass: 'text-blue-900',
    labelClass: 'text-blue-700',
  },
  {
    key: 'processing',
    status: 'PROCESSING',
    label: 'Processing',
    cardClass: 'border-amber-200 bg-amber-50',
    valueClass: 'text-amber-900',
    labelClass: 'text-amber-700',
  },
  {
    key: 'ready',
    status: 'READY',
    label: 'Ready',
    cardClass: 'border-indigo-200 bg-indigo-50',
    valueClass: 'text-indigo-900',
    labelClass: 'text-indigo-700',
  },
  {
    key: 'outForDelivery',
    status: 'OUT_FOR_DELIVERY',
    label: 'Out for Delivery',
    cardClass: 'border-violet-200 bg-violet-50',
    valueClass: 'text-violet-900',
    labelClass: 'text-violet-700',
  },
  {
    key: 'delivered',
    status: 'DELIVERED',
    label: 'Delivered',
    cardClass: 'border-green-200 bg-green-50',
    valueClass: 'text-green-900',
    labelClass: 'text-green-700',
  },
  {
    key: 'cancelled',
    status: 'CANCELLED',
    label: 'Cancelled',
    cardClass: 'border-slate-200 bg-slate-50',
    valueClass: 'text-slate-900',
    labelClass: 'text-slate-600',
  },
]

export function shortOrderId(orderId) {
  const value = String(orderId || '')
  return value.length > 8 ? value.slice(-8).toUpperCase() : value.toUpperCase()
}

export const PAYMENT_STATUS_LABELS = {
  PENDING: 'Payment pending',
  PAID: 'Paid',
  FAILED: 'Payment failed',
  CANCELLED: 'Payment cancelled',
}

export const PAYMENT_STATUS_STYLES = {
  PENDING: 'bg-amber-100 text-amber-800',
  PAID: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-slate-200 text-slate-700',
}

export const PAYMENT_METHOD_LABELS = {
  COD: 'Cash on Delivery',
}

export const DEFAULT_PAYMENT_METHOD = 'COD'

export const PRESCRIPTION_STATUS_LABELS = {
  NOT_REQUIRED: 'No prescription required',
  VERIFIED: 'Prescription verified',
}

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

const dateTimeFormatter = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

export function orderStatusLabel(status) {
  return ORDER_STATUS_LABELS[status] || status || 'Unknown'
}

export function paymentStatusLabel(status) {
  return PAYMENT_STATUS_LABELS[status] || status || 'Unknown'
}

export function paymentMethodLabel(method) {
  return PAYMENT_METHOD_LABELS[method] || method || 'Not specified'
}

export function prescriptionStatusLabel(status) {
  return PRESCRIPTION_STATUS_LABELS[status] || status || 'Unknown'
}

export function formatOrderDate(value, { withTime = false } = {}) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return (withTime ? dateTimeFormatter : dateFormatter).format(date)
}

export function normalizeMedicineName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

export function prescriptionCoversItem(prescription, item) {
  const prescribedNames = Array.isArray(prescription?.medicines)
    ? prescription.medicines.map((medicine) =>
        normalizeMedicineName(medicine.medicineName),
      )
    : []
  const candidates = [
    normalizeMedicineName(item?.name),
    normalizeMedicineName(item?.genericName),
  ].filter(Boolean)

  return candidates.some((candidate) => prescribedNames.includes(candidate))
}

export function cartCheckoutBlocker(cart) {
  if (!cart?.pharmacyAvailable) {
    return 'This pharmacy is no longer available for checkout.'
  }
  if (cart.items.some((item) => item.priceChanged)) {
    return 'A medicine price has changed. Remove and re-add it from the medicine page before checking out.'
  }
  if (cart.items.some((item) => !item.available)) {
    return 'One or more medicines are no longer available in the requested quantity. Update the cart before checking out.'
  }
  return null
}

export function matchingPrescriptions(prescriptions, item) {
  return prescriptions.filter(
    (prescription) =>
      prescription.status === 'ACTIVE' &&
      prescriptionCoversItem(prescription, item),
  )
}

export function addressLines(address) {
  const locality = [address?.city, address?.state].filter(Boolean).join(', ')
  const region = [locality, address?.pincode].filter(Boolean).join(' ')
  return [
    [address?.addressLine1, address?.addressLine2].filter(Boolean).join(', '),
    address?.landmark,
    region,
  ].filter(Boolean)
}
