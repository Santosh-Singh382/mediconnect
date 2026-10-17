const express = require('express')
const { requireAuth, requireRole } = require('../middleware/auth.middleware')
const appointmentController = require('../controllers/appointment.controller')

const router = express.Router()

// Public: open slots for an approved doctor on a given date.
router.get('/availability/:doctorId', appointmentController.getAvailability)

router.post('/', requireAuth, requireRole('PATIENT'), appointmentController.createAppointment)

router.get('/my', requireAuth, requireRole('PATIENT'), appointmentController.getMyAppointments)
router.get('/doctor', requireAuth, requireRole('DOCTOR'), appointmentController.getDoctorAppointments)

router.get('/:appointmentId', requireAuth, appointmentController.getAppointment)

router.patch(
  '/:appointmentId/confirm',
  requireAuth,
  requireRole('DOCTOR'),
  appointmentController.confirmAppointment,
)
router.patch(
  '/:appointmentId/reject',
  requireAuth,
  requireRole('DOCTOR'),
  appointmentController.rejectAppointment,
)
router.patch(
  '/:appointmentId/complete',
  requireAuth,
  requireRole('DOCTOR'),
  appointmentController.completeAppointment,
)
router.patch(
  '/:appointmentId/cancel',
  requireAuth,
  appointmentController.cancelAppointment,
)

module.exports = router