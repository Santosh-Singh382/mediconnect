const express = require('express')
const pharmacyController = require('../controllers/pharmacy.controller')

const router = express.Router()

// Public directory entry for an approved, active pharmacy only.
router.get('/:pharmacyId', pharmacyController.getPharmacy)

module.exports = router
