const dateTimeFormatter = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

export const NOTIFICATION_TYPE_STYLES = {
  ORDER_PLACED: 'bg-sky-100 text-sky-700',
  ORDER_CONFIRMED: 'bg-blue-100 text-blue-700',
  ORDER_PROCESSING: 'bg-amber-100 text-amber-700',
  ORDER_READY: 'bg-indigo-100 text-indigo-700',
  ORDER_OUT_FOR_DELIVERY: 'bg-violet-100 text-violet-700',
  ORDER_DELIVERED: 'bg-green-100 text-green-700',
  ORDER_CANCELLED: 'bg-slate-200 text-slate-600',
  NEW_ORDER: 'bg-brand-100 text-brand-700',
  DOCTOR_APPROVED: 'bg-green-100 text-green-700',
  DOCTOR_REJECTED: 'bg-red-100 text-red-700',
  PHARMACY_APPROVED: 'bg-green-100 text-green-700',
  PHARMACY_REJECTED: 'bg-red-100 text-red-700',
}

export function formatNotificationDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return dateTimeFormatter.format(date)
}

export function notificationOrderPath(notification, role) {
  if (
    !notification ||
    notification.referenceType !== 'ORDER' ||
    !notification.referenceId
  ) {
    return null
  }

  if (role === 'ADMIN') {
    return `/admin/orders/${notification.referenceId}`
  }
  if (role === 'PHARMACY') {
    return `/pharmacy/orders/${notification.referenceId}`
  }
  if (role === 'PATIENT') {
    return `/orders/${notification.referenceId}`
  }
  return null
}

export function notificationPath(notification, role) {
  const orderPath = notificationOrderPath(notification, role)
  if (orderPath) {
    return orderPath
  }

  if (!notification || !notification.referenceId) {
    return null
  }

  if (notification.referenceType === 'DOCTOR_PROFILE') {
    if (role === 'DOCTOR') return '/doctor/profile'
    if (role === 'ADMIN') return '/admin/doctors'
    return null
  }

  if (notification.referenceType === 'PHARMACY_PROFILE') {
    if (role === 'PHARMACY') return '/pharmacy/profile'
    if (role === 'ADMIN') return '/admin/pharmacies'
    return null
  }

  return null
}

export function notificationLinkLabel(notification) {
  if (notification?.referenceType === 'ORDER') return 'View order'
  if (
    notification?.referenceType === 'DOCTOR_PROFILE' ||
    notification?.referenceType === 'PHARMACY_PROFILE'
  ) {
    return 'View profile'
  }
  return 'View details'
}
