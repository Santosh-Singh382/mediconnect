const express = require('express')
const { requireAuth, requireRole } = require('../middleware/auth.middleware')
const patientController = require('../controllers/patient.controller')

const router = express.Router()

router.use(requireAuth, requireRole('PATIENT'))

router.get('/profile', patientController.getProfile)
router.put('/profile', patientController.updateProfile)
router.get('/dashboard', patientController.getDashboard)

module.exports = router