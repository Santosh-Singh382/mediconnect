const express = require('express')
const { requireAuth, requireRole } = require('../middleware/auth.middleware')
const pharmacyController = require('../controllers/pharmacy.controller')

const router = express.Router()

// Pharmacy-owner endpoints are limited to authenticated PHARMACY accounts.
router.use(requireAuth, requireRole('PHARMACY'))

router.get('/profile', pharmacyController.getProfile)
router.post('/profile', pharmacyController.createProfile)
router.put('/profile', pharmacyController.updateProfile)

module.exports = router
