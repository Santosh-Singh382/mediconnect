export const DOCUMENT_TYPE_LABELS = {
  LAB_REPORT: 'Lab Report',
  PRESCRIPTION: 'Prescription',
  SCAN_REPORT: 'Scan Report',
  DISCHARGE_SUMMARY: 'Discharge Summary',
  MEDICAL_CERTIFICATE: 'Medical Certificate',
  CONSULTATION_DOCUMENT: 'Consultation Document',
  OTHER: 'Other',
}

export const DOCUMENT_TYPE_STYLES = {
  LAB_REPORT: 'bg-amber-100 text-amber-800',
  PRESCRIPTION: 'bg-blue-100 text-blue-800',
  SCAN_REPORT: 'bg-indigo-100 text-indigo-800',
  DISCHARGE_SUMMARY: 'bg-teal-100 text-teal-800',
  MEDICAL_CERTIFICATE: 'bg-purple-100 text-purple-800',
  CONSULTATION_DOCUMENT: 'bg-emerald-100 text-emerald-800',
  OTHER: 'bg-slate-200 text-slate-700',
}

export const DOCUMENT_TYPE_OPTIONS = Object.entries(DOCUMENT_TYPE_LABELS).map(
  ([value, label]) => ({ value, label }),
)

export const ACCEPTED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png']
export const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
]
export const MAX_FILE_SIZE_MB = 10
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

export function documentTypeLabel(type) {
  return DOCUMENT_TYPE_LABELS[type] || type
}

export function documentTypeClass(type) {
  return DOCUMENT_TYPE_STYLES[type] || DOCUMENT_TYPE_STYLES.OTHER
}

export function formatFileSize(bytes) {
  if (!bytes || bytes < 0) return ''
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatDocumentDate(value) {
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

export function fileExtension(name) {
  const index = String(name || '').lastIndexOf('.')
  return index === -1 ? '' : String(name).slice(index).toLowerCase()
}
