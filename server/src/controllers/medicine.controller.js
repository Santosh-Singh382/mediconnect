const medicineService = require('../services/medicine.service')

async function listMyMedicines(req, res) {
  const data = await medicineService.listMyMedicines(req.user.id, req.query)
  res.json({ success: true, data })
}

async function createMedicine(req, res) {
  const medicine = await medicineService.createMedicine(req.user.id, req.body)
  res.status(201).json({ success: true, data: { medicine } })
}

async function getMyMedicine(req, res) {
  const medicine = await medicineService.getMyMedicineById(
    req.user.id,
    req.params.medicineId,
  )
  res.json({ success: true, data: { medicine } })
}

async function updateMyMedicine(req, res) {
  const medicine = await medicineService.updateMyMedicine(
    req.user.id,
    req.params.medicineId,
    req.body,
  )
  res.json({ success: true, data: { medicine } })
}

async function deactivateMyMedicine(req, res) {
  const medicine = await medicineService.deactivateMyMedicine(
    req.user.id,
    req.params.medicineId,
  )
  res.json({ success: true, data: { medicine } })
}

async function reactivateMyMedicine(req, res) {
  const medicine = await medicineService.reactivateMyMedicine(
    req.user.id,
    req.params.medicineId,
  )
  res.json({ success: true, data: { medicine } })
}

module.exports = {
  listMyMedicines,
  createMedicine,
  getMyMedicine,
  updateMyMedicine,
  deactivateMyMedicine,
  reactivateMyMedicine,
}
