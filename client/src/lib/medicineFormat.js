export const MEDICINE_CATEGORY_OPTIONS = [
  { value: 'TABLET', label: 'Tablet' },
  { value: 'CAPSULE', label: 'Capsule' },
  { value: 'SYRUP', label: 'Syrup' },
  { value: 'INJECTION', label: 'Injection' },
  { value: 'CREAM', label: 'Cream' },
  { value: 'OINTMENT', label: 'Ointment' },
  { value: 'DROPS', label: 'Drops' },
  { value: 'INHALER', label: 'Inhaler' },
  { value: 'POWDER', label: 'Powder' },
  { value: 'OTHER', label: 'Other' },
]

export const MEDICINE_CATEGORY_FILTER_OPTIONS = [
  { value: '', label: 'All categories' },
  ...MEDICINE_CATEGORY_OPTIONS,
]

export const MEDICINE_SORT_OPTIONS = [
  { value: '', label: 'Name (A–Z)' },
  { value: 'name_desc', label: 'Name (Z–A)' },
  { value: 'price_asc', label: 'Price (low to high)' },
  { value: 'price_desc', label: 'Price (high to low)' },
  { value: 'stock_asc', label: 'Stock (low to high)' },
  { value: 'stock_desc', label: 'Stock (high to low)' },
  { value: 'expiry_asc', label: 'Expiry (earliest first)' },
  { value: 'expiry_desc', label: 'Expiry (latest first)' },
]

const CATEGORY_LABELS = Object.fromEntries(
  MEDICINE_CATEGORY_OPTIONS.map((option) => [option.value, option.label]),
)

const priceFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

export function medicineCategoryLabel(category) {
  return CATEGORY_LABELS[category] || category || '—'
}

export function formatMedicinePrice(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—'
  }
  return priceFormatter.format(value)
}

export function formatExpiryDate(value) {
  if (!value) {
    return '—'
  }
  const parsed = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return dateFormatter.format(parsed)
}
