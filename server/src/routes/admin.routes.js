const express = require('express')
const { requireAuth, requireRole } = require('../middleware/auth.middleware')
const adminController = require('../controllers/admin.controller')

const router = express.Router()

router.use(requireAuth, requireRole('ADMIN'))

router.get('/dashboard', adminController.getDashboard)

router.get('/doctors', adminController.listDoctors)
router.patch(
  '/doctors/:doctorId/verification',
  adminController.updateDoctorVerification,
)

router.get('/pharmacies', adminController.listPharmacies)
router.patch(
  '/pharmacies/:pharmacyId/verification',
  adminController.updatePharmacyVerification,
)

router.get('/users', adminController.listUsers)
router.patch('/users/:userId/status', adminController.updateUserStatus)

router.get('/medicines', adminController.listMedicines)

router.get('/orders', adminController.listOrders)
router.get('/orders/:orderId', adminController.getOrder)

module.exports = router
