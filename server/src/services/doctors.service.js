const mongoose = require('mongoose')
const DoctorProfile = require('../models/DoctorProfile')
const User = require('../models/User')
const ApiError = require('../utils/ApiError')

const DAYS_OF_WEEK = DoctorProfile.DAYS_OF_WEEK

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 12
const MAX_LIMIT = 50

const MAX_SEARCH_LENGTH = 100
const MAX_SPECIALIZATION_LENGTH = 100
const MAX_EXPERIENCE = 80
const MAX_FEE = 100000
const MAX_LANGUAGE_LENGTH = 50

const SORT_FIELDS = {
  name_asc: { name: 1, _id: 1 },
  experience_asc: { experience: 1, _id: 1 },
  experience_desc: { experience: -1, _id: 1 },
  fee_asc: { consultationFee: 1, _id: 1 },
  fee_desc: { consultationFee: -1, _id: 1 },
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function parsePositiveInteger(raw, field, errors, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (raw === undefined || raw === '') {
    return null
  }
  const value = Number(raw)
  if (typeof raw !== 'string' && typeof raw !== 'number') {
    errors.push({ field, message: `${field} must be a number` })
    return null
  }
  if (!Number.isInteger(value)) {
    errors.push({ field, message: `${field} must be a whole number` })
    return null
  }
  if (value < min) {
    errors.push({ field, message: `${field} cannot be less than ${min}` })
    return null
  }
  if (value > max) {
    errors.push({ field, message: `${field} cannot exceed ${max}` })
    return null
  }
  return value
}

function parseRangeNumber(raw, field, errors, { max = MAX_EXPERIENCE, label } = {}) {
  if (raw === undefined || raw === '') {
    return null
  }
  const value = Number(raw)
  if (typeof raw !== 'string' && typeof raw !== 'number') {
    errors.push({ field, message: `${label || field} must be a number` })
    return null
  }
  if (!Number.isFinite(value)) {
    errors.push({ field, message: `${label || field} must be a number` })
    return null
  }
  if (value < 0) {
    errors.push({ field, message: `${label || field} cannot be negative` })
    return null
  }
  if (value > max) {
    errors.push({ field, message: `${label || field} cannot exceed ${max}` })
    return null
  }
  return value
}

function buildDiscoveryQuery(query) {
  const errors = []
  const filter = { verificationStatus: 'APPROVED' }

  const rawQ = query.q
  let search = null
  if (rawQ !== undefined && rawQ !== '') {
    if (typeof rawQ !== 'string') {
      errors.push({ field: 'q', message: 'Search must be a string' })
    } else {
      search = rawQ.trim()
      if (search.length === 0) {
        search = null
      } else if (search.length > MAX_SEARCH_LENGTH) {
        errors.push({ field: 'q', message: `Search cannot exceed ${MAX_SEARCH_LENGTH} characters` })
      }
    }
  }

  const rawSpecialization = query.specialization
  let specialization = null
  if (rawSpecialization !== undefined && rawSpecialization !== '') {
    if (typeof rawSpecialization !== 'string') {
      errors.push({ field: 'specialization', message: 'Specialization must be a string' })
    } else {
      specialization = rawSpecialization.trim()
      if (specialization.length > MAX_SPECIALIZATION_LENGTH) {
        errors.push({ field: 'specialization', message: `Specialization cannot exceed ${MAX_SPECIALIZATION_LENGTH} characters` })
      }
      if (specialization.length === 0) {
        specialization = null
      }
    }
  }
  if (specialization) {
    filter.specialization = new RegExp(`^${escapeRegex(specialization)}$`, 'i')
  }

  const rawLanguage = query.language
  let language = null
  if (rawLanguage !== undefined && rawLanguage !== '') {
    if (typeof rawLanguage !== 'string') {
      errors.push({ field: 'language', message: 'Language must be a string' })
    } else {
      language = rawLanguage.trim()
      if (language.length > MAX_LANGUAGE_LENGTH) {
        errors.push({ field: 'language', message: `Language cannot exceed ${MAX_LANGUAGE_LENGTH} characters` })
      }
      if (language.length === 0) {
        language = null
      }
    }
  }
  if (language) {
    filter.languages = new RegExp(`^${escapeRegex(language)}$`, 'i')
  }

  const minExperience = parseRangeNumber(query.minExperience, 'minExperience', errors, {
    max: MAX_EXPERIENCE,
    label: 'Minimum experience',
  })
  const maxExperience = parseRangeNumber(query.maxExperience, 'maxExperience', errors, {
    max: MAX_EXPERIENCE,
    label: 'Maximum experience',
  })
  if (minExperience !== null && maxExperience !== null && minExperience > maxExperience) {
    errors.push({ field: 'minExperience', message: 'Minimum experience cannot exceed maximum experience' })
  }
  if (minExperience !== null) {
    filter.experience = { ...(filter.experience || {}), $gte: minExperience }
  }
  if (maxExperience !== null) {
    filter.experience = { ...(filter.experience || {}), $lte: maxExperience }
  }

  const minFee = parseRangeNumber(query.minFee, 'minFee', errors, {
    max: MAX_FEE,
    label: 'Minimum fee',
  })
  const maxFee = parseRangeNumber(query.maxFee, 'maxFee', errors, {
    max: MAX_FEE,
    label: 'Maximum fee',
  })
  if (minFee !== null && maxFee !== null && minFee > maxFee) {
    errors.push({ field: 'minFee', message: 'Minimum fee cannot exceed maximum fee' })
  }
  if (minFee !== null) {
    filter.consultationFee = { ...(filter.consultationFee || {}), $gte: minFee }
  }
  if (maxFee !== null) {
    filter.consultationFee = { ...(filter.consultationFee || {}), $lte: maxFee }
  }

  const rawDay = query.day
  let day = null
  if (rawDay !== undefined && rawDay !== '') {
    if (typeof rawDay !== 'string') {
      errors.push({ field: 'day', message: 'Day must be one of the supported days of the week' })
    } else {
      day = rawDay.trim().toUpperCase()
      if (!DAYS_OF_WEEK.includes(day)) {
        errors.push({ field: 'day', message: `${rawDay.trim()} is not a supported day of the week` })
      }
    }
  }
  if (day) {
    filter.availability = {
      $elemMatch: { dayOfWeek: day, enabled: true },
    }
  }

  const page = parsePositiveInteger(query.page, 'page', errors, { min: 1 }) ?? DEFAULT_PAGE
  const limit = parsePositiveInteger(query.limit, 'limit', errors, { min: 1, max: MAX_LIMIT }) ?? DEFAULT_LIMIT

  let sort = SORT_FIELDS.name_asc
  if (query.sort !== undefined && query.sort !== '') {
    if (typeof query.sort !== 'string' || !Object.prototype.hasOwnProperty.call(SORT_FIELDS, query.sort)) {
      errors.push({ field: 'sort', message: 'sort must be one of: name_asc, experience_asc, experience_desc, fee_asc, fee_desc' })
    } else {
      sort = SORT_FIELDS[query.sort]
    }
  }

  if (errors.length > 0) {
    throw new ApiError(400, 'Invalid discovery query', 'VALIDATION_ERROR', errors)
  }

  return { filter, search, page, limit, sort }
}

function serializeDoctorCard(doc) {
  const clinicAddress = doc.clinicAddress || {}
  const schedule = (doc.availability || [])
    .filter((d) => d.enabled && d.startTime && d.endTime)
    .map((d) => ({ dayOfWeek: d.dayOfWeek, startTime: d.startTime, endTime: d.endTime }))

  return {
    id: doc._id.toString(),
    name: doc.name || 'Dr. Unknown',
    specialization: doc.specialization,
    qualification: doc.qualification,
    experience: typeof doc.experience === 'number' ? doc.experience : null,
    consultationFee: typeof doc.consultationFee === 'number' ? doc.consultationFee : null,
    bio: doc.bio || null,
    clinicName: doc.clinicName || null,
    clinicAddress: {
      street: clinicAddress.street || null,
      city: clinicAddress.city || null,
      state: clinicAddress.state || null,
      postalCode: clinicAddress.postalCode || null,
      country: clinicAddress.country || null,
    },
    languages: Array.isArray(doc.languages) ? doc.languages : [],
    availability: schedule,
    verificationStatus: doc.verificationStatus || 'APPROVED',
  }
}

async function listDoctors(query) {
  const { filter, search, page, limit, sort } = buildDiscoveryQuery(query)

  const pipeline = [{ $match: filter }]

  pipeline.push({ $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } })
  pipeline.push({
    $addFields: {
      name: { $ifNull: [{ $arrayElemAt: ['$user.name', 0] }, 'Dr. Unknown'] },
    },
  })
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i')
    pipeline.push({
      $match: {
        $or: [{ specialization: rx }, { qualification: rx }, { clinicName: rx }, { name: rx }],
      },
    })
  }
  pipeline.push({ $sort: sort })
  pipeline.push({ $unset: ['user', 'userId'] })
  pipeline.push({
    $facet: {
      metadata: [{ $count: 'total' }],
      data: [{ $skip: (page - 1) * limit }, { $limit: limit }],
    },
  })

  const [{ metadata, data }] = await DoctorProfile.aggregate(pipeline)

  const doctors = data.map(serializeDoctorCard)
  const total = metadata[0] ? metadata[0].total : 0
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit)

  return {
    doctors,
    pagination: { page, limit, total, totalPages },
  }
}

async function getDoctorById(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid doctor identifier', 'VALIDATION_ERROR', [
      { field: 'doctorId', message: 'Doctor ID is not a valid identifier' },
    ])
  }

  const profile = await DoctorProfile.findOne({ _id: id, verificationStatus: 'APPROVED' })

  if (!profile) {
    throw new ApiError(404, 'Doctor not found', 'NOT_FOUND')
  }

  const user = await User.findById(profile.userId).select('name').lean()

  const clinicAddress = profile.clinicAddress || {}
  const availability = (profile.availability || []).map((d) => ({
    dayOfWeek: d.dayOfWeek,
    enabled: d.enabled,
    startTime: d.startTime || null,
    endTime: d.endTime || null,
  }))

  return {
    id: profile._id.toString(),
    name: user && user.name ? user.name : 'Dr. Unknown',
    specialization: profile.specialization,
    qualification: profile.qualification,
    experience: typeof profile.experience === 'number' ? profile.experience : null,
    registrationNumber: profile.registrationNumber,
    bio: profile.bio || null,
    consultationFee: typeof profile.consultationFee === 'number' ? profile.consultationFee : null,
    languages: Array.isArray(profile.languages) ? profile.languages : [],
    clinicName: profile.clinicName || null,
    clinicAddress: {
      street: clinicAddress.street || null,
      city: clinicAddress.city || null,
      state: clinicAddress.state || null,
      postalCode: clinicAddress.postalCode || null,
      country: clinicAddress.country || null,
    },
    availability,
    verificationStatus: profile.verificationStatus,
  }
}

module.exports = {
  listDoctors,
  getDoctorById,
  buildDiscoveryQuery,
  serializeDoctorCard,
}