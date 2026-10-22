const fs = require('fs')
const medicalDocumentService = require('../services/medicalDocument.service')

async function uploadMedicalDocument(req, res) {
  const data = await medicalDocumentService.uploadMedicalDocument(
    req.user.id,
    req.file,
    req.body,
  )
  res.status(201).json({ success: true, data: { document: data } })
}

async function listMedicalDocuments(req, res) {
  const data = await medicalDocumentService.listMedicalDocuments({
    role: req.user.role,
    userId: req.user.id,
    query: req.query,
  })
  res.json({ success: true, data })
}

async function getMedicalDocument(req, res) {
  const data = await medicalDocumentService.getMedicalDocumentById(
    req.params.documentId,
    req.user.id,
    req.user.role,
  )
  res.json({ success: true, data: { document: data } })
}

async function downloadMedicalDocument(req, res) {
  const info = await medicalDocumentService.getDownloadInfo(
    req.params.documentId,
    req.user.id,
    req.user.role,
  )

  // Safe response headers: force a download, never inline-render, and stop
  // the browser from sniffing the content into something executable.
  res.setHeader('Content-Type', info.mimeType)
  res.setHeader('Content-Length', info.size)
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${info.downloadName.replace(/"/g, '')}"`,
  )

  const stream = fs.createReadStream(info.filePath)
  stream.on('error', () => {
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'This document is temporarily unavailable. Please try again later.',
        code: 'INTERNAL_ERROR',
      })
    }
  })
  stream.pipe(res)
}

async function deleteMedicalDocument(req, res) {
  const data = await medicalDocumentService.deleteMedicalDocument(
    req.params.documentId,
    req.user.id,
  )
  res.json({ success: true, data })
}

module.exports = {
  uploadMedicalDocument,
  listMedicalDocuments,
  getMedicalDocument,
  downloadMedicalDocument,
  deleteMedicalDocument,
}
