const mongoose = require('mongoose')
const Appointment = require('../models/Appointment')
const ApiError = require('../utils/ApiError')

// A video consultation may only be started for a confirmed appointment.
// COMPLETED/PENDING/CANCELLED/REJECTED are intentionally excluded.
const VIDEO_ACCESS_STATUSES = ['CONFIRMED']

// The consultation method is fixed at booking time. A video consultation may
// only run for appointments booked as VIDEO.
const VIDEO_CONSULTATION_TYPE = 'VIDEO'

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id)
}

// Load the appointment and ensure the authenticated user is a participant.
// Participants are always derived from the stored appointment, never from the
// client. This mirrors the existing chat authorization convention
// (400 invalid / 404 missing / 403 unauthorized).
async function loadAuthorizedAppointment(appointmentId, userId) {
  if (!isValidObjectId(appointmentId)) {
    throw new ApiError(400, 'Invalid appointment identifier', 'VALIDATION_ERROR', [
      { field: 'appointmentId', message: 'Appointment ID is not a valid identifier' },
    ])
  }

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
    isPatient,
    peerId: isPatient
      ? appointment.doctorId.toString()
      : appointment.patientId.toString(),
  }
}

// Authorization gate used by the Socket.IO video signaling handlers.
async function checkVideoAccess(appointmentId, userId) {
  const { appointment, isPatient, peerId } = await loadAuthorizedAppointment(
    appointmentId,
    userId,
  )

  if (appointment.type !== VIDEO_CONSULTATION_TYPE) {
    throw new ApiError(
      403,
      `This appointment was booked as ${appointment.type} consultation. Video consultation is not available for this appointment.`,
      'CONSULTATION_TYPE_MISMATCH',
    )
  }

  if (!VIDEO_ACCESS_STATUSES.includes(appointment.status)) {
    throw new ApiError(
      403,
      'Video consultation is only available for confirmed appointments',
      'VIDEO_NOT_AVAILABLE',
    )
  }

  return {
    appointment,
    isPatient,
    peerId,
    role: isPatient ? 'PATIENT' : 'DOCTOR',
  }
}

module.exports = {
  checkVideoAccess,
  VIDEO_ACCESS_STATUSES,
  VIDEO_CONSULTATION_TYPE,
}
