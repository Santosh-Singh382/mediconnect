export const PHARMACY_ORDER_ACCESS_MESSAGES = {
  PROFILE_REQUIRED: {
    title: 'Pharmacy profile required',
    message: 'Create your pharmacy profile before managing orders.',
    action: 'Create pharmacy profile',
  },
  PHARMACY_NOT_APPROVED: {
    title: 'Order management unavailable',
    message:
      'Your pharmacy profile must be approved before you can manage orders.',
    action: 'View pharmacy profile',
  },
  PHARMACY_REJECTED: {
    title: 'Order management unavailable',
    message:
      'Your pharmacy profile was rejected. Review your profile details before trying again.',
    action: 'View pharmacy profile',
  },
  PHARMACY_INACTIVE: {
    title: 'Order management unavailable',
    message:
      'Your pharmacy profile is inactive. Order management is unavailable.',
    action: 'View pharmacy profile',
  },
}

export function pharmacyOrderAccessState(code) {
  return PHARMACY_ORDER_ACCESS_MESSAGES[code] || null
}
