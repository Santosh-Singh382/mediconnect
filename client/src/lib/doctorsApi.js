import api from './api.js'

export function getDoctors(params = {}) {
  const clean = Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== '' && value !== null && value !== undefined,
    ),
  )
  return api.get('/doctors', { params: clean })
}

export function getDoctorById(id) {
  return api.get(`/doctors/${id}`)
}