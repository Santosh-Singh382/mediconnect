const mongoose = require('mongoose')
const MedicalRecord = require('../models/MedicalRecord')
const Appointment = require('../models/Appointment')
const Prescription = require('../models/Prescription')
const DoctorProfile = require('../models/DoctorProfile')
const User = require('../models/User')
const ApiError = require('../utils/ApiError')
const { DATE_PATTERN } = require('../models/Appointment')
const {
  RECORD_TYPES,
  MAX_TITLE_LENGTH,
  MAX_DIAGNOSIS_LENGTH,
  MAX_SUMMARY_LENGTH,
  MAX_NOTES_LENGTH,
} = require('../models/MedicalRecord')

const COMPLETED_STATUS = 'COMPLETED'

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 10
const MAX_LIMIT = 50

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id)
}

function objectIdSet(values) {
  return [...new Set(values.map((value) => value.toString()))].map(
    (value) => new mongoose.Types.ObjectId(value),
  )
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

function validateRequiredString(value, field, label, max, errors) {
  if (value === undefined || value === null || value === '') {
    errors.push({ field, message: `${label} is required` })
    return null
  }
  if (typeof value !== 'string') {
    errors.push({ field, message: `${label} must be a string` })
    return null
  }
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    errors.push({ field, message: `${label} is required` })
    return null
  }
  if (trimmed.length > max) {
    errors.push({ field, message: `${label} cannot exceed ${max} characters` })
    return null
  }
  return trimmed
}

function validateOptionalString(value, field, label, max, errors) {
  if (value === undefined || value === null || value === '') {
    return null
  }
  if (typeof value !== 'string') {
    errors.push({ field, message: `${label} must be a string` })
    return null
  }
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return null
  }
  if (trimmed.length > max) {
    errors.push({ field, message: `${label} cannot exceed ${max} characters` })
    return null
  }
  return trimmed
}

function validateRecordType(value, errors) {
  if (value === undefined || value === null || value === '') {
    errors.push({ field: 'recordType', message: 'Record type is required' })
    return null
  }
  if (typeof value !== 'string') {
    errors.push({ field: 'recordType', message: 'Record type must be a string' })
    return null
  }
  const normalized = value.trim().toUpperCase()
  if (!RECORD_TYPES.includes(normalized)) {
    errors.push({
      field: 'recordType',
      message: `Record type must be one of: ${RECORD_TYPES.join(', ')}`,
    })
    return null
  }
  return normalized
}

function validateRecordDate(value, errors) {
  if (value === undefined || value === null || value === '') {
    errors.push({ field: 'recordDate', message: 'Record date is required' })
    return null
  }

  let parsed = null
  if (typeof value === 'string') {
    parsed = new Date(value)
  } else if (value instanceof Date) {
    parsed = value
  } else {
    errors.push({ field: 'recordDate', message: 'Record date is not a valid date' })
    return null
  }

  if (!parsed || Number.isNaN(parsed.getTime())) {
    errors.push({ field: 'recordDate', message: 'Record date is not a valid date' })
    return null
  }

  return parsed
}

function validateCreateInput(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new ApiError(400, 'Invalid medical record payload', 'INVALID_REQUEST_BODY')
  }

  const errors = []

  const recordType = validateRecordType(input.recordType, errors)
  const title = validateRequiredString(
    input.title,
    'title',
    'Title',
    MAX_TITLE_LENGTH,
    errors,
  )
  const summary = validateRequiredString(
    input.summary,
    'summary',
    'Summary',
    MAX_SUMMARY_LENGTH,
    errors,
  )
  const diagnosis = validateOptionalString(
    input.diagnosis,
    'diagnosis',
    'Diagnosis',
    MAX_DIAGNOSIS_LENGTH,
    errors,
  )
  const notes = validateOptionalString(input.notes, 'notes', 'Notes', MAX_NOTES_LENGTH, errors)
  const recordDate = validateRecordDate(input.recordDate, errors)

  if (
    input.appointmentId === undefined ||
    input.appointmentId === null ||
    input.appointmentId === ''
  ) {
    errors.push({ field: 'appointmentId', message: 'Appointment is required' })
  } else if (
    typeof input.appointmentId !== 'string' ||
    !isValidObjectId(input.appointmentId)
  ) {
    errors.push({
      field: 'appointmentId',
      message: 'Appointment ID is not a valid identifier',
    })
  }

  let prescriptionId = null
  if (
    input.prescriptionId !== undefined &&
    input.prescriptionId !== null &&
    input.prescriptionId !== ''
  ) {
    if (
      typeof input.prescriptionId !== 'string' ||
      !isValidObjectId(input.prescriptionId)
    ) {
      errors.push({
        field: 'prescriptionId',
        message: 'Prescription ID is not a valid identifier',
      })
    } else {
      prescriptionId = input.prescriptionId
    }
  }

  if (errors.length > 0) {
    throw new ApiError(400, 'Invalid medical record data', 'VALIDATION_ERROR', errors)
  }

  return {
    appointmentId: input.appointmentId,
    prescriptionId,
    recordType,
    title,
    summary,
    diagnosis,
    notes,
    recordDate,
  }
}

async function assertRelatedPrescription(prescriptionId, appointment) {
  const prescription = await Prescription.findById(prescriptionId)
    .select('appointmentId patientId doctorId')
    .lean()

  if (!prescription) {
    throw new ApiError(400, 'Invalid medical record data', 'VALIDATION_ERROR', [
      { field: 'prescriptionId', message: 'Prescription not found' },
    ])
  }

  const matches =
    prescription.appointmentId.toString() === appointment._id.toString() &&
    prescription.patientId.toString() === appointment.patientId.toString() &&
    prescription.doctorId.toString() === appointment.doctorId.toString()

  if (!matches) {
    throw new ApiError(400, 'Invalid medical record data', 'VALIDATION_ERROR', [
      {
        field: 'prescriptionId',
        message: 'Prescription does not belong to this consultation',
      },
    ])
  }

  return prescription._id
}

async function createMedicalRecord(userId, input) {
  const { appointmentId, prescriptionId, recordType, title, summary, diagnosis, notes, recordDate } =
    validateCreateInput(input)

  const appointment = await Appointment.findById(appointmentId)
  if (!appointment) {
    throw new ApiError(404, 'Appointment not found', 'NOT_FOUND')
  }

  if (appointment.doctorId.toString() !== userId) {
    throw new ApiError(
      403,
      'You can only create records for your own appointments',
      'FORBIDDEN',
    )
  }

  if (appointment.status !== COMPLETED_STATUS) {
    throw new ApiError(
      409,
      'A medical record can only be created after the consultation is completed',
      'CONFLICT',
    )
  }

  let linkedPrescriptionId = null
  if (prescriptionId) {
    linkedPrescriptionId = await assertRelatedPrescription(prescriptionId, appointment)
  }

  const record = await MedicalRecord.create({
    patientId: appointment.patientId,
    doctorId: appointment.doctorId,
    appointmentId: appointment._id,
    prescriptionId: linkedPrescriptionId,
    recordType,
    title,
    summary,
    diagnosis,
    notes,
    recordDate,
  })

  const [enriched] = await enrichRecords([record])
  return enriched
}

function serializeRecord(record, maps = {}) {
  const patientId = record.patientId.toString()
  const doctorId = record.doctorId.toString()
  const appointmentId = record.appointmentId.toString()
  const appointment = maps.appointmentMap?.get(appointmentId) || null
  const patientUser = maps.patientUserMap?.get(patientId) || {}
  const doctorUser = maps.doctorUserMap?.get(doctorId) || {}
  const doctorProfile = maps.doctorProfileMap?.get(doctorId) || {}

  return {
    id: record._id.toString(),
    recordType: record.recordType,
    title: record.title,
    diagnosis: record.diagnosis || null,
    summary: record.summary,
    notes: record.notes || null,
    recordDate: record.recordDate ? record.recordDate.toISOString() : null,
    appointment: appointment
      ? {
          id: appointmentId,
          appointmentDate: appointment.appointmentDate,
          startTime: appointment.startTime,
          endTime: appointment.endTime,
          type: appointment.type,
        }
      : null,
    patient: {
      id: patientId,
      name: patientUser.name || 'Patient',
    },
    doctor: {
      id: doctorId,
      name: doctorUser.name || 'Doctor',
      specialization: doctorProfile.specialization || null,
    },
    prescription: record.prescriptionId
      ? { id: record.prescriptionId.toString() }
      : null,
    createdAt: record.createdAt ? record.createdAt.toISOString() : null,
    updatedAt: record.updatedAt ? record.updatedAt.toISOString() : null,
  }
}

async function enrichRecords(records) {
  if (records.length === 0) {
    return []
  }

  const appointmentIds = objectIdSet(records.map((record) => record.appointmentId))
  const patientIds = objectIdSet(records.map((record) => record.patientId))
  const doctorIds = objectIdSet(records.map((record) => record.doctorId))

  const [appointments, patientUsers, doctorUsers, doctorProfiles] = await Promise.all([
    Appointment.find({ _id: { $in: appointmentIds } })
      .select('appointmentDate startTime endTime type')
      .lean(),
    User.find({ _id: { $in: patientIds } }).select('name').lean(),
    User.find({ _id: { $in: doctorIds } }).select('name').lean(),
    DoctorProfile.find({ userId: { $in: doctorIds } })
      .select('userId specialization')
      .lean(),
  ])

  const maps = {
    appointmentMap: new Map(appointments.map((item) => [item._id.toString(), item])),
    patientUserMap: new Map(patientUsers.map((user) => [user._id.toString(), user])),
    doctorUserMap: new Map(doctorUsers.map((user) => [user._id.toString(), user])),
    doctorProfileMap: new Map(
      doctorProfiles.map((profile) => [profile.userId.toString(), profile]),
    ),
  }

  return records.map((record) => serializeRecord(record, maps))
}

function parseListQuery(query) {
  const errors = []
  const filter = {}

  const rawType = query.recordType
  if (rawType !== undefined && rawType !== '') {
    if (typeof rawType !== 'string') {
      errors.push({ field: 'recordType', message: 'Record type must be a string' })
    } else {
      const candidate = rawType.trim().toUpperCase()
      if (!RECORD_TYPES.includes(candidate)) {
        errors.push({
          field: 'recordType',
          message: `Record type must be one of: ${RECORD_TYPES.join(', ')}`,
        })
      } else {
        filter.recordType = candidate
      }
    }
  }

  let from = null
  if (query.from !== undefined && query.from !== '') {
    const parsed = parseDateString(query.from)
    if (!parsed) {
      errors.push({ field: 'from', message: 'From date is not a valid date' })
    } else {
      from = parsed
    }
  }

  let to = null
  if (query.to !== undefined && query.to !== '') {
    const parsed = parseDateString(query.to)
    if (!parsed) {
      errors.push({ field: 'to', message: 'To date is not a valid date' })
    } else {
      to = parsed
    }
  }

  if (from && to && from.getTime() > to.getTime()) {
    errors.push({ field: 'from', message: 'From date cannot be after to date' })
  }

  const recordDate = {}
  if (from) {
    recordDate.$gte = from
  }
  if (to) {
    recordDate.$lte = new Date(to.getTime() + 24 * 60 * 60 * 1000 - 1)
  }
  if (Object.keys(recordDate).length > 0) {
    filter.recordDate = recordDate
  }

  const page = parsePositiveInteger(query.page, 'page', errors, DEFAULT_PAGE)
  const limit = parsePositiveInteger(query.limit, 'limit', errors, DEFAULT_LIMIT, MAX_LIMIT)

  if (errors.length > 0) {
    throw new ApiError(400, 'Invalid medical records query', 'VALIDATION_ERROR', errors)
  }

  return { filter, page, limit }
}

async function listMedicalRecords({ role, userId, query }) {
  const { filter, page, limit } = parseListQuery(query || {})
  if (role === 'DOCTOR') {
    filter.doctorId = userId
  } else {
    filter.patientId = userId
  }

  const [total, records] = await Promise.all([
    MedicalRecord.countDocuments(filter),
    MedicalRecord.find(filter)
      .sort({ recordDate: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ])

  const totalPages = total === 0 ? 0 : Math.ceil(total / limit)

  return {
    records: await enrichRecords(records),
    pagination: { page, limit, total, totalPages },
  }
}

async function getMedicalRecordById(recordId, userId) {
  if (!isValidObjectId(recordId)) {
    throw new ApiError(400, 'Invalid medical record identifier', 'VALIDATION_ERROR', [
      {
        field: 'recordId',
        message: 'Medical record ID is not a valid identifier',
      },
    ])
  }

  const record = await MedicalRecord.findById(recordId)
  if (!record) {
    throw new ApiError(404, 'Medical record not found', 'NOT_FOUND')
  }

  if (
    record.patientId.toString() !== userId &&
    record.doctorId.toString() !== userId
  ) {
    throw new ApiError(
      403,
      'You do not have access to this medical record',
      'FORBIDDEN',
    )
  }

  const [enriched] = await enrichRecords([record])
  return enriched
}

module.exports = {
  createMedicalRecord,
  listMedicalRecords,
  getMedicalRecordById,
  serializeRecord,
  enrichRecords,
  COMPLETED_STATUS,
}
