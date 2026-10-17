const express = require('express')
const { requireAuth, requireRole } = require('../middleware/auth.middleware')
const doctorController = require('../controllers/doctor.controller')

const router = express.Router()

router.use(requireAuth, requireRole('DOCTOR'))

router.get('/profile', doctorController.getProfile)
router.put('/profile', doctorController.updateProfile)
router.get('/dashboard', doctorController.getDashboard)

module.exports = router