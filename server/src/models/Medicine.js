const mongoose = require('mongoose')

const MEDICINE_CATEGORIES = [
  'TABLET',
  'CAPSULE',
  'SYRUP',
  'INJECTION',
  'CREAM',
  'OINTMENT',
  'DROPS',
  'INHALER',
  'POWDER',
  'OTHER',
]

const MAX_NAME_LENGTH = 200
const MAX_GENERIC_NAME_LENGTH = 200
const MAX_BRAND_NAME_LENGTH = 200
const MAX_DESCRIPTION_LENGTH = 1000
const MAX_DOSAGE_FORM_LENGTH = 100
const MAX_STRENGTH_LENGTH = 100
const MAX_PACK_SIZE_LENGTH = 100
const MAX_PRICE = 1000000
const MAX_STOCK_QUANTITY = 1000000

const medicineSchema = new mongoose.Schema(
  {
    pharmacyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pharmacy',
      required: [true, 'Pharmacy is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Medicine name is required'],
      trim: true,
      minlength: [1, 'Medicine name cannot be empty'],
      maxlength: [
        MAX_NAME_LENGTH,
        `Medicine name cannot exceed ${MAX_NAME_LENGTH} characters`,
      ],
    },
    genericName: {
      type: String,
      trim: true,
      default: null,
      maxlength: [
        MAX_GENERIC_NAME_LENGTH,
        `Generic name cannot exceed ${MAX_GENERIC_NAME_LENGTH} characters`,
      ],
    },
    brandName: {
      type: String,
      trim: true,
      default: null,
      maxlength: [
        MAX_BRAND_NAME_LENGTH,
        `Brand name cannot exceed ${MAX_BRAND_NAME_LENGTH} characters`,
      ],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: {
        values: MEDICINE_CATEGORIES,
        message: '{VALUE} is not a supported medicine category',
      },
      index: true,
    },
    description: {
      type: String,
      trim: true,
      default: null,
      maxlength: [
        MAX_DESCRIPTION_LENGTH,
        `Description cannot exceed ${MAX_DESCRIPTION_LENGTH} characters`,
      ],
    },
    dosageForm: {
      type: String,
      trim: true,
      default: null,
      maxlength: [
        MAX_DOSAGE_FORM_LENGTH,
        `Dosage form cannot exceed ${MAX_DOSAGE_FORM_LENGTH} characters`,
      ],
    },
    strength: {
      type: String,
      trim: true,
      default: null,
      maxlength: [
        MAX_STRENGTH_LENGTH,
        `Strength cannot exceed ${MAX_STRENGTH_LENGTH} characters`,
      ],
    },
    packSize: {
      type: String,
      trim: true,
      default: null,
      maxlength: [
        MAX_PACK_SIZE_LENGTH,
        `Pack size cannot exceed ${MAX_PACK_SIZE_LENGTH} characters`,
      ],
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
      max: [MAX_PRICE, `Price cannot exceed ${MAX_PRICE}`],
      validate: {
        validator: Number.isFinite,
        message: 'Price must be a valid number',
      },
    },
    stockQuantity: {
      type: Number,
      required: [true, 'Stock quantity is required'],
      min: [0, 'Stock quantity cannot be negative'],
      max: [MAX_STOCK_QUANTITY, `Stock quantity cannot exceed ${MAX_STOCK_QUANTITY}`],
      validate: {
        validator: Number.isInteger,
        message: 'Stock quantity must be a whole number',
      },
    },
    prescriptionRequired: {
      type: Boolean,
      default: true,
    },
    expiryDate: {
      type: Date,
      required: [true, 'Expiry date is required'],
      validate: {
        validator(value) {
          return value instanceof Date && !Number.isNaN(value.getTime())
        },
        message: 'Expiry date is not a valid date',
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Normalized identity used only for duplicate protection. It is never
    // serialized or accepted from clients.
    identityKey: {
      type: String,
      required: true,
      select: false,
    },
  },
  {
    timestamps: true,
  },
)

// The same medicine may be sold by many pharmacies, but only once within a
// single pharmacy's inventory. The compound index is the database backstop for
// concurrent duplicate creation.
medicineSchema.index({ pharmacyId: 1, identityKey: 1 }, { unique: true })

// Inventory listing and filtering are always scoped to a pharmacy.
medicineSchema.index({ pharmacyId: 1, isActive: 1, name: 1 })
medicineSchema.index({ pharmacyId: 1, category: 1, name: 1 })
medicineSchema.index({ pharmacyId: 1, expiryDate: 1 })

// Public discovery filters active, non-expired medicines before joining the
// pharmacy. This index supports that visibility scan and category filtering.
medicineSchema.index({ isActive: 1, expiryDate: 1, category: 1 })

const MedicineModel = mongoose.model('Medicine', medicineSchema)

module.exports = MedicineModel
module.exports.MEDICINE_CATEGORIES = MEDICINE_CATEGORIES
module.exports.MAX_NAME_LENGTH = MAX_NAME_LENGTH
module.exports.MAX_GENERIC_NAME_LENGTH = MAX_GENERIC_NAME_LENGTH
module.exports.MAX_BRAND_NAME_LENGTH = MAX_BRAND_NAME_LENGTH
module.exports.MAX_DESCRIPTION_LENGTH = MAX_DESCRIPTION_LENGTH
module.exports.MAX_DOSAGE_FORM_LENGTH = MAX_DOSAGE_FORM_LENGTH
module.exports.MAX_STRENGTH_LENGTH = MAX_STRENGTH_LENGTH
module.exports.MAX_PACK_SIZE_LENGTH = MAX_PACK_SIZE_LENGTH
module.exports.MAX_PRICE = MAX_PRICE
module.exports.MAX_STOCK_QUANTITY = MAX_STOCK_QUANTITY
