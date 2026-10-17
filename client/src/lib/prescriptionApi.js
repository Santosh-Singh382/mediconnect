import api from './api.js'

export function createPrescription(payload) {
  return api.post('/prescriptions', payload)
}

export function getMyPrescriptions() {
  return api.get('/prescriptions')
}

export function getDoctorPrescriptions() {
  return api.get('/prescriptions/doctor')
}

export function getPrescription(prescriptionId) {
  return api.get(`/prescriptions/${prescriptionId}`)
}
