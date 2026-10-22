import api from './api.js'

function cleanParams(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== '' && value !== null && value !== undefined,
    ),
  )
}

// Upload uses FormData. The browser (via Axios) sets the multipart boundary
// automatically, so we never set Content-Type manually here.
export function uploadMedicalDocument(formData) {
  return api.post('/medical-documents', formData)
}

export function listMedicalDocuments(params = {}) {
  return api.get('/medical-documents', { params: cleanParams(params) })
}

export function getMedicalDocument(documentId) {
  return api.get(`/medical-documents/${documentId}`)
}

// Fetches the file as an authenticated Blob. The JWT stays in the request
// header, never in the URL.
export function downloadMedicalDocument(documentId) {
  return api.get(`/medical-documents/${documentId}/download`, {
    responseType: 'blob',
  })
}

export function deleteMedicalDocument(documentId) {
  return api.delete(`/medical-documents/${documentId}`)
}
