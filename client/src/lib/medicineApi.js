import api from './api.js'

function cleanParams(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== '' && value !== null && value !== undefined,
    ),
  )
}

export function listMedicines(params = {}) {
  return api.get('/medicines', { params: cleanParams(params) })
}

export function getMedicine(medicineId) {
  return api.get(`/medicines/${medicineId}`)
}

export function createMedicine(payload) {
  return api.post('/medicines', payload)
}

export function updateMedicine(medicineId, payload) {
  return api.put(`/medicines/${medicineId}`, payload)
}

export function deactivateMedicine(medicineId) {
  return api.patch(`/medicines/${medicineId}/deactivate`)
}

export function activateMedicine(medicineId) {
  return api.patch(`/medicines/${medicineId}/activate`)
}
