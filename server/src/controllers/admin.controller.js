const adminService = require('../services/admin.service')

async function getDashboard(req, res) {
  const data = await adminService.getDashboard()
  res.json({ success: true, data })
}

async function listDoctors(req, res) {
  const data = await adminService.listDoctors(req.query)
  res.json({ success: true, data })
}

async function updateDoctorVerification(req, res) {
  const doctor = await adminService.updateDoctorVerification(
    req.user.id,
    req.params.doctorId,
    req.body,
  )
  res.json({ success: true, data: { doctor } })
}

async function listPharmacies(req, res) {
  const data = await adminService.listPharmacies(req.query)
  res.json({ success: true, data })
}

async function updatePharmacyVerification(req, res) {
  const pharmacy = await adminService.updatePharmacyVerification(
    req.user.id,
    req.params.pharmacyId,
    req.body,
  )
  res.json({ success: true, data: { pharmacy } })
}

async function listUsers(req, res) {
  const data = await adminService.listUsers(req.query)
  res.json({ success: true, data })
}

async function updateUserStatus(req, res) {
  const user = await adminService.updateUserStatus(
    req.user.id,
    req.params.userId,
    req.body,
  )
  res.json({ success: true, data: { user } })
}

async function listMedicines(req, res) {
  const data = await adminService.listMedicines(req.query)
  res.json({ success: true, data })
}

async function listOrders(req, res) {
  const data = await adminService.listOrders(req.query)
  res.json({ success: true, data })
}

async function getOrder(req, res) {
  const order = await adminService.getOrderById(req.params.orderId)
  res.json({ success: true, data: { order } })
}

module.exports = {
  getDashboard,
  listDoctors,
  updateDoctorVerification,
  listPharmacies,
  updatePharmacyVerification,
  listUsers,
  updateUserStatus,
  listMedicines,
  listOrders,
  getOrder,
}
