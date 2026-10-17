const { describe, before, after, beforeEach, it } = require('node:test')
const assert = require('node:assert/strict')
const mongoose = require('mongoose')
const {
  startServer,
  stopServer,
  clearUsers,
  clearPatientProfiles,
  clearDoctorProfiles,
  clearAppointments,
  createUser,
  createDoctor,
  tokenForUser,
  request,
  User,
  DoctorProfile,
  Appointment,
} = require('./helpers')
const {
  APPOINTMENT_SLOT_MINUTES,
  APPOINTMENT_STATUSES,
} = require('../src/models/Appointment')

const DAYS = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
]

function dateString(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(base, days) {
  const result = new Date(base)
  result.setDate(result.getDate() + days)
  return result
}

function futureDateOn(dayOfWeek) {
  let cursor = addDays(new Date(), 7)
  while (DAYS[cursor.getDay()] !== dayOfWeek) {
    cursor = addDays(cursor, 1)
  }
  return dateString(cursor)
}

function pastDate() {
  return dateString(addDays(new Date(), -1))
}

const MONDAY_DATE = futureDateOn('MONDAY')
const WEDNESDAY_DATE = futureDateOn('WEDNESDAY')
const VALID_SLOT = '10:00'
const VALID_END = '10:30'

function bookingPayload(doctor, overrides = {}) {
  return {
    doctorId: doctor.profile._id.toString(),
    appointmentDate: MONDAY_DATE,
    startTime: VALID_SLOT,
    type: 'VIDEO',
    reason: 'Routine consultation',
    ...overrides,
  }
}

function slotTimes(payload) {
  return { startTime: payload.startTime, endTime: VALID_END }
}

describe('Appointment module', () => {
  let patientA
  let patientB
  let patientAToken
  let patientBToken
  let doctorA
  let doctorB
  let doctorAToken
  let doctorBToken
  let pendingDoctor
  let rejectedDoctor
  let pharmacyToken
  let adminToken

  before(async () => {
    await startServer()
  })

  after(async () => {
    await stopServer()
  })

  beforeEach(async () => {
    await clearAppointments()
    await clearDoctorProfiles()
    await clearPatientProfiles()
    await clearUsers()

    const a = await createUser({
      email: 'apt-patient-a@example.com',
      name: 'Patient Alpha',
      role: 'PATIENT',
    })
    patientA = a
    patientAToken = tokenForUser(a)

    const b = await createUser({
      email: 'apt-patient-b@example.com',
      name: 'Patient Beta',
      role: 'PATIENT',
    })
    patientB = b
    patientBToken = tokenForUser(b)

    const da = await createDoctor({
      email: 'apt-doctor-a@example.com',
      name: 'Dr. Alpha Approved',
      verificationStatus: 'APPROVED',
      profile: {
        specialization: 'Cardiologist',
        qualification: 'MBBS, MD (Cardiology)',
        experience: 10,
        registrationNumber: 'MC-AAA1',
        consultationFee: 800,
        clinicName: 'Alpha Heart Clinic',
        languages: ['English', 'Hindi'],
        availability: [
          { dayOfWeek: 'MONDAY', enabled: true, startTime: '09:00', endTime: '13:00' },
        ],
      },
    })
    doctorA = da
    doctorAToken = tokenForUser(da.user)

    const db = await createDoctor({
      email: 'apt-doctor-b@example.com',
      name: 'Dr. Beta Approved',
      verificationStatus: 'APPROVED',
      profile: {
        specialization: 'Dermatologist',
        qualification: 'MBBS',
        experience: 4,
        registrationNumber: 'MC-BBB1',
        consultationFee: 300,
        clinicName: 'Beta Skin Clinic',
        languages: ['English'],
        availability: [
          { dayOfWeek: 'MONDAY', enabled: true, startTime: '09:00', endTime: '13:00' },
        ],
      },
    })
    doctorB = db
    doctorBToken = tokenForUser(db.user)

    const pd = await createDoctor({
      email: 'apt-doctor-pending@example.com',
      name: 'Dr. Pending Doc',
      verificationStatus: 'PENDING',
      profile: {
        specialization: 'General Physician',
        availability: [
          { dayOfWeek: 'MONDAY', enabled: true, startTime: '09:00', endTime: '13:00' },
        ],
      },
    })
    pendingDoctor = pd

    const rd = await createDoctor({
      email: 'apt-doctor-rejected@example.com',
      name: 'Dr. Rejected Doc',
      verificationStatus: 'REJECTED',
      profile: {
        specialization: 'General Physician',
        availability: [
          { dayOfWeek: 'MONDAY', enabled: true, startTime: '09:00', endTime: '13:00' },
        ],
      },
    })
    rejectedDoctor = rd

    const pharmacy = await createUser({
      email: 'apt-pharmacy@example.com',
      role: 'PHARMACY',
    })
    pharmacyToken = tokenForUser(pharmacy)

    const admin = await createUser({ email: 'apt-admin@example.com', role: 'ADMIN' })
    adminToken = tokenForUser(admin)
  })

  it('model: required fields and enums are validated', async () => {
    await assert.rejects(
      Appointment.create({
        doctorId: doctorA.user._id,
        appointmentDate: MONDAY_DATE,
        startTime: VALID_SLOT,
        endTime: VALID_END,
        type: 'VIDEO',
      }),
      mongoose.Error.ValidationError,
    )
    await assert.rejects(
      Appointment.create({
        patientId: patientA._id,
        doctorId: doctorA.user._id,
        appointmentDate: MONDAY_DATE,
        startTime: VALID_SLOT,
        endTime: VALID_END,
        type: 'VIDEO',
        reason: 'Routine consultation',
        status: 'NOT_A_STATUS',
      }),
      mongoose.Error.ValidationError,
    )
  })

  it('model: defaults to PENDING, stores timestamps, slot constant is 30', async () => {
    assert.equal(APPOINTMENT_SLOT_MINUTES, 30)
    const appointment = await Appointment.create({
      patientId: patientA._id,
      doctorId: doctorA.user._id,
      appointmentDate: MONDAY_DATE,
      startTime: VALID_SLOT,
      endTime: VALID_END,
      type: 'CHAT',
      reason: 'Routine consultation',
    })
    assert.equal(appointment.status, 'PENDING')
    assert.ok(appointment.createdAt instanceof Date)
    assert.ok(appointment.updatedAt instanceof Date)
    assert.equal(appointment.type, 'CHAT')
    assert.ok(APPOINTMENT_STATUSES.includes(appointment.status))
  })

  it('patient can create an appointment', async () => {
    const response = await request('/api/appointments', {
      method: 'POST',
      body: bookingPayload(doctorA),
      token: patientAToken,
    })
    assert.equal(response.status, 201)
    assert.equal(response.body.success, true)
    assert.equal(response.body.data.appointment.status, 'PENDING')
    assert.equal(response.body.data.appointment.reason, 'Routine consultation')
    assert.equal(response.body.data.appointment.doctor.profileId, doctorA.profile._id.toString())
  })

  it('doctor cannot create an appointment', async () => {
    const response = await request('/api/appointments', {
      method: 'POST',
      body: bookingPayload(doctorA),
      token: doctorAToken,
    })
    assert.equal(response.status, 403)
    assert.equal(response.body.code, 'FORBIDDEN')
  })

  it('pharmacy cannot create an appointment', async () => {
    const response = await request('/api/appointments', {
      method: 'POST',
      body: bookingPayload(doctorA),
      token: pharmacyToken,
    })
    assert.equal(response.status, 403)
  })

  it('admin cannot create an appointment', async () => {
    const response = await request('/api/appointments', {
      method: 'POST',
      body: bookingPayload(doctorA),
      token: adminToken,
    })
    assert.equal(response.status, 403)
  })

  it('unauthenticated create is blocked', async () => {
    const response = await request('/api/appointments', {
      method: 'POST',
      body: bookingPayload(doctorA),
    })
    assert.equal(response.status, 401)
    assert.equal(response.body.code, 'UNAUTHORIZED')
  })

  it('approved doctor can be booked', async () => {
    const response = await request('/api/appointments', {
      method: 'POST',
      body: bookingPayload(doctorA, { startTime: '12:00' }),
      token: patientAToken,
    })
    assert.equal(response.status, 201)
  })

  it('pending doctor cannot be booked', async () => {
    const response = await request('/api/appointments', {
      method: 'POST',
      body: bookingPayload(pendingDoctor),
      token: patientAToken,
    })
    assert.equal(response.status, 404)
    assert.equal(response.body.code, 'NOT_FOUND')
  })

  it('rejected doctor cannot be booked', async () => {
    const response = await request('/api/appointments', {
      method: 'POST',
      body: bookingPayload(rejectedDoctor),
      token: patientAToken,
    })
    assert.equal(response.status, 404)
  })

  it('unknown doctor cannot be booked', async () => {
    const response = await request('/api/appointments', {
      method: 'POST',
      body: bookingPayload(doctorA, {
        doctorId: new mongoose.Types.ObjectId().toString(),
      }),
      token: patientAToken,
    })
    assert.equal(response.status, 404)
  })

  it('invalid doctor id is rejected', async () => {
    const response = await request('/api/appointments', {
      method: 'POST',
      body: bookingPayload(doctorA, { doctorId: 'not-an-id' }),
      token: patientAToken,
    })
    assert.equal(response.status, 400)
    assert.equal(response.body.code, 'VALIDATION_ERROR')
    assert.ok(response.body.details.some((detail) => detail.field === 'doctorId'))
  })

  it('past appointment date is rejected', async () => {
    const response = await request('/api/appointments', {
      method: 'POST',
      body: bookingPayload(doctorA, { appointmentDate: pastDate() }),
      token: patientAToken,
    })
    assert.equal(response.status, 400)
    assert.equal(response.body.code, 'VALIDATION_ERROR')
    assert.ok(
      response.body.details.some(
        (detail) => detail.field === 'appointmentDate' && detail.message.includes('past'),
      ),
    )
  })

  it('invalid appointment date is rejected', async () => {
    const response = await request('/api/appointments', {
      method: 'POST',
      body: bookingPayload(doctorA, { appointmentDate: '2026-13-45' }),
      token: patientAToken,
    })
    assert.equal(response.status, 400)
  })

  it('invalid start time is rejected', async () => {
    const response = await request('/api/appointments', {
      method: 'POST',
      body: bookingPayload(doctorA, { startTime: '10:15' }),
      token: patientAToken,
    })
    assert.equal(response.status, 400)
    assert.ok(response.body.details.some((detail) => detail.field === 'startTime'))
  })

  it('invalid consultation type is rejected', async () => {
    const response = await request('/api/appointments', {
      method: 'POST',
      body: bookingPayload(doctorA, { type: 'SMS' }),
      token: patientAToken,
    })
    assert.equal(response.status, 400)
    assert.ok(response.body.details.some((detail) => detail.field === 'type'))
  })

  it('empty reason is rejected', async () => {
    const response = await request('/api/appointments', {
      method: 'POST',
      body: bookingPayload(doctorA, { reason: '   ' }),
      token: patientAToken,
    })
    assert.equal(response.status, 400)
    assert.ok(response.body.details.some((detail) => detail.field === 'reason'))
  })

  it('excessive reason length is rejected', async () => {
    const response = await request('/api/appointments', {
      method: 'POST',
      body: bookingPayload(doctorA, { reason: 'a'.repeat(501) }),
      token: patientAToken,
    })
    assert.equal(response.status, 400)
    assert.ok(
      response.body.details.some(
        (detail) => detail.field === 'reason' && detail.message.includes('exceed'),
      ),
    )
  })

  it('availability endpoint returns generated 30-minute slots', async () => {
    const response = await request(
      `/api/appointments/availability/${doctorA.profile._id}?date=${MONDAY_DATE}`,
    )
    assert.equal(response.status, 200)
    assert.equal(response.body.success, true)
    assert.equal(response.body.data.doctorId, doctorA.profile._id.toString())
    assert.equal(response.body.data.date, MONDAY_DATE)
    assert.equal(response.body.data.dayOfWeek, 'MONDAY')
    assert.equal(response.body.data.slotMinutes, 30)
    assert.equal(response.body.data.slots.length, 8)
    assert.equal(response.body.data.slots[0].startTime, '09:00')
    assert.equal(response.body.data.slots[0].endTime, '09:30')
    assert.equal(response.body.data.slots[0].available, true)
  })

  it('availability endpoint rejects past dates', async () => {
    const response = await request(
      `/api/appointments/availability/${doctorA.profile._id}?date=${pastDate()}`,
    )
    assert.equal(response.status, 400)
    assert.equal(response.body.code, 'VALIDATION_ERROR')
  })

  it('availability endpoint rejects invalid dates and doctor ids', async () => {
    const badDate = await request(
      `/api/appointments/availability/${doctorA.profile._id}?date=2026-13-45`,
    )
    assert.equal(badDate.status, 400)

    const missingDate = await request(
      `/api/appointments/availability/${doctorA.profile._id}`,
    )
    assert.equal(missingDate.status, 400)

    const badDoctor = await request(
      `/api/appointments/availability/not-an-id?date=${MONDAY_DATE}`,
    )
    assert.equal(badDoctor.status, 400)
  })

  it('availability endpoint hides non-approved doctors', async () => {
    const unknown = await request(
      `/api/appointments/availability/${new mongoose.Types.ObjectId()}?date=${MONDAY_DATE}`,
    )
    assert.equal(unknown.status, 404)

    const pending = await request(
      `/api/appointments/availability/${pendingDoctor.profile._id}?date=${MONDAY_DATE}`,
    )
    assert.equal(pending.status, 404)

    const rejected = await request(
      `/api/appointments/availability/${rejectedDoctor.profile._id}?date=${MONDAY_DATE}`,
    )
    assert.equal(rejected.status, 404)
  })

  it('unavailable weekday returns empty slots', async () => {
    const response = await request(
      `/api/appointments/availability/${doctorA.profile._id}?date=${WEDNESDAY_DATE}`,
    )
    assert.equal(response.status, 200)
    assert.equal(response.body.data.dayOfWeek, 'WEDNESDAY')
    assert.deepEqual(response.body.data.slots, [])
  })

  it('time outside doctor availability is rejected', async () => {
    const response = await request('/api/appointments', {
      method: 'POST',
      body: bookingPayload(doctorA, { startTime: '08:30' }),
      token: patientAToken,
    })
    assert.equal(response.status, 400)
    assert.ok(response.body.details.some((detail) => detail.field === 'startTime'))
  })

  it('wrong weekday booking is rejected', async () => {
    const response = await request('/api/appointments', {
      method: 'POST',
      body: bookingPayload(doctorA, { appointmentDate: WEDNESDAY_DATE }),
      token: patientAToken,
    })
    assert.equal(response.status, 400)
  })

  it('backend calculates endTime as startTime + 30 minutes', async () => {
    const response = await request('/api/appointments', {
      method: 'POST',
      body: bookingPayload(doctorA, { startTime: '10:00' }),
      token: patientAToken,
    })
    assert.equal(response.status, 201)
    assert.deepEqual(slotTimes(response.body.data.appointment), {
      startTime: '10:00',
      endTime: '10:30',
    })
  })

  it('booked slot is marked unavailable in availability', async () => {
    await request('/api/appointments', {
      method: 'POST',
      body: bookingPayload(doctorA),
      token: patientAToken,
    })
    const response = await request(
      `/api/appointments/availability/${doctorA.profile._id}?date=${MONDAY_DATE}`,
    )
    const booked = response.body.data.slots.find((slot) => slot.startTime === '10:00')
    const free = response.body.data.slots.find((slot) => slot.startTime === '10:30')
    assert.equal(booked.available, false)
    assert.equal(free.available, true)
  })

  it('exact overlap is rejected with 409', async () => {
    await request('/api/appointments', {
      method: 'POST',
      body: bookingPayload(doctorA),
      token: patientAToken,
    })
    const response = await request('/api/appointments', {
      method: 'POST',
      body: bookingPayload(doctorA),
      token: patientBToken,
    })
    assert.equal(response.status, 409)
    assert.equal(response.body.code, 'CONFLICT')
    assert.ok(response.body.message.includes('no longer available'))
  })

  it('partial overlap is rejected', async () => {
    await Appointment.create({
      patientId: patientA._id,
      doctorId: doctorA.user._id,
      appointmentDate: MONDAY_DATE,
      startTime: '09:45',
      endTime: '10:15',
      type: 'VIDEO',
      status: 'PENDING',
      reason: 'Existing booking',
    })
    const response = await request('/api/appointments', {
      method: 'POST',
      body: bookingPayload(doctorA),
      token: patientBToken,
    })
    assert.equal(response.status, 409)
  })

  it('earlier overlap is rejected', async () => {
    await Appointment.create({
      patientId: patientA._id,
      doctorId: doctorA.user._id,
      appointmentDate: MONDAY_DATE,
      startTime: '10:15',
      endTime: '10:45',
      type: 'VIDEO',
      status: 'PENDING',
      reason: 'Existing booking',
    })
    const response = await request('/api/appointments', {
      method: 'POST',
      body: bookingPayload(doctorA, { startTime: '10:30' }),
      token: patientBToken,
    })
    assert.equal(response.status, 409)
  })

  it('later overlap is rejected', async () => {
    await Appointment.create({
      patientId: patientA._id,
      doctorId: doctorA.user._id,
      appointmentDate: MONDAY_DATE,
      startTime: '10:45',
      endTime: '11:15',
      type: 'VIDEO',
      status: 'PENDING',
      reason: 'Existing booking',
    })
    const response = await request('/api/appointments', {
      method: 'POST',
      body: bookingPayload(doctorA, { startTime: '10:30' }),
      token: patientBToken,
    })
    assert.equal(response.status, 409)
  })

  it('adjacent slot is allowed', async () => {
    await request('/api/appointments', {
      method: 'POST',
      body: bookingPayload(doctorA),
      token: patientAToken,
    })
    const response = await request('/api/appointments', {
      method: 'POST',
      body: bookingPayload(doctorA, { startTime: '10:30' }),
      token: patientBToken,
    })
    assert.equal(response.status, 201)
  })

  it('cancelled slot is reusable', async () => {
    const created = await request('/api/appointments', {
      method: 'POST',
      body: bookingPayload(doctorA),
      token: patientAToken,
    })
    const appointmentId = created.body.data.appointment.id
    const cancelled = await request(`/api/appointments/${appointmentId}/cancel`, {
      method: 'PATCH',
      token: patientAToken,
    })
    assert.equal(cancelled.status, 200)
    assert.equal(cancelled.body.data.appointment.status, 'CANCELLED')

    const rebook = await request('/api/appointments', {
      method: 'POST',
      body: bookingPayload(doctorA),
      token: patientBToken,
    })
    assert.equal(rebook.status, 201)
  })

  it('rejected slot is reusable', async () => {
    const created = await request('/api/appointments', {
      method: 'POST',
      body: bookingPayload(doctorA),
      token: patientAToken,
    })
    const rejected = await request(
      `/api/appointments/${created.body.data.appointment.id}/reject`,
      { method: 'PATCH', token: doctorAToken },
    )
    assert.equal(rejected.status, 200)
    assert.equal(rejected.body.data.appointment.status, 'REJECTED')

    const rebook = await request('/api/appointments', {
      method: 'POST',
      body: bookingPayload(doctorA),
      token: patientBToken,
    })
    assert.equal(rebook.status, 201)
  })

  it('patient can list their own appointments with pagination', async () => {
    await request('/api/appointments', {
      method: 'POST',
      body: bookingPayload(doctorA),
      token: patientAToken,
    })
    await request('/api/appointments', {
      method: 'POST',
      body: bookingPayload(doctorA, { startTime: '11:00' }),
      token: patientAToken,
    })

    const response = await request('/api/appointments/my?page=1&limit=12', {
      token: patientAToken,
    })
    assert.equal(response.status, 200)
    assert.equal(response.body.data.appointments.length, 2)
    assert.equal(response.body.data.pagination.total, 2)
    assert.equal(response.body.data.pagination.page, 1)
    assert.equal(response.body.data.pagination.totalPages, 1)
    assert.equal(
      response.body.data.appointments[0].doctor.profileId,
      doctorA.profile._id.toString(),
    )
    assert.equal(response.body.data.appointments[0].doctor.name, 'Dr. Alpha Approved')
    assert.equal(
      response.body.data.appointments[0].doctor.specialization,
      'Cardiologist',
    )
  })

  it('patient isolation: other patients cannot see the appointment', async () => {
    await request('/api/appointments', {
      method: 'POST',
      body: bookingPayload(doctorA),
      token: patientAToken,
    })
    const response = await request('/api/appointments/my', { token: patientBToken })
    assert.equal(response.status, 200)
    assert.equal(response.body.data.pagination.total, 0)
    assert.deepEqual(response.body.data.appointments, [])
  })

  it('patient list supports status filtering', async () => {
    await request('/api/appointments', {
      method: 'POST',
      body: bookingPayload(doctorA),
      token: patientAToken,
    })
    const pending = await request('/api/appointments/my?status=PENDING', {
      token: patientAToken,
    })
    assert.equal(pending.body.data.pagination.total, 1)

    const confirmed = await request('/api/appointments/my?status=CONFIRMED', {
      token: patientAToken,
    })
    assert.equal(confirmed.body.data.pagination.total, 0)

    const bad = await request('/api/appointments/my?status=WRONG', {
      token: patientAToken,
    })
    assert.equal(bad.status, 400)
  })

  it('doctor can list their own appointments', async () => {
    await request('/api/appointments', {
      method: 'POST',
      body: bookingPayload(doctorA),
      token: patientAToken,
    })
    const response = await request('/api/appointments/doctor?status=PENDING', {
      token: doctorAToken,
    })
    assert.equal(response.status, 200)
    assert.equal(response.body.data.pagination.total, 1)
    assert.equal(response.body.data.appointments[0].patient.name, 'Patient Alpha')
    assert.equal(response.body.data.appointments[0].doctorId, doctorA.user._id.toString())
  })

  it('doctor isolation: only owning doctor sees their appointment', async () => {
    await request('/api/appointments', {
      method: 'POST',
      body: bookingPayload(doctorA),
      token: patientAToken,
    })
    const doctorAView = await request('/api/appointments/doctor', {
      token: doctorAToken,
    })
    const doctorBView = await request('/api/appointments/doctor', {
      token: doctorBToken,
    })
    assert.equal(doctorAView.body.data.pagination.total, 1)
    assert.equal(doctorBView.body.data.pagination.total, 0)
  })

  it('appointment detail enforces ownership', async () => {
    const created = await request('/api/appointments', {
      method: 'POST',
      body: bookingPayload(doctorA),
      token: patientAToken,
    })
    const id = created.body.data.appointment.id

    const owner = await request(`/api/appointments/${id}`, { token: patientAToken })
    assert.equal(owner.status, 200)
    assert.equal(owner.body.data.appointment.status, 'PENDING')

    const otherPatient = await request(`/api/appointments/${id}`, { token: patientBToken })
    assert.equal(otherPatient.status, 403)

    const otherDoctor = await request(`/api/appointments/${id}`, { token: doctorBToken })
    assert.equal(otherDoctor.status, 403)

    const ownerDoctor = await request(`/api/appointments/${id}`, { token: doctorAToken })
    assert.equal(ownerDoctor.status, 200)

    const unknown = await request(
      `/api/appointments/${new mongoose.Types.ObjectId()}`,
      { token: patientAToken },
    )
    assert.equal(unknown.status, 404)

    const invalid = await request('/api/appointments/not-an-id', {
      token: patientAToken,
    })
    assert.equal(invalid.status, 400)
  })

  it('doctor can confirm a pending appointment', async () => {
    const created = await request('/api/appointments', {
      method: 'POST',
      body: bookingPayload(doctorA),
      token: patientAToken,
    })
    const response = await request(
      `/api/appointments/${created.body.data.appointment.id}/confirm`,
      { method: 'PATCH', token: doctorAToken },
    )
    assert.equal(response.status, 200)
    assert.equal(response.body.data.appointment.status, 'CONFIRMED')
  })

  it('wrong doctor cannot confirm an appointment', async () => {
    const created = await request('/api/appointments', {
      method: 'POST',
      body: bookingPayload(doctorA),
      token: patientAToken,
    })
    const response = await request(
      `/api/appointments/${created.body.data.appointment.id}/confirm`,
      { method: 'PATCH', token: doctorBToken },
    )
    assert.equal(response.status, 403)
    assert.equal(response.body.code, 'FORBIDDEN')
  })

  it('doctor can reject a pending appointment', async () => {
    const created = await request('/api/appointments', {
      method: 'POST',
      body: bookingPayload(doctorA),
      token: patientAToken,
    })
    const response = await request(
      `/api/appointments/${created.body.data.appointment.id}/reject`,
      { method: 'PATCH', token: doctorAToken },
    )
    assert.equal(response.status, 200)
    assert.equal(response.body.data.appointment.status, 'REJECTED')
  })

  it('patient can cancel a pending or confirmed appointment', async () => {
    const created = await request('/api/appointments', {
      method: 'POST',
      body: bookingPayload(doctorA),
      token: patientAToken,
    })

    const pendingCancel = await request(
      `/api/appointments/${created.body.data.appointment.id}/cancel`,
      { method: 'PATCH', token: patientAToken },
    )
    assert.equal(pendingCancel.status, 200)
    assert.equal(pendingCancel.body.data.appointment.status, 'CANCELLED')
    assert.ok(pendingCancel.body.data.appointment.updatedAt)

    const rebook = await request('/api/appointments', {
      method: 'POST',
      body: bookingPayload(doctorA),
      token: patientAToken,
    })
    const confirmed = await request(
      `/api/appointments/${rebook.body.data.appointment.id}/confirm`,
      { method: 'PATCH', token: doctorAToken },
    )
    const confirmedCancel = await request(
      `/api/appointments/${rebook.body.data.appointment.id}/cancel`,
      { method: 'PATCH', token: patientAToken },
    )
    assert.equal(confirmedCancel.status, 200)
    assert.equal(confirmedCancel.body.data.appointment.status, 'CANCELLED')
  })

  it('doctor can cancel an appointment', async () => {
    const created = await request('/api/appointments', {
      method: 'POST',
      body: bookingPayload(doctorA),
      token: patientAToken,
    })
    const response = await request(
      `/api/appointments/${created.body.data.appointment.id}/cancel`,
      { method: 'PATCH', token: doctorAToken },
    )
    assert.equal(response.status, 200)
    assert.equal(response.body.data.appointment.status, 'CANCELLED')
  })

  it('invalid status transitions are blocked', async () => {
    const created = await request('/api/appointments', {
      method: 'POST',
      body: bookingPayload(doctorA),
      token: patientAToken,
    })
    const id = created.body.data.appointment.id

    const confirmed = await request(`/api/appointments/${id}/confirm`, {
      method: 'PATCH',
      token: doctorAToken,
    })
    assert.equal(confirmed.body.data.appointment.status, 'CONFIRMED')

    const doubleConfirm = await request(`/api/appointments/${id}/confirm`, {
      method: 'PATCH',
      token: doctorAToken,
    })
    assert.equal(doubleConfirm.status, 409)
    assert.equal(doubleConfirm.body.code, 'CONFLICT')
  })

  it('pending appointment cannot be completed directly', async () => {
    const created = await request('/api/appointments', {
      method: 'POST',
      body: bookingPayload(doctorA),
      token: patientAToken,
    })
    const response = await request(
      `/api/appointments/${created.body.data.appointment.id}/complete`,
      { method: 'PATCH', token: doctorAToken },
    )
    assert.equal(response.status, 409)
  })

  it('doctor can complete a confirmed appointment', async () => {
    const created = await request('/api/appointments', {
      method: 'POST',
      body: bookingPayload(doctorA),
      token: patientAToken,
    })
    const id = created.body.data.appointment.id
    await request(`/api/appointments/${id}/confirm`, {
      method: 'PATCH',
      token: doctorAToken,
    })
    const response = await request(`/api/appointments/${id}/complete`, {
      method: 'PATCH',
      token: doctorAToken,
    })
    assert.equal(response.status, 200)
    assert.equal(response.body.data.appointment.status, 'COMPLETED')
  })

  it('completed appointment is immutable', async () => {
    const created = await request('/api/appointments', {
      method: 'POST',
      body: bookingPayload(doctorA),
      token: patientAToken,
    })
    const id = created.body.data.appointment.id
    await request(`/api/appointments/${id}/confirm`, {
      method: 'PATCH',
      token: doctorAToken,
    })
    await request(`/api/appointments/${id}/complete`, {
      method: 'PATCH',
      token: doctorAToken,
    })

    for (const action of ['cancel', 'confirm', 'complete', 'reject']) {
      const attempt = await request(`/api/appointments/${id}/${action}`, {
        method: 'PATCH',
        token: doctorAToken,
      })
      assert.equal(attempt.status, 409)
    }

    const detail = await request(`/api/appointments/${id}`, { token: patientAToken })
    assert.equal(detail.body.data.appointment.status, 'COMPLETED')
  })

  it('cancelled appointment is immutable', async () => {
    const created = await request('/api/appointments', {
      method: 'POST',
      body: bookingPayload(doctorA),
      token: patientAToken,
    })
    const id = created.body.data.appointment.id
    await request(`/api/appointments/${id}/cancel`, {
      method: 'PATCH',
      token: patientAToken,
    })

    const attempt = await request(`/api/appointments/${id}/confirm`, {
      method: 'PATCH',
      token: doctorAToken,
    })
    assert.equal(attempt.status, 409)

    const detail = await request(`/api/appointments/${id}`, { token: patientAToken })
    assert.equal(detail.body.data.appointment.status, 'CANCELLED')
  })

  it('rejected appointment is immutable', async () => {
    const created = await request('/api/appointments', {
      method: 'POST',
      body: bookingPayload(doctorA),
      token: patientAToken,
    })
    const id = created.body.data.appointment.id
    await request(`/api/appointments/${id}/reject`, {
      method: 'PATCH',
      token: doctorAToken,
    })

    const confirmAttempt = await request(`/api/appointments/${id}/confirm`, {
      method: 'PATCH',
      token: doctorAToken,
    })
    assert.equal(confirmAttempt.status, 409)

    const cancelAttempt = await request(`/api/appointments/${id}/cancel`, {
      method: 'PATCH',
      token: patientAToken,
    })
    assert.equal(cancelAttempt.status, 409)

    const detail = await request(`/api/appointments/${id}`, { token: patientAToken })
    assert.equal(detail.body.data.appointment.status, 'REJECTED')
  })

  it('sensitive fields are absent from responses', async () => {
    const created = await request('/api/appointments', {
      method: 'POST',
      body: bookingPayload(doctorA),
      token: patientAToken,
    })
    const id = created.body.data.appointment.id

    const payloads = [
      created.body.data.appointment,
      (await request('/api/appointments/my', { token: patientAToken })).body.data
        .appointments[0],
      (await request(`/api/appointments/${id}`, { token: patientAToken })).body.data
        .appointment,
      (await request(`/api/appointments/${id}`, { token: doctorAToken })).body.data
        .appointment,
    ]

    for (const appointment of payloads) {
      const serialized = JSON.stringify(appointment)
      assert.ok(!serialized.includes('passwordHash'))
      assert.ok(!serialized.includes('"password"'))
      assert.ok(!serialized.includes('"email"'))
      assert.ok(!serialized.includes('"token"'))
      assert.ok(!('passwordHash' in appointment))
      assert.ok(!('email' in appointment.doctor))
      assert.ok(!('email' in appointment.patient))
    }
  })

  it('patient authentication regression: dashboard works and unauthorized is blocked', async () => {
    const withToken = await request('/api/patient/dashboard', {
      token: patientAToken,
    })
    assert.equal(withToken.status, 200)
    assert.equal(withToken.body.success, true)

    const noToken = await request('/api/patient/dashboard')
    assert.equal(noToken.status, 401)
  })

  it('patient module regression: profile update still works', async () => {
    const response = await request('/api/patient/profile', {
      method: 'PUT',
      body: { gender: 'FEMALE', bloodGroup: 'O+' },
      token: patientAToken,
    })
    assert.equal(response.status, 200)
    assert.equal(response.body.data.profile.gender, 'FEMALE')
    assert.equal(response.body.data.profile.bloodGroup, 'O+')
  })

  it('doctor module regression: dashboard still works', async () => {
    const response = await request('/api/doctor/dashboard', {
      token: doctorAToken,
    })
    assert.equal(response.status, 200)
    assert.equal(response.body.success, true)
    assert.equal(response.body.data.verificationStatus, 'APPROVED')
  })

  it('health regression: health endpoint responds', async () => {
    const response = await request('/api/health')
    assert.equal(response.status, 200)
    assert.equal(response.body.success, true)
  })

  it('404 regression: unknown appointment path returns 404', async () => {
    const response = await request('/api/appointments/booking/extra')
    assert.equal(response.status, 404)
    assert.equal(response.body.code, 'ROUTE_NOT_FOUND')
  })

  it('appointment documents store user references only', async () => {
    await request('/api/appointments', {
      method: 'POST',
      body: bookingPayload(doctorA),
      token: patientAToken,
    })

    const stored = await Appointment.findOne().lean()
    assert.equal(stored.patientId.toString(), patientA._id.toString())
    assert.equal(stored.doctorId.toString(), doctorA.user._id.toString())
    assert.equal(stored.status, 'PENDING')
    assert.equal(stored.type, 'VIDEO')
    assert.equal(stored.reason, 'Routine consultation')
    assert.ok(!('passwordHash' in stored))
    assert.ok(!('email' in stored))
  })

  it('appointment list rejects invalid pagination and date query values', async () => {
    const badPage = await request('/api/appointments/my?page=0', {
      token: patientAToken,
    })
    assert.equal(badPage.status, 400)

    const badDate = await request('/api/appointments/my?date=2026-99-99', {
      token: patientAToken,
    })
    assert.equal(badDate.status, 400)

    const badLimit = await request('/api/appointments/doctor?limit=999', {
      token: doctorAToken,
    })
    assert.equal(badLimit.status, 400)
  })
})