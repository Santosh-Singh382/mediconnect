const express = require('express')
const healthRoutes = require('./health.routes')
const authRoutes = require('./auth.routes')
const patientRoutes = require('./patient.routes')
const doctorRoutes = require('./doctor.routes')
const doctorsRoutes = require('./doctors.routes')
const appointmentRoutes = require('./appointment.routes')
const chatRoutes = require('./chat.routes')
const prescriptionRoutes = require('./prescription.routes')

const router = express.Router()

router.use('/health', healthRoutes)
router.use('/auth', authRoutes)
router.use('/patient', patientRoutes)
router.use('/doctor', doctorRoutes)
router.use('/doctors', doctorsRoutes)
router.use('/appointments', appointmentRoutes)
router.use('/chat', chatRoutes)
router.use('/prescriptions', prescriptionRoutes)

module.exports = router
