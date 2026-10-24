const mongoose = require('mongoose')
const Pharmacy = require('../models/Pharmacy')
const ApiError = require('../utils/ApiError')
const { PHONE_PATTERN } = require('../utils/validation')

const PINCODE_PATTERN = /^[1-9][0-9]{5}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TIME_PATTERN = Pharmacy.TIME_PATTERN

const REQUIRED_FIELDS = [
  { key: 'pharmacyName', label: 'Pharmacy name', max: 120 },
  { key: 'pharmacistName', label: 'Pharmacist name', max: 100 },
  { key: 'licenseNumber', label: 'License number', max: 60 },
  { key: 'phone', label: 'Phone number', max: 20 },
  { key: 'address', label: 'Address', max: 200 },
  { key: 'city', label: 'City', max: 100 },
  { key: 'state', label: 'State', max: 100 },
  { key: 'pincode', label: 'Pincode', max: 20 },
]

const MAX_EMAIL_LENGTH = 254
const MAX_DESCRIPTION_LENGTH = 1000

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id)
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
  if (value === undefined) {
    return undefined
  }
  if (value === null || value === '') {
    return null
  }
  if (typeof value !== 'string') {
    errors.push({ field, message: `${label} must be a string` })
    return undefined
  }
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return null
  }
  if (trimmed.length > max) {
    errors.push({ field, message: `${label} cannot exceed ${max} characters` })
    return undefined
  }
  return trimmed
}

function validateOptionalEmail(value, errors) {
  const email = validateOptionalString(
    value,
    'email',
    'Email',
    MAX_EMAIL_LENGTH,
    errors,
  )
  if (email === undefined || email === null) {
    return email
  }
  const normalized = email.toLowerCase()
  if (!EMAIL_PATTERN.test(normalized)) {
    errors.push({ field: 'email', message: 'Email address is not valid' })
    return undefined
  }
  return normalized
}

function validateOptionalTime(value, field, label, errors) {
  if (value === undefined) {
    return undefined
  }
  if (value === null || value === '') {
    return null
  }
  if (typeof value !== 'string') {
    errors.push({ field, message: `${label} must be a string` })
    return undefined
  }
  const trimmed = value.trim()
  if (!TIME_PATTERN.test(trimmed)) {
    errors.push({ field, message: `${label} must use HH:mm format` })
    return undefined
  }
  return trimmed
}

function validatePharmacyInput(input, { requireAll }) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new ApiError(400, 'Invalid pharmacy payload', 'INVALID_REQUEST_BODY')
  }

  const errors = []
  const updates = {}

  for (const { key, label, max } of REQUIRED_FIELDS) {
    if (input[key] === undefined) {
      if (requireAll) {
        errors.push({ field: key, message: `${label} is required` })
      }
      continue
    }

    const value = validateRequiredString(input[key], key, label, max, errors)
    if (value !== null) {
      updates[key] = value
    }
  }

  if (updates.phone !== undefined && !PHONE_PATTERN.test(updates.phone)) {
    errors.push({ field: 'phone', message: 'Phone number is not valid' })
    delete updates.phone
  }

  if (updates.pincode !== undefined && !PINCODE_PATTERN.test(updates.pincode)) {
    errors.push({
      field: 'pincode',
      message: 'Pincode must be a valid 6-digit Indian pincode',
    })
    delete updates.pincode
  }

  if (input.email !== undefined) {
    const email = validateOptionalEmail(input.email, errors)
    if (email !== undefined) {
      updates.email = email
    }
  }

  if (input.description !== undefined) {
    const description = validateOptionalString(
      input.description,
      'description',
      'Description',
      MAX_DESCRIPTION_LENGTH,
      errors,
    )
    if (description !== undefined) {
      updates.description = description
    }
  }

  if (input.openingTime !== undefined) {
    const openingTime = validateOptionalTime(
      input.openingTime,
      'openingTime',
      'Opening time',
      errors,
    )
    if (openingTime !== undefined) {
      updates.openingTime = openingTime
    }
  }

  if (input.closingTime !== undefined) {
    const closingTime = validateOptionalTime(
      input.closingTime,
      'closingTime',
      'Closing time',
      errors,
    )
    if (closingTime !== undefined) {
      updates.closingTime = closingTime
    }
  }

  if (errors.length > 0) {
    throw new ApiError(400, 'Invalid pharmacy data', 'VALIDATION_ERROR', errors)
  }

  return updates
}

function validateTimeRange(updates, existing) {
  const openingTime =
    updates.openingTime !== undefined
      ? updates.openingTime
      : existing?.openingTime || null
  const closingTime =
    updates.closingTime !== undefined
      ? updates.closingTime
      : existing?.closingTime || null

  if (Boolean(openingTime) !== Boolean(closingTime)) {
    throw new ApiError(400, 'Invalid pharmacy data', 'VALIDATION_ERROR', [
      {
        field: 'openingTime',
        message: 'Opening and closing time must be provided together',
      },
    ])
  }

  if (openingTime && closingTime && openingTime >= closingTime) {
    throw new ApiError(400, 'Invalid pharmacy data', 'VALIDATION_ERROR', [
      {
        field: 'openingTime',
        message: 'Opening time must be earlier than closing time',
      },
    ])
  }
}

// Verification is platform-controlled. A pharmacy may echo its current status
// but can never change it, including on creation where the only valid value is
// the PENDING default.
function assertVerificationUnchanged(input, currentStatus) {
  if (!input || typeof input !== 'object' || input.verificationStatus === undefined) {
    return
  }

  const current = currentStatus || 'PENDING'
  if (input.verificationStatus !== current) {
    throw new ApiError(
      403,
      'Verification status is managed by the platform and cannot be changed by the pharmacy',
      'FORBIDDEN',
    )
  }
}

function serializeProfile(profile) {
  return {
    id: profile._id.toString(),
    pharmacyName: profile.pharmacyName || null,
    pharmacistName: profile.pharmacistName || null,
    licenseNumber: profile.licenseNumber || null,
    phone: profile.phone || null,
    email: profile.email || null,
    address: profile.address || null,
    city: profile.city || null,
    state: profile.state || null,
    pincode: profile.pincode || null,
    description: profile.description || null,
    openingTime: profile.openingTime || null,
    closingTime: profile.closingTime || null,
    verificationStatus: profile.verificationStatus || 'PENDING',
    isActive: profile.isActive !== false,
    createdAt: profile.createdAt ? profile.createdAt.toISOString() : null,
    updatedAt: profile.updatedAt ? profile.updatedAt.toISOString() : null,
  }
}

// Public discovery exposes business contact and location details only. The
// owning user account and internal document fields are never serialized.
function serializePublicPharmacy(profile) {
  return {
    id: profile._id.toString(),
    pharmacyName: profile.pharmacyName || null,
    pharmacistName: profile.pharmacistName || null,
    licenseNumber: profile.licenseNumber || null,
    phone: profile.phone || null,
    email: profile.email || null,
    address: profile.address || null,
    city: profile.city || null,
    state: profile.state || null,
    pincode: profile.pincode || null,
    description: profile.description || null,
    openingTime: profile.openingTime || null,
    closingTime: profile.closingTime || null,
    verificationStatus: profile.verificationStatus || 'PENDING',
    isActive: profile.isActive !== false,
  }
}

function duplicateProfileError(error) {
  if (!error || error.code !== 11000) {
    return null
  }
  if (error.keyPattern && error.keyPattern.licenseNumber) {
    return new ApiError(
      409,
      'A pharmacy with this license number already exists',
      'LICENSE_TAKEN',
    )
  }
  return new ApiError(
    409,
    'A pharmacy profile already exists for this account',
    'PROFILE_EXISTS',
  )
}

async function getMyPharmacy(userId) {
  const profile = await Pharmacy.findOne({ userId })

  return {
    profile: profile ? serializeProfile(profile) : null,
  }
}

async function createMyPharmacy(userId, input) {
  const existing = await Pharmacy.findOne({ userId })
  if (existing) {
    throw new ApiError(
      409,
      'A pharmacy profile already exists for this account',
      'PROFILE_EXISTS',
    )
  }

  assertVerificationUnchanged(input, null)

  const updates = validatePharmacyInput(input, { requireAll: true })
  validateTimeRange(updates, null)

  try {
    const profile = await Pharmacy.create({ userId, ...updates })
    return { profile: serializeProfile(profile) }
  } catch (error) {
    const duplicate = duplicateProfileError(error)
    if (duplicate) {
      throw duplicate
    }
    throw error
  }
}

async function updateMyPharmacy(userId, input) {
  const existing = await Pharmacy.findOne({ userId })
  if (!existing) {
    throw new ApiError(
      404,
      'Pharmacy profile not found. Create a profile first.',
      'NOT_FOUND',
    )
  }

  assertVerificationUnchanged(input, existing.verificationStatus)

  const updates = validatePharmacyInput(input, { requireAll: false })
  validateTimeRange(updates, existing)

  if (Object.keys(updates).length === 0) {
    return { profile: serializeProfile(existing) }
  }

  try {
    const profile = await Pharmacy.findOneAndUpdate(
      { userId },
      { $set: updates },
      {
        returnDocument: 'after',
        runValidators: true,
      },
    )
    return { profile: serializeProfile(profile) }
  } catch (error) {
    const duplicate = duplicateProfileError(error)
    if (duplicate) {
      throw duplicate
    }
    throw error
  }
}

async function getPharmacyById(pharmacyId) {
  if (!isValidObjectId(pharmacyId)) {
    throw new ApiError(400, 'Invalid pharmacy identifier', 'VALIDATION_ERROR', [
      {
        field: 'pharmacyId',
        message: 'Pharmacy ID is not a valid identifier',
      },
    ])
  }

  const profile = await Pharmacy.findOne({
    _id: pharmacyId,
    verificationStatus: 'APPROVED',
    isActive: true,
  })

  if (!profile) {
    throw new ApiError(404, 'Pharmacy not found', 'NOT_FOUND')
  }

  return serializePublicPharmacy(profile)
}

module.exports = {
  getMyPharmacy,
  createMyPharmacy,
  updateMyPharmacy,
  getPharmacyById,
  serializeProfile,
  serializePublicPharmacy,
}
