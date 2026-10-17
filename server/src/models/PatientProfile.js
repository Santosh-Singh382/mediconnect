const mongoose = require('mongoose')

const GENDERS = ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

const patientProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
      unique: true,
    },
    dateOfBirth: {
      type: Date,
      default: null,
    },
    gender: {
      type: String,
      enum: {
        values: GENDERS,
        message: '{VALUE} is not a supported gender',
      },
      default: null,
    },
    address: {
      street: { type: String, trim: true, maxlength: 200, default: null },
      city: { type: String, trim: true, maxlength: 100, default: null },
      state: { type: String, trim: true, maxlength: 100, default: null },
      postalCode: { type: String, trim: true, maxlength: 20, default: null },
      country: { type: String, trim: true, maxlength: 100, default: null },
    },
    emergencyContact: {
      name: { type: String, trim: true, maxlength: 100, default: null },
      relationship: { type: String, trim: true, maxlength: 100, default: null },
      phone: { type: String, trim: true, maxlength: 20, default: null },
    },
    bloodGroup: {
      type: String,
      enum: {
        values: BLOOD_GROUPS,
        message: '{VALUE} is not a supported blood group',
      },
      default: null,
    },
    allergies: {
      type: [String],
      default: [],
    },
    existingConditions: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  },
)

module.exports = mongoose.model('PatientProfile', patientProfileSchema)