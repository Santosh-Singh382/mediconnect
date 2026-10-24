const express = require('express')
const { requireAuth, requireRole } = require('../middleware/auth.middleware')
const medicineController = require('../controllers/medicine.controller')

const router = express.Router()

// Inventory management is limited to authenticated PHARMACY accounts. The
// owning pharmacy is derived from the JWT by the service, never from the body.
router.use(requireAuth, requireRole('PHARMACY'))

router.get('/', medicineController.listMyMedicines)
router.post('/', medicineController.createMedicine)
router.patch('/:medicineId/deactivate', medicineController.deactivateMyMedicine)
router.patch('/:medicineId/activate', medicineController.reactivateMyMedicine)
router.get('/:medicineId', medicineController.getMyMedicine)
router.put('/:medicineId', medicineController.updateMyMedicine)

module.exports = router
