const mongoose = require('mongoose')

const VERIFICATION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED']

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

const pharmacySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
      unique: true,
    },
    pharmacyName: {
      type: String,
      required: [true, 'Pharmacy name is required'],
      trim: true,
      maxlength: [120, 'Pharmacy name cannot exceed 120 characters'],
    },
    pharmacistName: {
      type: String,
      required: [true, 'Pharmacist name is required'],
      trim: true,
      maxlength: [100, 'Pharmacist name cannot exceed 100 characters'],
    },
    licenseNumber: {
      type: String,
      required: [true, 'License number is required'],
      unique: true,
      trim: true,
      maxlength: [60, 'License number cannot exceed 60 characters'],
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      maxlength: [20, 'Phone number cannot exceed 20 characters'],
      validate: {
        validator(value) {
          return /^\+?[0-9\s()-]{7,20}$/.test(value)
        },
        message: 'Phone number is not valid',
      },
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
      maxlength: [254, 'Email cannot exceed 254 characters'],
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email address is not valid'],
    },
    address: {
      type: String,
      required: [true, 'Address is required'],
      trim: true,
      maxlength: [200, 'Address cannot exceed 200 characters'],
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
      maxlength: [100, 'City cannot exceed 100 characters'],
    },
    state: {
      type: String,
      required: [true, 'State is required'],
      trim: true,
      maxlength: [100, 'State cannot exceed 100 characters'],
    },
    pincode: {
      type: String,
      required: [true, 'Pincode is required'],
      trim: true,
      match: [/^[1-9][0-9]{5}$/, 'Pincode must be a valid 6-digit Indian pincode'],
    },
    description: {
      type: String,
      trim: true,
      default: null,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    openingTime: {
      type: String,
      default: null,
      validate: {
        validator(value) {
          return value === null || value === '' || TIME_PATTERN.test(value)
        },
        message: 'Opening time must use HH:mm format',
      },
    },
    closingTime: {
      type: String,
      default: null,
      validate: {
        validator(value) {
          return value === null || value === '' || TIME_PATTERN.test(value)
        },
        message: 'Closing time must use HH:mm format',
      },
    },
    verificationStatus: {
      type: String,
      default: 'PENDING',
      enum: {
        values: VERIFICATION_STATUSES,
        message: '{VALUE} is not a supported verification status',
      },
      index: true,
    },
    verificationReason: {
      type: String,
      trim: true,
      default: null,
      maxlength: [500, 'Verification reason cannot exceed 500 characters'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
)

module.exports = mongoose.model('Pharmacy', pharmacySchema)
module.exports.VERIFICATION_STATUSES = VERIFICATION_STATUSES
module.exports.TIME_PATTERN = TIME_PATTERN
