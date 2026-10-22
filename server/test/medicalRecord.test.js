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
  createUser,
  createDoctor,
  tokenForUser,
  request,
  Appointment,
  Prescription,
  MedicalRecord,
} = require('./helpers')

function medicine(overrides = {}) {
  return {
    medicineName: 'Paracetamol',
    dosage: '500 mg',
    frequency: 'Twice daily',
    duration: '5 days',
    route: 'ORAL',
    timing: 'AFTER_MEAL',
    quantity: 10,
    ...overrides,
  }
}

function recordPayload(appointmentId, overrides = {}) {
  return {
    appointmentId: appointmentId.toString(),
    recordType: 'CONSULTATION',
    title: 'Follow-up consultation',
    summary: 'Patient reported steady improvement. Continue current medication.',
    diagnosis: 'Viral fever resolving',
    notes: 'Advised review in two weeks if symptoms persist.',
    recordDate: '2030-01-07',
    ...overrides,
  }
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

describe('Medical record module', () => {
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
    await MedicalRecord.init()
    await Prescription.init()
  })

  after(async () => {
    await stopServer()
  })

  beforeEach(async () => {
    await clearMedicalRecords()
    await clearPrescriptions()
    await clearAppointments()
    await clearDoctorProfiles()
    await clearPatientProfiles()
    await clearUsers()

    const pa = await createUser({
      email: 'mr-patient-a@example.com',
      name: 'Patient Alpha',
      role: 'PATIENT',
    })
    patientA = pa
    patientAToken = tokenForUser(pa)

    const pb = await createUser({
      email: 'mr-patient-b@example.com',
      name: 'Patient Beta',
      role: 'PATIENT',
    })
    patientB = pb
    patientBToken = tokenForUser(pb)

    const da = await createDoctor({
      email: 'mr-doctor-a@example.com',
      name: 'Dr. Alpha Approved',
      verificationStatus: 'APPROVED',
      profile: { specialization: 'Cardiologist' },
    })
    doctorA = da
    doctorAToken = tokenForUser(da.user)

    const db = await createDoctor({
      email: 'mr-doctor-b@example.com',
      name: 'Dr. Beta Approved',
      verificationStatus: 'APPROVED',
      profile: { specialization: 'Dermatologist' },
    })
    doctorB = db
    doctorBToken = tokenForUser(db.user)

    const pharmacy = await createUser({
      email: 'mr-pharmacy@example.com',
      name: 'Test Pharmacy',
      role: 'PHARMACY',
    })
    pharmacyToken = tokenForUser(pharmacy)

    const admin = await createUser({
      email: 'mr-admin@example.com',
      name: 'Test Admin',
      role: 'ADMIN',
    })
    adminToken = tokenForUser(admin)
  })

  describe('authentication', () => {
    it('rejects unauthenticated creation', async () => {
      const appointment = await createAppointment(patientA, doctorA.user)
      const response = await request('/api/medical-records', {
        method: 'POST',
        body: recordPayload(appointment._id),
      })
      assert.equal(response.status, 401)
      assert.equal(response.body.success, false)
    })

    it('rejects unauthenticated listing', async () => {
      const response = await request('/api/medical-records')
      assert.equal(response.status, 401)
    })

    it('rejects unauthenticated detail access', async () => {
      const response = await request('/api/medical-records/507f1f77bcf86cd799439011')
      assert.equal(response.status, 401)
    })
  })

  describe('role enforcement', () => {
    it('forbids patients from creating records', async () => {
      const appointment = await createAppointment(patientA, doctorA.user)
      const response = await request('/api/medical-records', {
        method: 'POST',
        token: patientAToken,
        body: recordPayload(appointment._id),
      })
      assert.equal(response.status, 403)
      assert.equal(await MedicalRecord.countDocuments(), 0)
    })

    it('forbids pharmacy and admin roles from creating records', async () => {
      const appointment = await createAppointment(patientA, doctorA.user)
      const pharmacyResponse = await request('/api/medical-records', {
        method: 'POST',
        token: pharmacyToken,
        body: recordPayload(appointment._id),
      })
      const adminResponse = await request('/api/medical-records', {
        method: 'POST',
        token: adminToken,
        body: recordPayload(appointment._id),
      })
      assert.equal(pharmacyResponse.status, 403)
      assert.equal(adminResponse.status, 403)
    })

    it('forbids pharmacy and admin roles from listing records', async () => {
      assert.equal(
        (await request('/api/medical-records', { token: pharmacyToken })).status,
        403,
      )
      assert.equal(
        (await request('/api/medical-records', { token: adminToken })).status,
        403,
      )
    })

    it('allows a doctor to create a record for their completed appointment', async () => {
      const appointment = await createAppointment(patientA, doctorA.user)
      const response = await request('/api/medical-records', {
        method: 'POST',
        token: doctorAToken,
        body: recordPayload(appointment._id),
      })
      assert.equal(response.status, 201)
      assert.equal(response.body.success, true)
      assert.equal(response.body.data.record.recordType, 'CONSULTATION')
      assert.equal(response.body.data.record.appointment.id, appointment._id.toString())
    })
  })

  describe('appointment rules', () => {
    it('rejects an invalid appointment identifier', async () => {
      const response = await request('/api/medical-records', {
        method: 'POST',
        token: doctorAToken,
        body: recordPayload('not-an-id'),
      })
      assert.equal(response.status, 400)
      assert.equal(response.body.code, 'VALIDATION_ERROR')
      assert.ok(response.body.details.some((item) => item.field === 'appointmentId'))
    })

    it('returns 404 for a missing appointment', async () => {
      const response = await request('/api/medical-records', {
        method: 'POST',
        token: doctorAToken,
        body: recordPayload('507f1f77bcf86cd799439011'),
      })
      assert.equal(response.status, 404)
      assert.equal(await MedicalRecord.countDocuments(), 0)
    })

    it('forbids a doctor from creating a record for another doctor appointment', async () => {
      const appointment = await createAppointment(patientA, doctorA.user)
      const response = await request('/api/medical-records', {
        method: 'POST',
        token: doctorBToken,
        body: recordPayload(appointment._id),
      })
      assert.equal(response.status, 403)
      assert.equal(await MedicalRecord.countDocuments(), 0)
    })

    for (const status of ['PENDING', 'CONFIRMED', 'CANCELLED', 'REJECTED']) {
      it(`rejects a ${status} appointment`, async () => {
        const appointment = await createAppointment(patientA, doctorA.user, { status })
        const response = await request('/api/medical-records', {
          method: 'POST',
          token: doctorAToken,
          body: recordPayload(appointment._id),
        })
        assert.equal(response.status, 409)
        assert.equal(await MedicalRecord.countDocuments(), 0)
      })
    }

    it('derives the patient and doctor from the stored appointment', async () => {
      const appointment = await createAppointment(patientA, doctorA.user)
      const response = await request('/api/medical-records', {
        method: 'POST',
        token: doctorAToken,
        body: recordPayload(appointment._id, {
          patientId: patientB._id.toString(),
          doctorId: doctorB.user._id.toString(),
        }),
      })
      assert.equal(response.status, 201)
      const stored = await MedicalRecord.findOne({ appointmentId: appointment._id })
      assert.equal(stored.patientId.toString(), patientA._id.toString())
      assert.equal(stored.doctorId.toString(), doctorA.user._id.toString())
    })

    it('allows multiple records for the same consultation', async () => {
      const appointment = await createAppointment(patientA, doctorA.user)
      const first = await request('/api/medical-records', {
        method: 'POST',
        token: doctorAToken,
        body: recordPayload(appointment._id),
      })
      const second = await request('/api/medical-records', {
        method: 'POST',
        token: doctorAToken,
        body: recordPayload(appointment._id, {
          recordType: 'LAB_REPORT',
          title: 'Complete blood count',
        }),
      })
      assert.equal(first.status, 201)
      assert.equal(second.status, 201)
      assert.equal(await MedicalRecord.countDocuments({ appointmentId: appointment._id }), 2)
    })
  })

  describe('validation', () => {
    it('rejects an unsupported record type', async () => {
      const appointment = await createAppointment(patientA, doctorA.user)
      const response = await request('/api/medical-records', {
        method: 'POST',
        token: doctorAToken,
        body: recordPayload(appointment._id, { recordType: 'NOT_A_TYPE' }),
      })
      assert.equal(response.status, 400)
      assert.ok(response.body.details.some((item) => item.field === 'recordType'))
    })

    it('requires a title', async () => {
      const appointment = await createAppointment(patientA, doctorA.user)
      const response = await request('/api/medical-records', {
        method: 'POST',
        token: doctorAToken,
        body: recordPayload(appointment._id, { title: '   ' }),
      })
      assert.equal(response.status, 400)
      assert.ok(response.body.details.some((item) => item.field === 'title'))
    })

    it('requires a summary', async () => {
      const appointment = await createAppointment(patientA, doctorA.user)
      const response = await request('/api/medical-records', {
        method: 'POST',
        token: doctorAToken,
        body: recordPayload(appointment._id, { summary: '' }),
      })
      assert.equal(response.status, 400)
      assert.ok(response.body.details.some((item) => item.field === 'summary'))
    })

    it('requires a record date', async () => {
      const appointment = await createAppointment(patientA, doctorA.user)
      const response = await request('/api/medical-records', {
        method: 'POST',
        token: doctorAToken,
        body: recordPayload(appointment._id, { recordDate: '' }),
      })
      assert.equal(response.status, 400)
      assert.ok(response.body.details.some((item) => item.field === 'recordDate'))
    })

    it('rejects an invalid record date', async () => {
      const appointment = await createAppointment(patientA, doctorA.user)
      const response = await request('/api/medical-records', {
        method: 'POST',
        token: doctorAToken,
        body: recordPayload(appointment._id, { recordDate: 'not-a-date' }),
      })
      assert.equal(response.status, 400)
      assert.ok(response.body.details.some((item) => item.field === 'recordDate'))
    })

    it('rejects a title that is too long', async () => {
      const appointment = await createAppointment(patientA, doctorA.user)
      const response = await request('/api/medical-records', {
        method: 'POST',
        token: doctorAToken,
        body: recordPayload(appointment._id, { title: 'x'.repeat(500) }),
      })
      assert.equal(response.status, 400)
      assert.ok(response.body.details.some((item) => item.field === 'title'))
    })

    it('accepts optional diagnosis and notes when provided', async () => {
      const appointment = await createAppointment(patientA, doctorA.user)
      const response = await request('/api/medical-records', {
        method: 'POST',
        token: doctorAToken,
        body: recordPayload(appointment._id),
      })
      assert.equal(response.status, 201)
      assert.equal(response.body.data.record.diagnosis, 'Viral fever resolving')
      assert.equal(
        response.body.data.record.notes,
        'Advised review in two weeks if symptoms persist.',
      )
    })

    it('treats empty diagnosis and notes as null', async () => {
      const appointment = await createAppointment(patientA, doctorA.user)
      const response = await request('/api/medical-records', {
        method: 'POST',
        token: doctorAToken,
        body: recordPayload(appointment._id, { diagnosis: '   ', notes: '' }),
      })
      assert.equal(response.status, 201)
      assert.equal(response.body.data.record.diagnosis, null)
      assert.equal(response.body.data.record.notes, null)
    })
  })

  describe('prescription relationship', () => {
    it('links a prescription that belongs to the consultation', async () => {
      const appointment = await createAppointment(patientA, doctorA.user)
      const prescription = await Prescription.create({
        appointmentId: appointment._id,
        patientId: patientA._id,
        doctorId: doctorA.user._id,
        medicines: [medicine()],
      })
      const response = await request('/api/medical-records', {
        method: 'POST',
        token: doctorAToken,
        body: recordPayload(appointment._id, {
          prescriptionId: prescription._id.toString(),
        }),
      })
      assert.equal(response.status, 201)
      assert.equal(
        response.body.data.record.prescription.id,
        prescription._id.toString(),
      )
    })

    it('rejects a prescription that belongs to another appointment', async () => {
      const appointment = await createAppointment(patientA, doctorA.user)
      const otherAppointment = await createAppointment(patientA, doctorA.user, {
        appointmentDate: '2030-01-08',
      })
      const otherPrescription = await Prescription.create({
        appointmentId: otherAppointment._id,
        patientId: patientA._id,
        doctorId: doctorA.user._id,
        medicines: [medicine()],
      })
      const response = await request('/api/medical-records', {
        method: 'POST',
        token: doctorAToken,
        body: recordPayload(appointment._id, {
          prescriptionId: otherPrescription._id.toString(),
        }),
      })
      assert.equal(response.status, 400)
      assert.ok(response.body.details.some((item) => item.field === 'prescriptionId'))
      assert.equal(await MedicalRecord.countDocuments(), 0)
    })

    it('rejects a prescription that belongs to another patient', async () => {
      const appointment = await createAppointment(patientA, doctorA.user)
      const mismatched = await Prescription.create({
        appointmentId: appointment._id,
        patientId: patientB._id,
        doctorId: doctorA.user._id,
        medicines: [medicine()],
      })
      const response = await request('/api/medical-records', {
        method: 'POST',
        token: doctorAToken,
        body: recordPayload(appointment._id, {
          prescriptionId: mismatched._id.toString(),
        }),
      })
      assert.equal(response.status, 400)
      assert.ok(response.body.details.some((item) => item.field === 'prescriptionId'))
    })

    it('rejects a prescription that belongs to another doctor', async () => {
      const appointment = await createAppointment(patientA, doctorA.user)
      const mismatched = await Prescription.create({
        appointmentId: appointment._id,
        patientId: patientA._id,
        doctorId: doctorB.user._id,
        medicines: [medicine()],
      })
      const response = await request('/api/medical-records', {
        method: 'POST',
        token: doctorAToken,
        body: recordPayload(appointment._id, {
          prescriptionId: mismatched._id.toString(),
        }),
      })
      assert.equal(response.status, 400)
      assert.ok(response.body.details.some((item) => item.field === 'prescriptionId'))
    })

    it('rejects a nonexistent prescription', async () => {
      const appointment = await createAppointment(patientA, doctorA.user)
      const response = await request('/api/medical-records', {
        method: 'POST',
        token: doctorAToken,
        body: recordPayload(appointment._id, {
          prescriptionId: '507f1f77bcf86cd799439011',
        }),
      })
      assert.equal(response.status, 400)
      assert.ok(response.body.details.some((item) => item.field === 'prescriptionId'))
    })

    it('rejects a malformed prescription identifier', async () => {
      const appointment = await createAppointment(patientA, doctorA.user)
      const response = await request('/api/medical-records', {
        method: 'POST',
        token: doctorAToken,
        body: recordPayload(appointment._id, { prescriptionId: 'nope' }),
      })
      assert.equal(response.status, 400)
      assert.ok(response.body.details.some((item) => item.field === 'prescriptionId'))
    })
  })

  describe('ownership and visibility', () => {
    it('lets a patient list only their own records', async () => {
      const apptA = await createAppointment(patientA, doctorA.user)
      await createRecord(patientA, doctorA, apptA, { title: 'For patient A' })
      const apptB = await createAppointment(patientB, doctorB.user)
      await createRecord(patientB, doctorB, apptB, { title: 'For patient B' })

      const response = await request('/api/medical-records', { token: patientAToken })
      assert.equal(response.status, 200)
      assert.equal(response.body.data.records.length, 1)
      assert.equal(response.body.data.records[0].title, 'For patient A')
    })

    it('prevents a patient from reading another patient record by id', async () => {
      const apptA = await createAppointment(patientA, doctorA.user)
      const record = await createRecord(patientA, doctorA, apptA)
      const response = await request(`/api/medical-records/${record._id}`, {
        token: patientBToken,
      })
      assert.equal(response.status, 403)
    })

    it('lets a doctor list only records they created', async () => {
      const apptA = await createAppointment(patientA, doctorA.user)
      await createRecord(patientA, doctorA, apptA, { title: 'By doctor A' })
      const apptB = await createAppointment(patientB, doctorB.user)
      await createRecord(patientB, doctorB, apptB, { title: 'By doctor B' })

      const response = await request('/api/medical-records', { token: doctorAToken })
      assert.equal(response.status, 200)
      assert.equal(response.body.data.records.length, 1)
      assert.equal(response.body.data.records[0].title, 'By doctor A')
    })

    it('prevents a doctor from reading a record created by another doctor', async () => {
      const apptA = await createAppointment(patientA, doctorA.user)
      const record = await createRecord(patientA, doctorA, apptA)
      const response = await request(`/api/medical-records/${record._id}`, {
        token: doctorBToken,
      })
      assert.equal(response.status, 403)
    })

    it('lets the linked patient and doctor read the same record', async () => {
      const apptA = await createAppointment(patientA, doctorA.user)
      const record = await createRecord(patientA, doctorA, apptA)
      const asPatient = await request(`/api/medical-records/${record._id}`, {
        token: patientAToken,
      })
      const asDoctor = await request(`/api/medical-records/${record._id}`, {
        token: doctorAToken,
      })
      assert.equal(asPatient.status, 200)
      assert.equal(asDoctor.status, 200)
      assert.equal(asPatient.body.data.record.id, record._id.toString())
    })
  })

  describe('record details', () => {
    it('returns the full record shape for an owner', async () => {
      const appointment = await createAppointment(patientA, doctorA.user)
      const created = await request('/api/medical-records', {
        method: 'POST',
        token: doctorAToken,
        body: recordPayload(appointment._id),
      })
      const recordId = created.body.data.record.id

      const response = await request(`/api/medical-records/${recordId}`, {
        token: patientAToken,
      })
      assert.equal(response.status, 200)
      const { record } = response.body.data
      assert.equal(record.recordType, 'CONSULTATION')
      assert.equal(record.title, 'Follow-up consultation')
      assert.equal(record.appointment.id, appointment._id.toString())
      assert.equal(record.appointment.type, 'VIDEO')
      assert.equal(record.patient.id, patientA._id.toString())
      assert.equal(record.patient.name, 'Patient Alpha')
      assert.equal(record.doctor.id, doctorA.user._id.toString())
      assert.equal(record.doctor.name, 'Dr. Alpha Approved')
      assert.equal(record.doctor.specialization, 'Cardiologist')
      assert.equal(record.prescription, null)
    })

    it('returns 404 for a missing record', async () => {
      const response = await request('/api/medical-records/507f1f77bcf86cd799439011', {
        token: patientAToken,
      })
      assert.equal(response.status, 404)
      assert.equal(response.body.code, 'NOT_FOUND')
    })

    it('returns 400 for a malformed record identifier', async () => {
      const response = await request('/api/medical-records/not-an-id', {
        token: patientAToken,
      })
      assert.equal(response.status, 400)
      assert.equal(response.body.code, 'VALIDATION_ERROR')
    })
  })

  describe('serialization and security', () => {
    it('never exposes password hashes or tokens', async () => {
      const appointment = await createAppointment(patientA, doctorA.user)
      const created = await request('/api/medical-records', {
        method: 'POST',
        token: doctorAToken,
        body: recordPayload(appointment._id),
      })
      const fetched = await request(
        `/api/medical-records/${created.body.data.record.id}`,
        { token: doctorAToken },
      )
      const serialized = JSON.stringify(fetched.body)
      assert.equal(serialized.includes('passwordHash'), false)
      assert.equal(serialized.includes('token'), false)
      assert.equal(serialized.includes('jwt'), false)
    })

    it('does not leak patient or doctor email or phone', async () => {
      const appointment = await createAppointment(patientA, doctorA.user)
      const created = await request('/api/medical-records', {
        method: 'POST',
        token: doctorAToken,
        body: recordPayload(appointment._id),
      })
      const fetched = await request(
        `/api/medical-records/${created.body.data.record.id}`,
        { token: patientAToken },
      )
      const serialized = JSON.stringify(fetched.body)
      assert.equal(serialized.includes('mr-patient-a@example.com'), false)
      assert.equal(serialized.includes('mr-doctor-a@example.com'), false)
      assert.equal(serialized.includes('phone'), false)
    })
  })

  describe('pagination and filtering', () => {
    async function seedThree(appointment) {
      await createRecord(patientA, doctorA, appointment, {
        title: 'Record one',
        recordType: 'CONSULTATION',
        recordDate: new Date('2030-01-01'),
      })
      await createRecord(patientA, doctorA, appointment, {
        title: 'Record two',
        recordType: 'DIAGNOSIS',
        recordDate: new Date('2030-01-15'),
      })
      await createRecord(patientA, doctorA, appointment, {
        title: 'Record three',
        recordType: 'LAB_REPORT',
        recordDate: new Date('2030-02-01'),
      })
    }

    it('paginates records', async () => {
      const appointment = await createAppointment(patientA, doctorA.user)
      await seedThree(appointment)

      const pageOne = await request('/api/medical-records?page=1&limit=2', {
        token: patientAToken,
      })
      assert.equal(pageOne.status, 200)
      assert.equal(pageOne.body.data.records.length, 2)
      assert.equal(pageOne.body.data.pagination.page, 1)
      assert.equal(pageOne.body.data.pagination.total, 3)
      assert.equal(pageOne.body.data.pagination.totalPages, 2)

      const pageTwo = await request('/api/medical-records?page=2&limit=2', {
        token: patientAToken,
      })
      assert.equal(pageTwo.body.data.records.length, 1)
    })

    it('sorts records by record date descending', async () => {
      const appointment = await createAppointment(patientA, doctorA.user)
      await seedThree(appointment)
      const response = await request('/api/medical-records', { token: patientAToken })
      const titles = response.body.data.records.map((record) => record.title)
      assert.deepEqual(titles, ['Record three', 'Record two', 'Record one'])
    })

    it('filters records by record type', async () => {
      const appointment = await createAppointment(patientA, doctorA.user)
      await seedThree(appointment)
      const response = await request('/api/medical-records?recordType=DIAGNOSIS', {
        token: patientAToken,
      })
      assert.equal(response.status, 200)
      assert.equal(response.body.data.records.length, 1)
      assert.equal(response.body.data.records[0].title, 'Record two')
    })

    it('filters records by date range', async () => {
      const appointment = await createAppointment(patientA, doctorA.user)
      await seedThree(appointment)
      const response = await request(
        '/api/medical-records?from=2030-01-10&to=2030-01-20',
        { token: patientAToken },
      )
      assert.equal(response.status, 200)
      assert.equal(response.body.data.records.length, 1)
      assert.equal(response.body.data.records[0].title, 'Record two')
    })

    it('rejects an invalid record type filter', async () => {
      const response = await request('/api/medical-records?recordType=HACK', {
        token: patientAToken,
      })
      assert.equal(response.status, 400)
      assert.equal(response.body.code, 'VALIDATION_ERROR')
    })

    it('rejects an invalid date range filter', async () => {
      const response = await request('/api/medical-records?from=2030-05-01&to=2030-01-01', {
        token: patientAToken,
      })
      assert.equal(response.status, 400)
      assert.equal(response.body.code, 'VALIDATION_ERROR')
    })

    it('rejects an out-of-range limit rather than silently accepting it', async () => {
      const response = await request('/api/medical-records?limit=999', {
        token: patientAToken,
      })
      assert.equal(response.status, 400)
      assert.equal(response.body.code, 'VALIDATION_ERROR')
    })

    it('ignores unknown query parameters without erroring', async () => {
      const response = await request('/api/medical-records?$where=1&sort=evil', {
        token: patientAToken,
      })
      assert.equal(response.status, 200)
      assert.equal(response.body.success, true)
    })
  })

  describe('phase regression smoke checks', () => {
    it('keeps the health endpoint available', async () => {
      const response = await request('/api/health')
      assert.equal(response.status, 200)
    })

    it('keeps appointment endpoints protected', async () => {
      assert.equal((await request('/api/appointments/my')).status, 401)
    })

    it('keeps prescription endpoints protected', async () => {
      assert.equal((await request('/api/prescriptions')).status, 401)
    })

    it('keeps the doctor directory public', async () => {
      const response = await request('/api/doctors')
      assert.equal(response.status, 200)
    })
  })
})
