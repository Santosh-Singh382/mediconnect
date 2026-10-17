const mongoose = require('mongoose')

const PRESCRIPTION_STATUSES = ['ACTIVE', 'CANCELLED']

const MEDICINE_ROUTES = [
  'ORAL',
  'TOPICAL',
  'INHALATION',
  'INJECTION',
  'OPHTHALMIC',
  'OTHER',
]

const MEDICINE_TIMINGS = ['BEFORE_MEAL', 'AFTER_MEAL', 'WITH_MEAL', 'ANYTIME']

const MAX_DIAGNOSIS_LENGTH = 1000
const MAX_INSTRUCTIONS_LENGTH = 2000
const MAX_MEDICINES = 30
const MAX_MEDICINE_NAME_LENGTH = 200
const MAX_DOSAGE_LENGTH = 100
const MAX_FREQUENCY_LENGTH = 100
const MAX_DURATION_LENGTH = 100
const MAX_MEDICINE_INSTRUCTIONS_LENGTH = 500
const MAX_QUANTITY = 10000

const medicineSchema = new mongoose.Schema(
  {
    medicineName: {
      type: String,
      required: [true, 'Medicine name is required'],
      trim: true,
      minlength: [1, 'Medicine name cannot be empty'],
      maxlength: [
        MAX_MEDICINE_NAME_LENGTH,
        `Medicine name cannot exceed ${MAX_MEDICINE_NAME_LENGTH} characters`,
      ],
    },
    dosage: {
      type: String,
      required: [true, 'Dosage is required'],
      trim: true,
      minlength: [1, 'Dosage cannot be empty'],
      maxlength: [MAX_DOSAGE_LENGTH, `Dosage cannot exceed ${MAX_DOSAGE_LENGTH} characters`],
    },
    frequency: {
      type: String,
      required: [true, 'Frequency is required'],
      trim: true,
      minlength: [1, 'Frequency cannot be empty'],
      maxlength: [
        MAX_FREQUENCY_LENGTH,
        `Frequency cannot exceed ${MAX_FREQUENCY_LENGTH} characters`,
      ],
    },
    duration: {
      type: String,
      required: [true, 'Duration is required'],
      trim: true,
      minlength: [1, 'Duration cannot be empty'],
      maxlength: [
        MAX_DURATION_LENGTH,
        `Duration cannot exceed ${MAX_DURATION_LENGTH} characters`,
      ],
    },
    route: {
      type: String,
      default: null,
      enum: {
        values: [...MEDICINE_ROUTES, null],
        message: '{VALUE} is not a supported medicine route',
      },
    },
    timing: {
      type: String,
      default: null,
      enum: {
        values: [...MEDICINE_TIMINGS, null],
        message: '{VALUE} is not a supported medicine timing',
      },
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1'],
      max: [MAX_QUANTITY, `Quantity cannot exceed ${MAX_QUANTITY}`],
      validate: {
        validator: Number.isInteger,
        message: 'Quantity must be a whole number',
      },
    },
    instructions: {
      type: String,
      trim: true,
      default: null,
      maxlength: [
        MAX_MEDICINE_INSTRUCTIONS_LENGTH,
        `Medicine instructions cannot exceed ${MAX_MEDICINE_INSTRUCTIONS_LENGTH} characters`,
      ],
    },
  },
  { _id: true },
)

const prescriptionSchema = new mongoose.Schema(
  {
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      required: [true, 'Appointment is required'],
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Patient is required'],
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Doctor is required'],
    },
    diagnosis: {
      type: String,
      trim: true,
      default: null,
      maxlength: [
        MAX_DIAGNOSIS_LENGTH,
        `Diagnosis cannot exceed ${MAX_DIAGNOSIS_LENGTH} characters`,
      ],
    },
    medicines: {
      type: [medicineSchema],
      required: [true, 'At least one medicine is required'],
      validate: [
        {
          validator: (value) => Array.isArray(value) && value.length > 0,
          message: 'At least one medicine is required',
        },
        {
          validator: (value) => Array.isArray(value) && value.length <= MAX_MEDICINES,
          message: `A prescription cannot contain more than ${MAX_MEDICINES} medicines`,
        },
      ],
    },
    instructions: {
      type: String,
      trim: true,
      default: null,
      maxlength: [
        MAX_INSTRUCTIONS_LENGTH,
        `Instructions cannot exceed ${MAX_INSTRUCTIONS_LENGTH} characters`,
      ],
    },
    followUpDate: {
      type: String,
      default: null,
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Follow-up date must use YYYY-MM-DD format'],
    },
    status: {
      type: String,
      default: 'ACTIVE',
      enum: {
        values: PRESCRIPTION_STATUSES,
        message: '{VALUE} is not a supported prescription status',
      },
    },
  },
  {
    timestamps: true,
  },
)

// A consultation (appointment) can have at most ONE prescription. This unique
// index is the database-level backstop against duplicate/concurrent creation.
prescriptionSchema.index({ appointmentId: 1 }, { unique: true })

// Patient prescription history, newest first.
prescriptionSchema.index({ patientId: 1, createdAt: -1 })

// Doctor authored prescriptions, newest first.
prescriptionSchema.index({ doctorId: 1, createdAt: -1 })

const PrescriptionModel = mongoose.model('Prescription', prescriptionSchema)

module.exports = PrescriptionModel
module.exports.PRESCRIPTION_STATUSES = PRESCRIPTION_STATUSES
module.exports.MEDICINE_ROUTES = MEDICINE_ROUTES
module.exports.MEDICINE_TIMINGS = MEDICINE_TIMINGS
module.exports.MAX_DIAGNOSIS_LENGTH = MAX_DIAGNOSIS_LENGTH
module.exports.MAX_INSTRUCTIONS_LENGTH = MAX_INSTRUCTIONS_LENGTH
module.exports.MAX_MEDICINES = MAX_MEDICINES
module.exports.MAX_MEDICINE_NAME_LENGTH = MAX_MEDICINE_NAME_LENGTH
module.exports.MAX_DOSAGE_LENGTH = MAX_DOSAGE_LENGTH
module.exports.MAX_FREQUENCY_LENGTH = MAX_FREQUENCY_LENGTH
module.exports.MAX_DURATION_LENGTH = MAX_DURATION_LENGTH
module.exports.MAX_MEDICINE_INSTRUCTIONS_LENGTH = MAX_MEDICINE_INSTRUCTIONS_LENGTH
module.exports.MAX_QUANTITY = MAX_QUANTITY
