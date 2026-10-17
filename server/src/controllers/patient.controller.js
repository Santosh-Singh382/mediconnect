const {
  getPatientProfile,
  savePatientProfile,
  getPatientDashboard,
} = require('../services/patient.service')

async function getProfile(req, res) {
  const data = await getPatientProfile(req.user.id)
  res.json({ success: true, data: { user: req.user, ...data } })
}

async function updateProfile(req, res) {
  const data = await savePatientProfile(req.user.id, req.body)
  res.json({ success: true, data: { user: req.user, ...data } })
}

async function getDashboard(req, res) {
  const data = await getPatientDashboard(req.user.id)
  res.json({ success: true, data: { user: req.user, ...data } })
}

module.exports = { getProfile, updateProfile, getDashboard }