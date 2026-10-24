import api from './api.js'

export function getAdminDashboard() {
  return api.get('/admin/dashboard')
}

export function getAdminDoctors(params = {}) {
  return api.get('/admin/doctors', { params })
}

export function updateDoctorVerification(doctorId, payload) {
  return api.patch(`/admin/doctors/${doctorId}/verification`, payload)
}

export function getAdminPharmacies(params = {}) {
  return api.get('/admin/pharmacies', { params })
}

export function updatePharmacyVerification(pharmacyId, payload) {
  return api.patch(`/admin/pharmacies/${pharmacyId}/verification`, payload)
}

export function getAdminUsers(params = {}) {
  return api.get('/admin/users', { params })
}

export function updateAdminUserStatus(userId, isActive) {
  return api.patch(`/admin/users/${userId}/status`, { isActive })
}

export function getAdminMedicines(params = {}) {
  return api.get('/admin/medicines', { params })
}

export function getAdminOrders(params = {}) {
  return api.get('/admin/orders', { params })
}

export function getAdminOrder(orderId) {
  return api.get(`/admin/orders/${orderId}`)
}
