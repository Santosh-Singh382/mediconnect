const mongoose = require('mongoose')

const DOCUMENT_TYPES = [
  'LAB_REPORT',
  'PRESCRIPTION',
  'SCAN_REPORT',
  'DISCHARGE_SUMMARY',
  'MEDICAL_CERTIFICATE',
  'CONSULTATION_DOCUMENT',
  'OTHER',
]

const MAX_TITLE_LENGTH = 200
const MAX_DESCRIPTION_LENGTH = 1000
const MAX_ORIGINAL_NAME_LENGTH = 255
const MAX_MIME_TYPE_LENGTH = 127
const MAX_STORED_NAME_LENGTH = 255
const MAX_STORAGE_PATH_LENGTH = 512

const medicalDocumentSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Patient is required'],
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Uploader is required'],
    },
    // Optional link to a medical record. Documents without a link stay
    // private to the patient who uploaded them.
    recordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MedicalRecord',
      default: null,
    },
    documentType: {
      type: String,
      required: [true, 'Document type is required'],
      enum: {
        values: DOCUMENT_TYPES,
        message: '{VALUE} is not a supported document type',
      },
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: [1, 'Title cannot be empty'],
      maxlength: [MAX_TITLE_LENGTH, `Title cannot exceed ${MAX_TITLE_LENGTH} characters`],
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
    // Metadata only. The original name is never used as a filesystem path.
    originalName: {
      type: String,
      required: [true, 'Original file name is required'],
      trim: true,
      maxlength: [
        MAX_ORIGINAL_NAME_LENGTH,
        `File name cannot exceed ${MAX_ORIGINAL_NAME_LENGTH} characters`,
      ],
    },
    // Generated safe filename, e.g. <uuid>.pdf. Never user-controlled.
    storedName: {
      type: String,
      required: [true, 'Stored file name is required'],
      trim: true,
      maxlength: [
        MAX_STORED_NAME_LENGTH,
        `Stored file name cannot exceed ${MAX_STORED_NAME_LENGTH} characters`,
      ],
    },
    mimeType: {
      type: String,
      required: [true, 'MIME type is required'],
      trim: true,
      maxlength: [
        MAX_MIME_TYPE_LENGTH,
        `MIME type cannot exceed ${MAX_MIME_TYPE_LENGTH} characters`,
      ],
    },
    size: {
      type: Number,
      required: [true, 'File size is required'],
      min: [1, 'File size must be at least 1 byte'],
    },
    // Path relative to the private uploads directory. Never sent to clients.
    storagePath: {
      type: String,
      required: [true, 'Storage path is required'],
      trim: true,
      maxlength: [
        MAX_STORAGE_PATH_LENGTH,
        `Storage path cannot exceed ${MAX_STORAGE_PATH_LENGTH} characters`,
      ],
    },
    uploadedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
)

// Patient document timeline, newest first.
medicalDocumentSchema.index({ patientId: 1, uploadedAt: -1 })

// Documents attached to a medical record, newest first.
medicalDocumentSchema.index({ recordId: 1, uploadedAt: -1 })

// Audit trail of everything a user uploaded, newest first.
medicalDocumentSchema.index({ uploadedBy: 1, uploadedAt: -1 })

const MedicalDocumentModel = mongoose.model('MedicalDocument', medicalDocumentSchema)

module.exports = MedicalDocumentModel
module.exports.DOCUMENT_TYPES = DOCUMENT_TYPES
module.exports.MAX_TITLE_LENGTH = MAX_TITLE_LENGTH
module.exports.MAX_DESCRIPTION_LENGTH = MAX_DESCRIPTION_LENGTH
