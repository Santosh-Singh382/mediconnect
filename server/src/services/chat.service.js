const mongoose = require('mongoose')
const Appointment = require('../models/Appointment')
const Message = require('../models/Message')
const ApiError = require('../utils/ApiError')

// Chat history is available for these statuses.
const CHAT_ACCESS_STATUSES = ['CONFIRMED', 'COMPLETED']

// New messages may only be sent to confirmed appointments.
const CHAT_SEND_STATUSES = ['CONFIRMED']

// Chat is only the consultation method for appointments booked as CHAT.
const CHAT_CONSULTATION_TYPE = 'CHAT'

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id)
}

function assertValidAppointmentId(appointmentId) {
  if (!isValidObjectId(appointmentId)) {
    throw new ApiError(400, 'Invalid appointment identifier', 'VALIDATION_ERROR', [
      { field: 'appointmentId', message: 'Appointment ID is not a valid identifier' },
    ])
  }
}

// Load the appointment and ensure the authenticated user is a participant.
// The receiver is always derived from the stored appointment, never trusted
// from the client. Health/ownership rules intentionally follow the existing
// appointment convention (400 invalid / 404 missing / 403 unauthorized).
async function loadAuthorizedAppointment(appointmentId, userId) {
  assertValidAppointmentId(appointmentId)

  const appointment = await Appointment.findById(appointmentId).lean()
  if (!appointment) {
    throw new ApiError(404, 'Appointment not found', 'NOT_FOUND')
  }

  const isPatient = appointment.patientId.toString() === userId
  const isDoctor = appointment.doctorId.toString() === userId

  if (!isPatient && !isDoctor) {
    throw new ApiError(403, 'You do not have access to this appointment', 'FORBIDDEN')
  }

  return {
    appointment,
    receiverId: isPatient
      ? appointment.doctorId.toString()
      : appointment.patientId.toString(),
  }
}

function assertChatAccess(appointment, { canSend = false } = {}) {
  if (appointment.type !== CHAT_CONSULTATION_TYPE) {
    throw new ApiError(
      403,
      `This appointment was booked as ${appointment.type} consultation. Chat consultation is not available for this appointment.`,
      'CONSULTATION_TYPE_MISMATCH',
    )
  }

  const allowed = canSend ? CHAT_SEND_STATUSES : CHAT_ACCESS_STATUSES
  if (!allowed.includes(appointment.status)) {
    throw new ApiError(
      403,
      canSend
        ? 'Chat messages can only be sent for confirmed appointments'
        : 'Chat is not available for this appointment',
      canSend ? 'CHAT_NOT_AVAILABLE' : 'CHAT_ACCESS_DENIED',
    )
  }
}

function validateMessage(rawMessage) {
  const errors = []

  if (typeof rawMessage !== 'string') {
    errors.push({ field: 'message', message: 'Message must be a string' })
    throw new ApiError(400, 'Invalid message data', 'VALIDATION_ERROR', errors)
  }

  const trimmed = rawMessage.trim()

  if (trimmed.length === 0) {
    errors.push({ field: 'message', message: 'Message cannot be empty' })
  } else if (trimmed.length > Message.MAX_MESSAGE_LENGTH) {
    errors.push({
      field: 'message',
      message: `Message cannot exceed ${Message.MAX_MESSAGE_LENGTH} characters`,
    })
  }

  if (errors.length > 0) {
    throw new ApiError(400, 'Invalid message data', 'VALIDATION_ERROR', errors)
  }

  return trimmed
}

function parsePositiveInteger(raw, field, errors, fallback, max = Number.MAX_SAFE_INTEGER) {
  if (raw === undefined || raw === '') {
    return fallback
  }
  const value = Number(raw)
  if (typeof raw !== 'string' && typeof raw !== 'number') {
    errors.push({ field, message: `${field} must be a number` })
    return fallback
  }
  if (!Number.isInteger(value) || value < 1) {
    errors.push({ field, message: `${field} must be a positive whole number` })
    return fallback
  }
  if (value > max) {
    errors.push({ field, message: `${field} cannot exceed ${max}` })
    return fallback
  }
  return value
}

function parseMessagesQuery(query) {
  const errors = []
  const page = parsePositiveInteger(query.page, 'page', errors, DEFAULT_PAGE)
  const limit = parsePositiveInteger(query.limit, 'limit', errors, DEFAULT_LIMIT, MAX_LIMIT)

  if (errors.length > 0) {
    throw new ApiError(400, 'Invalid messages query', 'VALIDATION_ERROR', errors)
  }

  return { page, limit }
}

function serializeMessage(message) {
  return {
    id: message._id.toString(),
    appointmentId: message.appointmentId.toString(),
    senderId: message.senderId.toString(),
    receiverId: message.receiverId.toString(),
    message: message.message,
    messageType: message.messageType,
    isRead: message.isRead,
    readAt: message.readAt ? message.readAt.toISOString() : null,
    createdAt: message.createdAt ? message.createdAt.toISOString() : null,
    updatedAt: message.updatedAt ? message.updatedAt.toISOString() : null,
  }
}

// Authorization gate used by both the REST chat API and Socket.IO handlers.
async function checkChatAccess(appointmentId, userId) {
  const { appointment, receiverId } = await loadAuthorizedAppointment(
    appointmentId,
    userId,
  )
  assertChatAccess(appointment)
  return { appointment, receiverId }
}

async function getMessages({ appointmentId, userId, query }) {
  await checkChatAccess(appointmentId, userId)

  const { page, limit } = parseMessagesQuery(query || {})

  const filter = { appointmentId }
  const [total, messages] = await Promise.all([
    Message.countDocuments(filter),
    Message.find(filter)
      .sort({ createdAt: 1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ])

  const totalPages = total === 0 ? 0 : Math.ceil(total / limit)

  return {
    messages: messages.map(serializeMessage),
    pagination: { page, limit, total, totalPages },
  }
}

async function sendMessage({ appointmentId, userId, message }) {
  const { appointment, receiverId } = await loadAuthorizedAppointment(
    appointmentId,
    userId,
  )
  assertChatAccess(appointment, { canSend: true })

  const trimmed = validateMessage(message)

  const stored = await Message.create({
    appointmentId: appointment._id,
    senderId: userId,
    receiverId,
    message: trimmed,
    messageType: 'TEXT',
  })

  return { message: serializeMessage(stored) }
}

async function markAsRead({ appointmentId, userId }) {
  await checkChatAccess(appointmentId, userId)

  const readAt = new Date()
  const result = await Message.updateMany(
    {
      appointmentId,
      receiverId: userId,
      isRead: false,
    },
    {
      $set: { isRead: true, readAt },
    },
  )

  return { updatedCount: result.modifiedCount || 0, readAt: readAt.toISOString() }
}

module.exports = {
  checkChatAccess,
  getMessages,
  sendMessage,
  markAsRead,
  serializeMessage,
  CHAT_ACCESS_STATUSES,
  CHAT_SEND_STATUSES,
}
module.exports.MAX_MESSAGE_LENGTH = Message.MAX_MESSAGE_LENGTH