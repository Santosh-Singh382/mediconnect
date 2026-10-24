import api from './api.js'

export function getMyPharmacy() {
  return api.get('/pharmacy/profile')
}

export function createMyPharmacy(payload) {
  return api.post('/pharmacy/profile', payload)
}

export function updateMyPharmacy(payload) {
  return api.put('/pharmacy/profile', payload)
}
