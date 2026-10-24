const mongoose = require('mongoose')
const Medicine = require('../models/Medicine')
const Pharmacy = require('../models/Pharmacy')
const ApiError = require('../utils/ApiError')
const { DATE_PATTERN } = require('../models/Appointment')
const {
  MEDICINE_CATEGORIES,
  MAX_NAME_LENGTH,
  MAX_GENERIC_NAME_LENGTH,
  MAX_BRAND_NAME_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_DOSAGE_FORM_LENGTH,
  MAX_STRENGTH_LENGTH,
  MAX_PACK_SIZE_LENGTH,
  MAX_PRICE,
  MAX_STOCK_QUANTITY,
} = require('../models/Medicine')

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50
const MAX_SEARCH_LENGTH = 100
const MIN_EXPIRY_YEAR = 1900
const MAX_EXPIRY_YEAR = 2200

const SORT_FIELDS = {
  name_asc: { name: 1, _id: 1 },
  name_desc: { name: -1, _id: 1 },
  price_asc: { price: 1, _id: 1 },
  price_desc: { price: -1, _id: 1 },
  stock_asc: { stockQuantity: 1, _id: 1 },
  stock_desc: { stockQuantity: -1, _id: 1 },
  expiry_asc: { expiryDate: 1, _id: 1 },
  expiry_desc: { expiryDate: -1, _id: 1 },
}

const SORT_OPTIONS = Object.keys(SORT_FIELDS)

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id)
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function parseDateOnly(value) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    return null
  }

  const [year, month, day] = value.split('-').map(Number)
  if (year < MIN_EXPIRY_YEAR || year > MAX_EXPIRY_YEAR) {
    return null
  }

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

function formatDateOnly(value) {
  return value ? value.toISOString().slice(0, 10) : null
}

function isExpired(value) {
  if (!value) {
    return false
  }
  const now = new Date()
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return value.getTime() < today
}

function validateRequiredString(value, field, label, max, errors) {
  if (value === undefined || value === null || value === '') {
    errors.push({ field, message: `${label} is required` })
    return undefined
  }
  if (typeof value !== 'string') {
    errors.push({ field, message: `${label} must be a string` })
    return undefined
  }
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    errors.push({ field, message: `${label} is required` })
    return undefined
  }
  if (trimmed.length > max) {
    errors.push({ field, message: `${label} cannot exceed ${max} characters` })
    return undefined
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

function validateCategory(value, errors) {
  if (value === undefined || value === null || value === '') {
    errors.push({ field: 'category', message: 'Category is required' })
    return undefined
  }
  if (typeof value !== 'string') {
    errors.push({ field: 'category', message: 'Category must be a string' })
    return undefined
  }
  const normalized = value.trim().toUpperCase()
  if (!MEDICINE_CATEGORIES.includes(normalized)) {
    errors.push({
      field: 'category',
      message: `Category must be one of: ${MEDICINE_CATEGORIES.join(', ')}`,
    })
    return undefined
  }
  return normalized
}

function validatePrice(value, errors, { required }) {
  if (value === undefined) {
    if (required) {
      errors.push({ field: 'price', message: 'Price is required' })
    }
    return undefined
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    errors.push({ field: 'price', message: 'Price must be a valid number' })
    return undefined
  }
  if (value < 0) {
    errors.push({ field: 'price', message: 'Price cannot be negative' })
    return undefined
  }
  if (value > MAX_PRICE) {
    errors.push({ field: 'price', message: `Price cannot exceed ${MAX_PRICE}` })
    return undefined
  }

  const paise = value * 100
  if (Math.abs(paise - Math.round(paise)) > 1e-9) {
    errors.push({
      field: 'price',
      message: 'Price cannot have more than 2 decimal places',
    })
    return undefined
  }

  return Math.round(paise) / 100
}

function validateStockQuantity(value, errors, { required }) {
  if (value === undefined) {
    if (required) {
      errors.push({ field: 'stockQuantity', message: 'Stock quantity is required' })
    }
    return undefined
  }
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    errors.push({
      field: 'stockQuantity',
      message: 'Stock quantity must be a whole number',
    })
    return undefined
  }
  if (value < 0) {
    errors.push({
      field: 'stockQuantity',
      message: 'Stock quantity cannot be negative',
    })
    return undefined
  }
  if (value > MAX_STOCK_QUANTITY) {
    errors.push({
      field: 'stockQuantity',
      message: `Stock quantity cannot exceed ${MAX_STOCK_QUANTITY}`,
    })
    return undefined
  }
  return value
}

function validateExpiryDate(value, errors, { required }) {
  if (value === undefined) {
    if (required) {
      errors.push({ field: 'expiryDate', message: 'Expiry date is required' })
    }
    return undefined
  }

  const parsed = parseDateOnly(value)
  if (!parsed) {
    errors.push({
      field: 'expiryDate',
      message: 'Expiry date must be a valid date in YYYY-MM-DD format',
    })
    return undefined
  }
  return parsed
}

function validatePrescriptionRequired(value, errors) {
  if (value === undefined) {
    return undefined
  }
  if (typeof value !== 'boolean') {
    errors.push({
      field: 'prescriptionRequired',
      message: 'Prescription required must be true or false',
    })
    return undefined
  }
  return value
}

function validateMedicineInput(input, { requireAll }) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new ApiError(400, 'Invalid medicine payload', 'INVALID_REQUEST_BODY')
  }

  const errors = []
  const updates = {}

  if (input.name !== undefined || requireAll) {
    const name = validateRequiredString(
      input.name,
      'name',
      'Medicine name',
      MAX_NAME_LENGTH,
      errors,
    )
    if (name !== undefined) {
      updates.name = name
    }
  }

  if (input.category !== undefined || requireAll) {
    const category = validateCategory(input.category, errors)
    if (category !== undefined) {
      updates.category = category
    }
  }

  const price = validatePrice(input.price, errors, { required: requireAll })
  if (price !== undefined) {
    updates.price = price
  }

  const stockQuantity = validateStockQuantity(input.stockQuantity, errors, {
    required: requireAll,
  })
  if (stockQuantity !== undefined) {
    updates.stockQuantity = stockQuantity
  }

  if (input.expiryDate !== undefined || requireAll) {
    const expiryDate = validateExpiryDate(input.expiryDate, errors, {
      required: requireAll,
    })
    if (expiryDate !== undefined) {
      updates.expiryDate = expiryDate
    }
  }

  const prescriptionRequired = validatePrescriptionRequired(
    input.prescriptionRequired,
    errors,
  )
  if (prescriptionRequired !== undefined) {
    updates.prescriptionRequired = prescriptionRequired
  }

  const optionalFields = [
    ['genericName', 'Generic name', MAX_GENERIC_NAME_LENGTH],
    ['brandName', 'Brand name', MAX_BRAND_NAME_LENGTH],
    ['description', 'Description', MAX_DESCRIPTION_LENGTH],
    ['dosageForm', 'Dosage form', MAX_DOSAGE_FORM_LENGTH],
    ['strength', 'Strength', MAX_STRENGTH_LENGTH],
    ['packSize', 'Pack size', MAX_PACK_SIZE_LENGTH],
  ]

  for (const [field, label, max] of optionalFields) {
    if (input[field] === undefined) {
      continue
    }
    const value = validateOptionalString(input[field], field, label, max, errors)
    if (value !== undefined) {
      updates[field] = value
    }
  }

  if (errors.length > 0) {
    throw new ApiError(400, 'Invalid medicine data', 'VALIDATION_ERROR', errors)
  }

  return updates
}

function normalizeIdentityPart(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
  return normalized
}

// Duplicate identity is scoped to one pharmacy: name + strength + dosage form,
// normalized for case and whitespace. Different pharmacies may stock the same
// medicine, and a different strength or dosage form is a separate item.
function buildIdentityKey({ name, strength, dosageForm }) {
  return JSON.stringify([
    normalizeIdentityPart(name),
    normalizeIdentityPart(strength),
    normalizeIdentityPart(dosageForm),
  ])
}

async function getInventoryPharmacy(userId) {
  const pharmacy = await Pharmacy.findOne({ userId })

  if (!pharmacy) {
    throw new ApiError(
      404,
      'Create your pharmacy profile before managing inventory',
      'PROFILE_REQUIRED',
    )
  }

  if (pharmacy.verificationStatus === 'REJECTED') {
    throw new ApiError(
      403,
      'Your pharmacy profile was rejected. Inventory management is unavailable.',
      'PHARMACY_REJECTED',
    )
  }

  if (pharmacy.isActive === false) {
    throw new ApiError(
      403,
      'Your pharmacy account is inactive. Inventory management is unavailable.',
      'PHARMACY_INACTIVE',
    )
  }

  return pharmacy
}

function serializeMedicine(medicine) {
  return {
    id: medicine._id.toString(),
    name: medicine.name,
    genericName: medicine.genericName || null,
    brandName: medicine.brandName || null,
    category: medicine.category,
    description: medicine.description || null,
    dosageForm: medicine.dosageForm || null,
    strength: medicine.strength || null,
    packSize: medicine.packSize || null,
    price: medicine.price,
    stockQuantity: medicine.stockQuantity,
    prescriptionRequired: medicine.prescriptionRequired !== false,
    expiryDate: formatDateOnly(medicine.expiryDate),
    isExpired: isExpired(medicine.expiryDate),
    isActive: medicine.isActive !== false,
    createdAt: medicine.createdAt ? medicine.createdAt.toISOString() : null,
    updatedAt: medicine.updatedAt ? medicine.updatedAt.toISOString() : null,
  }
}

function duplicateMedicineError() {
  return new ApiError(
    409,
    'This medicine already exists in your inventory',
    'DUPLICATE_MEDICINE',
  )
}

async function assertUniqueIdentity(pharmacyId, identityKey, excludeId) {
  const filter = { pharmacyId, identityKey }
  if (excludeId) {
    filter._id = { $ne: excludeId }
  }

  const existing = await Medicine.findOne(filter).select('_id').lean()
  if (existing) {
    throw duplicateMedicineError()
  }
}

function handleDuplicateKey(error) {
  if (error && error.code === 11000) {
    throw duplicateMedicineError()
  }
  throw error
}

function validateMedicineId(medicineId) {
  if (!isValidObjectId(medicineId)) {
    throw new ApiError(400, 'Invalid medicine identifier', 'VALIDATION_ERROR', [
      {
        field: 'medicineId',
        message: 'Medicine ID is not a valid identifier',
      },
    ])
  }
}

function parsePositiveInteger(raw, field, errors, fallback, max = Number.MAX_SAFE_INTEGER) {
  if (raw === undefined || raw === '') {
    return fallback
  }
  if (typeof raw !== 'string' && typeof raw !== 'number') {
    errors.push({ field, message: `${field} must be a number` })
    return fallback
  }
  const value = Number(raw)
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

function parseListQuery(query) {
  const errors = []
  const filter = {}

  if (query.q !== undefined && query.q !== '') {
    if (typeof query.q !== 'string') {
      errors.push({ field: 'q', message: 'Search must be a string' })
    } else {
      const search = query.q.trim()
      if (search.length > MAX_SEARCH_LENGTH) {
        errors.push({
          field: 'q',
          message: `Search cannot exceed ${MAX_SEARCH_LENGTH} characters`,
        })
      } else if (search.length > 0) {
        const pattern = new RegExp(escapeRegex(search), 'i')
        filter.$or = [
          { name: pattern },
          { genericName: pattern },
          { brandName: pattern },
        ]
      }
    }
  }

  if (query.category !== undefined && query.category !== '') {
    const category = validateCategory(query.category, errors)
    if (category !== undefined) {
      filter.category = category
    }
  }

  if (query.isActive !== undefined && query.isActive !== '') {
    if (typeof query.isActive !== 'string') {
      errors.push({ field: 'isActive', message: 'isActive must be true or false' })
    } else {
      const normalized = query.isActive.trim().toLowerCase()
      if (normalized !== 'true' && normalized !== 'false') {
        errors.push({
          field: 'isActive',
          message: 'isActive must be true or false',
        })
      } else {
        filter.isActive = normalized === 'true'
      }
    }
  }

  const page = parsePositiveInteger(query.page, 'page', errors, DEFAULT_PAGE)
  const limit = parsePositiveInteger(query.limit, 'limit', errors, DEFAULT_LIMIT, MAX_LIMIT)

  let sort = SORT_FIELDS.name_asc
  if (query.sort !== undefined && query.sort !== '') {
    if (
      typeof query.sort !== 'string' ||
      !Object.prototype.hasOwnProperty.call(SORT_FIELDS, query.sort)
    ) {
      errors.push({
        field: 'sort',
        message: `sort must be one of: ${SORT_OPTIONS.join(', ')}`,
      })
    } else {
      sort = SORT_FIELDS[query.sort]
    }
  }

  if (errors.length > 0) {
    throw new ApiError(400, 'Invalid medicine inventory query', 'VALIDATION_ERROR', errors)
  }

  return { filter, page, limit, sort }
}

async function createMedicine(userId, input) {
  const pharmacy = await getInventoryPharmacy(userId)
  const updates = validateMedicineInput(input, { requireAll: true })
  const identityKey = buildIdentityKey(updates)

  await assertUniqueIdentity(pharmacy._id, identityKey)

  try {
    const medicine = await Medicine.create({
      pharmacyId: pharmacy._id,
      ...updates,
      identityKey,
    })
    return serializeMedicine(medicine)
  } catch (error) {
    handleDuplicateKey(error)
  }
}

async function listMyMedicines(userId, query) {
  const pharmacy = await getInventoryPharmacy(userId)
  const { filter, page, limit, sort } = parseListQuery(query || {})
  filter.pharmacyId = pharmacy._id

  const [total, medicines] = await Promise.all([
    Medicine.countDocuments(filter),
    Medicine.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ])

  const totalPages = total === 0 ? 0 : Math.ceil(total / limit)

  return {
    medicines: medicines.map(serializeMedicine),
    pagination: { page, limit, total, totalPages },
  }
}

async function getMyMedicineById(userId, medicineId) {
  const pharmacy = await getInventoryPharmacy(userId)
  validateMedicineId(medicineId)

  const medicine = await Medicine.findOne({
    _id: medicineId,
    pharmacyId: pharmacy._id,
  }).lean()

  if (!medicine) {
    throw new ApiError(404, 'Medicine not found', 'NOT_FOUND')
  }

  return serializeMedicine(medicine)
}

async function updateMyMedicine(userId, medicineId, input) {
  const pharmacy = await getInventoryPharmacy(userId)
  validateMedicineId(medicineId)

  const existing = await Medicine.findOne({
    _id: medicineId,
    pharmacyId: pharmacy._id,
  }).select('+identityKey')

  if (!existing) {
    throw new ApiError(404, 'Medicine not found', 'NOT_FOUND')
  }

  const updates = validateMedicineInput(input, { requireAll: false })

  const identityKey = buildIdentityKey({
    name: updates.name !== undefined ? updates.name : existing.name,
    strength: updates.strength !== undefined ? updates.strength : existing.strength,
    dosageForm:
      updates.dosageForm !== undefined ? updates.dosageForm : existing.dosageForm,
  })

  if (identityKey !== existing.identityKey) {
    await assertUniqueIdentity(pharmacy._id, identityKey, existing._id)
    updates.identityKey = identityKey
  }

  if (Object.keys(updates).length === 0) {
    return serializeMedicine(existing)
  }

  try {
    const medicine = await Medicine.findOneAndUpdate(
      { _id: medicineId, pharmacyId: pharmacy._id },
      { $set: updates },
      { returnDocument: 'after', runValidators: true },
    ).lean()

    if (!medicine) {
      throw new ApiError(404, 'Medicine not found', 'NOT_FOUND')
    }

    return serializeMedicine(medicine)
  } catch (error) {
    handleDuplicateKey(error)
  }
}

async function setMyMedicineActive(userId, medicineId, isActive) {
  const pharmacy = await getInventoryPharmacy(userId)
  validateMedicineId(medicineId)

  const medicine = await Medicine.findOneAndUpdate(
    { _id: medicineId, pharmacyId: pharmacy._id },
    { $set: { isActive } },
    { returnDocument: 'after', runValidators: true },
  ).lean()

  if (!medicine) {
    throw new ApiError(404, 'Medicine not found', 'NOT_FOUND')
  }

  return serializeMedicine(medicine)
}

async function deactivateMyMedicine(userId, medicineId) {
  return setMyMedicineActive(userId, medicineId, false)
}

async function reactivateMyMedicine(userId, medicineId) {
  return setMyMedicineActive(userId, medicineId, true)
}

module.exports = {
  createMedicine,
  listMyMedicines,
  getMyMedicineById,
  updateMyMedicine,
  deactivateMyMedicine,
  reactivateMyMedicine,
  serializeMedicine,
  buildIdentityKey,
  parseListQuery,
}
