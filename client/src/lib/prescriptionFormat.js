export const PRESCRIPTION_STATUS_STYLES = {
  ACTIVE: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-slate-200 text-slate-700',
}

export const MEDICINE_ROUTE_LABELS = {
  ORAL: 'Oral',
  TOPICAL: 'Topical',
  INHALATION: 'Inhalation',
  INJECTION: 'Injection',
  OPHTHALMIC: 'Ophthalmic',
  OTHER: 'Other',
}

export const MEDICINE_TIMING_LABELS = {
  BEFORE_MEAL: 'Before meal',
  AFTER_MEAL: 'After meal',
  WITH_MEAL: 'With meal',
  ANYTIME: 'Anytime',
}

export const MEDICINE_ROUTE_OPTIONS = [
  { value: '', label: 'Route (optional)' },
  ...Object.entries(MEDICINE_ROUTE_LABELS).map(([value, label]) => ({
    value,
    label,
  })),
]

export const MEDICINE_TIMING_OPTIONS = [
  { value: '', label: 'Timing (optional)' },
  ...Object.entries(MEDICINE_TIMING_LABELS).map(([value, label]) => ({
    value,
    label,
  })),
]

export function routeLabel(route) {
  if (!route) return 'Not specified'
  return MEDICINE_ROUTE_LABELS[route] || route
}

export function timingLabel(timing) {
  if (!timing) return 'Not specified'
  return MEDICINE_TIMING_LABELS[timing] || timing
}

export function formatTimestamp(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
