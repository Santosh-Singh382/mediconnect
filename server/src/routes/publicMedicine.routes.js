const express = require('express')
const publicMedicineController = require('../controllers/publicMedicine.controller')

const router = express.Router()

router.get('/', publicMedicineController.listPublicMedicines)
router.get('/:medicineId', publicMedicineController.getPublicMedicine)

module.exports = router
