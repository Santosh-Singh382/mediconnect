export function homePathFor(user) {
  if (user?.role === 'PATIENT') return '/patient/dashboard'
  if (user?.role === 'DOCTOR') return '/doctor/dashboard'
  return '/account'
}

export function homeLinksFor(user) {
  if (user?.role === 'PATIENT') {
    return [
      { to: '/patient/dashboard', label: 'Dashboard' },
      { to: '/patient/profile', label: 'Profile' },
      { to: '/appointments', label: 'My Appointments' },
      { to: '/prescriptions', label: 'Prescriptions' },
      { to: '/medical-records', label: 'Medical Records' },
      { to: '/doctors', label: 'Find a Doctor' },
    ]
  }
  if (user?.role === 'DOCTOR') {
    return [
      { to: '/doctor/dashboard', label: 'Dashboard' },
      { to: '/doctor/profile', label: 'Profile' },
      { to: '/doctor/appointments', label: 'Appointments' },
      { to: '/prescriptions', label: 'Prescriptions' },
      { to: '/medical-records', label: 'Medical Records' },
    ]
  }
  return []
}