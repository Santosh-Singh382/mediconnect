const { listDoctors, getDoctorById } = require('../services/doctors.service')

async function getDoctors(req, res) {
  const data = await listDoctors(req.query)
  res.json({ success: true, data })
}

async function getDoctor(req, res) {
  const doctor = await getDoctorById(req.params.doctorId)
  res.json({ success: true, data: { doctor } })
}

module.exports = { getDoctors, getDoctor: getDoctor }