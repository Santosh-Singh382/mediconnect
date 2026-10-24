const mongoose = require('mongoose')
const Medicine = require('../models/Medicine')
const Pharmacy = require('../models/Pharmacy')
const ApiError = require('../utils/ApiError')

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50
const MAX_SEARCH_LENGTH = 100
const MAX_PRICE = 1000000

const SORT_FIELDS = {
  name_asc: { name: 1, _id: 1 },
  name_desc: { name: -1, _id: 1 },
  price_asc: { price: 1, _id: 1 },
  price_desc: { price: -1, _id: 1 },
  expiry_asc: { expiryDate: 1, _id: 1 },
  expiry_desc: { expiryDate: -1, _id: 1 },
  stock_desc: { stockQuantity: -1, _id: 1 },
  newest: { createdAt: -1, _id: -1 },
}

const SORT_OPTIONS = Object.keys(SORT_FIELDS)

const PUBLIC_PHARMACY_PROJECTION = {
  pharmacyName: 1,
  pharmacistName: 1,
  address: 1,
  city: 1,
  state: 1,
  pincode: 1,
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function startOfTodayUtc() {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

function formatDateOnly(value) {
  return value ? value.toISOString().slice(0, 10) : null
}

function isExpired(value) {
  if (!value) return false
  return value.getTime() < startOfTodayUtc().getTime()
}

function parseSearch(raw, errors) {
  if (raw === undefined || raw === '') return null
  if (typeof raw !== 'string') {
    errors.push({ field: 'q', message: 'Search must be a string' })
    return null
  }
  const search = raw.trim()
  if (search.length === 0) return null
  if (search.length > MAX_SEARCH_LENGTH) {
    errors.push({
      field: 'q',
      message: `Search cannot exceed ${MAX_SEARCH_LENGTH} characters`,
    })
    return null
  }
  return search
}

function parseCategory(raw, errors) {
  if (raw === undefined || raw === '') return null
  if (typeof raw !== 'string') {
    errors.push({ field: 'category', message: 'Category must be a string' })
    return null
  }
  const category = raw.trim().toUpperCase()
  if (category.length === 0) return null
  if (!Medicine.MEDICINE_CATEGORIES.includes(category)) {
    errors.push({
      field: 'category',
      message: `${raw.trim()} is not a supported medicine category`,
    })
    return null
  }
  return category
}

function parseBoolean(raw, field, errors) {
  if (raw === undefined || raw === '') return null
  if (typeof raw !== 'string') {
    errors.push({ field, message: `${field} must be true or false` })
    return null
  }
  const normalized = raw.trim().toLowerCase()
  if (normalized !== 'true' && normalized !== 'false') {
    errors.push({ field, message: `${field} must be true or false` })
    return null
  }
  return normalized === 'true'
}

function parsePrice(raw, field, errors) {
  if (raw === undefined || raw === '') return null
  if (typeof raw !== 'string') {
    errors.push({ field, message: `${field} must be a number` })
    return null
  }
  const trimmed = raw.trim()
  if (trimmed === '') return null
  const value = Number(trimmed)
  if (!Number.isFinite(value)) {
    errors.push({ field, message: `${field} must be a number` })
    return null
  }
  if (value < 0) {
    errors.push({ field, message: `${field} cannot be negative` })
    return null
  }
  if (value > MAX_PRICE) {
    errors.push({ field, message: `${field} cannot exceed ${MAX_PRICE}` })
    return null
  }
  return value
}

function parsePositiveInteger(raw, field, errors, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (raw === undefined || raw === '') return null
  if (typeof raw !== 'string') {
    errors.push({ field, message: `${field} must be a number` })
    return null
  }
  const trimmed = raw.trim()
  if (trimmed === '') return null
  const value = Number(trimmed)
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

function parsePharmacyId(raw, errors) {
  if (raw === undefined || raw === '') return null
  if (typeof raw !== 'string') {
    errors.push({ field: 'pharmacyId', message: 'Pharmacy ID must be a string' })
    return null
  }
  const pharmacyId = raw.trim()
  if (pharmacyId.length === 0) return null
  if (!mongoose.Types.ObjectId.isValid(pharmacyId)) {
    errors.push({
      field: 'pharmacyId',
      message: 'Pharmacy ID is not a valid identifier',
    })
    return null
  }
  return new mongoose.Types.ObjectId(pharmacyId)
}

function buildPublicQuery(query) {
  const errors = []
  const filter = {
    isActive: true,
    expiryDate: { $gte: startOfTodayUtc() },
    stockQuantity: { $gte: 0 },
  }

  const search = parseSearch(query.q, errors)
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i')
    filter.$or = [
      { name: pattern },
      { genericName: pattern },
      { brandName: pattern },
      { strength: pattern },
    ]
  }

  const category = parseCategory(query.category, errors)
  if (category) filter.category = category

  const minPrice = parsePrice(query.minPrice, 'minPrice', errors)
  const maxPrice = parsePrice(query.maxPrice, 'maxPrice', errors)
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    errors.push({
      field: 'minPrice',
      message: 'Minimum price cannot exceed maximum price',
    })
  }
  if (minPrice !== null || maxPrice !== null) {
    filter.price = {}
    if (minPrice !== null) filter.price.$gte = minPrice
    if (maxPrice !== null) filter.price.$lte = maxPrice
  }

  const prescriptionRequired = parseBoolean(
    query.prescriptionRequired,
    'prescriptionRequired',
    errors,
  )
  if (prescriptionRequired !== null) {
    filter.prescriptionRequired = prescriptionRequired
  }

  const inStock = parseBoolean(query.inStock, 'inStock', errors)
  if (inStock === true) {
    filter.stockQuantity.$gt = 0
  } else if (inStock === false) {
    filter.stockQuantity.$lte = 0
  }

  const pharmacyId = parsePharmacyId(query.pharmacyId, errors)
  if (pharmacyId) filter.pharmacyId = pharmacyId

  const page = parsePositiveInteger(query.page, 'page', errors, { min: 1 }) ?? DEFAULT_PAGE
  const limit =
    parsePositiveInteger(query.limit, 'limit', errors, { min: 1, max: MAX_LIMIT }) ??
    DEFAULT_LIMIT

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
    throw new ApiError(400, 'Invalid public medicine query', 'VALIDATION_ERROR', errors)
  }

  return { filter, page, limit, sort }
}

function serializePharmacySummary(pharmacy) {
  return {
    id: pharmacy._id.toString(),
    pharmacyName: pharmacy.pharmacyName || null,
    pharmacistName: pharmacy.pharmacistName || null,
    address: pharmacy.address || null,
    city: pharmacy.city || null,
    state: pharmacy.state || null,
    pincode: pharmacy.pincode || null,
  }
}

function serializePublicMedicine(medicine) {
  const stock = Number.isFinite(medicine.stockQuantity)
    ? Math.max(0, Math.trunc(medicine.stockQuantity))
    : 0

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
    price: typeof medicine.price === 'number' ? medicine.price : null,
    stockQuantity: stock,
    inStock: stock > 0,
    prescriptionRequired: medicine.prescriptionRequired !== false,
    expiryDate: formatDateOnly(medicine.expiryDate),
    isExpired: isExpired(medicine.expiryDate),
    pharmacy: serializePharmacySummary(medicine.pharmacy),
  }
}

async function searchPublicMedicines(query) {
  const { filter, page, limit, sort } = buildPublicQuery(query || {})

  const [result] = await Medicine.aggregate([
    { $match: filter },
    {
      $lookup: {
        from: 'pharmacies',
        localField: 'pharmacyId',
        foreignField: '_id',
        as: 'pharmacy',
        pipeline: [
          {
            $match: {
              verificationStatus: 'APPROVED',
              isActive: true,
            },
          },
          { $project: PUBLIC_PHARMACY_PROJECTION },
        ],
      },
    },
    { $unwind: '$pharmacy' },
    { $sort: sort },
    {
      $facet: {
        metadata: [{ $count: 'total' }],
        data: [{ $skip: (page - 1) * limit }, { $limit: limit }],
      },
    },
  ])

  const medicines = result?.data || []
  const total = result?.metadata?.[0]?.total || 0
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit)

  return {
    medicines: medicines.map(serializePublicMedicine),
    pagination: { page, limit, total, totalPages },
  }
}

async function getPublicMedicineById(medicineId) {
  if (!mongoose.Types.ObjectId.isValid(medicineId)) {
    throw new ApiError(400, 'Invalid medicine identifier', 'VALIDATION_ERROR', [
      { field: 'medicineId', message: 'Medicine ID is not a valid identifier' },
    ])
  }

  const medicine = await Medicine.findOne({
    _id: medicineId,
    isActive: true,
    expiryDate: { $gte: startOfTodayUtc() },
    stockQuantity: { $gte: 0 },
  }).lean()

  if (!medicine) {
    throw new ApiError(404, 'Medicine not found', 'NOT_FOUND')
  }

  const pharmacy = await Pharmacy.findOne({
    _id: medicine.pharmacyId,
    verificationStatus: 'APPROVED',
    isActive: true,
  })
    .select(PUBLIC_PHARMACY_PROJECTION)
    .lean()

  if (!pharmacy) {
    throw new ApiError(404, 'Medicine not found', 'NOT_FOUND')
  }

  return serializePublicMedicine({ ...medicine, pharmacy })
}

module.exports = {
  searchPublicMedicines,
  getPublicMedicineById,
  buildPublicQuery,
  serializePublicMedicine,
  serializePharmacySummary,
  isExpired,
}
