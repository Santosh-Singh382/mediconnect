const path = require('path')
const fs = require('fs/promises')
const crypto = require('crypto')
const mongoose = require('mongoose')
const MedicalDocument = require('../models/MedicalDocument')
const MedicalRecord = require('../models/MedicalRecord')
const User = require('../models/User')
const ApiError = require('../utils/ApiError')
const env = require('../config/env')
const {
  DOCUMENT_TYPES,
  MAX_TITLE_LENGTH,
  MAX_DESCRIPTION_LENGTH,
} = require('../models/MedicalDocument')

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 10
const MAX_LIMIT = 50

// Uploaded files live in a private directory that is never served statically.
const UPLOAD_DIR = env.medicalDocumentUploadDir
const MAX_FILE_SIZE_MB = env.medicalDocumentMaxSizeMb
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

// Allowed file types. Each entry declares the accepted MIME types, the file
// extensions, and the leading bytes (magic signature) that must match the
// actual file content so a renamed executable cannot slip through.
const ALLOWED_FILE_TYPES = {
  PDF: {
    mimeTypes: ['application/pdf'],
    extensions: ['.pdf'],
    signature: Buffer.from([0x25, 0x50, 0x44, 0x46]), // %PDF
  },
  JPEG: {
    mimeTypes: ['image/jpeg'],
    extensions: ['.jpg', '.jpeg'],
    signature: Buffer.from([0xff, 0xd8, 0xff]),
  },
  PNG: {
    mimeTypes: ['image/png'],
    extensions: ['.png'],
    signature: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  },
}

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id)
}

function validateRequiredString(value, field, label, max, errors) {
  if (value === undefined || value === null || value === '') {
    errors.push({ field, message: `${label} is required` })
    return null
  }
  if (typeof value !== 'string') {
    errors.push({ field, message: `${label} must be a string` })
    return null
  }
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    errors.push({ field, message: `${label} is required` })
    return null
  }
  if (trimmed.length > max) {
    errors.push({ field, message: `${label} cannot exceed ${max} characters` })
    return null
  }
  return trimmed
}

function validateOptionalString(value, field, label, max, errors) {
  if (value === undefined || value === null || value === '') {
    return null
  }
  if (typeof value !== 'string') {
    errors.push({ field, message: `${label} must be a string` })
    return null
  }
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return null
  }
  if (trimmed.length > max) {
    errors.push({ field, message: `${label} cannot exceed ${max} characters` })
    return null
  }
  return trimmed
}

function validateDocumentType(value, errors) {
  if (value === undefined || value === null || value === '') {
    errors.push({ field: 'documentType', message: 'Document type is required' })
    return null
  }
  if (typeof value !== 'string') {
    errors.push({ field: 'documentType', message: 'Document type must be a string' })
    return null
  }
  const normalized = value.trim().toUpperCase()
  if (!DOCUMENT_TYPES.includes(normalized)) {
    errors.push({
      field: 'documentType',
      message: `Document type must be one of: ${DOCUMENT_TYPES.join(', ')}`,
    })
    return null
  }
  return normalized
}

function validateCreateInput(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new ApiError(400, 'Invalid medical document payload', 'INVALID_REQUEST_BODY')
  }

  const errors = []

  const documentType = validateDocumentType(input.documentType, errors)
  const title = validateRequiredString(
    input.title,
    'title',
    'Title',
    MAX_TITLE_LENGTH,
    errors,
  )
  const description = validateOptionalString(
    input.description,
    'description',
    'Description',
    MAX_DESCRIPTION_LENGTH,
    errors,
  )

  let recordId = null
  if (
    input.recordId !== undefined &&
    input.recordId !== null &&
    input.recordId !== ''
  ) {
    if (typeof input.recordId !== 'string' || !isValidObjectId(input.recordId)) {
      errors.push({
        field: 'recordId',
        message: 'Medical record ID is not a valid identifier',
      })
    } else {
      recordId = input.recordId
    }
  }

  if (errors.length > 0) {
    throw new ApiError(400, 'Invalid medical document data', 'VALIDATION_ERROR', errors)
  }

  return { documentType, title, description, recordId }
}

function findAllowedType(mimeType, originalName) {
  const extension = path.extname(originalName || '').toLowerCase()

  for (const [, spec] of Object.entries(ALLOWED_FILE_TYPES)) {
    const mimeMatches = spec.mimeTypes.includes((mimeType || '').toLowerCase())
    const extensionMatches = spec.extensions.includes(extension)
    if (mimeMatches && extensionMatches) {
      return { spec, extension }
    }
  }
  return null
}

function matchesSignature(buffer, signature) {
  if (!buffer || buffer.length < signature.length) {
    return false
  }
  return signature.every((byte, index) => buffer[index] === byte)
}

// Validates the uploaded file server-side. Never trusts the client-provided
// extension or MIME type alone: the file's leading bytes must match too.
function validateUploadedFile(file) {
  if (!file) {
    throw new ApiError(400, 'A file is required', 'VALIDATION_ERROR', [
      { field: 'file', message: 'Please choose a file to upload' },
    ])
  }

  if (!file.buffer || file.buffer.length === 0) {
    throw new ApiError(400, 'The uploaded file is empty', 'VALIDATION_ERROR', [
      { field: 'file', message: 'The uploaded file is empty' },
    ])
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new ApiError(
      400,
      `File size must be ${MAX_FILE_SIZE_MB} MB or less`,
      'VALIDATION_ERROR',
      [{ field: 'file', message: `File size must be ${MAX_FILE_SIZE_MB} MB or less` }],
    )
  }

  const allowed = findAllowedType(file.mimetype, file.originalname)
  if (!allowed) {
    throw new ApiError(
      400,
      'This file type is not supported. Please upload a PDF, JPG, JPEG, or PNG file.',
      'VALIDATION_ERROR',
      [
        {
          field: 'file',
          message: 'This file type is not supported. Please upload a PDF, JPG, JPEG, or PNG file.',
        },
      ],
    )
  }

  if (!matchesSignature(file.buffer, allowed.spec.signature)) {
    throw new ApiError(
      400,
      'The uploaded file does not match its declared type',
      'VALIDATION_ERROR',
      [
        {
          field: 'file',
          message: 'The uploaded file does not match its declared type',
        },
      ],
    )
  }

  return allowed.extension
}

// Builds a generated safe filename. The original name is never used as a
// filesystem path, so path traversal is impossible by construction.
function buildStoredName(extension) {
  return `${crypto.randomUUID()}${extension}`
}

async function assertRecordBelongsToPatient(recordId, patientId) {
  const record = await MedicalRecord.findById(recordId)
    .select('patientId')
    .lean()

  if (!record) {
    throw new ApiError(400, 'Invalid medical document data', 'VALIDATION_ERROR', [
      { field: 'recordId', message: 'Medical record not found' },
    ])
  }

  if (record.patientId.toString() !== patientId) {
    throw new ApiError(
      403,
      'You can only attach documents to your own medical records',
      'FORBIDDEN',
    )
  }

  return record._id
}

async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true })
}

async function uploadMedicalDocument(userId, file, input) {
  const { documentType, title, description, recordId } = validateCreateInput(input)
  const extension = validateUploadedFile(file)

  let linkedRecordId = null
  if (recordId) {
    linkedRecordId = await assertRecordBelongsToPatient(recordId, userId)
  }

  const storedName = buildStoredName(extension)
  // Keep the stored path relative so the physical location stays private.
  const storagePath = path.join('medical-documents', storedName)

  await ensureUploadDir()
  await fs.writeFile(path.join(UPLOAD_DIR, storedName), file.buffer)

  const document = await MedicalDocument.create({
    patientId: userId,
    uploadedBy: userId,
    recordId: linkedRecordId,
    documentType,
    title,
    description,
    originalName: file.originalname,
    storedName,
    mimeType: file.mimetype,
    size: file.size,
    storagePath,
    uploadedAt: new Date(),
  })

  const [enriched] = await enrichDocuments([document])
  return enriched
}

function serializeDocument(document, maps = {}) {
  const patientId = document.patientId.toString()
  const patientUser = maps.patientUserMap?.get(patientId) || {}

  return {
    id: document._id.toString(),
    documentType: document.documentType,
    title: document.title,
    description: document.description || null,
    originalName: document.originalName,
    mimeType: document.mimeType,
    size: document.size,
    uploadedAt: document.uploadedAt ? document.uploadedAt.toISOString() : null,
    patient: {
      id: patientId,
      name: patientUser.name || 'Patient',
    },
    record: document.recordId ? { id: document.recordId.toString() } : null,
    createdAt: document.createdAt ? document.createdAt.toISOString() : null,
    updatedAt: document.updatedAt ? document.updatedAt.toISOString() : null,
  }
}

async function enrichDocuments(documents) {
  if (documents.length === 0) {
    return []
  }

  const patientIds = [
    ...new Set(documents.map((document) => document.patientId.toString())),
  ].map((id) => new mongoose.Types.ObjectId(id))

  const patientUsers = await User.find({ _id: { $in: patientIds } })
    .select('name')
    .lean()

  const maps = {
    patientUserMap: new Map(
      patientUsers.map((user) => [user._id.toString(), user]),
    ),
  }

  return documents.map((document) => serializeDocument(document, maps))
}

function parsePositiveInteger(raw, field, errors, fallback, max = Number.MAX_SAFE_INTEGER) {
  if (raw === undefined || raw === '') {
    return fallback
  }
  const value = Number(raw)
  if (typeof raw !== 'string' && typeof raw !== 'number') {
    errors.push({ field, message: `${field} must be a number` })
    return fallback
  }
  if (!Number.isInteger(value) || value < 1) {
    errors.push({ field, message: `${field} must be a positive whole number` })
    return fallback
  }
  if (value > max) {
    errors.push({ field, message: `${field} cannot exceed ${max}` })
    return fallback
  }
  return value
}

function parseListQuery(query) {
  const errors = []
  const filter = {}

  const rawType = query.documentType
  if (rawType !== undefined && rawType !== '') {
    if (typeof rawType !== 'string') {
      errors.push({ field: 'documentType', message: 'Document type must be a string' })
    } else {
      const candidate = rawType.trim().toUpperCase()
      if (!DOCUMENT_TYPES.includes(candidate)) {
        errors.push({
          field: 'documentType',
          message: `Document type must be one of: ${DOCUMENT_TYPES.join(', ')}`,
        })
      } else {
        filter.documentType = candidate
      }
    }
  }

  const rawRecordId = query.recordId
  if (rawRecordId !== undefined && rawRecordId !== '') {
    if (typeof rawRecordId !== 'string' || !isValidObjectId(rawRecordId)) {
      errors.push({
        field: 'recordId',
        message: 'Medical record ID is not a valid identifier',
      })
    } else {
      filter.recordId = rawRecordId
    }
  }

  const page = parsePositiveInteger(query.page, 'page', errors, DEFAULT_PAGE)
  const limit = parsePositiveInteger(query.limit, 'limit', errors, DEFAULT_LIMIT, MAX_LIMIT)

  if (errors.length > 0) {
    throw new ApiError(400, 'Invalid medical documents query', 'VALIDATION_ERROR', errors)
  }

  return { filter, page, limit }
}

async function listMedicalDocuments({ role, userId, query }) {
  const { filter, page, limit } = parseListQuery(query || {})

  if (role === 'DOCTOR') {
    // Doctors only see documents attached to records they themselves created.
    const doctorRecords = await MedicalRecord.find({ doctorId: userId })
      .select('_id')
      .lean()
    const recordIds = doctorRecords.map((record) => record._id)
    filter.recordId = { $in: recordIds }
  } else {
    filter.patientId = userId
  }

  const [total, documents] = await Promise.all([
    MedicalDocument.countDocuments(filter),
    MedicalDocument.find(filter)
      .sort({ uploadedAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ])

  const totalPages = total === 0 ? 0 : Math.ceil(total / limit)

  return {
    documents: await enrichDocuments(documents),
    pagination: { page, limit, total, totalPages },
  }
}

async function findDocumentById(documentId) {
  if (!isValidObjectId(documentId)) {
    throw new ApiError(400, 'Invalid medical document identifier', 'VALIDATION_ERROR', [
      {
        field: 'documentId',
        message: 'Medical document ID is not a valid identifier',
      },
    ])
  }

  const document = await MedicalDocument.findById(documentId)
  if (!document) {
    throw new ApiError(404, 'Medical document not found', 'NOT_FOUND')
  }

  return document
}

// Authorization gate shared by detail, download, and delete flows. Doctors
// only reach documents linked to a record they created; patients only their
// own. Runs before any file is read from disk.
async function authorizeDocumentAccess(document, userId, role) {
  if (document.patientId.toString() === userId) {
    return
  }

  if (role === 'DOCTOR' && document.recordId) {
    const record = await MedicalRecord.findById(document.recordId)
      .select('doctorId')
      .lean()
    if (record && record.doctorId.toString() === userId) {
      return
    }
  }

  throw new ApiError(
    403,
    'You do not have permission to access this document',
    'FORBIDDEN',
  )
}

async function getMedicalDocumentById(documentId, userId, role) {
  const document = await findDocumentById(documentId)
  await authorizeDocumentAccess(document, userId, role)

  const [enriched] = await enrichDocuments([document])
  return enriched
}

// Strips anything unsafe from a display filename used in Content-Disposition.
function sanitizeDownloadName(originalName, storedName) {
  const base = path.basename(String(originalName || storedName || 'document'))
  const cleaned = base
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f"\\/]/g, '_')
    .trim()
  if (!cleaned || cleaned === '.' || cleaned === '..') {
    return storedName
  }
  return cleaned.slice(0, 120)
}

async function getDownloadInfo(documentId, userId, role) {
  const document = await findDocumentById(documentId)
  await authorizeDocumentAccess(document, userId, role)

  const filePath = path.join(UPLOAD_DIR, document.storedName)

  // Confirm the physical file exists before streaming. A missing file is a
  // controlled server error and never leaks the filesystem path.
  try {
    await fs.access(filePath)
  } catch {
    throw new ApiError(
      500,
      'This document is temporarily unavailable. Please try again later.',
      'INTERNAL_ERROR',
    )
  }

  return {
    filePath,
    mimeType: document.mimeType,
    size: document.size,
    downloadName: sanitizeDownloadName(document.originalName, document.storedName),
  }
}

async function deleteMedicalDocument(documentId, userId) {
  const document = await findDocumentById(documentId)

  // Only the patient who uploaded the document may delete it.
  if (document.patientId.toString() !== userId) {
    throw new ApiError(
      403,
      'You do not have permission to delete this document',
      'FORBIDDEN',
    )
  }

  await MedicalDocument.deleteOne({ _id: document._id })

  // Remove the physical file. A missing file is not an error (it may already
  // have been cleaned up); any real failure is logged but never blocks the
  // metadata removal that already succeeded.
  try {
    await fs.unlink(path.join(UPLOAD_DIR, document.storedName))
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Failed to remove medical document file:', error.message)
    }
  }

  return { id: document._id.toString() }
}

module.exports = {
  uploadMedicalDocument,
  listMedicalDocuments,
  getMedicalDocumentById,
  getDownloadInfo,
  deleteMedicalDocument,
  sanitizeDownloadName,
  UPLOAD_DIR,
  MAX_FILE_SIZE_BYTES,
  ALLOWED_FILE_TYPES,
}
