import api from './api.js'

function cleanParams(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== '' && value !== null && value !== undefined,
    ),
  )
}

export function getChatMessages(appointmentId, params = {}) {
  return api.get(`/chat/${appointmentId}/messages`, {
    params: cleanParams(params),
  })
}

export function sendChatMessage(appointmentId, message) {
  return api.post(`/chat/${appointmentId}/messages`, { message })
}

export function markChatMessagesRead(appointmentId) {
  return api.patch(`/chat/${appointmentId}/read`)
}