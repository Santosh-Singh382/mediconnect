import api from './api.js'

export function getPatientProfile() {
  return api.get('/patient/profile')
}

export function savePatientProfile(payload) {
  return api.put('/patient/profile', payload)
}

export function getPatientDashboard() {
  return api.get('/patient/dashboard')
}