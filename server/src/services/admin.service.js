const mongoose = require('mongoose')
const DoctorProfile = require('../models/DoctorProfile')
const Pharmacy = require('../models/Pharmacy')
const User = require('../models/User')
const Medicine = require('../models/Medicine')
const Order = require('../models/Order')
const ApiError = require('../utils/ApiError')
const {
  notifyVerificationDecision,
} = require('./notification.service')

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50
const MAX_SEARCH_LENGTH = 100
const MAX_REASON_LENGTH = 500

const ROLE_VALUES = ['PATIENT', 'DOCTOR', 'PHARMACY', 'ADMIN']
const VERIFICATION_VALUES = ['PENDING', 'APPROVED', 'REJECTED']
const VERIFICATION_ACTIONS = ['APPROVED', 'REJECTED']

const DOCTOR_SORT_FIELDS = {
  newest: { createdAt: -1, _id: -1 },
  oldest: { createdAt: 1, _id: 1 },
  name_asc: { name: 1, _id: 1 },
  name_desc: { name: -1, _id: 1 },
}

const PHARMACY_SORT_FIELDS = {
  newest: { createdAt: -1, _id: -1 },
  oldest: { createdAt: 1, _id: 1 },
  name_asc: { pharmacyName: 1, _id: 1 },
  name_desc: { pharmacyName: -1, _id: 1 },
}

const USER_SORT_FIELDS = {
  newest: { createdAt: -1, _id: -1 },
  oldest: { createdAt: 1, _id: 1 },
  name_asc: { name: 1, _id: 1 },
  name_desc: { name: -1, _id: 1 },
}

const MEDICINE_SORT_FIELDS = {
  newest: { createdAt: -1, _id: -1 },
  name_asc: { name: 1, _id: 1 },
  name_desc: { name: -1, _id: 1 },
  expiry_asc: { expiryDate: 1, _id: 1 },
  stock_desc: { stockQuantity: -1, _id: 1 },
}

const ORDER_SORT_FIELDS = {
  newest: { placedAt: -1, _id: -1 },
  oldest: { placedAt: 1, _id: 1 },
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function startOfTodayUtc() {
  const now = new Date()
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  )
}

function formatDateOnly(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

function isValidObjectId(value) {
  return typeof value === 'string' && mongoose.Types.ObjectId.isValid(value)
}

function parsePositiveInteger(
  raw,
  field,
  errors,
  fallback,
  max = Number.MAX_SAFE_INTEGER,
) {
  if (raw === undefined || raw === '') return fallback
  if (Array.isArray(raw) || (typeof raw !== 'string' && typeof raw !== 'number')) {
    errors.push({ field, message: `${field} must be a positive whole number` })
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

function parseSearch(raw, errors, field = 'q') {
  if (raw === undefined || raw === '') return null
  if (typeof raw !== 'string') {
    errors.push({ field, message: 'Search must be a string' })
    return null
  }

  const search = raw.trim()
  if (search.length === 0) return null
  if (search.length > MAX_SEARCH_LENGTH) {
    errors.push({
      field,
      message: `Search cannot exceed ${MAX_SEARCH_LENGTH} characters`,
    })
    return null
  }
  return search
}

function parseEnum(raw, field, allowed, errors) {
  if (raw === undefined || raw === '') return null
  if (typeof raw !== 'string') {
    errors.push({ field, message: `${field} must be a string` })
    return null
  }

  const value = raw.trim().toUpperCase()
  if (!allowed.includes(value)) {
    errors.push({
      field,
      message: `${field} must be one of: ${allowed.join(', ')}`,
    })
    return null
  }
  return value
}

function parseBoolean(raw, field, errors) {
  if (raw === undefined || raw === '') return null
  if (typeof raw !== 'string') {
    errors.push({ field, message: `${field} must be true or false` })
    return null
  }

  const value = raw.trim().toLowerCase()
  if (value !== 'true' && value !== 'false') {
    errors.push({ field, message: `${field} must be true or false` })
    return null
  }
  return value === 'true'
}

function parseObjectId(raw, field, errors) {
  if (raw === undefined || raw === '') return null
  if (typeof raw !== 'string' || !isValidObjectId(raw.trim())) {
    errors.push({ field, message: `${field} is not a valid identifier` })
    return null
  }
  return new mongoose.Types.ObjectId(raw.trim())
}

function parseSort(raw, fields, errors) {
  if (raw === undefined || raw === '') return fields.newest
  if (typeof raw !== 'string' || !Object.hasOwn(fields, raw)) {
    errors.push({
      field: 'sort',
      message: `sort must be one of: ${Object.keys(fields).join(', ')}`,
    })
    return fields.newest
  }
  return fields[raw]
}

function parseListQuery(query, errors, sortFields) {
  const page = parsePositiveInteger(
    query.page,
    'page',
    errors,
    DEFAULT_PAGE,
    1000000,
  )
  const limit = parsePositiveInteger(
    query.limit,
    'limit',
    errors,
    DEFAULT_LIMIT,
    MAX_LIMIT,
  )
  return {
    page,
    limit,
    sort: parseSort(query.sort, sortFields, errors),
  }
}

function throwValidation(message, errors) {
  throw new ApiError(400, message, 'VALIDATION_ERROR', errors)
}

function buildPagination(page, limit, total) {
  return {
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  }
}

function serializeAdminDoctor(doc) {
  return {
    id: doc._id.toString(),
    userId: doc.userId ? doc.userId.toString() : null,
    name: doc.name || 'Unknown doctor',
    email: doc.email || null,
    phone: doc.phone || null,
    isActive: doc.isActive !== false,
    specialization: doc.specialization || null,
    qualification: doc.qualification || null,
    experience: typeof doc.experience === 'number' ? doc.experience : null,
    registrationNumber: doc.registrationNumber || null,
    consultationFee:
      typeof doc.consultationFee === 'number' ? doc.consultationFee : null,
    clinicName: doc.clinicName || null,
    clinicCity: doc.clinicCity || null,
    clinicState: doc.clinicState || null,
    verificationStatus: doc.verificationStatus,
    verificationReason: doc.verificationReason || null,
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
  }
}

function serializeAdminPharmacy(doc) {
  return {
    id: doc._id.toString(),
    userId: doc.userId ? doc.userId.toString() : null,
    pharmacyName: doc.pharmacyName,
    pharmacistName: doc.pharmacistName || null,
    licenseNumber: doc.licenseNumber || null,
    phone: doc.phone || null,
    email: doc.email || null,
    address: doc.address || null,
    city: doc.city || null,
    state: doc.state || null,
    pincode: doc.pincode || null,
    isActive: doc.isActive !== false,
    verificationStatus: doc.verificationStatus,
    verificationReason: doc.verificationReason || null,
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
  }
}

function serializeAdminUser(doc) {
  return {
    id: doc._id.toString(),
    name: doc.name,
    email: doc.email,
    phone: doc.phone || null,
    role: doc.role,
    isActive: doc.isActive !== false,
    isVerified: doc.isVerified === true,
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
  }
}

function serializeAdminMedicine(doc) {
  const stockQuantity = Number.isFinite(doc.stockQuantity)
    ? Math.max(0, Math.trunc(doc.stockQuantity))
    : 0
  const expiryDate = doc.expiryDate ? new Date(doc.expiryDate) : null
  const isExpired = expiryDate
    ? expiryDate.getTime() < startOfTodayUtc().getTime()
    : false

  return {
    id: doc._id.toString(),
    name: doc.name,
    genericName: doc.genericName || null,
    brandName: doc.brandName || null,
    category: doc.category,
    dosageForm: doc.dosageForm || null,
    strength: doc.strength || null,
    packSize: doc.packSize || null,
    price: typeof doc.price === 'number' ? doc.price : null,
    stockQuantity,
    inStock: stockQuantity > 0,
    prescriptionRequired: doc.prescriptionRequired === true,
    expiryDate: formatDateOnly(doc.expiryDate),
    isExpired,
    isActive: doc.isActive !== false,
    pharmacy: {
      id: doc.pharmacyId ? doc.pharmacyId.toString() : null,
      pharmacyName: doc.pharmacyName || null,
      verificationStatus: doc.pharmacyVerificationStatus || null,
      isActive: doc.pharmacyIsActive !== false,
    },
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
  }
}

function serializeStatusHistory(history) {
  if (!Array.isArray(history)) return []
  return history.flatMap((entry) => {
    if (!entry || !entry.status || !entry.timestamp) return []
    const timestamp =
      entry.timestamp instanceof Date
        ? entry.timestamp
        : new Date(entry.timestamp)
    if (Number.isNaN(timestamp.getTime())) return []
    return [{ status: entry.status, timestamp: timestamp.toISOString() }]
  })
}

function serializeAdminOrderSummary(order) {
  const items = Array.isArray(order.items) ? order.items : []
  const unitCount = items.reduce(
    (sum, item) => sum + (Number.isInteger(item.quantity) ? item.quantity : 0),
    0,
  )

  return {
    orderId: order._id.toString(),
    pharmacy: {
      id: order.pharmacyId ? order.pharmacyId.toString() : null,
      pharmacyName: order.pharmacySnapshot?.pharmacyName || null,
    },
    customerName: order.deliveryAddress?.fullName || null,
    deliveryCity: order.deliveryAddress?.city || null,
    itemCount: items.length,
    unitCount,
    items: items.slice(0, 3).map((item) => ({
      name: item.nameSnapshot,
      genericName: item.genericNameSnapshot || null,
      quantity: item.quantity,
    })),
    totalAmount: order.totalAmount,
    paymentStatus: order.paymentStatus,
    orderStatus: order.orderStatus,
    placedAt: order.placedAt ? order.placedAt.toISOString() : null,
  }
}

function serializeAdminOrder(order) {
  const items = Array.isArray(order.items) ? order.items : []
  const unitCount = items.reduce(
    (sum, item) => sum + (Number.isInteger(item.quantity) ? item.quantity : 0),
    0,
  )

  return {
    orderId: order._id.toString(),
    pharmacy: {
      id: order.pharmacyId ? order.pharmacyId.toString() : null,
      pharmacyName: order.pharmacySnapshot?.pharmacyName || null,
      city: order.pharmacySnapshot?.city || null,
      state: order.pharmacySnapshot?.state || null,
    },
    customer: {
      name: order.deliveryAddress?.fullName || null,
      city: order.deliveryAddress?.city || null,
      state: order.deliveryAddress?.state || null,
      pincode: order.deliveryAddress?.pincode || null,
    },
    itemCount: items.length,
    unitCount,
    items: items.map((item) => ({
      name: item.nameSnapshot,
      genericName: item.genericNameSnapshot || null,
      brandName: item.brandNameSnapshot || null,
      dosageForm: item.dosageFormSnapshot || null,
      strength: item.strengthSnapshot || null,
      packSize: item.packSizeSnapshot || null,
      quantity: item.quantity,
      unitPrice: item.unitPriceSnapshot,
      lineTotal: item.lineTotal,
      prescriptionRequired: item.prescriptionRequired === true,
    })),
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    totalAmount: order.totalAmount,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    orderStatus: order.orderStatus,
    statusHistory: serializeStatusHistory(order.statusHistory),
    prescriptionStatus: order.prescriptionStatus,
    placedAt: order.placedAt ? order.placedAt.toISOString() : null,
    createdAt: order.createdAt ? order.createdAt.toISOString() : null,
    updatedAt: order.updatedAt ? order.updatedAt.toISOString() : null,
  }
}

async function getDashboard() {
  const [
    totalUsers,
    totalDoctors,
    pendingDoctorVerifications,
    totalPharmacies,
    pendingPharmacyVerifications,
    totalMedicines,
    totalOrders,
  ] = await Promise.all([
    User.countDocuments({}),
    DoctorProfile.countDocuments({}),
    DoctorProfile.countDocuments({ verificationStatus: 'PENDING' }),
    Pharmacy.countDocuments({}),
    Pharmacy.countDocuments({ verificationStatus: 'PENDING' }),
    Medicine.countDocuments({}),
    Order.countDocuments({}),
  ])

  return {
    metrics: {
      totalUsers,
      totalDoctors,
      pendingDoctorVerifications,
      totalPharmacies,
      pendingPharmacyVerifications,
      totalMedicines,
      totalOrders,
    },
  }
}

async function listDoctors(query = {}) {
  const errors = []
  const status = parseEnum(
    query.status,
    'status',
    VERIFICATION_VALUES,
    errors,
  )
  const search = parseSearch(query.q, errors)
  const { page, limit, sort } = parseListQuery(
    query,
    errors,
    DOCTOR_SORT_FIELDS,
  )
  if (errors.length > 0) {
    throwValidation('Invalid doctors query', errors)
  }

  const match = {}
  if (status) match.verificationStatus = status

  const pipeline = [{ $match: match }]
  pipeline.push({
    $lookup: {
      from: 'users',
      localField: 'userId',
      foreignField: '_id',
      as: 'account',
    },
  })
  pipeline.push({
    $addFields: {
      name: {
        $ifNull: [{ $arrayElemAt: ['$account.name', 0] }, 'Unknown doctor'],
      },
      email: { $arrayElemAt: ['$account.email', 0] },
      phone: { $arrayElemAt: ['$account.phone', 0] },
      isActive: {
        $ifNull: [{ $arrayElemAt: ['$account.isActive', 0] }, false],
      },
    },
  })

  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i')
    pipeline.push({
      $match: {
        $or: [
          { name: pattern },
          { email: pattern },
          { phone: pattern },
          { specialization: pattern },
          { qualification: pattern },
          { registrationNumber: pattern },
          { clinicName: pattern },
        ],
      },
    })
  }

  pipeline.push({ $sort: sort })
  pipeline.push({
    $project: {
      _id: 1,
      userId: 1,
      name: 1,
      email: 1,
      phone: 1,
      isActive: 1,
      specialization: 1,
      qualification: 1,
      experience: 1,
      registrationNumber: 1,
      consultationFee: 1,
      clinicName: 1,
      clinicCity: '$clinicAddress.city',
      clinicState: '$clinicAddress.state',
      verificationStatus: 1,
      verificationReason: 1,
      createdAt: 1,
      updatedAt: 1,
    },
  })
  pipeline.push({
    $facet: {
      metadata: [{ $count: 'total' }],
      data: [{ $skip: (page - 1) * limit }, { $limit: limit }],
    },
  })

  const [result] = await DoctorProfile.aggregate(pipeline)
  const data = result?.data || []
  const total = result?.metadata?.[0]?.total || 0

  return {
    doctors: data.map(serializeAdminDoctor),
    pagination: buildPagination(page, limit, total),
  }
}

async function listPharmacies(query = {}) {
  const errors = []
  const status = parseEnum(
    query.status,
    'status',
    VERIFICATION_VALUES,
    errors,
  )
  const search = parseSearch(query.q, errors)
  const { page, limit, sort } = parseListQuery(
    query,
    errors,
    PHARMACY_SORT_FIELDS,
  )
  if (errors.length > 0) {
    throwValidation('Invalid pharmacies query', errors)
  }

  const filter = {}
  if (status) filter.verificationStatus = status
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i')
    filter.$or = [
      { pharmacyName: pattern },
      { pharmacistName: pattern },
      { licenseNumber: pattern },
      { email: pattern },
      { phone: pattern },
      { address: pattern },
      { city: pattern },
    ]
  }

  const [total, pharmacies] = await Promise.all([
    Pharmacy.countDocuments(filter),
    Pharmacy.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ])

  return {
    pharmacies: pharmacies.map(serializeAdminPharmacy),
    pagination: buildPagination(page, limit, total),
  }
}

async function listUsers(query = {}) {
  const errors = []
  const search = parseSearch(query.q, errors)
  const role = parseEnum(query.role, 'role', ROLE_VALUES, errors)
  const isActive = parseBoolean(query.isActive, 'isActive', errors)
  const isVerified = parseBoolean(query.isVerified, 'isVerified', errors)
  const { page, limit, sort } = parseListQuery(
    query,
    errors,
    USER_SORT_FIELDS,
  )
  if (errors.length > 0) {
    throwValidation('Invalid users query', errors)
  }

  const filter = {}
  if (role) filter.role = role
  if (isActive !== null) filter.isActive = isActive
  if (isVerified !== null) filter.isVerified = isVerified
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i')
    filter.$or = [
      { name: pattern },
      { email: pattern },
      { phone: pattern },
    ]
  }

  const [total, users] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter)
      .select('name email phone role isActive isVerified createdAt updatedAt')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ])

  return {
    users: users.map(serializeAdminUser),
    pagination: buildPagination(page, limit, total),
  }
}

async function listMedicines(query = {}) {
  const errors = []
  const search = parseSearch(query.q, errors)
  const category = parseEnum(
    query.category,
    'category',
    Medicine.MEDICINE_CATEGORIES,
    errors,
  )
  const pharmacyId = parseObjectId(query.pharmacyId, 'pharmacyId', errors)
  const isActive = parseBoolean(query.isActive, 'isActive', errors)
  const expired = parseBoolean(query.expired, 'expired', errors)
  const inStock = parseBoolean(query.inStock, 'inStock', errors)
  const { page, limit, sort } = parseListQuery(
    query,
    errors,
    MEDICINE_SORT_FIELDS,
  )
  if (errors.length > 0) {
    throwValidation('Invalid medicines query', errors)
  }

  const match = {}
  if (category) match.category = category
  if (pharmacyId) match.pharmacyId = pharmacyId
  if (isActive !== null) match.isActive = isActive
  if (expired === true) {
    match.expiryDate = { $lt: startOfTodayUtc() }
  } else if (expired === false) {
    match.expiryDate = { $gte: startOfTodayUtc() }
  }
  if (inStock === true) {
    match.stockQuantity = { $gt: 0 }
  } else if (inStock === false) {
    match.stockQuantity = { $lte: 0 }
  }
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i')
    match.$or = [
      { name: pattern },
      { genericName: pattern },
      { brandName: pattern },
    ]
  }

  const [result] = await Medicine.aggregate([
    { $match: match },
    {
      $lookup: {
        from: 'pharmacies',
        localField: 'pharmacyId',
        foreignField: '_id',
        as: 'pharmacy',
      },
    },
    { $unwind: { path: '$pharmacy', preserveNullAndEmptyArrays: true } },
    { $sort: sort },
    {
      $project: {
        _id: 1,
        pharmacyId: 1,
        name: 1,
        genericName: 1,
        brandName: 1,
        category: 1,
        dosageForm: 1,
        strength: 1,
        packSize: 1,
        price: 1,
        stockQuantity: 1,
        prescriptionRequired: 1,
        expiryDate: 1,
        isActive: 1,
        createdAt: 1,
        updatedAt: 1,
        pharmacyName: '$pharmacy.pharmacyName',
        pharmacyVerificationStatus: '$pharmacy.verificationStatus',
        pharmacyIsActive: '$pharmacy.isActive',
      },
    },
    {
      $facet: {
        metadata: [{ $count: 'total' }],
        data: [{ $skip: (page - 1) * limit }, { $limit: limit }],
      },
    },
  ])

  const data = result?.data || []
  const total = result?.metadata?.[0]?.total || 0

  return {
    medicines: data.map(serializeAdminMedicine),
    pagination: buildPagination(page, limit, total),
  }
}

async function listOrders(query = {}) {
  const errors = []
  const search = parseSearch(query.q, errors)
  const status = parseEnum(query.status, 'status', Order.ORDER_STATUSES, errors)
  const paymentStatus = parseEnum(
    query.paymentStatus,
    'paymentStatus',
    Order.PAYMENT_STATUSES,
    errors,
  )
  const pharmacyId = parseObjectId(query.pharmacyId, 'pharmacyId', errors)
  const { page, limit, sort } = parseListQuery(
    query,
    errors,
    ORDER_SORT_FIELDS,
  )
  if (errors.length > 0) {
    throwValidation('Invalid orders query', errors)
  }

  const filter = {}
  if (status) filter.orderStatus = status
  if (paymentStatus) filter.paymentStatus = paymentStatus
  if (pharmacyId) filter.pharmacyId = pharmacyId
  if (search) {
    const pattern = new RegExp(escapeRegex(search), 'i')
    const clauses = [
      { 'items.nameSnapshot': pattern },
      { 'items.genericNameSnapshot': pattern },
      { 'items.brandNameSnapshot': pattern },
      { 'pharmacySnapshot.pharmacyName': pattern },
    ]
    if (isValidObjectId(search)) {
      clauses.unshift({ _id: new mongoose.Types.ObjectId(search) })
    }
    filter.$or = clauses
  }

  const [total, orders] = await Promise.all([
    Order.countDocuments(filter),
    Order.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ])

  return {
    orders: orders.map(serializeAdminOrderSummary),
    pagination: buildPagination(page, limit, total),
  }
}

async function getOrderById(orderId) {
  if (!isValidObjectId(orderId)) {
    throw new ApiError(400, 'Invalid order identifier', 'VALIDATION_ERROR', [
      { field: 'orderId', message: 'Order ID is not a valid identifier' },
    ])
  }

  const order = await Order.findById(orderId).lean()
  if (!order) {
    throw new ApiError(404, 'Order not found', 'ORDER_NOT_FOUND')
  }

  return serializeAdminOrder(order)
}

function assertBodyObject(body, message) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(400, message, 'INVALID_REQUEST_BODY')
  }
}

function assertOnlyFields(body, allowedFields) {
  const unknown = Object.keys(body).filter(
    (key) => !allowedFields.includes(key),
  )
  if (unknown.length > 0) {
    throwValidation('Invalid request body', [
      {
        field: unknown[0],
        message: `Only ${allowedFields.join(', ')} may be updated`,
      },
    ])
  }
}

function parseVerificationInput(body) {
  assertBodyObject(body, 'Invalid verification payload')
  assertOnlyFields(body, ['status', 'reason'])

  const errors = []
  if (typeof body.status !== 'string') {
    errors.push({ field: 'status', message: 'Status is required' })
  }
  const status =
    typeof body.status === 'string' ? body.status.trim().toUpperCase() : ''
  if (status && !VERIFICATION_ACTIONS.includes(status)) {
    errors.push({
      field: 'status',
      message: `Status must be one of: ${VERIFICATION_ACTIONS.join(', ')}`,
    })
  }

  let reason = null
  if (body.reason !== undefined && body.reason !== null && body.reason !== '') {
    if (typeof body.reason !== 'string') {
      errors.push({ field: 'reason', message: 'Reason must be a string' })
    } else {
      reason = body.reason.trim()
      if (reason.length > MAX_REASON_LENGTH) {
        errors.push({
          field: 'reason',
          message: `Reason cannot exceed ${MAX_REASON_LENGTH} characters`,
        })
      }
      if (reason.length === 0) reason = null
    }
  }

  if (errors.length > 0) {
    throwValidation('Invalid verification payload', errors)
  }

  return {
    status,
    reason: status === 'APPROVED' ? null : reason,
  }
}

async function loadDoctorForAdmin(doctorId) {
  if (!isValidObjectId(doctorId)) {
    throw new ApiError(400, 'Invalid doctor identifier', 'VALIDATION_ERROR', [
      { field: 'doctorId', message: 'Doctor ID is not a valid identifier' },
    ])
  }

  const doctor = await DoctorProfile.findById(doctorId).lean()
  if (!doctor) {
    throw new ApiError(404, 'Doctor profile not found', 'DOCTOR_NOT_FOUND')
  }
  return doctor
}

async function updateDoctorVerification(adminId, doctorId, body) {
  const { status, reason } = parseVerificationInput(body)
  const doctor = await loadDoctorForAdmin(doctorId)

  if (doctor.userId.toString() === adminId) {
    throw new ApiError(
      403,
      'Administrators cannot verify their own profile',
      'SELF_VERIFICATION_FORBIDDEN',
    )
  }

  if (doctor.verificationStatus === status) {
    throw new ApiError(
      409,
      `Doctor verification is already ${status}`,
      'VERIFICATION_UNCHANGED',
    )
  }

  const updated = await DoctorProfile.findOneAndUpdate(
    {
      _id: doctor._id,
      verificationStatus: doctor.verificationStatus,
      userId: { $ne: adminId },
    },
    {
      $set: {
        verificationStatus: status,
        verificationReason: reason,
      },
    },
    { returnDocument: 'after', runValidators: true },
  ).lean()

  if (!updated) {
    const current = await DoctorProfile.findById(doctor._id).lean()
    if (!current) {
      throw new ApiError(404, 'Doctor profile not found', 'DOCTOR_NOT_FOUND')
    }
    if (current.userId.toString() === adminId) {
      throw new ApiError(
        403,
        'Administrators cannot verify their own profile',
        'SELF_VERIFICATION_FORBIDDEN',
      )
    }
    if (current.verificationStatus === status) {
      throw new ApiError(
        409,
        `Doctor verification is already ${status}`,
        'VERIFICATION_UNCHANGED',
      )
    }
    throw new ApiError(
      409,
      'Doctor verification changed. Refresh and try again.',
      'VERIFICATION_CONFLICT',
    )
  }

  const account = await User.findById(updated.userId)
    .select('name email phone isActive')
    .lean()

  await notifyVerificationDecision({
    subject: 'DOCTOR',
    userId: updated.userId,
    profileId: updated._id,
    status,
    eventTimestamp: updated.updatedAt,
  })

  return serializeAdminDoctor({
    ...updated,
    name: account?.name || 'Unknown doctor',
    email: account?.email || null,
    phone: account?.phone || null,
    isActive: account?.isActive,
    clinicCity: updated.clinicAddress?.city || null,
    clinicState: updated.clinicAddress?.state || null,
  })
}

async function loadPharmacyForAdmin(pharmacyId) {
  if (!isValidObjectId(pharmacyId)) {
    throw new ApiError(400, 'Invalid pharmacy identifier', 'VALIDATION_ERROR', [
      { field: 'pharmacyId', message: 'Pharmacy ID is not a valid identifier' },
    ])
  }

  const pharmacy = await Pharmacy.findById(pharmacyId).lean()
  if (!pharmacy) {
    throw new ApiError(404, 'Pharmacy profile not found', 'PHARMACY_NOT_FOUND')
  }
  return pharmacy
}

async function updatePharmacyVerification(adminId, pharmacyId, body) {
  const { status, reason } = parseVerificationInput(body)
  const pharmacy = await loadPharmacyForAdmin(pharmacyId)

  if (pharmacy.userId.toString() === adminId) {
    throw new ApiError(
      403,
      'Administrators cannot verify their own profile',
      'SELF_VERIFICATION_FORBIDDEN',
    )
  }

  if (pharmacy.verificationStatus === status) {
    throw new ApiError(
      409,
      `Pharmacy verification is already ${status}`,
      'VERIFICATION_UNCHANGED',
    )
  }

  const updated = await Pharmacy.findOneAndUpdate(
    {
      _id: pharmacy._id,
      verificationStatus: pharmacy.verificationStatus,
      userId: { $ne: adminId },
    },
    {
      $set: {
        verificationStatus: status,
        verificationReason: reason,
      },
    },
    { returnDocument: 'after', runValidators: true },
  ).lean()

  if (!updated) {
    const current = await Pharmacy.findById(pharmacy._id).lean()
    if (!current) {
      throw new ApiError(404, 'Pharmacy profile not found', 'PHARMACY_NOT_FOUND')
    }
    if (current.userId.toString() === adminId) {
      throw new ApiError(
        403,
        'Administrators cannot verify their own profile',
        'SELF_VERIFICATION_FORBIDDEN',
      )
    }
    if (current.verificationStatus === status) {
      throw new ApiError(
        409,
        `Pharmacy verification is already ${status}`,
        'VERIFICATION_UNCHANGED',
      )
    }
    throw new ApiError(
      409,
      'Pharmacy verification changed. Refresh and try again.',
      'VERIFICATION_CONFLICT',
    )
  }

  await notifyVerificationDecision({
    subject: 'PHARMACY',
    userId: updated.userId,
    profileId: updated._id,
    status,
    eventTimestamp: updated.updatedAt,
  })

  return serializeAdminPharmacy(updated)
}

async function updateUserStatus(adminId, userId, body) {
  assertBodyObject(body, 'Invalid user status payload')
  assertOnlyFields(body, ['isActive'])

  if (typeof body.isActive !== 'boolean') {
    throwValidation('Invalid user status payload', [
      { field: 'isActive', message: 'isActive must be true or false' },
    ])
  }

  if (!isValidObjectId(userId)) {
    throw new ApiError(400, 'Invalid user identifier', 'VALIDATION_ERROR', [
      { field: 'userId', message: 'User ID is not a valid identifier' },
    ])
  }

  const user = await User.findById(userId).lean()
  if (!user) {
    throw new ApiError(404, 'User not found', 'USER_NOT_FOUND')
  }

  if (user._id.toString() === adminId && body.isActive === false) {
    throw new ApiError(
      403,
      'Administrators cannot deactivate their own account',
      'SELF_DEACTIVATION_FORBIDDEN',
    )
  }

  const updated = await User.findByIdAndUpdate(
    user._id,
    { $set: { isActive: body.isActive } },
    { returnDocument: 'after', runValidators: true },
  )
    .select('name email phone role isActive isVerified createdAt updatedAt')
    .lean()

  return serializeAdminUser(updated)
}

module.exports = {
  getDashboard,
  listDoctors,
  listPharmacies,
  listUsers,
  listMedicines,
  listOrders,
  getOrderById,
  updateDoctorVerification,
  updatePharmacyVerification,
  updateUserStatus,
  serializeAdminDoctor,
  serializeAdminPharmacy,
  serializeAdminUser,
  serializeAdminMedicine,
  serializeAdminOrderSummary,
  serializeAdminOrder,
}
