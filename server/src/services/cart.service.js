const mongoose = require('mongoose')
const Cart = require('../models/Cart')
const { MAX_CART_ITEM_QUANTITY } = require('../models/Cart')
const Medicine = require('../models/Medicine')
const Pharmacy = require('../models/Pharmacy')
const ApiError = require('../utils/ApiError')
const {
  serializePharmacySummary,
  isExpired,
} = require('./publicMedicine.service')

const LOW_STOCK_THRESHOLD = 5
const MAX_ADD_ATTEMPTS = 3

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function validateObjectId(value, field, label) {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new ApiError(400, `Invalid ${label}`, 'VALIDATION_ERROR', [
      {
        field,
        message: `${label} ID is not a valid identifier`,
      },
    ])
  }
}

function validatePayload(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new ApiError(400, 'Invalid cart payload', 'INVALID_REQUEST_BODY')
  }
}

function validateQuantity(input) {
  const quantity = input?.quantity

  if (quantity === undefined || quantity === null) {
    throw new ApiError(400, 'Invalid cart item data', 'VALIDATION_ERROR', [
      { field: 'quantity', message: 'Quantity is required' },
    ])
  }

  if (typeof quantity !== 'number' || !Number.isInteger(quantity)) {
    throw new ApiError(400, 'Invalid cart item data', 'VALIDATION_ERROR', [
      { field: 'quantity', message: 'Quantity must be a whole number' },
    ])
  }

  if (quantity < 1) {
    throw new ApiError(400, 'Invalid cart item data', 'VALIDATION_ERROR', [
      { field: 'quantity', message: 'Quantity must be at least 1' },
    ])
  }

  if (quantity > MAX_CART_ITEM_QUANTITY) {
    throw new ApiError(400, 'Invalid cart item data', 'VALIDATION_ERROR', [
      {
        field: 'quantity',
        message: `Quantity cannot exceed ${MAX_CART_ITEM_QUANTITY}`,
      },
    ])
  }

  return quantity
}

function quantityExceedsStockError(stockQuantity) {
  return new ApiError(
    409,
    `Only ${stockQuantity} unit${stockQuantity === 1 ? '' : 's'} available`,
    'CART_QUANTITY_EXCEEDS_STOCK',
    [
      {
        field: 'quantity',
        message: `Requested quantity exceeds current stock of ${stockQuantity}`,
      },
    ],
  )
}

function quantityLimitError() {
  return new ApiError(
    409,
    `A cart item cannot exceed ${MAX_CART_ITEM_QUANTITY} units`,
    'CART_QUANTITY_LIMIT_EXCEEDED',
  )
}

async function loadMedicineForCart(medicineId) {
  validateObjectId(medicineId, 'medicineId', 'Medicine')

  const medicine = await Medicine.findById(medicineId).lean()

  if (!medicine) {
    throw new ApiError(404, 'Medicine not found', 'MEDICINE_NOT_FOUND')
  }

  if (medicine.isActive === false) {
    throw new ApiError(
      409,
      'This medicine is no longer available',
      'MEDICINE_UNAVAILABLE',
    )
  }

  if (isExpired(medicine.expiryDate)) {
    throw new ApiError(409, 'This medicine has expired', 'MEDICINE_EXPIRED')
  }

  if (!Number.isInteger(medicine.stockQuantity) || medicine.stockQuantity <= 0) {
    throw new ApiError(
      409,
      'This medicine is currently out of stock',
      'MEDICINE_OUT_OF_STOCK',
    )
  }

  const pharmacy = await Pharmacy.findById(medicine.pharmacyId).lean()

  if (
    !pharmacy ||
    pharmacy.isActive === false ||
    pharmacy.verificationStatus !== 'APPROVED'
  ) {
    throw new ApiError(
      409,
      'This pharmacy is not currently available',
      'PHARMACY_UNAVAILABLE',
    )
  }

  return { medicine, pharmacy }
}

function buildItemSnapshot(medicine, quantity, now) {
  return {
    medicineId: medicine._id,
    quantity,
    unitPriceSnapshot: medicine.price,
    medicineNameSnapshot: medicine.name,
    genericNameSnapshot: medicine.genericName || null,
    strengthSnapshot: medicine.strength || null,
    dosageFormSnapshot: medicine.dosageForm || null,
    packSizeSnapshot: medicine.packSize || null,
    prescriptionRequiredSnapshot: medicine.prescriptionRequired !== false,
    addedAt: now,
    updatedAt: now,
  }
}

async function getOrCreateCart(patientId, pharmacyId) {
  try {
    return await Cart.findOneAndUpdate(
      { patientId, pharmacyId },
      {
        $setOnInsert: {
          patientId,
          pharmacyId,
          items: [],
        },
      },
      {
        upsert: true,
        returnDocument: 'after',
        setDefaultsOnInsert: true,
        runValidators: true,
      },
    ).lean()
  } catch (error) {
    if (error?.code === 11000) {
      const existing = await Cart.findOne({ patientId, pharmacyId }).lean()
      if (existing) return existing
    }
    throw error
  }
}

function serializeCartItem(item, medicine, pharmacyAvailable) {
  const currentStock =
    medicine && Number.isInteger(medicine.stockQuantity)
      ? Math.max(0, medicine.stockQuantity)
      : 0
  const currentUnitPrice =
    medicine && typeof medicine.price === 'number'
      ? medicine.price
      : item.unitPriceSnapshot
  const active = Boolean(medicine) && medicine.isActive !== false
  const expired = Boolean(medicine) && isExpired(medicine.expiryDate)
  const priceChanged = Boolean(medicine) && currentUnitPrice !== item.unitPriceSnapshot
  const quantityExceeded =
    Boolean(medicine) && currentStock > 0 && item.quantity > currentStock
  const outOfStock = Boolean(medicine) && currentStock <= 0
  const available =
    Boolean(medicine) &&
    active &&
    !expired &&
    pharmacyAvailable &&
    currentStock > 0 &&
    item.quantity <= currentStock
  const lowStock = available && currentStock <= LOW_STOCK_THRESHOLD

  let availabilityStatus = 'available'
  if (!medicine || !active) {
    availabilityStatus = 'unavailable'
  } else if (expired) {
    availabilityStatus = 'expired'
  } else if (!pharmacyAvailable) {
    availabilityStatus = 'pharmacyUnavailable'
  } else if (outOfStock) {
    availabilityStatus = 'outOfStock'
  } else if (quantityExceeded) {
    availabilityStatus = 'quantityExceeded'
  } else if (lowStock) {
    availabilityStatus = 'lowStock'
  }

  return {
    medicineId: item.medicineId.toString(),
    name: item.medicineNameSnapshot,
    genericName: item.genericNameSnapshot || null,
    brandName: medicine?.brandName || null,
    category: medicine?.category || null,
    dosageForm: item.dosageFormSnapshot || null,
    strength: item.strengthSnapshot || null,
    packSize: item.packSizeSnapshot || null,
    quantity: item.quantity,
    unitPrice: item.unitPriceSnapshot,
    subtotal: roundMoney(item.unitPriceSnapshot * item.quantity),
    prescriptionRequired: item.prescriptionRequiredSnapshot !== false,
    currentUnitPrice,
    priceChanged,
    currentStock,
    available,
    lowStock,
    quantityExceeded,
    outOfStock,
    expired,
    active,
    availabilityStatus,
  }
}

function serializeCart(cart, medicineMap, pharmacyMap) {
  const pharmacy = pharmacyMap.get(cart.pharmacyId.toString())
  const pharmacyAvailable = Boolean(
    pharmacy &&
      pharmacy.isActive !== false &&
      pharmacy.verificationStatus === 'APPROVED',
  )
  const pharmacySummary = pharmacy
    ? serializePharmacySummary(pharmacy)
    : {
        id: cart.pharmacyId.toString(),
        pharmacyName: null,
        pharmacistName: null,
        address: null,
        city: null,
        state: null,
        pincode: null,
      }

  const items = cart.items.map((item) =>
    serializeCartItem(
      item,
      medicineMap.get(item.medicineId.toString()) || null,
      pharmacyAvailable,
    ),
  )

  return {
    cartId: cart._id.toString(),
    pharmacy: pharmacySummary,
    pharmacyAvailable,
    items,
    subtotal: roundMoney(items.reduce((total, item) => total + item.subtotal, 0)),
    itemCount: items.length,
    totalQuantity: items.reduce((total, item) => total + item.quantity, 0),
  }
}

async function hydrateCarts(carts) {
  if (carts.length === 0) return []

  const medicineIds = [
    ...new Set(carts.flatMap((cart) => cart.items.map((item) => item.medicineId))),
  ]
  const pharmacyIds = [
    ...new Set(carts.map((cart) => cart.pharmacyId)),
  ]

  const [medicines, pharmacies] = await Promise.all([
    medicineIds.length > 0
      ? Medicine.find({ _id: { $in: medicineIds } }).lean()
      : [],
    pharmacyIds.length > 0
      ? Pharmacy.find({ _id: { $in: pharmacyIds } }).lean()
      : [],
  ])

  const medicineMap = new Map(
    medicines.map((medicine) => [medicine._id.toString(), medicine]),
  )
  const pharmacyMap = new Map(
    pharmacies.map((pharmacy) => [pharmacy._id.toString(), pharmacy]),
  )

  return carts
    .map((cart) => serializeCart(cart, medicineMap, pharmacyMap))
    .filter((cart) => cart.itemCount > 0)
    .sort((left, right) => {
      const leftName = left.pharmacy.pharmacyName || ''
      const rightName = right.pharmacy.pharmacyName || ''
      return leftName.localeCompare(rightName)
    })
}

function buildSummary(carts) {
  return {
    cartCount: carts.length,
    itemCount: carts.reduce((total, cart) => total + cart.itemCount, 0),
    totalQuantity: carts.reduce((total, cart) => total + cart.totalQuantity, 0),
    subtotal: roundMoney(carts.reduce((total, cart) => total + cart.subtotal, 0)),
  }
}

async function getCartViewByDocument(cart) {
  const carts = await hydrateCarts(cart && cart.items.length > 0 ? [cart] : [])
  return carts[0] || null
}

async function getCart(patientId) {
  const carts = await Cart.find({
    patientId,
    'items.0': { $exists: true },
  }).lean()
  const serialized = await hydrateCarts(carts)
  return {
    carts: serialized,
    summary: buildSummary(serialized),
  }
}

async function addCartItem(patientId, input) {
  validatePayload(input)
  const quantity = validateQuantity(input)
  const { medicine, pharmacy } = await loadMedicineForCart(input.medicineId)

  if (quantity > medicine.stockQuantity) {
    throw quantityExceedsStockError(medicine.stockQuantity)
  }

  let cart = await getOrCreateCart(patientId, pharmacy._id)
  if (!cart) {
    throw new ApiError(
      409,
      'The cart could not be created. Please try again.',
      'CART_CONFLICT',
    )
  }

  const now = new Date()
  const stockLimit = Math.min(medicine.stockQuantity, MAX_CART_ITEM_QUANTITY)

  for (let attempt = 0; attempt < MAX_ADD_ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      cart = await Cart.findOne({ _id: cart._id, patientId }).lean()
      if (!cart) {
        cart = await getOrCreateCart(patientId, pharmacy._id)
        if (!cart) break
      }
    }

    const existing = cart.items.find(
      (item) => item.medicineId.toString() === medicine._id.toString(),
    )

    if (existing) {
      const newQuantity = existing.quantity + quantity

      if (newQuantity > MAX_CART_ITEM_QUANTITY) {
        throw quantityLimitError()
      }

      if (newQuantity > medicine.stockQuantity) {
        throw quantityExceedsStockError(medicine.stockQuantity)
      }

      // The filter re-checks the new quantity while updating, so two concurrent
      // requests cannot both push the item past stock or the application limit.
      const updated = await Cart.findOneAndUpdate(
        {
          _id: cart._id,
          patientId,
          items: {
            $elemMatch: {
              medicineId: medicine._id,
              quantity: { $lte: stockLimit - quantity },
            },
          },
        },
        {
          $inc: { 'items.$.quantity': quantity },
          $set: { 'items.$.updatedAt': now },
        },
        { returnDocument: 'after', runValidators: true },
      ).lean()

      if (updated) {
        return getCartViewByDocument(updated)
      }
      continue
    }

    // The inequality on medicineId prevents a concurrent request from adding a
    // second row for the same medicine.
    const pushed = await Cart.findOneAndUpdate(
      {
        _id: cart._id,
        patientId,
        'items.medicineId': { $ne: medicine._id },
      },
      {
        $push: {
          items: buildItemSnapshot(medicine, quantity, now),
        },
      },
      { returnDocument: 'after', runValidators: true },
    ).lean()

    if (pushed) {
      return getCartViewByDocument(pushed)
    }
  }

  const latest = await Cart.findOne({ _id: cart._id, patientId }).lean()
  const latestItem = latest?.items.find(
    (item) => item.medicineId.toString() === medicine._id.toString(),
  )

  if (latestItem) {
    if (latestItem.quantity + quantity > MAX_CART_ITEM_QUANTITY) {
      throw quantityLimitError()
    }
    if (latestItem.quantity + quantity > medicine.stockQuantity) {
      throw quantityExceedsStockError(medicine.stockQuantity)
    }
  }

  throw new ApiError(
    409,
    'The cart could not be updated. Please try again.',
    'CART_CONFLICT',
  )
}

async function updateCartItem(patientId, medicineId, input) {
  validateObjectId(medicineId, 'medicineId', 'Medicine')
  validatePayload(input)
  const quantity = validateQuantity(input)

  const cart = await Cart.findOne({
    patientId,
    'items.medicineId': medicineId,
  }).lean()

  if (!cart) {
    throw new ApiError(404, 'Cart item not found', 'CART_ITEM_NOT_FOUND')
  }

  const medicine = await Medicine.findById(medicineId).lean()

  if (!medicine) {
    throw new ApiError(
      409,
      'This medicine is no longer available',
      'MEDICINE_UNAVAILABLE',
    )
  }

  if (quantity > medicine.stockQuantity) {
    throw quantityExceedsStockError(medicine.stockQuantity)
  }

  const updated = await Cart.findOneAndUpdate(
    {
      _id: cart._id,
      patientId,
      'items.medicineId': medicineId,
    },
    {
      $set: {
        'items.$.quantity': quantity,
        'items.$.updatedAt': new Date(),
      },
    },
    { returnDocument: 'after', runValidators: true },
  ).lean()

  if (!updated) {
    throw new ApiError(404, 'Cart item not found', 'CART_ITEM_NOT_FOUND')
  }

  return getCartViewByDocument(updated)
}

async function removeCartItem(patientId, medicineId) {
  validateObjectId(medicineId, 'medicineId', 'Medicine')

  const updated = await Cart.findOneAndUpdate(
    {
      patientId,
      'items.medicineId': medicineId,
    },
    {
      $pull: {
        items: { medicineId },
      },
    },
    { returnDocument: 'after' },
  ).lean()

  if (!updated) {
    throw new ApiError(404, 'Cart item not found', 'CART_ITEM_NOT_FOUND')
  }

  return getCartViewByDocument(updated)
}

async function clearCart(patientId, cartId) {
  validateObjectId(cartId, 'cartId', 'Cart')

  const cart = await Cart.findOneAndDelete({ _id: cartId, patientId }).lean()

  if (!cart) {
    throw new ApiError(404, 'Cart not found', 'CART_NOT_FOUND')
  }

  return { cleared: true }
}

module.exports = {
  getCart,
  addCartItem,
  updateCartItem,
  removeCartItem,
  clearCart,
}

