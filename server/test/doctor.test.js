const { describe, before, after, beforeEach, it } = require('node:test')
const assert = require('node:assert/strict')
const {
  startServer,
  stopServer,
  clearUsers,
  clearPatientProfiles,
  clearDoctorProfiles,
  createUser,
  loginAndGetToken,
  request,
  User,
  PatientProfile,
  DoctorProfile,
} = require('./helpers')

function doctorPayload(overrides = {}) {
  return {
    specialization: 'General Physician',
    qualification: 'MBBS',
    experience: 5,
    registrationNumber: 'MC-12345',
    consultationFee: 500,
    bio: 'General physician with five years of experience.',
    clinicName: 'Aarogya Clinic',
    clinicAddress: {
      street: 'Main Road',
      city: 'Berhampur',
      state: 'Odisha',
      postalCode: '760001',
      country: 'India',
    },
    languages: ['English', 'Hindi', 'Odia'],
    availability: [
      { dayOfWeek: 'MONDAY', enabled: true, startTime: '10:00', endTime: '13:00' },
      { dayOfWeek: 'TUESDAY', enabled: false },
    ],
    ...overrides,
  }
}

describe('Doctor module', () => {
  let doctorToken
  let doctorBToken
  let doctorId
  let doctorBId
  let patientToken
  let pharmacyToken
  let adminToken

  before(async () => {
    await startServer()
  })

  after(async () => {
    await stopServer()
  })

  beforeEach(async () => {
    await clearUsers()
    await clearPatientProfiles()
    await clearDoctorProfiles()

    const doctorA = await createUser({ email: 'doctor-a@example.com', role: 'DOCTOR' })
    doctorId = doctorA._id.toString()
    doctorToken = await loginAndGetToken('doctor-a@example.com')

    const doctorB = await createUser({ email: 'doctor-b@example.com', role: 'DOCTOR' })
    doctorBId = doctorB._id.toString()
    doctorBToken = await loginAndGetToken('doctor-b@example.com')

    const patient = await createUser({ email: 'patient@example.com' })
    patientToken = await loginAndGetToken('patient@example.com')

    const pharmacy = await createUser({ email: 'pharmacy@example.com', role: 'PHARMACY' })
    pharmacyToken = await loginAndGetToken('pharmacy@example.com')

    const admin = await createUser({ email: 'admin@example.com', role: 'ADMIN' })
    adminToken = await loginAndGetToken('admin@example.com')
  })

  describe('Doctor profile', () => {
    it('allows a DOCTOR to create a profile', async () => {
      const response = await request('/api/doctor/profile', {
        method: 'PUT',
        token: doctorToken,
        body: doctorPayload(),
      })

      assert.equal(response.status, 200)
      assert.equal(response.body.success, true)
      assert.equal(response.body.data.user.id, doctorId)
      assert.equal(response.body.data.user.role, 'DOCTOR')
      assert.equal(response.body.data.profile.specialization, 'General Physician')
      assert.equal(response.body.data.profile.experience, 5)
      assert.equal(response.body.data.profile.consultationFee, 500)
      assert.deepEqual(response.body.data.profile.languages, ['English', 'Hindi', 'Odia'])
      assert.equal(response.body.data.profile.availability.length, 2)
      assert.equal(response.body.data.profile.availability[0].startTime, '10:00')
      assert.equal(response.body.data.profileCompletion, 100)

      const stored = await DoctorProfile.findOne({ userId: doctorId })
      assert.ok(stored)
      assert.equal(stored.userId.toString(), doctorId)
    })

    it('allows a DOCTOR to retrieve their own profile', async () => {
      await request('/api/doctor/profile', {
        method: 'PUT',
        token: doctorToken,
        body: doctorPayload(),
      })

      const response = await request('/api/doctor/profile', { token: doctorToken })

      assert.equal(response.status, 200)
      assert.equal(response.body.data.user.id, doctorId)
      assert.equal(response.body.data.profile.qualification, 'MBBS')
      assert.equal(response.body.data.profile.clinicName, 'Aarogya Clinic')
    })

    it('allows a DOCTOR to update their own profile', async () => {
      await request('/api/doctor/profile', {
        method: 'PUT',
        token: doctorToken,
        body: doctorPayload(),
      })

      const response = await request('/api/doctor/profile', {
        method: 'PUT',
        token: doctorToken,
        body: {
          consultationFee: 700,
          bio: 'Updated bio.',
          experience: 6,
        },
      })

      assert.equal(response.status, 200)
      assert.equal(response.body.data.profile.consultationFee, 700)
      assert.equal(response.body.data.profile.bio, 'Updated bio.')
      assert.equal(response.body.data.profile.experience, 6)
      assert.equal(response.body.data.profile.specialization, 'General Physician')

      const stored = await DoctorProfile.findOne({ userId: doctorId })
      assert.equal(stored.consultationFee, 700)
      assert.equal(stored.specialization, 'General Physician')
    })

    it('does not create a duplicate profile', async () => {
      await request('/api/doctor/profile', {
        method: 'PUT',
        token: doctorToken,
        body: doctorPayload(),
      })
      await request('/api/doctor/profile', {
        method: 'PUT',
        token: doctorToken,
        body: doctorPayload({ consultationFee: 900 }),
      })

      const count = await DoctorProfile.countDocuments({ userId: doctorId })
      assert.equal(count, 1)
    })

    it('blocks PATIENT with 403', async () => {
      const response = await request('/api/doctor/profile', { token: patientToken })
      assert.equal(response.status, 403)
      assert.equal(response.body.code, 'FORBIDDEN')
    })

    it('blocks PHARMACY with 403', async () => {
      const response = await request('/api/doctor/profile', { token: pharmacyToken })
      assert.equal(response.status, 403)
      assert.equal(response.body.code, 'FORBIDDEN')
    })

    it('blocks ADMIN with 403', async () => {
      const response = await request('/api/doctor/profile', { token: adminToken })
      assert.equal(response.status, 403)
      assert.equal(response.body.code, 'FORBIDDEN')
    })

    it('rejects an unauthenticated request with 401', async () => {
      const response = await request('/api/doctor/profile', {
        method: 'PUT',
        body: doctorPayload(),
      })
      assert.equal(response.status, 401)
      assert.equal(response.body.code, 'UNAUTHORIZED')
    })

    it("keeps each doctor's data isolated from other doctors", async () => {
      await request('/api/doctor/profile', {
        method: 'PUT',
        token: doctorToken,
        body: doctorPayload({ specialization: 'Cardiologist' }),
      })
      await request('/api/doctor/profile', {
        method: 'PUT',
        token: doctorBToken,
        body: doctorPayload({ specialization: 'Dermatologist' }),
      })

      const own = await request('/api/doctor/profile', { token: doctorToken })
      const other = await request('/api/doctor/profile', { token: doctorBToken })

      assert.equal(own.body.data.profile.specialization, 'Cardiologist')
      assert.equal(other.body.data.profile.specialization, 'Dermatologist')
    })
  })

  describe('Doctor profile validation', () => {
    it('rejects a missing specialization', async () => {
      const response = await request('/api/doctor/profile', {
        method: 'PUT',
        token: doctorToken,
        body: { qualification: 'MBBS', registrationNumber: 'MC-1' },
      })

      assert.equal(response.status, 400)
      assert.equal(response.body.code, 'VALIDATION_ERROR')
      assert.ok(response.body.details.some((d) => d.field === 'specialization'))
    })

    it('rejects a missing qualification', async () => {
      const response = await request('/api/doctor/profile', {
        method: 'PUT',
        token: doctorToken,
        body: doctorPayload({ qualification: null }),
      })

      assert.equal(response.status, 400)
      assert.ok(response.body.details.some((d) => d.field === 'qualification'))
    })

    it('rejects an invalid experience', async () => {
      const response = await request('/api/doctor/profile', {
        method: 'PUT',
        token: doctorToken,
        body: doctorPayload({ experience: 'many' }),
      })
      assert.equal(response.status, 400)
      assert.ok(response.body.details.some((d) => d.field === 'experience'))
    })

    it('rejects a negative experience', async () => {
      const response = await request('/api/doctor/profile', {
        method: 'PUT',
        token: doctorToken,
        body: doctorPayload({ experience: -2 }),
      })
      assert.equal(response.status, 400)
      assert.ok(response.body.details.some((d) => d.field === 'experience'))
    })

    it('rejects an invalid consultation fee', async () => {
      const response = await request('/api/doctor/profile', {
        method: 'PUT',
        token: doctorToken,
        body: doctorPayload({ consultationFee: 'free' }),
      })
      assert.equal(response.status, 400)
      assert.ok(response.body.details.some((d) => d.field === 'consultationFee'))
    })

    it('rejects a negative consultation fee', async () => {
      const response = await request('/api/doctor/profile', {
        method: 'PUT',
        token: doctorToken,
        body: doctorPayload({ consultationFee: -100 }),
      })
      assert.equal(response.status, 400)
      assert.ok(response.body.details.some((d) => d.field === 'consultationFee'))
    })

    it('rejects an invalid availability day', async () => {
      const response = await request('/api/doctor/profile', {
        method: 'PUT',
        token: doctorToken,
        body: doctorPayload({
          availability: [{ dayOfWeek: 'FUNDAY', enabled: true, startTime: '10:00', endTime: '12:00' }],
        }),
      })
      assert.equal(response.status, 400)
      assert.ok(response.body.details.some((d) => d.field === 'availability.dayOfWeek'))
    })

    it('rejects an invalid time format', async () => {
      const response = await request('/api/doctor/profile', {
        method: 'PUT',
        token: doctorToken,
        body: doctorPayload({
          availability: [{ dayOfWeek: 'MONDAY', enabled: true, startTime: '10am', endTime: '12:00' }],
        }),
      })
      assert.equal(response.status, 400)
      assert.ok(response.body.details.some((d) => d.field === 'availability.startTime'))
    })

    it('rejects startTime not earlier than endTime', async () => {
      const response = await request('/api/doctor/profile', {
        method: 'PUT',
        token: doctorToken,
        body: doctorPayload({
          availability: [{ dayOfWeek: 'MONDAY', enabled: true, startTime: '14:00', endTime: '10:00' }],
        }),
      })
      assert.equal(response.status, 400)
      assert.ok(response.body.details.some((d) => d.field === 'availability'))
    })

    it('rejects a duplicate availability day', async () => {
      const response = await request('/api/doctor/profile', {
        method: 'PUT',
        token: doctorToken,
        body: doctorPayload({
          availability: [
            { dayOfWeek: 'MONDAY', enabled: true, startTime: '10:00', endTime: '12:00' },
            { dayOfWeek: 'MONDAY', enabled: false },
          ],
        }),
      })
      assert.equal(response.status, 400)
      assert.ok(response.body.details.some((d) => d.field === 'availability.dayOfWeek'))
    })

    it('rejects an invalid language array', async () => {
      const notArray = await request('/api/doctor/profile', {
        method: 'PUT',
        token: doctorToken,
        body: doctorPayload({ languages: 'English' }),
      })
      assert.equal(notArray.status, 400)
      assert.ok(notArray.body.details.some((d) => d.field === 'languages'))

      const badItem = await request('/api/doctor/profile', {
        method: 'PUT',
        token: doctorToken,
        body: doctorPayload({ languages: ['English', 42] }),
      })
      assert.equal(badItem.status, 400)
      assert.ok(badItem.body.details.some((d) => d.field === 'languages'))
    })
  })

  describe('Verification status', () => {
    it('defaults a new doctor profile to PENDING', async () => {
      const response = await request('/api/doctor/profile', {
        method: 'PUT',
        token: doctorToken,
        body: doctorPayload(),
      })

      assert.equal(response.status, 200)
      assert.equal(response.body.data.profile.verificationStatus, 'PENDING')

      const stored = await DoctorProfile.findOne({ userId: doctorId })
      assert.equal(stored.verificationStatus, 'PENDING')
    })

    it('blocks a doctor from self-approving', async () => {
      await request('/api/doctor/profile', {
        method: 'PUT',
        token: doctorToken,
        body: doctorPayload(),
      })

      const approve = await request('/api/doctor/profile', {
        method: 'PUT',
        token: doctorToken,
        body: { verificationStatus: 'APPROVED' },
      })
      assert.equal(approve.status, 403)
      assert.equal(approve.body.code, 'FORBIDDEN')

      const reject = await request('/api/doctor/profile', {
        method: 'PUT',
        token: doctorToken,
        body: { verificationStatus: 'REJECTED' },
      })
      assert.equal(reject.status, 403)

      const stored = await DoctorProfile.findOne({ userId: doctorId })
      assert.equal(stored.verificationStatus, 'PENDING')
    })
  })

  describe('Doctor dashboard', () => {
    it('returns safe user data and verification status', async () => {
      await request('/api/doctor/profile', {
        method: 'PUT',
        token: doctorToken,
        body: doctorPayload(),
      })

      const response = await request('/api/doctor/dashboard', { token: doctorToken })

      assert.equal(response.status, 200)
      assert.equal(response.body.data.user.id, doctorId)
      assert.equal(response.body.data.user.email, 'doctor-a@example.com')
      assert.equal(response.body.data.user.passwordHash, undefined)
      assert.equal(response.body.data.verificationStatus, 'PENDING')
    })

    it('calculates and returns profile completion', async () => {
      const empty = await request('/api/doctor/dashboard', { token: doctorToken })
      assert.equal(empty.body.data.profileCompletion, 0)
      assert.equal(empty.body.data.profile, null)

      await request('/api/doctor/profile', {
        method: 'PUT',
        token: doctorToken,
        body: {
          specialization: 'General Physician',
          qualification: 'MBBS',
          experience: 5,
          registrationNumber: 'MC-12345',
          consultationFee: 500,
        },
      })
      const partial = await request('/api/doctor/dashboard', { token: doctorToken })
      assert.equal(partial.body.data.profileCompletion, 50)

      await request('/api/doctor/profile', {
        method: 'PUT',
        token: doctorToken,
        body: doctorPayload(),
      })
      const complete = await request('/api/doctor/dashboard', { token: doctorToken })
      assert.equal(complete.body.data.profileCompletion, 100)
    })

    it('keeps future module counts at 0 without fake records', async () => {
      const response = await request('/api/doctor/dashboard', { token: doctorToken })

      assert.deepEqual(response.body.data.stats, {
        upcomingAppointments: 0,
        completedConsultations: 0,
        prescriptionsCreated: 0,
      })
    })

    it('blocks non-doctor roles from the dashboard', async () => {
      assert.equal((await request('/api/doctor/dashboard', { token: patientToken })).status, 403)
      assert.equal((await request('/api/doctor/dashboard', { token: pharmacyToken })).status, 403)
      assert.equal((await request('/api/doctor/dashboard', { token: adminToken })).status, 403)
      assert.equal((await request('/api/doctor/dashboard')).status, 401)
    })
  })

  describe('Security', () => {
    it('never exposes passwordHash in any response', async () => {
      const created = await request('/api/doctor/profile', {
        method: 'PUT',
        token: doctorToken,
        body: doctorPayload(),
      })
      assert.equal(JSON.stringify(created.body).includes('passwordHash'), false)

      const fetched = await request('/api/doctor/profile', { token: doctorToken })
      assert.equal(JSON.stringify(fetched.body).includes('passwordHash'), false)

      const dashboard = await request('/api/doctor/dashboard', { token: doctorToken })
      assert.equal(JSON.stringify(dashboard.body).includes('passwordHash'), false)
      assert.equal(JSON.stringify(dashboard.body).includes('token'), false)
    })

    it('ignores a client-provided userId for ownership', async () => {
      await request('/api/doctor/profile', {
        method: 'PUT',
        token: doctorToken,
        body: doctorPayload({ userId: doctorBId }),
      })

      const stored = await DoctorProfile.findOne({ userId: doctorId })
      assert.equal(stored.userId.toString(), doctorId)

      const count = await DoctorProfile.countDocuments({ userId: doctorBId })
      assert.equal(count, 0)
    })

    it('does not pollute the User document with doctor fields', async () => {
      await request('/api/doctor/profile', {
        method: 'PUT',
        token: doctorToken,
        body: doctorPayload(),
      })

      const user = await User.findById(doctorId)
      const keys = Object.keys(user.toObject())
      for (const doctorField of [
        'specialization',
        'qualification',
        'registrationNumber',
        'availability',
        'verificationStatus',
      ]) {
        assert.equal(keys.includes(doctorField), false)
      }
    })
  })

  describe('Regression', () => {
    it('keeps patient APIs working', async () => {
      const created = await request('/api/patient/profile', {
        method: 'PUT',
        token: patientToken,
        body: { gender: 'MALE' },
      })
      assert.equal(created.status, 200)
      assert.equal(created.body.data.profile.gender, 'MALE')

      const patientCount = await PatientProfile.countDocuments()
      assert.equal(patientCount, 1)
    })

    it('keeps authentication working', async () => {
      const response = await request('/api/auth/me', { token: doctorToken })
      assert.equal(response.status, 200)
      assert.equal(response.body.data.user.role, 'DOCTOR')
    })

    it('keeps /api/health working', async () => {
      const response = await request('/api/health')
      assert.equal(response.status, 200)
      assert.equal(response.body.data.status, 'ok')
    })

    it('keeps the 404 contract for unknown routes', async () => {
      const response = await request('/api/nope')
      assert.equal(response.status, 404)
      assert.equal(response.body.code, 'ROUTE_NOT_FOUND')
    })
  })
})