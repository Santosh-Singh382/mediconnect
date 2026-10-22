const os = require('node:os')
const path = require('node:path')
const fs = require('node:fs')

// Point the medical-document upload directory at a private temp folder BEFORE
// the app (and its env config) is loaded, so tests never write real patient
// files into server/uploads/. Each test process gets its own folder.
const TEST_UPLOAD_DIR = path.join(
  os.tmpdir(),
  `mediconnect-doc-test-${process.pid}-${Date.now()}`,
)
process.env.MEDICAL_DOCUMENT_UPLOAD_DIR = TEST_UPLOAD_DIR

const { describe, before, after, beforeEach, it } = require('node:test')
const assert = require('node:assert/strict')

const {
  startServer,
  stopServer,
  clearUsers,
  clearPatientProfiles,
  clearDoctorProfiles,
  clearAppointments,
  clearPrescriptions,
  clearMedicalRecords,
  clearMedicalDocuments,
  createUser,
  createDoctor,
  tokenForUser,
  request,
  uploadRequest,
  Appointment,
  Prescription,
  MedicalRecord,
  MedicalDocument,
} = require('./helpers')

// ---- File fixtures with real magic-byte signatures -------------------------

function pdfBuffer(marker = 'hello') {
  return Buffer.from(`%PDF-1.4\n${marker}\n1 0 obj\n<< >>\nendobj\n%%EOF\n`)
}

function jpegBuffer() {
  // FF D8 FF E0 + a minimal JFIF header.
  return Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
  ])
}

function pngBuffer() {
  // Full 8-byte PNG signature followed by arbitrary bytes.
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from('IHDR'),
    Buffer.from([0x00, 0x00, 0x00, 0x0d]),
    Buffer.from([0xff, 0xff, 0xff, 0xff]),
  ])
}

function oversizedPdfBuffer() {
  // A valid PDF header padded past the 10 MB limit.
  const header = pdfBuffer('big')
  const filler = Buffer.alloc(10 * 1024 * 1024 + 1, 0x20)
  return Buffer.concat([header, filler])
}

function file(overrides = {}) {
  return {
    buffer: pdfBuffer(),
    contentType: 'application/pdf',
    filename: 'report.pdf',
    ...overrides,
  }
}

async function uploadPdf(token, fields = {}, overrides = {}) {
  return uploadRequest('/api/medical-documents', {
    token,
    fields: { documentType: 'LAB_REPORT', title: 'Report', ...fields },
    file: file(overrides),
  })
}

async function createAppointment(patient, doctorUser, overrides = {}) {
  return Appointment.create({
    patientId: patient._id,
    doctorId: doctorUser._id,
    appointmentDate: '2030-01-07',
    startTime: '10:00',
    endTime: '10:30',
    type: 'VIDEO',
    status: 'COMPLETED',
    reason: 'Routine consultation',
    ...overrides,
  })
}

async function createRecord(patient, doctor, appointment, overrides = {}) {
  const doctorId = doctor.user ? doctor.user._id : doctor._id
  return MedicalRecord.create({
    patientId: patient._id,
    doctorId,
    appointmentId: appointment._id,
    recordType: 'CONSULTATION',
    title: 'Seeded record',
    summary: 'Seeded summary for the consultation.',
    recordDate: new Date('2030-01-07'),
    ...overrides,
  })
}

describe('Medical document module', () => {
  let patientA
  let patientB
  let patientAToken
  let patientBToken
  let doctorA
  let doctorB
  let doctorAToken
  let doctorBToken
  let pharmacyToken
  let adminToken

  before(async () => {
    await startServer()
    await MedicalDocument.init()
    await MedicalRecord.init()
  })

  after(async () => {
    await stopServer()
    // Remove the temp upload directory so no test files linger anywhere.
    await fs.promises.rm(TEST_UPLOAD_DIR, { recursive: true, force: true })
  })

  beforeEach(async () => {
    await clearMedicalDocuments()
    await clearMedicalRecords()
    await clearPrescriptions()
    await clearAppointments()
    await clearDoctorProfiles()
    await clearPatientProfiles()
    await clearUsers()

    patientA = await createUser({
      email: 'doc-patient-a@example.com',
      name: 'Patient Alpha',
      role: 'PATIENT',
    })
    patientAToken = tokenForUser(patientA)

    patientB = await createUser({
      email: 'doc-patient-b@example.com',
      name: 'Patient Beta',
      role: 'PATIENT',
    })
    patientBToken = tokenForUser(patientB)

    doctorA = await createDoctor({
      email: 'doc-doctor-a@example.com',
      name: 'Doctor Alpha',
    })
    doctorAToken = tokenForUser(doctorA.user)

    doctorB = await createDoctor({
      email: 'doc-doctor-b@example.com',
      name: 'Doctor Beta',
    })
    doctorBToken = tokenForUser(doctorB.user)

    const pharmacy = await createUser({
      email: 'doc-pharmacy@example.com',
      name: 'Pharmacy',
      role: 'PHARMACY',
    })
    pharmacyToken = tokenForUser(pharmacy)

    const admin = await createUser({
      email: 'doc-admin@example.com',
      name: 'Admin',
      role: 'ADMIN',
    })
    adminToken = tokenForUser(admin)
  })

  // ---- Authentication -----------------------------------------------------

  it('rejects an unauthenticated upload', async () => {
    const response = await uploadRequest('/api/medical-documents', {
      fields: { documentType: 'LAB_REPORT', title: 'Report' },
      file: file(),
    })
    assert.equal(response.status, 401)
  })

  it('rejects an unauthenticated list', async () => {
    const response = await request('/api/medical-documents')
    assert.equal(response.status, 401)
  })

  it('rejects an unauthenticated download', async () => {
    const response = await request('/api/medical-documents/507f1f77bcf86cd799439011/download')
    assert.equal(response.status, 401)
  })

  it('rejects an unauthenticated delete', async () => {
    const response = await request('/api/medical-documents/507f1f77bcf86cd799439011', {
      method: 'DELETE',
    })
    assert.equal(response.status, 401)
  })

  // ---- Upload -------------------------------------------------------------

  it('lets a patient upload a PDF', async () => {
    const response = await uploadPdf(patientAToken)
    assert.equal(response.status, 201)
    assert.equal(response.body.data.document.documentType, 'LAB_REPORT')
    assert.equal(response.body.data.document.originalName, 'report.pdf')
    assert.equal(response.body.data.document.mimeType, 'application/pdf')
  })

  it('lets a patient upload a JPG', async () => {
    const response = await uploadRequest('/api/medical-documents', {
      token: patientAToken,
      fields: { documentType: 'SCAN_REPORT', title: 'X-ray' },
      file: file({ buffer: jpegBuffer(), contentType: 'image/jpeg', filename: 'xray.jpg' }),
    })
    assert.equal(response.status, 201)
    assert.equal(response.body.data.document.mimeType, 'image/jpeg')
  })

  it('lets a patient upload a PNG', async () => {
    const response = await uploadRequest('/api/medical-documents', {
      token: patientAToken,
      fields: { documentType: 'OTHER', title: 'Scan image' },
      file: file({ buffer: pngBuffer(), contentType: 'image/png', filename: 'scan.png' }),
    })
    assert.equal(response.status, 201)
    assert.equal(response.body.data.document.mimeType, 'image/png')
  })

  it('rejects an unsupported file extension', async () => {
    const response = await uploadRequest('/api/medical-documents', {
      token: patientAToken,
      fields: { documentType: 'OTHER', title: 'Notes' },
      file: file({
        buffer: Buffer.from('plain text'),
        contentType: 'text/plain',
        filename: 'notes.txt',
      }),
    })
    assert.equal(response.status, 400)
  })

  it('rejects an unsupported MIME type', async () => {
    const response = await uploadRequest('/api/medical-documents', {
      token: patientAToken,
      fields: { documentType: 'OTHER', title: 'Report' },
      file: file({
        buffer: pdfBuffer(),
        contentType: 'text/plain',
        filename: 'report.pdf',
      }),
    })
    assert.equal(response.status, 400)
  })

  it('rejects a file whose magic bytes do not match its declared type', async () => {
    // Named and typed as a PDF, but the leading bytes are a PNG signature.
    const response = await uploadRequest('/api/medical-documents', {
      token: patientAToken,
      fields: { documentType: 'OTHER', title: 'Fake' },
      file: file({
        buffer: pngBuffer(),
        contentType: 'application/pdf',
        filename: 'fake.pdf',
      }),
    })
    assert.equal(response.status, 400)
  })

  it('rejects a file larger than 10 MB', async () => {
    const response = await uploadRequest('/api/medical-documents', {
      token: patientAToken,
      fields: { documentType: 'OTHER', title: 'Huge' },
      file: file({ buffer: oversizedPdfBuffer(), filename: 'huge.pdf' }),
    })
    assert.equal(response.status, 400)
    assert.match(response.body.message, /10 MB/)
  })

  it('rejects a request with no file', async () => {
    const response = await uploadRequest('/api/medical-documents', {
      token: patientAToken,
      fields: { documentType: 'LAB_REPORT', title: 'Report' },
    })
    assert.equal(response.status, 400)
    assert.equal(response.body.code, 'VALIDATION_ERROR')
  })

  it('rejects a missing title', async () => {
    const response = await uploadPdf(patientAToken, { title: '' })
    assert.equal(response.status, 400)
    assert.ok(
      response.body.details.some((detail) => detail.field === 'title'),
    )
  })

  it('rejects an invalid document type', async () => {
    const response = await uploadPdf(patientAToken, { documentType: 'NOT_A_TYPE' })
    assert.equal(response.status, 400)
    assert.ok(
      response.body.details.some((detail) => detail.field === 'documentType'),
    )
  })

  it('rejects a malformed recordId', async () => {
    const response = await uploadPdf(patientAToken, { recordId: 'not-an-id' })
    assert.equal(response.status, 400)
    assert.ok(
      response.body.details.some((detail) => detail.field === 'recordId'),
    )
  })

  it('does not allow a doctor to upload documents', async () => {
    const response = await uploadPdf(doctorAToken)
    assert.equal(response.status, 403)
  })

  it('does not allow a pharmacy or admin account to upload', async () => {
    const pharmacy = await uploadPdf(pharmacyToken)
    assert.equal(pharmacy.status, 403)
    const admin = await uploadPdf(adminToken)
    assert.equal(admin.status, 403)
  })

  // ---- Ownership ----------------------------------------------------------

  it('lets a patient list only their own documents', async () => {
    await uploadPdf(patientAToken, { title: 'A one' })
    await uploadPdf(patientAToken, { title: 'A two' })
    await uploadPdf(patientBToken, { title: 'B one' })

    const response = await request('/api/medical-documents', { token: patientAToken })
    assert.equal(response.status, 200)
    assert.equal(response.body.data.documents.length, 2)
    for (const doc of response.body.data.documents) {
      assert.equal(doc.patient.id, patientA._id.toString())
    }
  })

  it('blocks a patient from reading another patient document metadata', async () => {
    const uploaded = await uploadPdf(patientAToken)
    const id = uploaded.body.data.document.id

    const response = await request(`/api/medical-documents/${id}`, {
      token: patientBToken,
    })
    assert.equal(response.status, 403)
  })

  it('blocks a patient from downloading another patient file', async () => {
    const uploaded = await uploadPdf(patientAToken)
    const id = uploaded.body.data.document.id

    const response = await request(`/api/medical-documents/${id}/download`, {
      token: patientBToken,
    })
    assert.equal(response.status, 403)
  })

  it('blocks a patient from deleting another patient file', async () => {
    const uploaded = await uploadPdf(patientAToken)
    const id = uploaded.body.data.document.id

    const response = await request(`/api/medical-documents/${id}`, {
      method: 'DELETE',
      token: patientBToken,
    })
    assert.equal(response.status, 403)
  })

  it('blocks a patient from attaching another patient medical record', async () => {
    const appointment = await createAppointment(patientB, doctorA.user)
    const otherRecord = await createRecord(patientB, doctorA, appointment)

    const response = await uploadPdf(patientAToken, {
      recordId: otherRecord._id.toString(),
    })
    assert.equal(response.status, 403)
  })

  // ---- Doctor authorization ----------------------------------------------

  it('blocks a doctor from an unrelated patient document', async () => {
    const uploaded = await uploadPdf(patientAToken)
    const id = uploaded.body.data.document.id

    const response = await request(`/api/medical-documents/${id}`, {
      token: doctorAToken,
    })
    assert.equal(response.status, 403)
  })

  it('lets a doctor access a document linked to their own medical record', async () => {
    const appointment = await createAppointment(patientA, doctorA.user)
    const record = await createRecord(patientA, doctorA, appointment)
    const uploaded = await uploadPdf(patientAToken, {
      recordId: record._id.toString(),
    })
    const id = uploaded.body.data.document.id

    const detail = await request(`/api/medical-documents/${id}`, {
      token: doctorAToken,
    })
    assert.equal(detail.status, 200)

    const download = await request(`/api/medical-documents/${id}/download`, {
      token: doctorAToken,
    })
    assert.equal(download.status, 200)
  })

  it('blocks a doctor from a document linked to another doctor record', async () => {
    const appointment = await createAppointment(patientA, doctorB.user)
    const record = await createRecord(patientA, doctorB, appointment)
    const uploaded = await uploadPdf(patientAToken, {
      recordId: record._id.toString(),
    })
    const id = uploaded.body.data.document.id

    const denied = await request(`/api/medical-documents/${id}`, {
      token: doctorAToken,
    })
    assert.equal(denied.status, 403)

    const allowed = await request(`/api/medical-documents/${id}`, {
      token: doctorBToken,
    })
    assert.equal(allowed.status, 200)
  })

  it('does not let a doctor delete a patient document', async () => {
    const uploaded = await uploadPdf(patientAToken)
    const id = uploaded.body.data.document.id

    const response = await request(`/api/medical-documents/${id}`, {
      method: 'DELETE',
      token: doctorAToken,
    })
    assert.equal(response.status, 403)
  })

  it('scopes a doctor list to documents on their own records only', async () => {
    const apptA = await createAppointment(patientA, doctorA.user)
    const recordA = await createRecord(patientA, doctorA, apptA)
    await uploadPdf(patientAToken, {
      title: 'For doctor A',
      recordId: recordA._id.toString(),
    })

    const apptB = await createAppointment(patientA, doctorB.user)
    const recordB = await createRecord(patientA, doctorB, apptB)
    await uploadPdf(patientAToken, {
      title: 'For doctor B',
      recordId: recordB._id.toString(),
    })

    const response = await request('/api/medical-documents', { token: doctorAToken })
    assert.equal(response.status, 200)
    assert.equal(response.body.data.documents.length, 1)
    assert.equal(response.body.data.documents[0].title, 'For doctor A')
  })

  it('does not give admin unrestricted access', async () => {
    const uploaded = await uploadPdf(patientAToken)
    const id = uploaded.body.data.document.id

    // Admin cannot list, read, download, or delete patient documents.
    const list = await request('/api/medical-documents', { token: adminToken })
    assert.equal(list.status, 403)

    const detail = await request(`/api/medical-documents/${id}`, {
      token: adminToken,
    })
    assert.equal(detail.status, 403)

    const removal = await request(`/api/medical-documents/${id}`, {
      method: 'DELETE',
      token: adminToken,
    })
    assert.equal(removal.status, 403)
  })

  // ---- Security -----------------------------------------------------------

  it('stores files under a generated name, never the original filename', async () => {
    const uploaded = await uploadPdf(patientAToken, {}, { filename: 'my report.pdf' })
    const document = uploaded.body.data.document

    assert.match(
      document.id,
      /^[0-9a-f]{24}$/,
    )
    // The serialized document never exposes storedName, so verify in the DB.
    const stored = await MedicalDocument.findById(document.id).lean()
    assert.match(
      stored.storedName,
      /^[0-9a-f-]{36}\.pdf$/i,
    )
    assert.ok(!stored.storedName.includes('my report'))
  })

  it('neutralizes path traversal in the original filename', async () => {
    const uploaded = await uploadPdf(
      patientAToken,
      {},
      { filename: '../../evil.pdf', buffer: pdfBuffer('evil') },
    )
    assert.equal(uploaded.status, 201)

    const stored = await MedicalDocument.findById(
      uploaded.body.data.document.id,
    ).lean()
    // The stored name is a bare UUID: no separators, no parent references.
    assert.ok(!stored.storedName.includes('..'))
    assert.ok(!stored.storedName.includes('/'))
    assert.ok(!stored.storedName.includes('\\'))
    assert.match(stored.storedName, /^[0-9a-f-]{36}\.pdf$/i)

    // The file lives inside the upload directory, not outside it.
    const resolved = path.resolve(TEST_UPLOAD_DIR, stored.storedName)
    assert.ok(resolved.startsWith(path.resolve(TEST_UPLOAD_DIR)))
    assert.equal(fs.existsSync(resolved), true)
  })

  it('does not return the physical storage path in the API', async () => {
    const uploaded = await uploadPdf(patientAToken)
    const id = uploaded.body.data.document.id

    const detail = await request(`/api/medical-documents/${id}`, {
      token: patientAToken,
    })
    const raw = JSON.stringify(detail.body)
    assert.ok(!raw.includes('storagePath'))
    assert.ok(!raw.includes('storedName'))
    assert.ok(!raw.includes(TEST_UPLOAD_DIR))
  })

  it('never returns password hashes or tokens', async () => {
    const uploaded = await uploadPdf(patientAToken)
    const id = uploaded.body.data.document.id

    const detail = await request(`/api/medical-documents/${id}`, {
      token: patientAToken,
    })
    const raw = JSON.stringify(detail.body)
    assert.equal(raw.includes('passwordHash'), false)
    assert.equal(raw.includes('jwt'), false)
    assert.equal(raw.includes('token'), false)
  })

  it('returns a safe Content-Disposition on download', async () => {
    const uploaded = await uploadPdf(patientAToken, {}, { filename: 'report.pdf' })
    const id = uploaded.body.data.document.id

    const download = await request(`/api/medical-documents/${id}/download`, {
      token: patientAToken,
    })
    assert.equal(download.status, 200)
    assert.match(
      download.headers.get('content-disposition'),
      /^attachment;/,
    )
    assert.equal(download.headers.get('x-content-type-options'), 'nosniff')
  })

  // ---- Delete -------------------------------------------------------------

  it('lets the owner delete a document and removes the physical file', async () => {
    const uploaded = await uploadPdf(patientAToken)
    const id = uploaded.body.data.document.id
    const stored = await MedicalDocument.findById(id).lean()
    const filePath = path.join(TEST_UPLOAD_DIR, stored.storedName)
    assert.equal(fs.existsSync(filePath), true)

    const response = await request(`/api/medical-documents/${id}`, {
      method: 'DELETE',
      token: patientAToken,
    })
    assert.equal(response.status, 200)
    assert.equal(fs.existsSync(filePath), false)
    assert.equal(await MedicalDocument.findById(id), null)
  })

  it('handles deleting a document whose physical file is already missing', async () => {
    const uploaded = await uploadPdf(patientAToken)
    const id = uploaded.body.data.document.id
    const stored = await MedicalDocument.findById(id).lean()
    await fs.promises.unlink(path.join(TEST_UPLOAD_DIR, stored.storedName))

    const response = await request(`/api/medical-documents/${id}`, {
      method: 'DELETE',
      token: patientAToken,
    })
    assert.equal(response.status, 200)
    assert.equal(await MedicalDocument.findById(id), null)
  })

  it('returns 404 when deleting a nonexistent document', async () => {
    const response = await request('/api/medical-documents/507f1f77bcf86cd799439011', {
      method: 'DELETE',
      token: patientAToken,
    })
    assert.equal(response.status, 404)
  })

  // ---- Integration --------------------------------------------------------

  it('links a document to an existing medical record', async () => {
    const appointment = await createAppointment(patientA, doctorA.user)
    const record = await createRecord(patientA, doctorA, appointment)

    const uploaded = await uploadPdf(patientAToken, {
      recordId: record._id.toString(),
    })
    assert.equal(uploaded.status, 201)
    assert.equal(
      uploaded.body.data.document.record.id,
      record._id.toString(),
    )
  })

  it('keeps a document without recordId private to the patient', async () => {
    const uploaded = await uploadPdf(patientAToken)
    const id = uploaded.body.data.document.id
    assert.equal(uploaded.body.data.document.record, null)

    // Another patient and an unrelated doctor are both blocked.
    const otherPatient = await request(`/api/medical-documents/${id}`, {
      token: patientBToken,
    })
    assert.equal(otherPatient.status, 403)

    const doctor = await request(`/api/medical-documents/${id}`, {
      token: doctorAToken,
    })
    assert.equal(doctor.status, 403)
  })

  // ---- Pagination and filters --------------------------------------------

  it('paginates the document list', async () => {
    await uploadPdf(patientAToken, { title: 'One' })
    await uploadPdf(patientAToken, { title: 'Two' })
    await uploadPdf(patientAToken, { title: 'Three' })

    const response = await request('/api/medical-documents?limit=2&page=1', {
      token: patientAToken,
    })
    assert.equal(response.status, 200)
    assert.equal(response.body.data.documents.length, 2)
    assert.equal(response.body.data.pagination.total, 3)
    assert.equal(response.body.data.pagination.totalPages, 2)
  })

  it('filters by document type', async () => {
    await uploadPdf(patientAToken, { documentType: 'LAB_REPORT', title: 'Lab' })
    await uploadRequest('/api/medical-documents', {
      token: patientAToken,
      fields: { documentType: 'SCAN_REPORT', title: 'Scan' },
      file: file({ buffer: jpegBuffer(), contentType: 'image/jpeg', filename: 'scan.jpg' }),
    })

    const response = await request(
      '/api/medical-documents?documentType=LAB_REPORT',
      { token: patientAToken },
    )
    assert.equal(response.status, 200)
    assert.equal(response.body.data.documents.length, 1)
    assert.equal(response.body.data.documents[0].documentType, 'LAB_REPORT')
  })

  it('filters by recordId', async () => {
    const appointment = await createAppointment(patientA, doctorA.user)
    const record = await createRecord(patientA, doctorA, appointment)

    await uploadPdf(patientAToken, { title: 'Linked', recordId: record._id.toString() })
    await uploadPdf(patientAToken, { title: 'Unlinked' })

    const response = await request(
      `/api/medical-documents?recordId=${record._id.toString()}`,
      { token: patientAToken },
    )
    assert.equal(response.status, 200)
    assert.equal(response.body.data.documents.length, 1)
    assert.equal(response.body.data.documents[0].title, 'Linked')
  })
})
