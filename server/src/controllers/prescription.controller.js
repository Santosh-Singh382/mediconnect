const prescriptionService = require('../services/prescription.service')

async function createPrescription(req, res) {
  const data = await prescriptionService.createPrescription(req.user.id, req.body)
  res.status(201).json({ success: true, data: { prescription: data } })
}

async function getMyPrescriptions(req, res) {
  const data = await prescriptionService.listPrescriptions({
    role: 'PATIENT',
    userId: req.user.id,
  })
  res.json({ success: true, data })
}

async function getDoctorPrescriptions(req, res) {
  const data = await prescriptionService.listPrescriptions({
    role: 'DOCTOR',
    userId: req.user.id,
  })
  res.json({ success: true, data })
}

async function getPrescription(req, res) {
  const data = await prescriptionService.getPrescriptionById(
    req.params.prescriptionId,
    req.user.id,
  )
  res.json({ success: true, data: { prescription: data } })
}

module.exports = {
  createPrescription,
  getMyPrescriptions,
  getDoctorPrescriptions,
  getPrescription,
}
