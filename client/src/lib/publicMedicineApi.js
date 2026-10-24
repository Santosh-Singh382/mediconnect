import api from './api.js'

function cleanParams(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== '' && value !== null && value !== undefined,
    ),
  )
}

export function searchPublicMedicines(params = {}) {
  return api.get('/public/medicines', { params: cleanParams(params) })
}

export function getPublicMedicine(medicineId) {
  return api.get(`/public/medicines/${medicineId}`)
}
