const express = require('express')
const { requireAuth, requireRole } = require('../middleware/auth.middleware')
const medicalRecordController = require('../controllers/medicalRecord.controller')

const router = express.Router()

// Patients see records about them; doctors see records they created.
router.get(
  '/',
  requireAuth,
  requireRole('PATIENT', 'DOCTOR'),
  medicalRecordController.listMedicalRecords,
)

// Doctors author records for their own completed consultations.
router.post(
  '/',
  requireAuth,
  requireRole('DOCTOR'),
  medicalRecordController.createMedicalRecord,
)

router.get('/:recordId', requireAuth, medicalRecordController.getMedicalRecord)

module.exports = router
