import { formatOrderDate } from './orderFormat.js'

export const VERIFICATION_STYLES = {
  PENDING: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
}

export const VERIFICATION_OPTIONS = [
  { value: '', label: 'All verification statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
]

export const ADMIN_SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'name_asc', label: 'Name A–Z' },
  { value: 'name_desc', label: 'Name Z–A' },
]

export const BOOLEAN_FILTER_OPTIONS = [
  { value: '', label: 'Any' },
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
]

export const ROLE_STYLES = {
  PATIENT: 'bg-sky-100 text-sky-800',
  DOCTOR: 'bg-indigo-100 text-indigo-800',
  PHARMACY: 'bg-emerald-100 text-emerald-800',
  ADMIN: 'bg-slate-200 text-slate-800',
}

export const ROLE_BADGE_VARIANTS = {
  PATIENT: 'info',
  DOCTOR: 'primary',
  PHARMACY: 'success',
  ADMIN: 'neutral',
}

export const ROLE_OPTIONS = [
  { value: '', label: 'All roles' },
  { value: 'PATIENT', label: 'Patient' },
  { value: 'DOCTOR', label: 'Doctor' },
  { value: 'PHARMACY', label: 'Pharmacy' },
  { value: 'ADMIN', label: 'Admin' },
]

export function verificationLabel(status) {
  if (status === 'PENDING') return 'Pending'
  if (status === 'APPROVED') return 'Approved'
  if (status === 'REJECTED') return 'Rejected'
  return status || 'Unknown'
}

export function roleLabel(role) {
  if (!role) return 'Unknown'
  return role.charAt(0) + role.slice(1).toLowerCase()
}

export function formatAdminDate(value, { withTime = false } = {}) {
  return formatOrderDate(value, { withTime })
}
