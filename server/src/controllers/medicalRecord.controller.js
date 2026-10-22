const medicalRecordService = require('../services/medicalRecord.service')

async function createMedicalRecord(req, res) {
  const data = await medicalRecordService.createMedicalRecord(req.user.id, req.body)
  res.status(201).json({ success: true, data: { record: data } })
}

async function listMedicalRecords(req, res) {
  const data = await medicalRecordService.listMedicalRecords({
    role: req.user.role,
    userId: req.user.id,
    query: req.query,
  })
  res.json({ success: true, data })
}

async function getMedicalRecord(req, res) {
  const data = await medicalRecordService.getMedicalRecordById(
    req.params.recordId,
    req.user.id,
  )
  res.json({ success: true, data: { record: data } })
}

module.exports = {
  createMedicalRecord,
  listMedicalRecords,
  getMedicalRecord,
}
