const mongoose = require('mongoose')
const {
  MAX_NAME_LENGTH,
  MAX_GENERIC_NAME_LENGTH,
  MAX_DOSAGE_FORM_LENGTH,
  MAX_STRENGTH_LENGTH,
  MAX_PACK_SIZE_LENGTH,
  MAX_PRICE,
} = require('./Medicine')

const MAX_CART_ITEM_QUANTITY = 100

const cartItemSchema = new mongoose.Schema(
  {
    medicineId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Medicine',
      required: [true, 'Medicine is required'],
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
      required: [true, 'Unit price snapshot is required'],
      min: [0, 'Unit price snapshot cannot be negative'],
      max: [MAX_PRICE, `Unit price snapshot cannot exceed ${MAX_PRICE}`],
    },
    medicineNameSnapshot: {
      type: String,
      required: [true, 'Medicine name snapshot is required'],
      trim: true,
      maxlength: [
        MAX_NAME_LENGTH,
        `Medicine name snapshot cannot exceed ${MAX_NAME_LENGTH} characters`,
      ],
    },
    genericNameSnapshot: {
      type: String,
      trim: true,
      default: null,
      maxlength: [
        MAX_GENERIC_NAME_LENGTH,
        `Generic name snapshot cannot exceed ${MAX_GENERIC_NAME_LENGTH} characters`,
      ],
    },
    strengthSnapshot: {
      type: String,
      trim: true,
      default: null,
      maxlength: [
        MAX_STRENGTH_LENGTH,
        `Strength snapshot cannot exceed ${MAX_STRENGTH_LENGTH} characters`,
      ],
    },
    dosageFormSnapshot: {
      type: String,
      trim: true,
      default: null,
      maxlength: [
        MAX_DOSAGE_FORM_LENGTH,
        `Dosage form snapshot cannot exceed ${MAX_DOSAGE_FORM_LENGTH} characters`,
      ],
    },
    packSizeSnapshot: {
      type: String,
      trim: true,
      default: null,
      maxlength: [
        MAX_PACK_SIZE_LENGTH,
        `Pack size snapshot cannot exceed ${MAX_PACK_SIZE_LENGTH} characters`,
      ],
    },
    prescriptionRequiredSnapshot: {
      type: Boolean,
      default: true,
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
)

const cartSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Patient is required'],
    },
    pharmacyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pharmacy',
      required: [true, 'Pharmacy is required'],
    },
    items: {
      type: [cartItemSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
)

// One cart per patient and pharmacy. The unique index is also the database
// backstop against concurrent "add to cart" requests creating two carts.
cartSchema.index({ patientId: 1, pharmacyId: 1 }, { unique: true })

const CartModel = mongoose.model('Cart', cartSchema)

module.exports = CartModel
module.exports.MAX_CART_ITEM_QUANTITY = MAX_CART_ITEM_QUANTITY
