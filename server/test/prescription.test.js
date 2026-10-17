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
  createUser,
  createDoctor,
  tokenForUser,
  request,
  Appointment,
  Prescription,
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
    instructions: 'Take with water',
    ...overrides,
  }
}

function prescriptionPayload(appointmentId, overrides = {}) {
  return {
    appointmentId: appointmentId.toString(),
    diagnosis: 'Viral fever',
    medicines: [medicine()],
    instructions: 'Rest and stay hydrated',
    followUpDate: '2030-01-14',
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

describe('Prescription module', () => {
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
    await Prescription.init()
  })

  after(async () => {
    await stopServer()
  })

  beforeEach(async () => {
    await clearPrescriptions()
    await clearAppointments()
    await clearDoctorProfiles()
    await clearPatientProfiles()
    await clearUsers()

    const pa = await createUser({
      email: 'rx-patient-a@example.com',
      name: 'Patient Alpha',
      role: 'PATIENT',
    })
    patientA = pa
    patientAToken = tokenForUser(pa)

    const pb = await createUser({
      email: 'rx-patient-b@example.com',
      name: 'Patient Beta',
      role: 'PATIENT',
    })
    patientB = pb
    patientBToken = tokenForUser(pb)

    const da = await createDoctor({
      email: 'rx-doctor-a@example.com',
      name: 'Dr. Alpha Approved',
      verificationStatus: 'APPROVED',
      profile: { specialization: 'Cardiologist' },
    })
    doctorA = da
    doctorAToken = tokenForUser(da.user)

    const db = await createDoctor({
      email: 'rx-doctor-b@example.com',
      name: 'Dr. Beta Approved',
      verificationStatus: 'APPROVED',
      profile: { specialization: 'Dermatologist' },
    })
    doctorB = db
    doctorBToken = tokenForUser(db.user)

    const pharmacy = await createUser({
      email: 'rx-pharmacy@example.com',
      name: 'Test Pharmacy',
      role: 'PHARMACY',
    })
    pharmacyToken = tokenForUser(pharmacy)

    const admin = await createUser({
      email: 'rx-admin@example.com',
      name: 'Test Admin',
      role: 'ADMIN',
    })
    adminToken = tokenForUser(admin)
  })

  describe('authentication and authorization', () => {
    it('rejects unauthenticated prescription creation', async () => {
      const appointment = await createAppointment(patientA, doctorA.user)
      const response = await request('/api/prescriptions', {
        method: 'POST',
        body: prescriptionPayload(appointment._id),
      })
      assert.equal(response.status, 401)
      assert.equal(response.body.success, false)
    })

    it('forbids patients from creating prescriptions', async () => {
      const appointment = await createAppointment(patientA, doctorA.user)
      const response = await request('/api/prescriptions', {
        method: 'POST',
        token: patientAToken,
        body: prescriptionPayload(appointment._id),
      })
      assert.equal(response.status, 403)
    })

    it('forbids pharmacy and admin roles from creating prescriptions', async () => {
      const appointment = await createAppointment(patientA, doctorA.user)
      const pharmacyResponse = await request('/api/prescriptions', {
        method: 'POST',
        token: pharmacyToken,
        body: prescriptionPayload(appointment._id),
      })
      const adminResponse = await request('/api/prescriptions', {
        method: 'POST',
        token: adminToken,
        body: prescriptionPayload(appointment._id),
      })
      assert.equal(pharmacyResponse.status, 403)
      assert.equal(adminResponse.status, 403)
    })

    it('forbids a doctor from prescribing for another doctor appointment', async () => {
      const appointment = await createAppointment(patientA, doctorA.user)
      const response = await request('/api/prescriptions', {
        method: 'POST',
        token: doctorBToken,
        body: prescriptionPayload(appointment._id),
      })
      assert.equal(response.status, 403)
      assert.equal((await Prescription.countDocuments()), 0)
    })

    it('requires authentication for prescription listings', async () => {
      assert.equal((await request('/api/prescriptions')).status, 401)
      assert.equal((await request('/api/prescriptions/doctor')).status, 401)
    })

    it('forbids a patient from reading the doctor prescription feed', async () => {
      const response = await request('/api/prescriptions/doctor', {
        token: patientAToken,
      })
      assert.equal(response.status, 403)
    })

    it('forbids a doctor from reading the patient prescription feed', async () => {
      const response = await request('/api/prescriptions', {
        token: doctorAToken,
      })
      assert.equal(response.status, 403)
    })
  })

  describe('appointment rules', () => {
    it('rejects an invalid appointment identifier', async () => {
      const response = await request('/api/prescriptions', {
        method: 'POST',
        token: doctorAToken,
        body: prescriptionPayload('not-an-id'),
      })
      assert.equal(response.status, 400)
      assert.equal(response.body.code, 'VALIDATION_ERROR')
    })

    it('returns 404 for a missing appointment', async () => {
      const response = await request('/api/prescriptions', {
        method: 'POST',
        token: doctorAToken,
        body: prescriptionPayload('64b7f9f9f9f9f9f9f9f9f9f9'),
      })
      assert.equal(response.status, 404)
    })

    for (const status of ['PENDING', 'CONFIRMED', 'CANCELLED', 'REJECTED']) {
      it(`rejects a ${status} appointment`, async () => {
        const appointment = await createAppointment(patientA, doctorA.user, {
          status,
        })
        const response = await request('/api/prescriptions', {
          method: 'POST',
          token: doctorAToken,
          body: prescriptionPayload(appointment._id),
        })
        assert.equal(response.status, 409)
        assert.equal((await Prescription.countDocuments()), 0)
      })
    }

    it('creates a prescription for a completed appointment', async () => {
      const appointment = await createAppointment(patientA, doctorA.user)
      const response = await request('/api/prescriptions', {
        method: 'POST',
        token: doctorAToken,
        body: prescriptionPayload(appointment._id),
      })
      assert.equal(response.status, 201)
      assert.equal(response.body.success, true)
      assert.equal(response.body.data.prescription.status, 'ACTIVE')
      assert.equal(response.body.data.prescription.appointmentId, appointment._id.toString())
    })

    it('derives the doctor and patient from the stored appointment', async () => {
      const appointment = await createAppointment(patientA, doctorA.user)
      const response = await request('/api/prescriptions', {
        method: 'POST',
        token: doctorAToken,
        body: prescriptionPayload(appointment._id, {
          doctorId: doctorB.user._id.toString(),
          patientId: patientB._id.toString(),
        }),
      })
      assert.equal(response.status, 201)
      const stored = await Prescription.findOne({ appointmentId: appointment._id })
      assert.equal(stored.doctorId.toString(), doctorA.user._id.toString())
      assert.equal(stored.patientId.toString(), patientA._id.toString())
    })
  })

  describe('validation', () => {
    it('requires an appointment', async () => {
      const response = await request('/api/prescriptions', {
        method: 'POST',
        token: doctorAToken,
        body: { medicines: [medicine()] },
      })
      assert.equal(response.status, 400)
      assert.ok(
        response.body.details.some((item) => item.field === 'appointmentId'),
      )
    })

    it('requires at least one medicine', async () => {
      const appointment = await createAppointment(patientA, doctorA.user)
      const missing = await request('/api/prescriptions', {
        method: 'POST',
        token: doctorAToken,
        body: prescriptionPayload(appointment._id, { medicines: [] }),
      })
      assert.equal(missing.status, 400)
      assert.ok(missing.body.details.some((item) => item.field === 'medicines'))
    })

    it('rejects a medicine object instead of an array', async () => {
      const appointment = await createAppointment(patientA, doctorA.user)
      const response = await request('/api/prescriptions', {
        method: 'POST',
        token: doctorAToken,
        body: prescriptionPayload(appointment._id, { medicines: { $ne: null } }),
      })
      assert.equal(response.status, 400)
    })

    it('rejects a medicine without a name', async () => {
      const appointment = await createAppointment(patientA, doctorA.user)
      const response = await request('/api/prescriptions', {
        method: 'POST',
        token: doctorAToken,
        body: prescriptionPayload(appointment._id, {
          medicines: [medicine({ medicineName: '   ' })],
        }),
      })
      assert.equal(response.status, 400)
      assert.ok(
        response.body.details.some(
          (item) => item.field === 'medicines[0].medicineName',
        ),
      )
    })

    it('rejects invalid route and timing enums', async () => {
      const appointment = await createAppointment(patientA, doctorA.user)
      const response = await request('/api/prescriptions', {
        method: 'POST',
        token: doctorAToken,
        body: prescriptionPayload(appointment._id, {
          medicines: [medicine({ route: 'SNORT', timing: 'MIDNIGHT' })],
        }),
      })
      assert.equal(response.status, 400)
      assert.ok(
        response.body.details.some((item) => item.field === 'medicines[0].route'),
      )
      assert.ok(
        response.body.details.some((item) => item.field === 'medicines[0].timing'),
      )
    })

    it('rejects non-positive and non-integer quantities', async () => {
      const appointment = await createAppointment(patientA, doctorA.user)
      for (const quantity of [0, -3, 2.5, 'ten']) {
        const response = await request('/api/prescriptions', {
          method: 'POST',
          token: doctorAToken,
          body: prescriptionPayload(appointment._id, {
            medicines: [medicine({ quantity })],
          }),
        })
        assert.equal(response.status, 400, `quantity ${quantity} should be rejected`)
      }
    })

    it('rejects an over-long diagnosis', async () => {
      const appointment = await createAppointment(patientA, doctorA.user)
      const response = await request('/api/prescriptions', {
        method: 'POST',
        token: doctorAToken,
        body: prescriptionPayload(appointment._id, {
          diagnosis: 'x'.repeat(1001),
        }),
      })
      assert.equal(response.status, 400)
      assert.ok(
        response.body.details.some((item) => item.field === 'diagnosis'),
      )
    })

    it('rejects an invalid follow-up date', async () => {
      const appointment = await createAppointment(patientA, doctorA.user)
      const response = await request('/api/prescriptions', {
        method: 'POST',
        token: doctorAToken,
        body: prescriptionPayload(appointment._id, {
          followUpDate: '14-01-2030',
        }),
      })
      assert.equal(response.status, 400)
      assert.ok(
        response.body.details.some((item) => item.field === 'followUpDate'),
      )
    })

    it('normalizes empty optional fields to null', async () => {
      const appointment = await createAppointment(patientA, doctorA.user)
      const response = await request('/api/prescriptions', {
        method: 'POST',
        token: doctorAToken,
        body: prescriptionPayload(appointment._id, {
          diagnosis: '   ',
          instructions: '',
          followUpDate: '',
          medicines: [medicine({ route: '', timing: '', instructions: '' })],
        }),
      })
      assert.equal(response.status, 201)
      const { prescription } = response.body.data
      assert.equal(prescription.diagnosis, null)
      assert.equal(prescription.instructions, null)
      assert.equal(prescription.followUpDate, null)
      assert.equal(prescription.medicines[0].route, null)
      assert.equal(prescription.medicines[0].timing, null)
    })
  })

  describe('duplicate prevention', () => {
    it('rejects a second prescription for the same appointment', async () => {
      const appointment = await createAppointment(patientA, doctorA.user)
      const first = await request('/api/prescriptions', {
        method: 'POST',
        token: doctorAToken,
        body: prescriptionPayload(appointment._id),
      })
      const second = await request('/api/prescriptions', {
        method: 'POST',
        token: doctorAToken,
        body: prescriptionPayload(appointment._id),
      })
      assert.equal(first.status, 201)
      assert.equal(second.status, 409)
      assert.equal(await Prescription.countDocuments(), 1)
    })

    it('prevents duplicate prescriptions from concurrent requests', async () => {
      const appointment = await createAppointment(patientA, doctorA.user)
      const [first, second] = await Promise.all([
        request('/api/prescriptions', {
          method: 'POST',
          token: doctorAToken,
          body: prescriptionPayload(appointment._id),
        }),
        request('/api/prescriptions', {
          method: 'POST',
          token: doctorAToken,
          body: prescriptionPayload(appointment._id),
        }),
      ])
      const statuses = [first.status, second.status].sort()
      assert.deepEqual(statuses, [201, 409])
      assert.equal(await Prescription.countDocuments(), 1)
    })
  })

  describe('retrieval and privacy', () => {
    let appointment
    let prescriptionId

    beforeEach(async () => {
      appointment = await createAppointment(patientA, doctorA.user)
      const created = await request('/api/prescriptions', {
        method: 'POST',
        token: doctorAToken,
        body: prescriptionPayload(appointment._id),
      })
      prescriptionId = created.body.data.prescription.id
    })

    it('lets the patient read their prescription', async () => {
      const response = await request(`/api/prescriptions/${prescriptionId}`, {
        token: patientAToken,
      })
      assert.equal(response.status, 200)
      assert.equal(response.body.data.prescription.id, prescriptionId)
      assert.equal(response.body.data.prescription.doctor.name, 'Dr. Alpha Approved')
      assert.equal(
        response.body.data.prescription.doctor.specialization,
        'Cardiologist',
      )
    })

    it('lets the authoring doctor read the prescription', async () => {
      const response = await request(`/api/prescriptions/${prescriptionId}`, {
        token: doctorAToken,
      })
      assert.equal(response.status, 200)
      assert.equal(response.body.data.prescription.patient.name, 'Patient Alpha')
    })

    it('blocks unrelated patients and doctors', async () => {
      const otherPatient = await request(`/api/prescriptions/${prescriptionId}`, {
        token: patientBToken,
      })
      const otherDoctor = await request(`/api/prescriptions/${prescriptionId}`, {
        token: doctorBToken,
      })
      assert.equal(otherPatient.status, 403)
      assert.equal(otherDoctor.status, 403)
    })

    it('returns 404 for an unknown prescription and 400 for an invalid id', async () => {
      const missing = await request(
        '/api/prescriptions/64b7f9f9f9f9f9f9f9f9f9f9',
        { token: patientAToken },
      )
      const invalid = await request('/api/prescriptions/not-an-id', {
        token: patientAToken,
      })
      assert.equal(missing.status, 404)
      assert.equal(invalid.status, 400)
    })

    it('lists only the requesting patient prescriptions', async () => {
      const otherAppointment = await createAppointment(patientB, doctorA.user, {
        startTime: '11:00',
        endTime: '11:30',
      })
      await request('/api/prescriptions', {
        method: 'POST',
        token: doctorAToken,
        body: prescriptionPayload(otherAppointment._id),
      })

      const response = await request('/api/prescriptions', {
        token: patientAToken,
      })
      assert.equal(response.status, 200)
      assert.equal(response.body.data.prescriptions.length, 1)
      assert.equal(response.body.data.prescriptions[0].id, prescriptionId)
    })

    it('lists only the requesting doctor prescriptions', async () => {
      const response = await request('/api/prescriptions/doctor', {
        token: doctorAToken,
      })
      assert.equal(response.status, 200)
      assert.equal(response.body.data.prescriptions.length, 1)
      assert.equal(response.body.data.prescriptions[0].doctor.name, 'Dr. Alpha Approved')

      const other = await request('/api/prescriptions/doctor', {
        token: doctorBToken,
      })
      assert.equal(other.body.data.prescriptions.length, 0)
    })

    it('never exposes sensitive account fields', async () => {
      const response = await request(`/api/prescriptions/${prescriptionId}`, {
        token: patientAToken,
      })
      const serialized = JSON.stringify(response.body)
      assert.equal(serialized.includes('passwordHash'), false)
      assert.equal(serialized.includes('rx-patient-a@example.com'), false)
      assert.equal(serialized.includes('rx-doctor-a@example.com'), false)
      assert.deepEqual(Object.keys(response.body.data.prescription.patient).sort(), [
        'id',
        'name',
      ])
      assert.deepEqual(Object.keys(response.body.data.prescription.doctor).sort(), [
        'id',
        'name',
        'specialization',
      ])
    })
  })
})
