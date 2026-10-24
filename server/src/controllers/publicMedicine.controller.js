const {
  searchPublicMedicines,
  getPublicMedicineById,
} = require('../services/publicMedicine.service')

async function listPublicMedicines(req, res) {
  const data = await searchPublicMedicines(req.query)
  res.json({ success: true, data })
}

async function getPublicMedicine(req, res) {
  const medicine = await getPublicMedicineById(req.params.medicineId)
  res.json({ success: true, data: { medicine } })
}

module.exports = {
  listPublicMedicines,
  getPublicMedicine,
}
