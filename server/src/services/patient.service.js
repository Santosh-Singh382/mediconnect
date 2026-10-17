const PatientProfile = require('../models/PatientProfile')
const ApiError = require('../utils/ApiError')
const {
  PHONE_PATTERN,
  applyAddressValidation,
  cleanStringArray,
} = require('../utils/validation')

const GENDERS = ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

const EMERGENCY_CONTACT_KEYS = ['name', 'relationship', 'phone']

const MAX_HEALTH_ARRAY_ITEMS = 50
const MAX_HEALTH_ITEM_LENGTH = 100

function validateProfileInput(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new ApiError(400, 'Invalid profile payload', 'INVALID_REQUEST_BODY')
  }

  const errors = []
  const updates = {}

  function addError(field, message) {
    errors.push({ field, message })
  }

  if (input.dateOfBirth !== undefined) {
    const raw = input.dateOfBirth
    if (raw === null || raw === '') {
      updates.dateOfBirth = null
    } else if (typeof raw === 'string' || raw instanceof Date) {
      const parsed = new Date(raw)
      if (Number.isNaN(parsed.getTime())) {
        addError('dateOfBirth', 'Date of birth is not a valid date')
      } else if (parsed.getTime() > Date.now()) {
        addError('dateOfBirth', 'Date of birth cannot be in the future')
      } else {
        updates.dateOfBirth = parsed
      }
    } else {
      addError('dateOfBirth', 'Date of birth is not a valid date')
    }
  }

  if (input.gender !== undefined) {
    const raw = input.gender
    if (raw === null || raw === '') {
      updates.gender = null
    } else if (typeof raw !== 'string' || !GENDERS.includes(raw.trim())) {
      addError('gender', 'Gender is not supported')
    } else {
      updates.gender = raw.trim()
    }
  }

  if (input.bloodGroup !== undefined) {
    const raw = input.bloodGroup
    if (raw === null || raw === '') {
      updates.bloodGroup = null
    } else if (typeof raw !== 'string' || !BLOOD_GROUPS.includes(raw.trim())) {
      addError('bloodGroup', 'Blood group is not supported')
    } else {
      updates.bloodGroup = raw.trim()
    }
  }

  if (input.address !== undefined) {
    applyAddressValidation(updates, addError, input.address, {
      prefix: 'address',
      label: 'Address',
    })
  }

  if (input.emergencyContact !== undefined) {
    const raw = input.emergencyContact
    if (raw === null || raw === '') {
      for (const key of EMERGENCY_CONTACT_KEYS) {
        updates[`emergencyContact.${key}`] = null
      }
    } else if (typeof raw !== 'object' || Array.isArray(raw)) {
      addError('emergencyContact', 'Emergency contact must be an object')
    } else {
      for (const key of EMERGENCY_CONTACT_KEYS) {
        if (raw[key] === undefined) continue

        const value = raw[key]
        if (value === null || value === '') {
          updates[`emergencyContact.${key}`] = null
          continue
        }
        if (typeof value !== 'string') {
          addError(`emergencyContact.${key}`, 'Emergency contact fields must be strings')
          continue
        }

        const trimmed = value.trim()
        if (key === 'phone' && !PHONE_PATTERN.test(trimmed)) {
          addError('emergencyContact.phone', 'Emergency contact phone is not valid')
          continue
        }
        updates[`emergencyContact.${key}`] = trimmed || null
      }
    }
  }

  if (input.allergies !== undefined) {
    const { value, error } = cleanStringArray(input.allergies, {
      field: 'allergies',
      maxItems: MAX_HEALTH_ARRAY_ITEMS,
      maxItemLength: MAX_HEALTH_ITEM_LENGTH,
    })
    if (error) addError(error.field, error.message)
    else updates.allergies = value
  }

  if (input.existingConditions !== undefined) {
    const { value, error } = cleanStringArray(input.existingConditions, {
      field: 'existingConditions',
      maxItems: MAX_HEALTH_ARRAY_ITEMS,
      maxItemLength: MAX_HEALTH_ITEM_LENGTH,
    })
    if (error) addError(error.field, error.message)
    else updates.existingConditions = value
  }

  if (errors.length > 0) {
    throw new ApiError(400, 'Invalid profile data', 'VALIDATION_ERROR', errors)
  }

  return updates
}

function hasAddressContent(profile) {
  const address = profile.address || {}
  return Boolean(
    address.street || address.city || address.state || address.postalCode || address.country,
  )
}

function calculateCompletion(profile) {
  const components = [
    Boolean(profile.dateOfBirth),
    Boolean(profile.gender),
    hasAddressContent(profile),
    Boolean(
      profile.emergencyContact &&
        profile.emergencyContact.name &&
        profile.emergencyContact.phone,
    ),
    Boolean(profile.bloodGroup),
  ]
  const present = components.filter(Boolean).length
  return Math.round((present / components.length) * 100)
}

function serializeProfile(profile) {
  const address = profile.address || {}
  const emergencyContact = profile.emergencyContact || {}

  return {
    dateOfBirth: profile.dateOfBirth
      ? profile.dateOfBirth.toISOString().slice(0, 10)
      : null,
    gender: profile.gender || null,
    address: {
      street: address.street || null,
      city: address.city || null,
      state: address.state || null,
      postalCode: address.postalCode || null,
      country: address.country || null,
    },
    emergencyContact: {
      name: emergencyContact.name || null,
      relationship: emergencyContact.relationship || null,
      phone: emergencyContact.phone || null,
    },
    bloodGroup: profile.bloodGroup || null,
    allergies: Array.isArray(profile.allergies) ? profile.allergies : [],
    existingConditions: Array.isArray(profile.existingConditions)
      ? profile.existingConditions
      : [],
  }
}

async function getPatientProfile(userId) {
  const profile = await PatientProfile.findOne({ userId })

  return {
    profile: profile ? serializeProfile(profile) : null,
    profileCompletion: profile ? calculateCompletion(profile) : 0,
  }
}

async function savePatientProfile(userId, input) {
  const updates = validateProfileInput(input)

  const profile = await PatientProfile.findOneAndUpdate(
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

async function getPatientDashboard(userId) {
  const { profile, profileCompletion } = await getPatientProfile(userId)

  return {
    profile,
    profileCompletion,
    stats: {
      // Temporary zero counts. Later modules (appointments, consultations,
      // prescriptions, medical records, orders) replace these values with
      // real database aggregations.
      upcomingAppointments: 0,
      completedConsultations: 0,
      prescriptions: 0,
      medicalRecords: 0,
      orders: 0,
    },
  }
}

module.exports = {
  getPatientProfile,
  savePatientProfile,
  getPatientDashboard,
  calculateCompletion,
}