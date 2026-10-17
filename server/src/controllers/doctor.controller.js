const {
  getDoctorProfile,
  saveDoctorProfile,
  getDoctorDashboard,
} = require('../services/doctor.service')

async function getProfile(req, res) {
  const data = await getDoctorProfile(req.user.id)
  res.json({ success: true, data: { user: req.user, ...data } })
}

async function updateProfile(req, res) {
  const data = await saveDoctorProfile(req.user.id, req.body)
  res.json({ success: true, data: { user: req.user, ...data } })
}

async function getDashboard(req, res) {
  const data = await getDoctorDashboard(req.user.id)
  res.json({ success: true, data: { user: req.user, ...data } })
}

module.exports = { getProfile, updateProfile, getDashboard }