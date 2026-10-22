export const RECORD_TYPE_LABELS = {
  CONSULTATION: 'Consultation',
  DIAGNOSIS: 'Diagnosis',
  LAB_REPORT: 'Lab report',
  PRESCRIPTION: 'Prescription',
  OTHER: 'Other',
}

export const RECORD_TYPE_STYLES = {
  CONSULTATION: 'bg-teal-100 text-teal-800',
  DIAGNOSIS: 'bg-indigo-100 text-indigo-800',
  LAB_REPORT: 'bg-amber-100 text-amber-800',
  PRESCRIPTION: 'bg-blue-100 text-blue-800',
  OTHER: 'bg-slate-200 text-slate-700',
}

export const RECORD_TYPE_OPTIONS = [
  { value: '', label: 'All record types' },
  ...Object.entries(RECORD_TYPE_LABELS).map(([value, label]) => ({
    value,
    label,
  })),
]

export function recordTypeLabel(type) {
  return RECORD_TYPE_LABELS[type] || type
}

export function recordTypeClass(type) {
  return RECORD_TYPE_STYLES[type] || RECORD_TYPE_STYLES.OTHER
}

export function formatRecordDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function formatRecordTimestamp(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}
