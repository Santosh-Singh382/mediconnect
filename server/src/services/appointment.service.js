const mongoose = require('mongoose')
const Appointment = require('../models/Appointment')
const DoctorProfile = require('../models/DoctorProfile')
const Prescription = require('../models/Prescription')
const User = require('../models/User')
const ApiError = require('../utils/ApiError')
const {
  APPOINTMENT_TYPES,
  APPOINTMENT_STATUSES,
  APPOINTMENT_SLOT_MINUTES,
  TIME_PATTERN,
  DATE_PATTERN,
  MAX_REASON_LENGTH,
} = require('../models/Appointment')

const DAYS_OF_WEEK = DoctorProfile.DAYS_OF_WEEK

// indexed by Date.prototype.getUTCDay() (0 = Sunday)
const DAYS_INDEXED = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
]

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 12
const MAX_LIMIT = 50

// Centralized status transition rules. Each status lists the statuses it may
// move to. Everything else (COMPLETED/REJECTED/CANCELLED -> anything,
// PENDING -> COMPLETED, ...) is rejected by design.
const STATUS_TRANSITIONS = {
  PENDING: ['CONFIRMED', 'REJECTED', 'CANCELLED'],
  CONFIRMED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  REJECTED: [],
  CANCELLED: [],
}

const ACTIVE_STATUSES = ['PENDING', 'CONFIRMED']

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id)
}

function timeToMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function minutesToTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function addMinutes(time, minutes) {
  return minutesToTime(timeToMinutes(time) + minutes)
}

function isGridAligned(time) {
  return timeToMinutes(time) % APPOINTMENT_SLOT_MINUTES === 0
}

function isFutureDate(dateString) {
  const today = todayString()
  return dateString >= today
}

function todayString() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDateString(dateString) {
  if (typeof dateString !== 'string' || !DATE_PATTERN.test(dateString)) {
    return null
  }
  const [year, month, day] = dateString.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null
  }
  return parsed
}

function dayOfWeekFromString(dateString) {
  const parsed = parseDateString(dateString)
  if (!parsed) {
    throw new ApiError(400, 'Invalid appointment date', 'VALIDATION_ERROR', [
      { field: 'appointmentDate', message: 'Appointment date is not a valid date' },
    ])
  }
  return DAYS_INDEXED[parsed.getUTCDay()]
}

function generateSlots(startTime, endTime) {
  const slots = []
  let cursor = timeToMinutes(startTime)
  const end = timeToMinutes(endTime)
  while (cursor + APPOINTMENT_SLOT_MINUTES <= end) {
    slots.push({
      startTime: minutesToTime(cursor),
      endTime: minutesToTime(cursor + APPOINTMENT_SLOT_MINUTES),
    })
    cursor += APPOINTMENT_SLOT_MINUTES
  }
  return slots
}

function slotsOverlap(a, b) {
  return a.startTime < b.endTime && a.endTime > b.startTime
}

function objectIdSet(values) {
  return [...new Set(values.map((value) => value.toString()))].map(
    (value) => new mongoose.Types.ObjectId(value),
  )
}

async function findApprovedDoctor(doctorId) {
  if (!isValidObjectId(doctorId)) {
    throw new ApiError(400, 'Invalid doctor identifier', 'VALIDATION_ERROR', [
      { field: 'doctorId', message: 'Doctor ID is not a valid identifier' },
    ])
  }

  const profile = await DoctorProfile.findOne({
    _id: doctorId,
    verificationStatus: 'APPROVED',
  })

  if (!profile) {
    throw new ApiError(404, 'Doctor not found', 'NOT_FOUND')
  }

  return profile
}

function validateCreateInput(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new ApiError(400, 'Invalid appointment payload', 'INVALID_REQUEST_BODY')
  }

  const errors = []

  if (input.doctorId === undefined || input.doctorId === null || input.doctorId === '') {
    errors.push({ field: 'doctorId', message: 'Doctor is required' })
  } else if (typeof input.doctorId !== 'string' || !isValidObjectId(input.doctorId)) {
    errors.push({ field: 'doctorId', message: 'Doctor ID is not a valid identifier' })
  }

  const rawDate = input.appointmentDate
  if (rawDate === undefined || rawDate === null || rawDate === '') {
    errors.push({ field: 'appointmentDate', message: 'Appointment date is required' })
  } else if (typeof rawDate !== 'string' || !parseDateString(rawDate)) {
    errors.push({ field: 'appointmentDate', message: 'Appointment date is not a valid date' })
  }

  const rawStartTime = input.startTime
  if (rawStartTime === undefined || rawStartTime === null || rawStartTime === '') {
    errors.push({ field: 'startTime', message: 'Start time is required' })
  } else if (typeof rawStartTime !== 'string' || !TIME_PATTERN.test(rawStartTime)) {
    errors.push({ field: 'startTime', message: 'Start time must use HH:mm format' })
  } else if (!isGridAligned(rawStartTime)) {
    errors.push({
      field: 'startTime',
      message: `Start time must be a valid ${APPOINTMENT_SLOT_MINUTES}-minute slot`,
    })
  }

  const rawType = input.type
  if (rawType === undefined || rawType === null || rawType === '') {
    errors.push({ field: 'type', message: 'Consultation type is required' })
  } else if (
    typeof rawType !== 'string' ||
    !APPOINTMENT_TYPES.includes(rawType.trim().toUpperCase())
  ) {
    errors.push({
      field: 'type',
      message: `Type must be one of: ${APPOINTMENT_TYPES.join(', ')}`,
    })
  }

  const rawReason = input.reason
  if (rawReason === undefined || rawReason === null) {
    errors.push({ field: 'reason', message: 'Reason is required' })
  } else if (typeof rawReason !== 'string') {
    errors.push({ field: 'reason', message: 'Reason must be a string' })
  } else {
    const trimmed = rawReason.trim()
    if (trimmed.length === 0) {
      errors.push({ field: 'reason', message: 'Reason is required' })
    } else if (trimmed.length > MAX_REASON_LENGTH) {
      errors.push({
        field: 'reason',
        message: `Reason cannot exceed ${MAX_REASON_LENGTH} characters`,
      })
    }
  }

  if (errors.length > 0) {
    throw new ApiError(400, 'Invalid appointment data', 'VALIDATION_ERROR', errors)
  }

  return {
    doctorId: input.doctorId,
    appointmentDate: input.appointmentDate,
    startTime: input.startTime,
    type: input.type.trim().toUpperCase(),
    reason: input.reason.trim(),
  }
}

async function enrichAppointments(appointments) {
  if (appointments.length === 0) {
    return []
  }

  const doctorIds = objectIdSet(appointments.map((appointment) => appointment.doctorId))
  const patientIds = objectIdSet(appointments.map((appointment) => appointment.patientId))
  const appointmentIds = appointments.map((appointment) => appointment._id)

  const [doctorUsers, patientUsers, doctorProfiles, prescriptions] = await Promise.all([
    User.find({ _id: { $in: doctorIds } }).select('name').lean(),
    User.find({ _id: { $in: patientIds } }).select('name phone').lean(),
    DoctorProfile.find({ userId: { $in: doctorIds } })
      .select('_id userId specialization consultationFee')
      .lean(),
    Prescription.find({ appointmentId: { $in: appointmentIds } })
      .select('appointmentId')
      .lean(),
  ])

  const doctorUserMap = new Map(doctorUsers.map((user) => [user._id.toString(), user]))
  const patientUserMap = new Map(patientUsers.map((user) => [user._id.toString(), user]))
  const doctorProfileMap = new Map(
    doctorProfiles.map((profile) => [profile.userId.toString(), profile]),
  )
  const prescriptionMap = new Map(
    prescriptions.map((prescription) => [
      prescription.appointmentId.toString(),
      prescription._id.toString(),
    ]),
  )

  return appointments.map((appointment) => {
    const doctorId = appointment.doctorId.toString()
    const patientId = appointment.patientId.toString()
    const appointmentId = appointment._id.toString()
    const doctorUser = doctorUserMap.get(doctorId) || {}
    const patientUser = patientUserMap.get(patientId) || {}
    const doctorProfile = doctorProfileMap.get(doctorId) || {}

    return {
      id: appointmentId,
      patientId: appointment.patientId.toString(),
      doctorId: appointment.doctorId.toString(),
      patient: {
        id: patientId,
        name: patientUser.name || 'Patient',
        phone: patientUser.phone || null,
      },
      doctor: {
        id: doctorId,
        profileId: doctorProfile._id ? doctorProfile._id.toString() : null,
        name: doctorUser.name || 'Doctor',
        specialization: doctorProfile.specialization || null,
        consultationFee:
          typeof doctorProfile.consultationFee === 'number'
            ? doctorProfile.consultationFee
            : null,
      },
      appointmentDate: appointment.appointmentDate,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      type: appointment.type,
      status: appointment.status,
      reason: appointment.reason,
      notes: appointment.notes || null,
      prescriptionId: prescriptionMap.get(appointmentId) || null,
      createdAt: appointment.createdAt ? appointment.createdAt.toISOString() : null,
      updatedAt: appointment.updatedAt ? appointment.updatedAt.toISOString() : null,
    }
  })
}

async function getAvailability(doctorId, rawDate) {
  const profile = await findApprovedDoctor(doctorId)

  if (rawDate === undefined || rawDate === null || rawDate === '') {
    throw new ApiError(400, 'Invalid appointment date', 'VALIDATION_ERROR', [
      { field: 'date', message: 'Appointment date is required' },
    ])
  }
  if (typeof rawDate !== 'string' || !parseDateString(rawDate)) {
    throw new ApiError(400, 'Invalid appointment date', 'VALIDATION_ERROR', [
      { field: 'date', message: 'Appointment date is not a valid date' },
    ])
  }
  if (!isFutureDate(rawDate)) {
    throw new ApiError(400, 'Invalid appointment date', 'VALIDATION_ERROR', [
      { field: 'date', message: 'Appointment date cannot be in the past' },
    ])
  }

  const dayOfWeek = dayOfWeekFromString(rawDate)
  const window = profile.availability.find(
    (entry) => entry.dayOfWeek === dayOfWeek && entry.enabled,
  )
  const slots = window
    ? generateSlots(window.startTime, window.endTime)
    : []

  if (slots.length > 0) {
    const busyAppointments = await Appointment.find({
      doctorId: profile.userId,
      appointmentDate: rawDate,
      status: { $in: ACTIVE_STATUSES },
    })
      .select('startTime endTime')
      .lean()

    for (const slot of slots) {
      const alreadyBooked = busyAppointments.some((appointment) =>
        slotsOverlap(slot, {
          startTime: appointment.startTime,
          endTime: appointment.endTime,
        }),
      )
      slot.available = !alreadyBooked
    }
  }

  return {
    doctorId: profile._id.toString(),
    date: rawDate,
    dayOfWeek,
    slotMinutes: APPOINTMENT_SLOT_MINUTES,
    slots,
  }
}

async function createAppointment(patientUserId, input) {
  const { doctorId, appointmentDate, startTime, type, reason } =
    validateCreateInput(input)

  const profile = await findApprovedDoctor(doctorId)

  if (!isFutureDate(appointmentDate)) {
    throw new ApiError(400, 'Invalid appointment date', 'VALIDATION_ERROR', [
      { field: 'appointmentDate', message: 'Appointment date cannot be in the past' },
    ])
  }

  const dayOfWeek = dayOfWeekFromString(appointmentDate)
  const window = profile.availability.find(
    (entry) => entry.dayOfWeek === dayOfWeek && entry.enabled,
  )
  const slot = {
    startTime,
    endTime: addMinutes(startTime, APPOINTMENT_SLOT_MINUTES),
  }

  if (
    !window ||
    window.startTime > slot.startTime ||
    window.endTime < slot.endTime
  ) {
    throw new ApiError(400, 'Invalid appointment data', 'VALIDATION_ERROR', [
      { field: 'startTime', message: 'Doctor is not available at the selected time' },
    ])
  }

  const doctorUserId = profile.userId

  const conflicted = await Appointment.findOne({
    doctorId: doctorUserId,
    appointmentDate,
    status: { $in: ACTIVE_STATUSES },
    startTime: { $lt: slot.endTime },
    endTime: { $gt: slot.startTime },
  })

  if (conflicted) {
    throw new ApiError(409, 'Selected appointment slot is no longer available.', 'CONFLICT')
  }

  let appointment
  try {
    appointment = await Appointment.create({
      patientId: patientUserId,
      doctorId: doctorUserId,
      appointmentDate,
      startTime: slot.startTime,
      endTime: slot.endTime,
      type,
      status: 'PENDING',
      reason,
    })
  } catch (error) {
    if (error && error.code === 11000) {
      throw new ApiError(409, 'Selected appointment slot is no longer available.', 'CONFLICT')
    }
    throw error
  }

  const [enriched] = await enrichAppointments([appointment])
  return enriched
}

function parseListQuery(role, query) {
  const errors = []
  const filter = role === 'PATIENT' ? { patientId: 'owner' } : { doctorId: 'owner' }

  const rawStatus = query.status
  let status = null
  if (rawStatus !== undefined && rawStatus !== '') {
    if (typeof rawStatus !== 'string') {
      errors.push({ field: 'status', message: 'Status must be a string' })
    } else {
      const candidate = rawStatus.trim().toUpperCase()
      if (!APPOINTMENT_STATUSES.includes(candidate)) {
        errors.push({
          field: 'status',
          message: `Status must be one of: ${APPOINTMENT_STATUSES.join(', ')}`,
        })
      } else {
        status = candidate
      }
    }
  }
  if (status) {
    filter.status = status
  }

  const rawDate = query.date
  let date = null
  if (rawDate !== undefined && rawDate !== '') {
    if (typeof rawDate !== 'string' || !parseDateString(rawDate)) {
      errors.push({ field: 'date', message: 'Date is not a valid date' })
    } else {
      date = rawDate
    }
  }
  if (date) {
    filter.appointmentDate = date
  }

  const page = parsePositiveInteger(query.page, 'page', errors, DEFAULT_PAGE)
  const limit = parsePositiveInteger(query.limit, 'limit', errors, DEFAULT_LIMIT, MAX_LIMIT)

  if (errors.length > 0) {
    throw new ApiError(400, 'Invalid appointments query', 'VALIDATION_ERROR', errors)
  }

  return { filter, page, limit }
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

async function listAppointments({ role, userId, query }) {
  const { filter, page, limit } = parseListQuery(role, query)
  if (role === 'PATIENT') {
    filter.patientId = userId
  } else {
    filter.doctorId = userId
  }

  const [total, appointments] = await Promise.all([
    Appointment.countDocuments(filter),
    Appointment.find(filter)
      .sort({ appointmentDate: -1, startTime: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ])

  const totalPages = total === 0 ? 0 : Math.ceil(total / limit)

  return {
    appointments: await enrichAppointments(appointments),
    pagination: { page, limit, total, totalPages },
  }
}

async function getAppointmentById(appointmentId, userId) {
  if (!isValidObjectId(appointmentId)) {
    throw new ApiError(400, 'Invalid appointment identifier', 'VALIDATION_ERROR', [
      { field: 'appointmentId', message: 'Appointment ID is not a valid identifier' },
    ])
  }

  const appointment = await Appointment.findById(appointmentId)
  if (!appointment) {
    throw new ApiError(404, 'Appointment not found', 'NOT_FOUND')
  }

  if (
    appointment.patientId.toString() !== userId &&
    appointment.doctorId.toString() !== userId
  ) {
    throw new ApiError(403, 'You do not have access to this appointment', 'FORBIDDEN')
  }

  const [enriched] = await enrichAppointments([appointment])
  return enriched
}

async function changeAppointmentStatus(appointmentId, userId, action) {
  if (!isValidObjectId(appointmentId)) {
    throw new ApiError(400, 'Invalid appointment identifier', 'VALIDATION_ERROR', [
      { field: 'appointmentId', message: 'Appointment ID is not a valid identifier' },
    ])
  }

  const appointment = await Appointment.findById(appointmentId)
  if (!appointment) {
    throw new ApiError(404, 'Appointment not found', 'NOT_FOUND')
  }

  const isDoctor = appointment.doctorId.toString() === userId
  const isPatient = appointment.patientId.toString() === userId
  const isOwner = isDoctor || isPatient
  const requiresDoctor = action.owner === 'doctor'

  if (requiresDoctor && !isDoctor) {
    throw new ApiError(403, 'Only the doctor can perform this action', 'FORBIDDEN')
  }
  if (!requiresDoctor && !isOwner) {
    throw new ApiError(403, 'You do not have access to this appointment', 'FORBIDDEN')
  }

  if (!STATUS_TRANSITIONS[appointment.status]?.includes(action.to)) {
    throw new ApiError(409, `Appointment cannot be ${action.label.toLowerCase()} in its current state`, 'CONFLICT')
  }

  const updated = await Appointment.findOneAndUpdate(
    { _id: appointment._id, status: appointment.status },
    { $set: { status: action.to } },
    { new: true, runValidators: true },
  )

  const [enriched] = await enrichAppointments([updated])
  return enriched
}

const DOCTOR_ACTIONS = {
  confirm: { to: 'CONFIRMED', owner: 'doctor', label: 'confirmed' },
  reject: { to: 'REJECTED', owner: 'doctor', label: 'rejected' },
  complete: { to: 'COMPLETED', owner: 'doctor', label: 'completed' },
  cancel: { to: 'CANCELLED', owner: 'either', label: 'cancelled' },
}

async function confirmAppointment(appointmentId, userId) {
  return changeAppointmentStatus(appointmentId, userId, DOCTOR_ACTIONS.confirm)
}

async function rejectAppointment(appointmentId, userId) {
  return changeAppointmentStatus(appointmentId, userId, DOCTOR_ACTIONS.reject)
}

async function completeAppointment(appointmentId, userId) {
  return changeAppointmentStatus(appointmentId, userId, DOCTOR_ACTIONS.complete)
}

async function cancelAppointment(appointmentId, userId) {
  return changeAppointmentStatus(appointmentId, userId, DOCTOR_ACTIONS.cancel)
}

function assertTransition(from, to) {
  return STATUS_TRANSITIONS[from]?.includes(to) || false
}

module.exports = {
  getAvailability,
  createAppointment,
  listAppointments,
  getAppointmentById,
  confirmAppointment,
  rejectAppointment,
  completeAppointment,
  cancelAppointment,
  assertTransition,
  STATUS_TRANSITIONS,
  APPOINTMENT_SLOT_MINUTES,
}