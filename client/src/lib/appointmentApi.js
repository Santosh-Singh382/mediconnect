import api from './api.js'

function cleanParams(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== '' && value !== null && value !== undefined,
    ),
  )
}

export function createAppointment(payload) {
  return api.post('/appointments', payload)
}

export function getAvailability(doctorId, date) {
  return api.get(`/appointments/availability/${doctorId}`, { params: { date } })
}

export function getMyAppointments(params = {}) {
  return api.get('/appointments/my', { params: cleanParams(params) })
}

export function getDoctorAppointments(params = {}) {
  return api.get('/appointments/doctor', { params: cleanParams(params) })
}

export function getAppointment(id) {
  return api.get(`/appointments/${id}`)
}

export function confirmAppointment(id) {
  return api.patch(`/appointments/${id}/confirm`)
}

export function rejectAppointment(id) {
  return api.patch(`/appointments/${id}/reject`)
}

export function cancelAppointment(id) {
  return api.patch(`/appointments/${id}/cancel`)
}

export function completeAppointment(id) {
  return api.patch(`/appointments/${id}/complete`)
}