const mongoose = require('mongoose')

const DAYS_OF_WEEK = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
]

const VERIFICATION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED']

const doctorProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
      unique: true,
    },
    specialization: {
      type: String,
      required: [true, 'Specialization is required'],
      trim: true,
      maxlength: [100, 'Specialization cannot exceed 100 characters'],
      index: true,
    },
    qualification: {
      type: String,
      required: [true, 'Qualification is required'],
      trim: true,
      maxlength: [100, 'Qualification cannot exceed 100 characters'],
    },
    experience: {
      type: Number,
      default: 0,
      min: [0, 'Experience cannot be negative'],
      max: [80, 'Experience cannot exceed 80 years'],
      index: true,
    },
    registrationNumber: {
      type: String,
      required: [true, 'Registration number is required'],
      trim: true,
      maxlength: [60, 'Registration number cannot exceed 60 characters'],
    },
    consultationFee: {
      type: Number,
      default: null,
      min: [0, 'Consultation fee cannot be negative'],
      max: [100000, 'Consultation fee cannot exceed 100000'],
      index: true,
    },
    bio: {
      type: String,
      trim: true,
      maxlength: [1000, 'Bio cannot exceed 1000 characters'],
      default: null,
    },
    clinicName: {
      type: String,
      trim: true,
      maxlength: [120, 'Clinic name cannot exceed 120 characters'],
      default: null,
    },
    clinicAddress: {
      street: { type: String, trim: true, maxlength: 200, default: null },
      city: { type: String, trim: true, maxlength: 100, default: null },
      state: { type: String, trim: true, maxlength: 100, default: null },
      postalCode: { type: String, trim: true, maxlength: 20, default: null },
      country: { type: String, trim: true, maxlength: 100, default: null },
    },
    languages: {
      type: [String],
      default: [],
    },
    availability: {
      type: [
        {
          dayOfWeek: {
            type: String,
            enum: {
              values: DAYS_OF_WEEK,
              message: '{VALUE} is not a supported day of the week',
            },
          },
          enabled: { type: Boolean, default: false },
          startTime: { type: String, default: null },
          endTime: { type: String, default: null },
        },
      ],
      default: [],
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
  },
  {
    timestamps: true,
  },
)

module.exports = mongoose.model('DoctorProfile', doctorProfileSchema)
module.exports.DAYS_OF_WEEK = DAYS_OF_WEEK
module.exports.VERIFICATION_STATUSES = VERIFICATION_STATUSES