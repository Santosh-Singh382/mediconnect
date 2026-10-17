const mongoose = require('mongoose')
const Appointment = require('../models/Appointment')
const ApiError = require('../utils/ApiError')

// An audio consultation may only be started for a confirmed appointment.
// COMPLETED/PENDING/CANCELLED/REJECTED are intentionally excluded.
const AUDIO_ACCESS_STATUSES = ['CONFIRMED']

// The consultation method is fixed at booking time. An audio consultation may
// only run for appointments booked as AUDIO.
const AUDIO_CONSULTATION_TYPE = 'AUDIO'

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id)
}

// Load the appointment and ensure the authenticated user is a participant.
// Participants are always derived from the stored appointment, never from the
// client. Mirrors the video/chat authorization convention
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

// Authorization gate used by the Socket.IO audio signaling handlers.
async function checkAudioAccess(appointmentId, userId) {
  const { appointment, isPatient, peerId } = await loadAuthorizedAppointment(
    appointmentId,
    userId,
  )

  if (appointment.type !== AUDIO_CONSULTATION_TYPE) {
    throw new ApiError(
      403,
      `This appointment was booked as ${appointment.type} consultation. Audio consultation is not available for this appointment.`,
      'CONSULTATION_TYPE_MISMATCH',
    )
  }

  if (!AUDIO_ACCESS_STATUSES.includes(appointment.status)) {
    throw new ApiError(
      403,
      'Audio consultation is only available for confirmed appointments',
      'AUDIO_NOT_AVAILABLE',
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
  checkAudioAccess,
  AUDIO_ACCESS_STATUSES,
  AUDIO_CONSULTATION_TYPE,
}
