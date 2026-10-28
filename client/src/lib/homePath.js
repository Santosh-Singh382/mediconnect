export function homePathFor(user) {
  if (user?.role === 'PATIENT') return '/patient/dashboard'
  if (user?.role === 'DOCTOR') return '/doctor/dashboard'
  if (user?.role === 'PHARMACY') return '/pharmacy/dashboard'
  if (user?.role === 'ADMIN') return '/admin'
  return '/account'
}

export function homeLinksFor(user) {
  if (user?.role === 'PATIENT') {
    return [
      { to: '/patient/dashboard', label: 'Dashboard' },
      { to: '/patient/profile', label: 'Profile' },
      { to: '/appointments', label: 'My Appointments' },
      { to: '/orders', label: 'My Orders' },
      { to: '/prescriptions', label: 'Prescriptions' },
      { to: '/medical-records', label: 'Medical Records' },
      { to: '/doctors', label: 'Find a Doctor' },
      { to: '/medicines', label: 'Medicines' },
      { to: '/cart', label: 'Cart' },
      { to: '/notifications', label: 'Notifications' },
    ]
  }
  if (user?.role === 'DOCTOR') {
    return [
      { to: '/doctor/dashboard', label: 'Dashboard' },
      { to: '/doctor/profile', label: 'Profile' },
      { to: '/doctor/appointments', label: 'Appointments' },
      { to: '/prescriptions', label: 'Prescriptions' },
      { to: '/medical-records', label: 'Medical Records' },
      { to: '/notifications', label: 'Notifications' },
    ]
  }
  if (user?.role === 'PHARMACY') {
    return [
      { to: '/pharmacy/dashboard', label: 'Dashboard' },
      { to: '/pharmacy/orders', label: 'Orders' },
      { to: '/pharmacy/inventory', label: 'Inventory' },
      { to: '/pharmacy/profile', label: 'Profile' },
      { to: '/notifications', label: 'Notifications' },
    ]
  }
  if (user?.role === 'ADMIN') {
    return [
      { to: '/admin', label: 'Dashboard' },
      { to: '/admin/doctors', label: 'Doctors' },
      { to: '/admin/pharmacies', label: 'Pharmacies' },
      { to: '/admin/users', label: 'Users' },
      { to: '/admin/medicines', label: 'Medicines' },
      { to: '/admin/orders', label: 'Orders' },
      { to: '/admin/notifications', label: 'Notifications' },
    ]
  }
  return [{ to: '/notifications', label: 'Notifications' }]
}