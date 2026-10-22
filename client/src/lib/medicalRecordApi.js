import api from './api.js'

function cleanParams(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== '' && value !== null && value !== undefined,
    ),
  )
}

export function createMedicalRecord(payload) {
  return api.post('/medical-records', payload)
}

export function getMedicalRecords(params = {}) {
  return api.get('/medical-records', { params: cleanParams(params) })
}

export function getMedicalRecord(recordId) {
  return api.get(`/medical-records/${recordId}`)
}
