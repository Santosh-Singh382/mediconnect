const mongoose = require('mongoose')
const Prescription = require('../models/Prescription')
const Appointment = require('../models/Appointment')
const DoctorProfile = require('../models/DoctorProfile')
const User = require('../models/User')
const ApiError = require('../utils/ApiError')
const { DATE_PATTERN } = require('../models/Appointment')
const {
  MEDICINE_ROUTES,
  MEDICINE_TIMINGS,
  MAX_DIAGNOSIS_LENGTH,
  MAX_INSTRUCTIONS_LENGTH,
  MAX_MEDICINES,
  MAX_MEDICINE_NAME_LENGTH,
  MAX_DOSAGE_LENGTH,
  MAX_FREQUENCY_LENGTH,
  MAX_DURATION_LENGTH,
  MAX_MEDICINE_INSTRUCTIONS_LENGTH,
  MAX_QUANTITY,
} = require('../models/Prescription')

const COMPLETED_STATUS = 'COMPLETED'

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id)
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

function objectIdSet(values) {
  return [...new Set(values.map((value) => value.toString()))].map(
    (value) => new mongoose.Types.ObjectId(value),
  )
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

function validateEnum(value, field, label, allowed, errors) {
  if (value === undefined || value === null || value === '') {
    return null
  }
  if (typeof value !== 'string') {
    errors.push({ field, message: `${label} must be a string` })
    return null
  }
  const normalized = value.trim().toUpperCase()
  if (!allowed.includes(normalized)) {
    errors.push({
      field,
      message: `${label} must be one of: ${allowed.join(', ')}`,
    })
    return null
  }
  return normalized
}

function validateQuantity(value, field, errors) {
  if (value === undefined || value === null || value === '') {
    errors.push({ field, message: 'Quantity is required' })
    return null
  }
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    errors.push({ field, message: 'Quantity must be a whole number' })
    return null
  }
  if (value < 1) {
    errors.push({ field, message: 'Quantity must be at least 1' })
    return null
  }
  if (value > MAX_QUANTITY) {
    errors.push({ field, message: `Quantity cannot exceed ${MAX_QUANTITY}` })
    return null
  }
  return value
}

function validateMedicine(raw, index, errors) {
  const prefix = `medicines[${index}]`

  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    errors.push({ field: prefix, message: 'Medicine must be an object' })
    return null
  }

  const medicineName = validateRequiredString(
    raw.medicineName,
    `${prefix}.medicineName`,
    'Medicine name',
    MAX_MEDICINE_NAME_LENGTH,
    errors,
  )
  const dosage = validateRequiredString(
    raw.dosage,
    `${prefix}.dosage`,
    'Dosage',
    MAX_DOSAGE_LENGTH,
    errors,
  )
  const frequency = validateRequiredString(
    raw.frequency,
    `${prefix}.frequency`,
    'Frequency',
    MAX_FREQUENCY_LENGTH,
    errors,
  )
  const duration = validateRequiredString(
    raw.duration,
    `${prefix}.duration`,
    'Duration',
    MAX_DURATION_LENGTH,
    errors,
  )
  const route = validateEnum(raw.route, `${prefix}.route`, 'Route', MEDICINE_ROUTES, errors)
  const timing = validateEnum(
    raw.timing,
    `${prefix}.timing`,
    'Timing',
    MEDICINE_TIMINGS,
    errors,
  )
  const quantity = validateQuantity(raw.quantity, `${prefix}.quantity`, errors)
  const instructions = validateOptionalString(
    raw.instructions,
    `${prefix}.instructions`,
    'Medicine instructions',
    MAX_MEDICINE_INSTRUCTIONS_LENGTH,
    errors,
  )

  return { medicineName, dosage, frequency, duration, route, timing, quantity, instructions }
}

function validateMedicines(value, errors) {
  if (value === undefined || value === null) {
    errors.push({ field: 'medicines', message: 'At least one medicine is required' })
    return []
  }
  if (!Array.isArray(value)) {
    errors.push({ field: 'medicines', message: 'Medicines must be an array' })
    return []
  }
  if (value.length === 0) {
    errors.push({ field: 'medicines', message: 'At least one medicine is required' })
    return []
  }
  if (value.length > MAX_MEDICINES) {
    errors.push({
      field: 'medicines',
      message: `A prescription cannot contain more than ${MAX_MEDICINES} medicines`,
    })
    return []
  }

  return value.map((raw, index) => validateMedicine(raw, index, errors))
}

function validateCreateInput(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new ApiError(400, 'Invalid prescription payload', 'INVALID_REQUEST_BODY')
  }

  const errors = []

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

  const diagnosis = validateOptionalString(
    input.diagnosis,
    'diagnosis',
    'Diagnosis',
    MAX_DIAGNOSIS_LENGTH,
    errors,
  )
  const instructions = validateOptionalString(
    input.instructions,
    'instructions',
    'Instructions',
    MAX_INSTRUCTIONS_LENGTH,
    errors,
  )

  let followUpDate = null
  if (input.followUpDate !== undefined && input.followUpDate !== null && input.followUpDate !== '') {
    if (
      typeof input.followUpDate !== 'string' ||
      !parseDateString(input.followUpDate)
    ) {
      errors.push({
        field: 'followUpDate',
        message: 'Follow-up date must be a valid date in YYYY-MM-DD format',
      })
    } else {
      followUpDate = input.followUpDate
    }
  }

  const medicines = validateMedicines(input.medicines, errors)

  if (errors.length > 0) {
    throw new ApiError(400, 'Invalid prescription data', 'VALIDATION_ERROR', errors)
  }

  return {
    appointmentId: input.appointmentId,
    diagnosis,
    instructions,
    followUpDate,
    medicines,
  }
}

function serializeMedicine(medicine) {
  return {
    id: medicine._id ? medicine._id.toString() : null,
    medicineName: medicine.medicineName,
    dosage: medicine.dosage,
    frequency: medicine.frequency,
    duration: medicine.duration,
    route: medicine.route || null,
    timing: medicine.timing || null,
    quantity: medicine.quantity,
    instructions: medicine.instructions || null,
  }
}

function serializePrescription(prescription, maps = {}) {
  const doctorId = prescription.doctorId.toString()
  const patientId = prescription.patientId.toString()
  const doctorUser = maps.doctorUserMap?.get(doctorId) || {}
  const patientUser = maps.patientUserMap?.get(patientId) || {}
  const doctorProfile = maps.doctorProfileMap?.get(doctorId) || {}

  return {
    id: prescription._id.toString(),
    appointmentId: prescription.appointmentId.toString(),
    diagnosis: prescription.diagnosis || null,
    medicines: Array.isArray(prescription.medicines)
      ? prescription.medicines.map(serializeMedicine)
      : [],
    instructions: prescription.instructions || null,
    followUpDate: prescription.followUpDate || null,
    status: prescription.status,
    patient: {
      id: patientId,
      name: patientUser.name || 'Patient',
    },
    doctor: {
      id: doctorId,
      name: doctorUser.name || 'Doctor',
      specialization: doctorProfile.specialization || null,
    },
    createdAt: prescription.createdAt ? prescription.createdAt.toISOString() : null,
    updatedAt: prescription.updatedAt ? prescription.updatedAt.toISOString() : null,
  }
}

async function enrichPrescriptions(prescriptions) {
  if (prescriptions.length === 0) {
    return []
  }

  const doctorIds = objectIdSet(prescriptions.map((item) => item.doctorId))
  const patientIds = objectIdSet(prescriptions.map((item) => item.patientId))

  const [doctorUsers, patientUsers, doctorProfiles] = await Promise.all([
    User.find({ _id: { $in: doctorIds } }).select('name').lean(),
    User.find({ _id: { $in: patientIds } }).select('name').lean(),
    DoctorProfile.find({ userId: { $in: doctorIds } })
      .select('userId specialization')
      .lean(),
  ])

  const maps = {
    doctorUserMap: new Map(doctorUsers.map((user) => [user._id.toString(), user])),
    patientUserMap: new Map(patientUsers.map((user) => [user._id.toString(), user])),
    doctorProfileMap: new Map(
      doctorProfiles.map((profile) => [profile.userId.toString(), profile]),
    ),
  }

  return prescriptions.map((prescription) =>
    serializePrescription(prescription, maps),
  )
}

async function createPrescription(userId, input) {
  const { appointmentId, diagnosis, instructions, followUpDate, medicines } =
    validateCreateInput(input)

  const appointment = await Appointment.findById(appointmentId)
  if (!appointment) {
    throw new ApiError(404, 'Appointment not found', 'NOT_FOUND')
  }

  if (appointment.doctorId.toString() !== userId) {
    throw new ApiError(
      403,
      'You can only create prescriptions for your own appointments',
      'FORBIDDEN',
    )
  }

  if (appointment.status !== COMPLETED_STATUS) {
    throw new ApiError(
      409,
      'A prescription can only be created after the consultation is completed',
      'CONFLICT',
    )
  }

  const existing = await Prescription.findOne({ appointmentId: appointment._id })
    .select('_id')
    .lean()
  if (existing) {
    throw new ApiError(
      409,
      'A prescription already exists for this appointment',
      'CONFLICT',
    )
  }

  let prescription
  try {
    prescription = await Prescription.create({
      appointmentId: appointment._id,
      patientId: appointment.patientId,
      doctorId: appointment.doctorId,
      diagnosis,
      medicines,
      instructions,
      followUpDate,
    })
  } catch (error) {
    if (error && error.code === 11000) {
      throw new ApiError(
        409,
        'A prescription already exists for this appointment',
        'CONFLICT',
      )
    }
    throw error
  }

  const [enriched] = await enrichPrescriptions([prescription])
  return enriched
}

async function getPrescriptionById(prescriptionId, userId) {
  if (!isValidObjectId(prescriptionId)) {
    throw new ApiError(400, 'Invalid prescription identifier', 'VALIDATION_ERROR', [
      {
        field: 'prescriptionId',
        message: 'Prescription ID is not a valid identifier',
      },
    ])
  }

  const prescription = await Prescription.findById(prescriptionId)
  if (!prescription) {
    throw new ApiError(404, 'Prescription not found', 'NOT_FOUND')
  }

  if (
    prescription.patientId.toString() !== userId &&
    prescription.doctorId.toString() !== userId
  ) {
    throw new ApiError(
      403,
      'You do not have access to this prescription',
      'FORBIDDEN',
    )
  }

  const [enriched] = await enrichPrescriptions([prescription])
  return enriched
}

async function listPrescriptions({ role, userId }) {
  const filter = role === 'DOCTOR' ? { doctorId: userId } : { patientId: userId }

  const prescriptions = await Prescription.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .lean()

  return { prescriptions: await enrichPrescriptions(prescriptions) }
}

module.exports = {
  createPrescription,
  getPrescriptionById,
  listPrescriptions,
  serializePrescription,
  enrichPrescriptions,
  COMPLETED_STATUS,
}
