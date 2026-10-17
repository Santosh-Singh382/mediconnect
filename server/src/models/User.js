const mongoose = require('mongoose')

const USER_ROLES = ['PATIENT', 'DOCTOR', 'PHARMACY', 'ADMIN']

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: [254, 'Email cannot exceed 254 characters'],
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Email address is not valid'],
    },
    phone: {
      type: String,
      trim: true,
      validate: {
        validator(value) {
          return !value || /^\+?[0-9\s()-]{7,20}$/.test(value)
        },
        message: 'Phone number is not valid',
      },
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      select: false,
    },
    role: {
      type: String,
      default: 'PATIENT',
      enum: {
        values: USER_ROLES,
        message: '{VALUE} is not a supported role',
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.passwordHash
        return ret
      },
    },
  },
)

module.exports = mongoose.model('User', userSchema)