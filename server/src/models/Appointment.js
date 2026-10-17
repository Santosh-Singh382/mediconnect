const mongoose = require('mongoose')

const APPOINTMENT_TYPES = ['VIDEO', 'AUDIO', 'CHAT']

const APPOINTMENT_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED',
  'REJECTED',
]

const APPOINTMENT_SLOT_MINUTES = 30

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const MAX_REASON_LENGTH = 500
const MAX_NOTES_LENGTH = 1000

const appointmentSchema = new mongoose.Schema(
  {
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
    appointmentDate: {
      type: String,
      required: [true, 'Appointment date is required'],
      match: [DATE_PATTERN, 'Appointment date must use YYYY-MM-DD format'],
    },
    startTime: {
      type: String,
      required: [true, 'Start time is required'],
      match: [TIME_PATTERN, 'Start time must use HH:mm format'],
    },
    endTime: {
      type: String,
      required: [true, 'End time is required'],
      match: [TIME_PATTERN, 'End time must use HH:mm format'],
    },
    type: {
      type: String,
      required: [true, 'Consultation type is required'],
      enum: {
        values: APPOINTMENT_TYPES,
        message: '{VALUE} is not a supported consultation type',
      },
    },
    status: {
      type: String,
      default: 'PENDING',
      enum: {
        values: APPOINTMENT_STATUSES,
        message: '{VALUE} is not a supported appointment status',
      },
    },
    reason: {
      type: String,
      required: [true, 'Reason is required'],
      trim: true,
      minlength: [1, 'Reason cannot be empty'],
      maxlength: [MAX_REASON_LENGTH, `Reason cannot exceed ${MAX_REASON_LENGTH} characters`],
    },
    notes: {
      type: String,
      trim: true,
      default: null,
      maxlength: [MAX_NOTES_LENGTH, `Notes cannot exceed ${MAX_NOTES_LENGTH} characters`],
    },
  },
  {
    timestamps: true,
  },
)

// A doctor/date/start-time can hold at most ONE active (PENDING or CONFIRMED)
// appointment. Cancelled and rejected slots are reusable. This partial unique
// index is the database-level double-booking backstop for grid-aligned slots.
appointmentSchema.index(
  { doctorId: 1, appointmentDate: 1, startTime: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['PENDING', 'CONFIRMED'] } },
  },
)

// Doctor appointment lists and overlap lookups are keyed by (doctor, date).
appointmentSchema.index({ doctorId: 1, appointmentDate: -1, startTime: 1 })

// Patient appointment lists are keyed by (patient, date).
appointmentSchema.index({ patientId: 1, appointmentDate: -1, startTime: 1 })

appointmentSchema.index({ doctorId: 1, status: 1, startTime: 1 })

const AppointmentModel = mongoose.model('Appointment', appointmentSchema)

module.exports = AppointmentModel
module.exports.APPOINTMENT_TYPES = APPOINTMENT_TYPES
module.exports.APPOINTMENT_STATUSES = APPOINTMENT_STATUSES
module.exports.APPOINTMENT_SLOT_MINUTES = APPOINTMENT_SLOT_MINUTES
module.exports.TIME_PATTERN = TIME_PATTERN
module.exports.DATE_PATTERN = DATE_PATTERN
module.exports.MAX_REASON_LENGTH = MAX_REASON_LENGTH
module.exports.MAX_NOTES_LENGTH = MAX_NOTES_LENGTH