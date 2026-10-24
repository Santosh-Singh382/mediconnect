const mongoose = require('mongoose')
const { MAX_CART_ITEM_QUANTITY } = require('./Cart')

const ORDER_STATUSES = [
  'PLACED',
  'CONFIRMED',
  'PROCESSING',
  'READY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
]

const PAYMENT_METHODS = ['COD']

const DEFAULT_PAYMENT_METHOD = 'COD'

const PAYMENT_STATUSES = ['PENDING', 'PAID', 'FAILED', 'CANCELLED']

const DEFAULT_PAYMENT_STATUS = 'PENDING'

const PRESCRIPTION_STATUSES = ['NOT_REQUIRED', 'VERIFIED']

const MAX_IDEMPOTENCY_KEY_LENGTH = 128
const MAX_ORDER_ITEMS = 200
const MAX_NAME_LENGTH = 200
const MAX_ADDRESS_LINE_LENGTH = 200
const MAX_CITY_LENGTH = 100
const MAX_STATE_LENGTH = 100
const MAX_PHONE_LENGTH = 20
const MAX_LANDMARK_LENGTH = 200
const MAX_PRICE = 1000000

const orderItemSchema = new mongoose.Schema(
  {
    medicineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medicine',
      required: [true, 'Medicine is required'],
    },
    nameSnapshot: {
      type: String,
      required: [true, 'Medicine name snapshot is required'],
      trim: true,
      maxlength: [MAX_NAME_LENGTH, `Medicine name cannot exceed ${MAX_NAME_LENGTH} characters`],
    },
    genericNameSnapshot: {
      type: String,
      trim: true,
      default: null,
      maxlength: [MAX_NAME_LENGTH, `Generic name cannot exceed ${MAX_NAME_LENGTH} characters`],
    },
    brandNameSnapshot: {
      type: String,
      trim: true,
      default: null,
      maxlength: [MAX_NAME_LENGTH, `Brand name cannot exceed ${MAX_NAME_LENGTH} characters`],
    },
    dosageFormSnapshot: {
      type: String,
      trim: true,
      default: null,
      maxlength: [100, 'Dosage form cannot exceed 100 characters'],
    },
    strengthSnapshot: {
      type: String,
      trim: true,
      default: null,
      maxlength: [100, 'Strength cannot exceed 100 characters'],
    },
    packSizeSnapshot: {
      type: String,
      trim: true,
      default: null,
      maxlength: [100, 'Pack size cannot exceed 100 characters'],
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1'],
      max: [MAX_CART_ITEM_QUANTITY, `Quantity cannot exceed ${MAX_CART_ITEM_QUANTITY}`],
      validate: {
        validator: Number.isInteger,
        message: 'Quantity must be a whole number',
      },
    },
    unitPriceSnapshot: {
      type: Number,
      required: [true, 'Unit price is required'],
      min: [0, 'Unit price cannot be negative'],
      max: [MAX_PRICE, `Unit price cannot exceed ${MAX_PRICE}`],
    },
    lineTotal: {
      type: Number,
      required: [true, 'Line total is required'],
      min: [0, 'Line total cannot be negative'],
    },
    prescriptionRequired: {
      type: Boolean,
      default: false,
    },
    prescriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Prescription',
      default: null,
    },
  },
  { _id: false },
)

const deliveryAddressSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      maxlength: [MAX_NAME_LENGTH, `Full name cannot exceed ${MAX_NAME_LENGTH} characters`],
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      maxlength: [MAX_PHONE_LENGTH, `Phone number cannot exceed ${MAX_PHONE_LENGTH} characters`],
    },
    addressLine1: {
      type: String,
      required: [true, 'Address line 1 is required'],
      trim: true,
      maxlength: [
        MAX_ADDRESS_LINE_LENGTH,
        `Address line 1 cannot exceed ${MAX_ADDRESS_LINE_LENGTH} characters`,
      ],
    },
    addressLine2: {
      type: String,
      trim: true,
      default: null,
      maxlength: [
        MAX_ADDRESS_LINE_LENGTH,
        `Address line 2 cannot exceed ${MAX_ADDRESS_LINE_LENGTH} characters`,
      ],
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
      maxlength: [MAX_CITY_LENGTH, `City cannot exceed ${MAX_CITY_LENGTH} characters`],
    },
    state: {
      type: String,
      required: [true, 'State is required'],
      trim: true,
      maxlength: [MAX_STATE_LENGTH, `State cannot exceed ${MAX_STATE_LENGTH} characters`],
    },
    pincode: {
      type: String,
      required: [true, 'Pincode is required'],
      trim: true,
      match: [/^[1-9][0-9]{5}$/, 'Pincode must be a valid 6-digit Indian pincode'],
    },
    landmark: {
      type: String,
      trim: true,
      default: null,
      maxlength: [
        MAX_LANDMARK_LENGTH,
        `Landmark cannot exceed ${MAX_LANDMARK_LENGTH} characters`,
      ],
    },
  },
  { _id: false },
)

const statusHistoryEntrySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: {
        values: ORDER_STATUSES,
        message: '{VALUE} is not a supported order status',
      },
      required: [true, 'Status history status is required'],
    },
    timestamp: {
      type: Date,
      required: [true, 'Status history timestamp is required'],
    },
  },
  { _id: false },
)

const pharmacySnapshotSchema = new mongoose.Schema(
  {
    pharmacyName: {
      type: String,
      required: [true, 'Pharmacy name snapshot is required'],
      trim: true,
      maxlength: [120, 'Pharmacy name cannot exceed 120 characters'],
    },
    pharmacistName: {
      type: String,
      trim: true,
      default: null,
      maxlength: [100, 'Pharmacist name cannot exceed 100 characters'],
    },
    address: {
      type: String,
      trim: true,
      default: null,
      maxlength: [MAX_ADDRESS_LINE_LENGTH, 'Pharmacy address is too long'],
    },
    city: {
      type: String,
      trim: true,
      default: null,
      maxlength: [MAX_CITY_LENGTH, 'Pharmacy city is too long'],
    },
    state: {
      type: String,
      trim: true,
      default: null,
      maxlength: [MAX_STATE_LENGTH, 'Pharmacy state is too long'],
    },
    pincode: {
      type: String,
      trim: true,
      default: null,
      maxlength: [20, 'Pharmacy pincode is too long'],
    },
  },
  { _id: false },
)

const orderSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Patient is required'],
      index: true,
    },
    pharmacyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pharmacy',
      required: [true, 'Pharmacy is required'],
      index: true,
    },
    pharmacySnapshot: {
      type: pharmacySnapshotSchema,
      required: true,
    },
    items: {
      type: [orderItemSchema],
      required: [true, 'At least one item is required'],
      validate: [
        {
          validator: (value) => Array.isArray(value) && value.length > 0,
          message: 'At least one item is required',
        },
        {
          validator: (value) => Array.isArray(value) && value.length <= MAX_ORDER_ITEMS,
          message: `An order cannot contain more than ${MAX_ORDER_ITEMS} items`,
        },
      ],
    },
    deliveryAddress: {
      type: deliveryAddressSchema,
      required: true,
    },
    subtotal: {
      type: Number,
      required: [true, 'Subtotal is required'],
      min: [0, 'Subtotal cannot be negative'],
    },
    deliveryFee: {
      type: Number,
      required: [true, 'Delivery fee is required'],
      min: [0, 'Delivery fee cannot be negative'],
      default: 0,
    },
    totalAmount: {
      type: Number,
      required: [true, 'Total amount is required'],
      min: [0, 'Total amount cannot be negative'],
    },
    paymentMethod: {
      type: String,
      enum: {
        values: PAYMENT_METHODS,
        message: '{VALUE} is not a supported payment method',
      },
      default: DEFAULT_PAYMENT_METHOD,
    },
    paymentStatus: {
      type: String,
      enum: {
        values: PAYMENT_STATUSES,
        message: '{VALUE} is not a supported payment status',
      },
      default: DEFAULT_PAYMENT_STATUS,
    },
    orderStatus: {
      type: String,
      enum: {
        values: ORDER_STATUSES,
        message: '{VALUE} is not a supported order status',
      },
      default: 'PLACED',
    },
    statusHistory: {
      type: [statusHistoryEntrySchema],
      default: [],
    },
    prescriptionStatus: {
      type: String,
      enum: {
        values: PRESCRIPTION_STATUSES,
        message: '{VALUE} is not a supported prescription status',
      },
      default: 'NOT_REQUIRED',
    },
    placedAt: {
      type: Date,
      default: Date.now,
    },
    sourceCartId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cart',
      required: [true, 'Source cart is required'],
      select: false,
    },
    idempotencyKey: {
      type: String,
      trim: true,
      default: null,
      maxlength: [
        MAX_IDEMPOTENCY_KEY_LENGTH,
        `Idempotency key cannot exceed ${MAX_IDEMPOTENCY_KEY_LENGTH} characters`,
      ],
      select: false,
    },
  },
  {
    timestamps: true,
  },
)

orderSchema.index({ sourceCartId: 1 }, { unique: true })

orderSchema.index(
  { patientId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: 'string' } },
  },
)

orderSchema.index({ patientId: 1, placedAt: -1, _id: -1 })
orderSchema.index({ patientId: 1, orderStatus: 1, placedAt: -1 })
orderSchema.index({ pharmacyId: 1, placedAt: -1, _id: -1 })
orderSchema.index({ pharmacyId: 1, orderStatus: 1, placedAt: -1 })

const OrderModel = mongoose.model('Order', orderSchema)

module.exports = OrderModel
module.exports.ORDER_STATUSES = ORDER_STATUSES
module.exports.PAYMENT_METHODS = PAYMENT_METHODS
module.exports.DEFAULT_PAYMENT_METHOD = DEFAULT_PAYMENT_METHOD
module.exports.PAYMENT_STATUSES = PAYMENT_STATUSES
module.exports.DEFAULT_PAYMENT_STATUS = DEFAULT_PAYMENT_STATUS
module.exports.PRESCRIPTION_STATUSES = PRESCRIPTION_STATUSES
module.exports.MAX_IDEMPOTENCY_KEY_LENGTH = MAX_IDEMPOTENCY_KEY_LENGTH
module.exports.MAX_ORDER_ITEMS = MAX_ORDER_ITEMS
