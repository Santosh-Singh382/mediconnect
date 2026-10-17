const DoctorProfile = require('../models/DoctorProfile')
const ApiError = require('../utils/ApiError')
const {
  applyAddressValidation,
  cleanStringArray,
} = require('../utils/validation')

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

const MAX_SPECIALIZATION = 100
const MAX_QUALIFICATION = 100
const MAX_REGISTRATION_NUMBER = 60
const MAX_BIO = 1000
const MAX_CLINIC_NAME = 120
const MIN_EXPERIENCE = 0
const MAX_EXPERIENCE = 80
const MIN_FEE = 0
const MAX_FEE = 100000
const MAX_LANGUAGES = 20
const MAX_LANGUAGE_LENGTH = 50

const REQUIRED_LABELS = {
  specialization: 'Specialization',
  qualification: 'Qualification',
  registrationNumber: 'Registration number',
}

function validateDoctorInput(input) {
  const errors = []
  const updates = {}

  function addError(field, message) {
    errors.push({ field, message })
  }

  for (const key of ['specialization', 'qualification', 'registrationNumber']) {
    if (input[key] === undefined) continue

    const raw = input[key]
    if (raw === null || raw === '') {
      addError(key, `${REQUIRED_LABELS[key]} is required`)
      continue
    }
    if (typeof raw !== 'string') {
      addError(key, `${REQUIRED_LABELS[key]} must be a string`)
      continue
    }
    const trimmed = raw.trim()
    if (trimmed.length === 0) {
      addError(key, `${REQUIRED_LABELS[key]} is required`)
      continue
    }
    const max = {
      specialization: MAX_SPECIALIZATION,
      qualification: MAX_QUALIFICATION,
      registrationNumber: MAX_REGISTRATION_NUMBER,
    }[key]
    if (trimmed.length > max) {
      addError(key, `${REQUIRED_LABELS[key]} cannot exceed ${max} characters`)
      continue
    }
    updates[key] = trimmed
  }

  if (input.experience !== undefined) {
    const value = coerceNumber(input.experience, 'experience', addError)
    if (value !== null) {
      updates.experience = value
    }
  }

  if (input.consultationFee !== undefined) {
    const value = coerceNumber(input.consultationFee, 'consultationFee', addError)
    if (value !== null) {
      updates.consultationFee = value
    }
  }

  if (input.bio !== undefined) {
    const raw = input.bio
    if (raw === null || raw === '') {
      updates.bio = null
    } else if (typeof raw !== 'string') {
      addError('bio', 'Bio must be a string')
    } else {
      const trimmed = raw.trim()
      if (trimmed.length > MAX_BIO) {
        addError('bio', `Bio cannot exceed ${MAX_BIO} characters`)
      } else {
        updates.bio = trimmed || null
      }
    }
  }

  if (input.clinicName !== undefined) {
    const raw = input.clinicName
    if (raw === null || raw === '') {
      updates.clinicName = null
    } else if (typeof raw !== 'string') {
      addError('clinicName', 'Clinic name must be a string')
    } else {
      const trimmed = raw.trim()
      if (trimmed.length > MAX_CLINIC_NAME) {
        addError('clinicName', `Clinic name cannot exceed ${MAX_CLINIC_NAME} characters`)
      } else {
        updates.clinicName = trimmed || null
      }
    }
  }

  if (input.clinicAddress !== undefined) {
    applyAddressValidation(updates, addError, input.clinicAddress, {
      prefix: 'clinicAddress',
      label: 'Clinic address',
    })
  }

  if (input.languages !== undefined) {
    const { value, error } = cleanStringArray(input.languages, {
      field: 'languages',
      maxItems: MAX_LANGUAGES,
      maxItemLength: MAX_LANGUAGE_LENGTH,
    })
    if (error) addError(error.field, error.message)
    else updates.languages = value
  }

  if (input.availability !== undefined) {
    const { value, error } = cleanAvailability(input.availability)
    if (error) addError(error.field, error.message)
    else updates.availability = value
  }

  if (errors.length > 0) {
    throw new ApiError(400, 'Invalid profile data', 'VALIDATION_ERROR', errors)
  }

  return updates
}

function coerceNumber(raw, field, addError) {
  if (raw === null || raw === '') {
    return null
  }
  const numberValue = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(numberValue)) {
    addError(field, `${label(field)} must be a number`)
    return null
  }
  const bounds = {
    experience: [MIN_EXPERIENCE, MAX_EXPERIENCE],
    consultationFee: [MIN_FEE, MAX_FEE],
  }[field]
  if (numberValue < bounds[0]) {
    addError(field, `${label(field)} cannot be negative`)
    return null
  }
  if (numberValue > bounds[1]) {
    addError(field, `${label(field)} cannot exceed ${bounds[1]}`)
    return null
  }
  return numberValue
}

function label(field) {
  const labels = {
    experience: 'Experience',
    consultationFee: 'Consultation fee',
  }
  return labels[field] || field
}

function cleanAvailability(value) {
  if (!Array.isArray(value)) {
    return { error: { field: 'availability', message: 'availability must be an array' } }
  }
  if (value.length > 7) {
    return { error: { field: 'availability', message: 'availability cannot contain more than 7 days' } }
  }

  const seen = new Set()
  const cleaned = []

  for (const entry of value) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      return { error: { field: 'availability', message: 'availability entries must be objects' } }
    }

    const dayOfWeek =
      typeof entry.dayOfWeek === 'string'
        ? entry.dayOfWeek.trim().toUpperCase()
        : ''

    if (!DoctorProfile.DAYS_OF_WEEK.includes(dayOfWeek)) {
      return { error: { field: 'availability.dayOfWeek', message: `${dayOfWeek} is not a valid day of the week` } }
    }
    if (seen.has(dayOfWeek)) {
      return { error: { field: 'availability.dayOfWeek', message: `${dayOfWeek} appears more than once` } }
    }
    seen.add(dayOfWeek)

    const enabled = entry.enabled === true
    const startTime = typeof entry.startTime === 'string' ? entry.startTime.trim() : ''
    const endTime = typeof entry.endTime === 'string' ? entry.endTime.trim() : ''

    if (!enabled) {
      cleaned.push({ dayOfWeek, enabled, startTime: null, endTime: null })
      continue
    }

    if (!TIME_PATTERN.test(startTime)) {
      return { error: { field: 'availability.startTime', message: `${dayOfWeek} start time must use HH:mm format` } }
    }
    if (!TIME_PATTERN.test(endTime)) {
      return { error: { field: 'availability.endTime', message: `${dayOfWeek} end time must use HH:mm format` } }
    }
    if (startTime >= endTime) {
      return { error: { field: 'availability', message: `${dayOfWeek} start time must be earlier than end time` } }
    }

    cleaned.push({ dayOfWeek, enabled, startTime, endTime })
  }

  return { value: cleaned }
}

function hasClinicAddressContent(profile) {
  const clinicAddress = profile.clinicAddress || {}
  return Boolean(
    clinicAddress.street ||
      clinicAddress.city ||
      clinicAddress.state ||
      clinicAddress.postalCode ||
      clinicAddress.country,
  )
}

function hasEnabledAvailability(profile) {
  return Array.isArray(profile.availability)
    ? profile.availability.some((day) => day.enabled && day.startTime && day.endTime)
    : false
}

function calculateCompletion(profile) {
  const components = [
    Boolean(profile.specialization),
    Boolean(profile.qualification),
    typeof profile.experience === 'number',
    Boolean(profile.registrationNumber),
    typeof profile.consultationFee === 'number',
    Boolean(profile.bio),
    Boolean(profile.clinicName),
    hasClinicAddressContent(profile),
    Array.isArray(profile.languages) && profile.languages.length > 0,
    hasEnabledAvailability(profile),
  ]
  const present = components.filter(Boolean).length
  return Math.round((present / components.length) * 100)
}

function serializeProfile(profile) {
  const clinicAddress = profile.clinicAddress || {}
  const availability = Array.isArray(profile.availability)
    ? profile.availability.map((day) => ({
        dayOfWeek: day.dayOfWeek,
        enabled: day.enabled,
        startTime: day.startTime || null,
        endTime: day.endTime || null,
      }))
    : []

  return {
    specialization: profile.specialization || null,
    qualification: profile.qualification || null,
    experience: typeof profile.experience === 'number' ? profile.experience : null,
    registrationNumber: profile.registrationNumber || null,
    consultationFee:
      typeof profile.consultationFee === 'number' ? profile.consultationFee : null,
    bio: profile.bio || null,
    clinicName: profile.clinicName || null,
    clinicAddress: {
      street: clinicAddress.street || null,
      city: clinicAddress.city || null,
      state: clinicAddress.state || null,
      postalCode: clinicAddress.postalCode || null,
      country: clinicAddress.country || null,
    },
    languages: Array.isArray(profile.languages) ? profile.languages : [],
    availability,
    verificationStatus: profile.verificationStatus || 'PENDING',
  }
}

async function getDoctorProfile(userId) {
  const profile = await DoctorProfile.findOne({ userId })

  return {
    profile: profile ? serializeProfile(profile) : null,
    profileCompletion: profile ? calculateCompletion(profile) : 0,
  }
}

async function saveDoctorProfile(userId, input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new ApiError(400, 'Invalid profile payload', 'INVALID_REQUEST_BODY')
  }

  const existing = await DoctorProfile.findOne({ userId })

  if (input.verificationStatus !== undefined) {
    const current = existing ? existing.verificationStatus : 'PENDING'
    if (input.verificationStatus !== current) {
      throw new ApiError(
        403,
        'Verification status is managed by the platform and cannot be changed by the doctor',
        'FORBIDDEN',
      )
    }
  }

  const updates = validateDoctorInput(input)

  if (!existing) {
    const requiredErrors = Object.keys(REQUIRED_LABELS)
      .filter((key) => updates[key] === undefined || updates[key] === null)
      .map((key) => ({
        field: key,
        message: `${REQUIRED_LABELS[key]} is required`,
      }))
    if (requiredErrors.length > 0) {
      throw new ApiError(400, 'Invalid profile data', 'VALIDATION_ERROR', requiredErrors)
    }
  }

  const profile = await DoctorProfile.findOneAndUpdate(
    { userId },
    { $set: updates },
    {
      returnDocument: 'after',
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    },
  )

  return {
    profile: serializeProfile(profile),
    profileCompletion: calculateCompletion(profile),
  }
}

async function getDoctorDashboard(userId) {
  const { profile, profileCompletion } = await getDoctorProfile(userId)

  return {
    profile,
    profileCompletion,
    verificationStatus: profile ? profile.verificationStatus : 'PENDING',
    stats: {
      // Temporary zero counts. Later modules (appointments, consultations,
      // prescriptions) replace these values with real database aggregations.
      upcomingAppointments: 0,
      completedConsultations: 0,
      prescriptionsCreated: 0,
    },
  }
}

module.exports = {
  getDoctorProfile,
  saveDoctorProfile,
  getDoctorDashboard,
  calculateCompletion,
}