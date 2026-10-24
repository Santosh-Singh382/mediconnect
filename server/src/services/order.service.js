const mongoose = require('mongoose')
const Order = require('../models/Order')
const {
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  DEFAULT_PAYMENT_METHOD,
  DEFAULT_PAYMENT_STATUS,
  MAX_IDEMPOTENCY_KEY_LENGTH,
} = require('../models/Order')
const Cart = require('../models/Cart')
const { MAX_CART_ITEM_QUANTITY } = require('../models/Cart')
const Medicine = require('../models/Medicine')
const Pharmacy = require('../models/Pharmacy')
const Prescription = require('../models/Prescription')
const ApiError = require('../utils/ApiError')
const { PHONE_PATTERN } = require('../utils/validation')
const { isExpired } = require('./publicMedicine.service')
const {
  notifyOrderCreated,
  notifyOrderStatusChanged,
} = require('./notification.service')

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 10
const PHARMACY_DEFAULT_LIMIT = 20
const MAX_LIMIT = 50
const MAX_SEARCH_LENGTH = 100
const DELIVERY_FEE = 0
const PINCODE_PATTERN = /^[1-9][0-9]{5}$/
const MAX_NAME_LENGTH = 200
const MAX_PHONE_LENGTH = 20
const MAX_ADDRESS_LENGTH = 200
const MAX_CITY_LENGTH = 100
const MAX_STATE_LENGTH = 100
const MAX_LANDMARK_LENGTH = 200

const SORT_FIELDS = {
  newest: { placedAt: -1, _id: -1 },
  oldest: { placedAt: 1, _id: 1 },
  total_asc: { totalAmount: 1, _id: 1 },
  total_desc: { totalAmount: -1, _id: -1 },
}

const PHARMACY_STATUS_TRANSITIONS = {
  PLACED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['READY'],
  READY: ['OUT_FOR_DELIVERY'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
}

const PHARMACY_SUMMARY_KEYS = {
  PLACED: 'placed',
  CONFIRMED: 'confirmed',
  PROCESSING: 'processing',
  READY: 'ready',
  OUT_FOR_DELIVERY: 'outForDelivery',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function startOfTodayUtc() {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value)
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

function validateDeliveryAddress(value, errors) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    errors.push({
      field: 'deliveryAddress',
      message: 'Delivery address must be an object',
    })
    return null
  }

  const fullName = validateRequiredString(
    value.fullName,
    'deliveryAddress.fullName',
    'Full name',
    MAX_NAME_LENGTH,
    errors,
  )

  let phone = null
  if (
    value.phone === undefined ||
    value.phone === null ||
    value.phone === ''
  ) {
    errors.push({
      field: 'deliveryAddress.phone',
      message: 'Phone number is required',
    })
  } else if (typeof value.phone !== 'string') {
    errors.push({
      field: 'deliveryAddress.phone',
      message: 'Phone number must be a string',
    })
  } else {
    const trimmed = value.phone.trim()
    if (trimmed.length === 0) {
      errors.push({
        field: 'deliveryAddress.phone',
        message: 'Phone number is required',
      })
    } else if (
      trimmed.length > MAX_PHONE_LENGTH ||
      !PHONE_PATTERN.test(trimmed)
    ) {
      errors.push({
        field: 'deliveryAddress.phone',
        message: 'Phone number is not valid',
      })
    } else {
      phone = trimmed
    }
  }

  const addressLine1 = validateRequiredString(
    value.addressLine1,
    'deliveryAddress.addressLine1',
    'Address line 1',
    MAX_ADDRESS_LENGTH,
    errors,
  )
  const addressLine2 = validateOptionalString(
    value.addressLine2,
    'deliveryAddress.addressLine2',
    'Address line 2',
    MAX_ADDRESS_LENGTH,
    errors,
  )
  const city = validateRequiredString(
    value.city,
    'deliveryAddress.city',
    'City',
    MAX_CITY_LENGTH,
    errors,
  )
  const state = validateRequiredString(
    value.state,
    'deliveryAddress.state',
    'State',
    MAX_STATE_LENGTH,
    errors,
  )

  let pincode = null
  if (
    value.pincode === undefined ||
    value.pincode === null ||
    value.pincode === ''
  ) {
    errors.push({
      field: 'deliveryAddress.pincode',
      message: 'Pincode is required',
    })
  } else if (typeof value.pincode !== 'string') {
    errors.push({
      field: 'deliveryAddress.pincode',
      message: 'Pincode must be a string',
    })
  } else {
    const trimmed = value.pincode.trim()
    if (!PINCODE_PATTERN.test(trimmed)) {
      errors.push({
        field: 'deliveryAddress.pincode',
        message: 'Pincode must be a valid 6-digit Indian pincode',
      })
    } else {
      pincode = trimmed
    }
  }

  const landmark = validateOptionalString(
    value.landmark,
    'deliveryAddress.landmark',
    'Landmark',
    MAX_LANDMARK_LENGTH,
    errors,
  )

  return {
    fullName,
    phone,
    addressLine1,
    addressLine2,
    city,
    state,
    pincode,
    landmark,
  }
}

function validatePrescriptionSelections(value, errors) {
  if (value === undefined || value === null) {
    return []
  }
  if (!Array.isArray(value)) {
    errors.push({
      field: 'prescriptionSelections',
      message: 'Prescription selections must be an array',
    })
    return []
  }
  if (value.length > MAX_CART_ITEM_QUANTITY) {
    errors.push({
      field: 'prescriptionSelections',
      message: `Prescription selections cannot exceed ${MAX_CART_ITEM_QUANTITY} entries`,
    })
    return []
  }

  const selections = []
  const seen = new Map()

  value.forEach((selection, index) => {
    const prefix = `prescriptionSelections[${index}]`
    if (
      selection === null ||
      typeof selection !== 'object' ||
      Array.isArray(selection)
    ) {
      errors.push({
        field: prefix,
        message: 'Prescription selection must be an object',
      })
      return
    }

    let medicineId = null
    if (
      typeof selection.medicineId !== 'string' ||
      !isValidObjectId(selection.medicineId)
    ) {
      errors.push({
        field: `${prefix}.medicineId`,
        message: 'Medicine ID is not a valid identifier',
      })
    } else {
      medicineId = selection.medicineId
    }

    let prescriptionId = null
    if (
      typeof selection.prescriptionId !== 'string' ||
      !isValidObjectId(selection.prescriptionId)
    ) {
      errors.push({
        field: `${prefix}.prescriptionId`,
        message: 'Prescription ID is not a valid identifier',
      })
    } else {
      prescriptionId = selection.prescriptionId
    }

    if (!medicineId || !prescriptionId) {
      return
    }

    if (seen.has(medicineId) && seen.get(medicineId) !== prescriptionId) {
      errors.push({
        field: prefix,
        message: 'A medicine can reference only one prescription',
      })
      return
    }

    if (!seen.has(medicineId)) {
      seen.set(medicineId, prescriptionId)
      selections.push({ medicineId, prescriptionId })
    }
  })

  return selections
}

function validateCheckoutInput(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new ApiError(
      400,
      'Invalid checkout payload',
      'INVALID_REQUEST_BODY',
    )
  }

  const errors = []

  let cartId = null
  if (
    input.cartId === undefined ||
    input.cartId === null ||
    input.cartId === ''
  ) {
    errors.push({ field: 'cartId', message: 'Cart ID is required' })
  } else if (
    typeof input.cartId !== 'string' ||
    !isValidObjectId(input.cartId)
  ) {
    errors.push({
      field: 'cartId',
      message: 'Cart ID is not a valid identifier',
    })
  } else {
    cartId = input.cartId
  }

  const deliveryAddress = validateDeliveryAddress(
    input.deliveryAddress,
    errors,
  )

  let paymentMethod = DEFAULT_PAYMENT_METHOD
  if (
    input.paymentMethod !== undefined &&
    input.paymentMethod !== null &&
    input.paymentMethod !== ''
  ) {
    if (typeof input.paymentMethod !== 'string') {
      errors.push({
        field: 'paymentMethod',
        message: 'Payment method must be a string',
      })
    } else {
      const normalizedPaymentMethod = input.paymentMethod.trim().toUpperCase()
      if (!PAYMENT_METHODS.includes(normalizedPaymentMethod)) {
        errors.push({
          field: 'paymentMethod',
          message: 'Only Cash on Delivery (COD) is available in this phase',
        })
      } else {
        paymentMethod = normalizedPaymentMethod
      }
    }
  }

  const prescriptionSelections = validatePrescriptionSelections(
    input.prescriptionSelections,
    errors,
  )

  if (errors.length > 0) {
    throw new ApiError(400, 'Invalid checkout data', 'VALIDATION_ERROR', errors)
  }

  return {
    cartId,
    deliveryAddress,
    paymentMethod,
    prescriptionSelections,
  }
}

function validateIdempotencyKey(value) {
  if (value === undefined || value === null) {
    return null
  }
  if (Array.isArray(value) || typeof value !== 'string') {
    throw new ApiError(
      400,
      'Invalid idempotency key',
      'VALIDATION_ERROR',
      [{ field: 'Idempotency-Key', message: 'Idempotency key must be a string' }],
    )
  }
  const key = value.trim()
  if (key.length === 0) {
    return null
  }
  if (key.length > MAX_IDEMPOTENCY_KEY_LENGTH) {
    throw new ApiError(
      400,
      'Invalid idempotency key',
      'VALIDATION_ERROR',
      [
        {
          field: 'Idempotency-Key',
          message: `Idempotency key cannot exceed ${MAX_IDEMPOTENCY_KEY_LENGTH} characters`,
        },
      ],
    )
  }
  return key
}

async function findOrderByIdempotencyKey(patientId, key) {
  if (!key) return null
  return Order.findOne({ patientId, idempotencyKey: key }).lean()
}

async function findOrderBySourceCart(patientId, cartId) {
  return Order.findOne({ patientId, sourceCartId: cartId }).lean()
}

async function loadCart(patientId, cartId) {
  const cart = await Cart.findOne({ _id: cartId, patientId }).lean()
  if (!cart) {
    throw new ApiError(404, 'Cart not found', 'CART_NOT_FOUND')
  }
  if (!Array.isArray(cart.items) || cart.items.length === 0) {
    throw new ApiError(409, 'Your cart is empty', 'CART_EMPTY')
  }
  return cart
}

function validateQuantity(value) {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > MAX_CART_ITEM_QUANTITY
  ) {
    throw new ApiError(
      400,
      'The cart contains an invalid quantity',
      'VALIDATION_ERROR',
      [
        {
          field: 'quantity',
          message: `Quantity must be a whole number between 1 and ${MAX_CART_ITEM_QUANTITY}`,
        },
      ],
    )
  }
}

async function loadCheckoutContext(cart) {
  const pharmacy = await Pharmacy.findById(cart.pharmacyId).lean()

  if (
    !pharmacy ||
    pharmacy.isActive === false ||
    pharmacy.verificationStatus !== 'APPROVED'
  ) {
    throw new ApiError(
      409,
      'The pharmacy is not currently available for checkout',
      'PHARMACY_UNAVAILABLE',
    )
  }

  const medicineIds = cart.items.map((item) => item.medicineId)
  const medicines = await Medicine.find({ _id: { $in: medicineIds } }).lean()
  const medicineMap = new Map(
    medicines.map((medicine) => [medicine._id.toString(), medicine]),
  )

  const priceChanges = []
  const stockErrors = []
  const lines = []

  for (const item of cart.items) {
    const medicine = medicineMap.get(item.medicineId.toString())

    if (!medicine) {
      throw new ApiError(
        409,
        'A medicine in your cart is no longer available',
        'MEDICINE_NOT_FOUND',
        [
          {
            field: 'medicineId',
            medicineId: item.medicineId.toString(),
            message: 'This medicine is no longer available',
          },
        ],
      )
    }

    if (medicine.pharmacyId.toString() !== cart.pharmacyId.toString()) {
      throw new ApiError(
        409,
        'A medicine in your cart is no longer available from this pharmacy',
        'MEDICINE_UNAVAILABLE',
        [
          {
            field: 'medicineId',
            medicineId: medicine._id.toString(),
            medicineName: medicine.name,
            message: 'This medicine does not belong to the cart pharmacy',
          },
        ],
      )
    }

    if (medicine.isActive === false) {
      throw new ApiError(
        409,
        `${medicine.name} is no longer available`,
        'MEDICINE_UNAVAILABLE',
        [
          {
            field: 'medicineId',
            medicineId: medicine._id.toString(),
            medicineName: medicine.name,
            message: 'This medicine is inactive',
          },
        ],
      )
    }

    if (isExpired(medicine.expiryDate)) {
      throw new ApiError(
        409,
        `${medicine.name} has expired`,
        'MEDICINE_EXPIRED',
        [
          {
            field: 'medicineId',
            medicineId: medicine._id.toString(),
            medicineName: medicine.name,
            message: 'This medicine has expired',
          },
        ],
      )
    }

    validateQuantity(item.quantity, medicine)

    const previousPrice = roundMoney(item.unitPriceSnapshot)
    const currentPrice = roundMoney(medicine.price)
    if (previousPrice !== currentPrice) {
      priceChanges.push({
        field: 'unitPrice',
        medicineId: medicine._id.toString(),
        medicineName: medicine.name,
        previousPrice,
        currentPrice,
      })
    }

    const availableQuantity = Math.max(0, medicine.stockQuantity)
    if (item.quantity > availableQuantity) {
      stockErrors.push({
        field: 'quantity',
        medicineId: medicine._id.toString(),
        medicineName: medicine.name,
        requestedQuantity: item.quantity,
        availableQuantity,
      })
    }

    lines.push({
      medicine,
      quantity: item.quantity,
      unitPrice: previousPrice,
      lineTotal: roundMoney(previousPrice * item.quantity),
      prescriptionRequired: medicine.prescriptionRequired !== false,
    })
  }

  if (priceChanges.length > 0) {
    throw new ApiError(
      409,
      'One or more medicine prices have changed. Review your cart before checking out.',
      'PRICE_CHANGED',
      priceChanges,
    )
  }

  if (stockErrors.length > 0) {
    throw new ApiError(
      409,
      'One or more medicines have insufficient stock',
      'INSUFFICIENT_STOCK',
      stockErrors,
    )
  }

  const subtotal = roundMoney(
    lines.reduce((total, line) => total + line.lineTotal, 0),
  )

  return {
    pharmacy,
    lines,
    subtotal,
    deliveryFee: DELIVERY_FEE,
    totalAmount: roundMoney(subtotal + DELIVERY_FEE),
  }
}

function normalizeMedicineName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function prescriptionCoversMedicine(prescription, medicine) {
  const prescribedNames = Array.isArray(prescription.medicines)
    ? prescription.medicines.map((item) =>
        normalizeMedicineName(item.medicineName),
      )
    : []
  const candidates = [
    normalizeMedicineName(medicine.name),
    normalizeMedicineName(medicine.genericName),
  ].filter(Boolean)

  return candidates.some((candidate) => prescribedNames.includes(candidate))
}

async function resolvePrescriptionReferences(
  patientId,
  lines,
  prescriptionSelections,
) {
  const requiredLines = lines.filter((line) => line.prescriptionRequired)

  if (requiredLines.length === 0) {
    return {
      prescriptionStatus: 'NOT_REQUIRED',
      prescriptionIdByMedicine: new Map(),
    }
  }

  const selectionByMedicine = new Map(
    prescriptionSelections.map((selection) => [
      selection.medicineId,
      selection.prescriptionId,
    ]),
  )

  const missing = requiredLines
    .filter(
      (line) => !selectionByMedicine.has(line.medicine._id.toString()),
    )
    .map((line) => ({
      field: 'prescriptionSelections',
      medicineId: line.medicine._id.toString(),
      medicineName: line.medicine.name,
      message: `A prescription is required for ${line.medicine.name}`,
    }))

  if (missing.length > 0) {
    throw new ApiError(
      409,
      'A valid prescription is required for one or more medicines',
      'PRESCRIPTION_REQUIRED',
      missing,
    )
  }

  const selectedIds = [
    ...new Set(requiredLines.map((line) =>
      selectionByMedicine.get(line.medicine._id.toString()),
    )),
  ]

  const prescriptions = await Prescription.find({
    _id: { $in: selectedIds },
    patientId,
  })
    .select('_id status medicines')
    .lean()

  const prescriptionMap = new Map(
    prescriptions.map((prescription) => [
      prescription._id.toString(),
      prescription,
    ]),
  )

  const invalid = []
  const prescriptionIdByMedicine = new Map()

  for (const line of requiredLines) {
    const medicineId = line.medicine._id.toString()
    const prescriptionId = selectionByMedicine.get(medicineId)
    const prescription = prescriptionMap.get(prescriptionId)

    if (!prescription) {
      invalid.push({
        field: 'prescriptionSelections',
        medicineId,
        medicineName: line.medicine.name,
        prescriptionId,
        message: 'The selected prescription does not belong to this patient or does not exist',
      })
      continue
    }

    if (prescription.status !== 'ACTIVE') {
      invalid.push({
        field: 'prescriptionSelections',
        medicineId,
        medicineName: line.medicine.name,
        prescriptionId,
        message: 'The selected prescription is not active',
      })
      continue
    }

    if (!prescriptionCoversMedicine(prescription, line.medicine)) {
      invalid.push({
        field: 'prescriptionSelections',
        medicineId,
        medicineName: line.medicine.name,
        prescriptionId,
        message: 'The selected prescription does not include this medicine',
      })
      continue
    }

    prescriptionIdByMedicine.set(medicineId, prescription._id)
  }

  if (invalid.length > 0) {
    throw new ApiError(
      409,
      'One or more prescription references are invalid',
      'INVALID_PRESCRIPTION',
      invalid,
    )
  }

  return {
    prescriptionStatus: 'VERIFIED',
    prescriptionIdByMedicine,
  }
}

function buildPharmacySnapshot(pharmacy) {
  return {
    pharmacyName: pharmacy.pharmacyName,
    pharmacistName: pharmacy.pharmacistName || null,
    address: pharmacy.address || null,
    city: pharmacy.city || null,
    state: pharmacy.state || null,
    pincode: pharmacy.pincode || null,
  }
}

function buildOrderItems(lines, prescriptionIdByMedicine) {
  return lines.map((line) => {
    const medicineId = line.medicine._id.toString()
    return {
      medicineId: line.medicine._id,
      nameSnapshot: line.medicine.name,
      genericNameSnapshot: line.medicine.genericName || null,
      brandNameSnapshot: line.medicine.brandName || null,
      dosageFormSnapshot: line.medicine.dosageForm || null,
      strengthSnapshot: line.medicine.strength || null,
      packSizeSnapshot: line.medicine.packSize || null,
      quantity: line.quantity,
      unitPriceSnapshot: line.unitPrice,
      lineTotal: line.lineTotal,
      prescriptionRequired: line.prescriptionRequired,
      prescriptionId: prescriptionIdByMedicine.get(medicineId) || null,
    }
  })
}

function priceChangeError(line, currentPrice) {
  return new ApiError(
    409,
    `${line.medicine.name} price has changed. Review your cart before checking out.`,
    'PRICE_CHANGED',
    [
      {
        field: 'unitPrice',
        medicineId: line.medicine._id.toString(),
        medicineName: line.medicine.name,
        previousPrice: roundMoney(line.unitPrice),
        currentPrice: roundMoney(currentPrice),
      },
    ],
  )
}

async function explainStockFailure(line) {
  const medicine = await Medicine.findById(line.medicine._id).lean()

  if (!medicine) {
    return new ApiError(
      409,
      'A medicine in your cart is no longer available',
      'MEDICINE_NOT_FOUND',
      [
        {
          field: 'medicineId',
          medicineId: line.medicine._id.toString(),
          medicineName: line.medicine.name,
          message: 'This medicine is no longer available',
        },
      ],
    )
  }

  if (
    medicine.isActive === false ||
    medicine.pharmacyId.toString() !== line.medicine.pharmacyId.toString()
  ) {
    return new ApiError(
      409,
      `${line.medicine.name} is no longer available`,
      'MEDICINE_UNAVAILABLE',
      [
        {
          field: 'medicineId',
          medicineId: line.medicine._id.toString(),
          medicineName: line.medicine.name,
          message: 'This medicine is no longer available',
        },
      ],
    )
  }

  if (isExpired(medicine.expiryDate)) {
    return new ApiError(
      409,
      `${line.medicine.name} has expired`,
      'MEDICINE_EXPIRED',
      [
        {
          field: 'medicineId',
          medicineId: line.medicine._id.toString(),
          medicineName: line.medicine.name,
          message: 'This medicine has expired',
        },
      ],
    )
  }

  if (roundMoney(medicine.price) !== line.unitPrice) {
    return priceChangeError(line, medicine.price)
  }

  const availableQuantity = Number.isInteger(medicine.stockQuantity)
    ? Math.max(0, medicine.stockQuantity)
    : 0

  if (line.quantity > availableQuantity) {
    return new ApiError(
      409,
      `${line.medicine.name} has insufficient stock`,
      'INSUFFICIENT_STOCK',
      [
        {
          field: 'quantity',
          medicineId: line.medicine._id.toString(),
          medicineName: line.medicine.name,
          requestedQuantity: line.quantity,
          availableQuantity,
        },
      ],
    )
  }

  return new ApiError(
    409,
    'Checkout could not reserve this item. Please try again.',
    'CHECKOUT_CONFLICT',
  )
}

async function deductStock(line) {
  const updated = await Medicine.findOneAndUpdate(
    {
      _id: line.medicine._id,
      pharmacyId: line.medicine.pharmacyId,
      isActive: true,
      expiryDate: { $gte: startOfTodayUtc() },
      price: line.medicine.price,
      stockQuantity: { $gte: line.quantity },
    },
    {
      $inc: { stockQuantity: -line.quantity },
    },
    { returnDocument: 'after' },
  ).lean()

  if (!updated) {
    throw await explainStockFailure(line)
  }

  return updated
}

async function restoreStock(lines) {
  const results = await Promise.allSettled(
    lines.map((line) =>
      Medicine.updateOne(
        { _id: line.medicine._id },
        { $inc: { stockQuantity: line.quantity } },
      ),
    ),
  )

  for (const result of results) {
    if (result.status === 'rejected') {
      console.error(
        `Failed to restore reserved stock: ${result.reason?.message || 'unknown error'}`,
      )
    }
  }
}

function serializeOrderItem(item) {
  return {
    medicineId: item.medicineId.toString(),
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
    prescriptionId: item.prescriptionId ? item.prescriptionId.toString() : null,
  }
}

function serializePaymentMethod(method) {
  return PAYMENT_METHODS.includes(method) ? method : null
}

function serializePaymentStatus(status) {
  return PAYMENT_STATUSES.includes(status) ? status : null
}

function serializeStatusHistory(history) {
  if (!Array.isArray(history)) return []

  return history.flatMap((entry) => {
    if (!entry || !ORDER_STATUSES.includes(entry.status) || !entry.timestamp) {
      return []
    }

    const timestamp =
      entry.timestamp instanceof Date
        ? entry.timestamp
        : new Date(entry.timestamp)

    if (Number.isNaN(timestamp.getTime())) {
      return []
    }

    return [{ status: entry.status, timestamp: timestamp.toISOString() }]
  })
}

function serializeOrder(order) {
  const pharmacy = order.pharmacySnapshot || {}

  return {
    orderId: order._id.toString(),
    pharmacy: {
      id: order.pharmacyId.toString(),
      pharmacyName: pharmacy.pharmacyName || null,
      pharmacistName: pharmacy.pharmacistName || null,
      address: pharmacy.address || null,
      city: pharmacy.city || null,
      state: pharmacy.state || null,
      pincode: pharmacy.pincode || null,
    },
    items: Array.isArray(order.items)
      ? order.items.map(serializeOrderItem)
      : [],
    deliveryAddress: {
      fullName: order.deliveryAddress.fullName,
      phone: order.deliveryAddress.phone,
      addressLine1: order.deliveryAddress.addressLine1,
      addressLine2: order.deliveryAddress.addressLine2 || null,
      city: order.deliveryAddress.city,
      state: order.deliveryAddress.state,
      pincode: order.deliveryAddress.pincode,
      landmark: order.deliveryAddress.landmark || null,
    },
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    totalAmount: order.totalAmount,
    paymentMethod: serializePaymentMethod(order.paymentMethod),
    paymentStatus: serializePaymentStatus(order.paymentStatus),
    orderStatus: order.orderStatus,
    statusHistory: serializeStatusHistory(order.statusHistory),
    prescriptionStatus: order.prescriptionStatus,
    placedAt: order.placedAt ? order.placedAt.toISOString() : null,
    createdAt: order.createdAt ? order.createdAt.toISOString() : null,
    updatedAt: order.updatedAt ? order.updatedAt.toISOString() : null,
  }
}

async function clearOrderedCart(patientId, cartId) {
  try {
    await Cart.deleteOne({ _id: cartId, patientId })
  } catch (error) {
    console.error(`Failed to clear ordered cart: ${error.message}`)
  }
}

async function checkout(patientId, input, idempotencyHeader) {
  const idempotencyKey = validateIdempotencyKey(idempotencyHeader)

  const previousOrder = await findOrderByIdempotencyKey(
    patientId,
    idempotencyKey,
  )
  if (previousOrder) {
    return { order: serializeOrder(previousOrder), replayed: true }
  }

  const { cartId, deliveryAddress, paymentMethod, prescriptionSelections } =
    validateCheckoutInput(input)

  const cart = await loadCart(patientId, cartId)
  const sourceOrder = await findOrderBySourceCart(patientId, cart._id)
  if (sourceOrder) {
    await clearOrderedCart(patientId, cart._id)
    return { order: serializeOrder(sourceOrder), replayed: true }
  }

  const context = await loadCheckoutContext(cart)
  const prescription = await resolvePrescriptionReferences(
    patientId,
    context.lines,
    prescriptionSelections,
  )

  const orderItems = buildOrderItems(
    context.lines,
    prescription.prescriptionIdByMedicine,
  )
  const placedAt = new Date()
  const orderDocument = {
    patientId,
    pharmacyId: cart.pharmacyId,
    pharmacySnapshot: buildPharmacySnapshot(context.pharmacy),
    items: orderItems,
    deliveryAddress,
    subtotal: context.subtotal,
    deliveryFee: context.deliveryFee,
    totalAmount: context.totalAmount,
    paymentMethod,
    paymentStatus: DEFAULT_PAYMENT_STATUS,
    orderStatus: 'PLACED',
    statusHistory: [{ status: 'PLACED', timestamp: placedAt }],
    prescriptionStatus: prescription.prescriptionStatus,
    placedAt,
    sourceCartId: cart._id,
    idempotencyKey,
  }

  const deducted = []
  let order
  let stockRestored = false

  try {
    for (const line of context.lines) {
      await deductStock(line)
      deducted.push(line)
    }

    try {
      order = await Order.create(orderDocument)
    } catch (error) {
      if (deducted.length > 0) {
        await restoreStock(deducted)
        stockRestored = true
      }

      if (error && error.code === 11000) {
        const replayByKey = await findOrderByIdempotencyKey(
          patientId,
          idempotencyKey,
        )
        if (replayByKey) {
          return { order: serializeOrder(replayByKey), replayed: true }
        }

        const replayByCart = await findOrderBySourceCart(
          patientId,
          cart._id,
        )
        if (replayByCart) {
          await clearOrderedCart(patientId, cart._id)
          return { order: serializeOrder(replayByCart), replayed: true }
        }

        throw new ApiError(
          409,
          'Checkout could not be completed. Please try again.',
          'CHECKOUT_CONFLICT',
        )
      }

      throw error
    }
  } catch (error) {
    if (!stockRestored && deducted.length > 0 && !order) {
      await restoreStock(deducted)
    }
    throw error
  }

  await notifyOrderCreated(order)
  await clearOrderedCart(patientId, cart._id)

  return { order: serializeOrder(order), replayed: false }
}

function parsePositiveInteger(raw, field, errors, fallback, max) {
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

function parseOrderListQuery(query) {
  const errors = []
  const filter = {}

  if (query.status !== undefined && query.status !== '') {
    if (typeof query.status !== 'string') {
      errors.push({ field: 'status', message: 'Status must be a string' })
    } else {
      const status = query.status.trim().toUpperCase()
      if (!ORDER_STATUSES.includes(status)) {
        errors.push({
          field: 'status',
          message: `Status must be one of: ${ORDER_STATUSES.join(', ')}`,
        })
      } else {
        filter.orderStatus = status
      }
    }
  }

  let sort = SORT_FIELDS.newest
  if (query.sort !== undefined && query.sort !== '') {
    if (
      typeof query.sort !== 'string' ||
      !Object.prototype.hasOwnProperty.call(SORT_FIELDS, query.sort)
    ) {
      errors.push({
        field: 'sort',
        message: `sort must be one of: ${Object.keys(SORT_FIELDS).join(', ')}`,
      })
    } else {
      sort = SORT_FIELDS[query.sort]
    }
  }

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

  if (errors.length > 0) {
    throw new ApiError(400, 'Invalid orders query', 'VALIDATION_ERROR', errors)
  }

  return { filter, page, limit, sort }
}

async function listOrders(patientId, query) {
  const { filter, page, limit, sort } = parseOrderListQuery(query || {})
  const scopedFilter = { ...filter, patientId }

  const [total, orders] = await Promise.all([
    Order.countDocuments(scopedFilter),
    Order.find(scopedFilter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ])

  return {
    orders: orders.map(serializeOrder),
    pagination: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  }
}

async function getOrderById(patientId, orderId) {
  if (!isValidObjectId(orderId)) {
    throw new ApiError(400, 'Invalid order identifier', 'VALIDATION_ERROR', [
      { field: 'orderId', message: 'Order ID is not a valid identifier' },
    ])
  }

  const order = await Order.findOne({
    _id: orderId,
    patientId,
  }).lean()

  if (!order) {
    throw new ApiError(404, 'Order not found', 'ORDER_NOT_FOUND')
  }

  return serializeOrder(order)
}

async function getPharmacyForOrderManagement(userId) {
  const pharmacy = await Pharmacy.findOne({ userId }).lean()

  if (!pharmacy) {
    throw new ApiError(
      404,
      'Create your pharmacy profile before managing orders',
      'PROFILE_REQUIRED',
    )
  }

  if (pharmacy.verificationStatus === 'REJECTED') {
    throw new ApiError(
      403,
      'Your pharmacy profile was rejected. Order management is unavailable.',
      'PHARMACY_REJECTED',
    )
  }

  if (pharmacy.verificationStatus !== 'APPROVED') {
    throw new ApiError(
      403,
      'Your pharmacy profile must be approved before you can manage orders.',
      'PHARMACY_NOT_APPROVED',
    )
  }

  if (pharmacy.isActive === false) {
    throw new ApiError(
      403,
      'Your pharmacy profile is inactive. Order management is unavailable.',
      'PHARMACY_INACTIVE',
    )
  }

  return pharmacy
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildPharmacySearchFilter(search) {
  if (!search) return {}

  const pattern = escapeRegex(search)
  const clauses = [
    { 'deliveryAddress.fullName': { $regex: pattern, $options: 'i' } },
    { 'items.nameSnapshot': { $regex: pattern, $options: 'i' } },
    { 'items.genericNameSnapshot': { $regex: pattern, $options: 'i' } },
    { 'items.brandNameSnapshot': { $regex: pattern, $options: 'i' } },
  ]

  if (mongoose.Types.ObjectId.isValid(search)) {
    clauses.unshift({ _id: search })
  }

  return { $or: clauses }
}

function parsePharmacyOrderListQuery(query) {
  const errors = []
  const filter = {}
  let search = ''

  if (query.q !== undefined && query.q !== '') {
    if (typeof query.q !== 'string') {
      errors.push({ field: 'q', message: 'Search query must be a string' })
    } else {
      search = query.q.trim()
      if (search.length > MAX_SEARCH_LENGTH) {
        errors.push({
          field: 'q',
          message: `Search query cannot exceed ${MAX_SEARCH_LENGTH} characters`,
        })
      }
    }
  }

  if (query.status !== undefined && query.status !== '') {
    if (typeof query.status !== 'string') {
      errors.push({ field: 'status', message: 'Status must be a string' })
    } else {
      const status = query.status.trim().toUpperCase()
      if (!ORDER_STATUSES.includes(status)) {
        errors.push({
          field: 'status',
          message: `Status must be one of: ${ORDER_STATUSES.join(', ')}`,
        })
      } else {
        filter.orderStatus = status
      }
    }
  }

  let sort = SORT_FIELDS.newest
  if (query.sort !== undefined && query.sort !== '') {
    if (
      typeof query.sort !== 'string' ||
      !Object.prototype.hasOwnProperty.call(SORT_FIELDS, query.sort)
    ) {
      errors.push({
        field: 'sort',
        message: `sort must be one of: ${Object.keys(SORT_FIELDS).join(', ')}`,
      })
    } else {
      sort = SORT_FIELDS[query.sort]
    }
  }

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
    PHARMACY_DEFAULT_LIMIT,
    MAX_LIMIT,
  )

  if (errors.length > 0) {
    throw new ApiError(
      400,
      'Invalid pharmacy orders query',
      'VALIDATION_ERROR',
      errors,
    )
  }

  return { search, filter, page, limit, sort }
}

function serializePharmacyOrderItem(item) {
  return {
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
  }
}

function serializePharmacyOrder(order) {
  return {
    orderId: order._id.toString(),
    items: Array.isArray(order.items)
      ? order.items.map(serializePharmacyOrderItem)
      : [],
    deliveryAddress: {
      fullName: order.deliveryAddress.fullName,
      phone: order.deliveryAddress.phone,
      addressLine1: order.deliveryAddress.addressLine1,
      addressLine2: order.deliveryAddress.addressLine2 || null,
      city: order.deliveryAddress.city,
      state: order.deliveryAddress.state,
      pincode: order.deliveryAddress.pincode,
      landmark: order.deliveryAddress.landmark || null,
    },
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    totalAmount: order.totalAmount,
    paymentMethod: serializePaymentMethod(order.paymentMethod),
    paymentStatus: serializePaymentStatus(order.paymentStatus),
    orderStatus: order.orderStatus,
    statusHistory: serializeStatusHistory(order.statusHistory),
    prescriptionStatus: order.prescriptionStatus,
    placedAt: order.placedAt ? order.placedAt.toISOString() : null,
    createdAt: order.createdAt ? order.createdAt.toISOString() : null,
    updatedAt: order.updatedAt ? order.updatedAt.toISOString() : null,
  }
}

async function listPharmacyOrders(userId, query) {
  const pharmacy = await getPharmacyForOrderManagement(userId)
  const { search, filter, page, limit, sort } = parsePharmacyOrderListQuery(
    query || {},
  )
  const scopedFilter = {
    ...filter,
    ...buildPharmacySearchFilter(search),
    pharmacyId: pharmacy._id,
  }

  const [total, orders] = await Promise.all([
    Order.countDocuments(scopedFilter),
    Order.find(scopedFilter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ])

  return {
    orders: orders.map(serializePharmacyOrder),
    pagination: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  }
}

async function getPharmacyOrderById(userId, orderId) {
  const pharmacy = await getPharmacyForOrderManagement(userId)

  if (!isValidObjectId(orderId)) {
    throw new ApiError(400, 'Invalid order identifier', 'VALIDATION_ERROR', [
      { field: 'orderId', message: 'Order ID is not a valid identifier' },
    ])
  }

  const order = await Order.findOne({
    _id: orderId,
    pharmacyId: pharmacy._id,
  }).lean()

  if (!order) {
    throw new ApiError(404, 'Order not found', 'ORDER_NOT_FOUND')
  }

  return serializePharmacyOrder(order)
}

function validatePharmacyStatusUpdate(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new ApiError(
      400,
      'Invalid order status payload',
      'INVALID_REQUEST_BODY',
    )
  }

  const errors = []
  for (const key of Object.keys(input)) {
    if (key !== 'status') {
      errors.push({
        field: key,
        message: `${key} cannot be updated`,
      })
    }
  }

  let status = null
  if (typeof input.status !== 'string' || input.status.trim() === '') {
    errors.push({ field: 'status', message: 'Status is required' })
  } else {
    status = input.status.trim().toUpperCase()
    if (!ORDER_STATUSES.includes(status)) {
      errors.push({
        field: 'status',
        message: `Status must be one of: ${ORDER_STATUSES.join(', ')}`,
      })
    }
  }

  if (errors.length > 0) {
    throw new ApiError(
      400,
      'Invalid order status update',
      'VALIDATION_ERROR',
      errors,
    )
  }

  return status
}

async function updatePharmacyOrderStatus(userId, orderId, input) {
  const pharmacy = await getPharmacyForOrderManagement(userId)

  if (!isValidObjectId(orderId)) {
    throw new ApiError(400, 'Invalid order identifier', 'VALIDATION_ERROR', [
      { field: 'orderId', message: 'Order ID is not a valid identifier' },
    ])
  }

  const status = validatePharmacyStatusUpdate(input)
  const current = await Order.findOne({
    _id: orderId,
    pharmacyId: pharmacy._id,
  })
    .select('orderStatus')
    .lean()

  if (!current) {
    throw new ApiError(404, 'Order not found', 'ORDER_NOT_FOUND')
  }

  const allowedStatuses = PHARMACY_STATUS_TRANSITIONS[current.orderStatus] || []
  if (!allowedStatuses.includes(status)) {
    throw new ApiError(
      409,
      `Order cannot be changed from ${current.orderStatus} to ${status}`,
      'INVALID_STATUS_TRANSITION',
      [
        {
          field: 'status',
          currentStatus: current.orderStatus,
          requestedStatus: status,
          allowedStatuses,
        },
      ],
    )
  }

  const order = await Order.findOneAndUpdate(
    {
      _id: orderId,
      pharmacyId: pharmacy._id,
      orderStatus: current.orderStatus,
    },
    {
      $set: { orderStatus: status },
      $push: {
        statusHistory: {
          status,
          timestamp: new Date(),
        },
      },
    },
    { returnDocument: 'after', runValidators: true },
  ).lean()

  if (!order) {
    const latest = await Order.findOne({
      _id: orderId,
      pharmacyId: pharmacy._id,
    })
      .select('orderStatus')
      .lean()

    if (!latest) {
      throw new ApiError(404, 'Order not found', 'ORDER_NOT_FOUND')
    }

    throw new ApiError(
      409,
      'The order status changed before this update could be applied',
      'INVALID_STATUS_TRANSITION',
      [
        {
          field: 'status',
          currentStatus: latest.orderStatus,
          requestedStatus: status,
          allowedStatuses:
            PHARMACY_STATUS_TRANSITIONS[latest.orderStatus] || [],
        },
      ],
    )
  }

  await notifyOrderStatusChanged(order)

  return serializePharmacyOrder(order)
}

async function getPharmacyOrderSummary(userId) {
  const pharmacy = await getPharmacyForOrderManagement(userId)
  const rows = await Order.aggregate([
    { $match: { pharmacyId: pharmacy._id } },
    { $group: { _id: '$orderStatus', count: { $sum: 1 } } },
  ])

  const summary = Object.fromEntries(
    Object.values(PHARMACY_SUMMARY_KEYS).map((key) => [key, 0]),
  )

  for (const row of rows) {
    const key = PHARMACY_SUMMARY_KEYS[row._id]
    if (key) summary[key] = row.count
  }

  return summary
}

module.exports = {
  checkout,
  listOrders,
  getOrderById,
  serializeOrder,
  listPharmacyOrders,
  getPharmacyOrderById,
  updatePharmacyOrderStatus,
  getPharmacyOrderSummary,
  DELIVERY_FEE,
}
