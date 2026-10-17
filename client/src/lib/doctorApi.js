import api from './api.js'

export function getDoctorProfile() {
  return api.get('/doctor/profile')
}

export function saveDoctorProfile(payload) {
  return api.put('/doctor/profile', payload)
}

export function getDoctorDashboard() {
  return api.get('/doctor/dashboard')
}