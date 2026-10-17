const express = require('express')
const { requireAuth, requireRole } = require('../middleware/auth.middleware')
const prescriptionController = require('../controllers/prescription.controller')

const router = express.Router()

// Doctor's authored prescriptions (must be declared before /:prescriptionId).
router.get(
  '/doctor',
  requireAuth,
  requireRole('DOCTOR'),
  prescriptionController.getDoctorPrescriptions,
)

// Patient's own prescriptions.
router.get(
  '/',
  requireAuth,
  requireRole('PATIENT'),
  prescriptionController.getMyPrescriptions,
)

router.post(
  '/',
  requireAuth,
  requireRole('DOCTOR'),
  prescriptionController.createPrescription,
)

router.get('/:prescriptionId', requireAuth, prescriptionController.getPrescription)

module.exports = router
