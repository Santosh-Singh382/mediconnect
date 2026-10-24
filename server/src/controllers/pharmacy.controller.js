const {
  getMyPharmacy,
  createMyPharmacy,
  updateMyPharmacy,
  getPharmacyById,
} = require('../services/pharmacy.service')

async function getProfile(req, res) {
  const data = await getMyPharmacy(req.user.id)
  res.json({ success: true, data: { user: req.user, ...data } })
}

async function createProfile(req, res) {
  const data = await createMyPharmacy(req.user.id, req.body)
  res.status(201).json({ success: true, data: { user: req.user, ...data } })
}

async function updateProfile(req, res) {
  const data = await updateMyPharmacy(req.user.id, req.body)
  res.json({ success: true, data: { user: req.user, ...data } })
}

async function getPharmacy(req, res) {
  const pharmacy = await getPharmacyById(req.params.pharmacyId)
  res.json({ success: true, data: { pharmacy } })
}

module.exports = { getProfile, createProfile, updateProfile, getPharmacy }
