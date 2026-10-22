const mongoose = require('mongoose')

const RECORD_TYPES = [
  'CONSULTATION',
  'DIAGNOSIS',
  'LAB_REPORT',
  'PRESCRIPTION',
  'OTHER',
]

const MAX_TITLE_LENGTH = 200
const MAX_DIAGNOSIS_LENGTH = 1000
const MAX_SUMMARY_LENGTH = 2000
const MAX_NOTES_LENGTH = 4000

const medicalRecordSchema = new mongoose.Schema(
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
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      required: [true, 'Appointment is required'],
    },
    prescriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Prescription',
      default: null,
    },
    recordType: {
      type: String,
      required: [true, 'Record type is required'],
      enum: {
        values: RECORD_TYPES,
        message: '{VALUE} is not a supported record type',
      },
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: [1, 'Title cannot be empty'],
      maxlength: [MAX_TITLE_LENGTH, `Title cannot exceed ${MAX_TITLE_LENGTH} characters`],
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
    summary: {
      type: String,
      required: [true, 'Summary is required'],
      trim: true,
      minlength: [1, 'Summary cannot be empty'],
      maxlength: [MAX_SUMMARY_LENGTH, `Summary cannot exceed ${MAX_SUMMARY_LENGTH} characters`],
    },
    notes: {
      type: String,
      trim: true,
      default: null,
      maxlength: [MAX_NOTES_LENGTH, `Notes cannot exceed ${MAX_NOTES_LENGTH} characters`],
    },
    recordDate: {
      type: Date,
      required: [true, 'Record date is required'],
    },
  },
  {
    timestamps: true,
  },
)

// Patient record timeline, newest first.
medicalRecordSchema.index({ patientId: 1, recordDate: -1 })

// Doctor authored records, newest first.
medicalRecordSchema.index({ doctorId: 1, recordDate: -1 })

// Records for a consultation. Deliberately NOT unique: a consultation may
// legitimately produce multiple records (consultation note, lab report, ...).
medicalRecordSchema.index({ appointmentId: 1 })

const MedicalRecordModel = mongoose.model('MedicalRecord', medicalRecordSchema)

module.exports = MedicalRecordModel
module.exports.RECORD_TYPES = RECORD_TYPES
module.exports.MAX_TITLE_LENGTH = MAX_TITLE_LENGTH
module.exports.MAX_DIAGNOSIS_LENGTH = MAX_DIAGNOSIS_LENGTH
module.exports.MAX_SUMMARY_LENGTH = MAX_SUMMARY_LENGTH
module.exports.MAX_NOTES_LENGTH = MAX_NOTES_LENGTH
