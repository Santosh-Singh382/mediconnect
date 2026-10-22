const express = require('express')
const multer = require('multer')
const { requireAuth, requireRole } = require('../middleware/auth.middleware')
const medicalDocumentController = require('../controllers/medicalDocument.controller')
const { MAX_FILE_SIZE_BYTES } = require('../services/medicalDocument.service')
const ApiError = require('../utils/ApiError')

const router = express.Router()

// Files are buffered in memory first so the service can validate type,
// signature, and size before anything touches the disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1 },
})

// Maps Multer's own errors onto the project's standard error shape.
function handleUpload(req, res, next) {
  upload.single('file')(req, res, (error) => {
    if (!error) return next()

    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return next(
          new ApiError(400, 'File size must be 10 MB or less', 'VALIDATION_ERROR', [
            { field: 'file', message: 'File size must be 10 MB or less' },
          ]),
        )
      }
      return next(
        new ApiError(
          400,
          'The upload could not be processed. Please try again.',
          'VALIDATION_ERROR',
          [{ field: 'file', message: 'The upload could not be processed' }],
        ),
      )
    }

    return next(error)
  })
}

// Patients upload their own documents; doctors never upload here.
router.post(
  '/',
  requireAuth,
  requireRole('PATIENT'),
  handleUpload,
  medicalDocumentController.uploadMedicalDocument,
)

router.get(
  '/',
  requireAuth,
  requireRole('PATIENT', 'DOCTOR'),
  medicalDocumentController.listMedicalDocuments,
)

router.get(
  '/:documentId/download',
  requireAuth,
  medicalDocumentController.downloadMedicalDocument,
)

router.get('/:documentId', requireAuth, medicalDocumentController.getMedicalDocument)

// Only the patient who uploaded a document may delete it. Doctors and admins
// are deliberately excluded.
router.delete(
  '/:documentId',
  requireAuth,
  requireRole('PATIENT'),
  medicalDocumentController.deleteMedicalDocument,
)

module.exports = router
