const { describe, before, after, beforeEach, it } = require('node:test')
const assert = require('node:assert/strict')
const {
  startServer,
  stopServer,
  clearUsers,
  clearPatientProfiles,
  createUser,
  loginAndGetToken,
  request,
  User,
  PatientProfile,
} = require('./helpers')

function profilePayload(overrides = {}) {
  return {
    dateOfBirth: '2000-01-15',
    gender: 'MALE',
    address: {
      street: 'Example Street',
      city: 'Paralakhemundi',
      state: 'Odisha',
      postalCode: '761200',
      country: 'India',
    },
    emergencyContact: {
      name: 'Emergency Contact',
      relationship: 'Parent',
      phone: '9876543210',
    },
    bloodGroup: 'B+',
    allergies: ['Example Allergy'],
    existingConditions: ['Example Condition'],
    ...overrides,
  }
}

describe('Patient module', () => {
  let patientToken
  let doctorToken
  let pharmacyToken
  let adminToken
  let patientId

  before(async () => {
    await startServer()
  })

  after(async () => {
    await stopServer()
  })

  beforeEach(async () => {
    await clearUsers()
    await clearPatientProfiles()

    const patient = await createUser({ email: 'patient@example.com' })
    patientId = patient._id.toString()
    patientToken = await loginAndGetToken('patient@example.com')

    const doctor = await createUser({
      email: 'doctor@example.com',
      role: 'DOCTOR',
    })
    doctorToken = await loginAndGetToken('doctor@example.com')

    const pharmacy = await createUser({
      email: 'pharmacy@example.com',
      role: 'PHARMACY',
    })
    pharmacyToken = await loginAndGetToken('pharmacy@example.com')

    const admin = await createUser({
      email: 'admin@example.com',
      role: 'ADMIN',
    })
    adminToken = await loginAndGetToken('admin@example.com')
  })

  describe('Patient profile', () => {
    it('allows an authenticated PATIENT to create a profile', async () => {
      const response = await request('/api/patient/profile', {
        method: 'PUT',
        token: patientToken,
        body: profilePayload(),
      })

      assert.equal(response.status, 200)
      assert.equal(response.body.success, true)
      assert.equal(response.body.data.user.id, patientId)
      assert.equal(response.body.data.user.role, 'PATIENT')
      assert.equal(response.body.data.profile.gender, 'MALE')
      assert.equal(response.body.data.profile.bloodGroup, 'B+')
      assert.equal(response.body.data.profile.dateOfBirth, '2000-01-15')
      assert.deepEqual(response.body.data.profile.allergies, ['Example Allergy'])
      assert.equal(
        response.body.data.profile.address.city,
        'Paralakhemundi',
      )
      assert.equal(response.body.data.profileCompletion, 100)

      const stored = await PatientProfile.findOne({ userId: patientId })
      assert.ok(stored)
      assert.equal(stored.userId.toString(), patientId)
    })

    it('allows an authenticated PATIENT to retrieve their own profile', async () => {
      await request('/api/patient/profile', {
        method: 'PUT',
        token: patientToken,
        body: profilePayload(),
      })

      const response = await request('/api/patient/profile', { token: patientToken })

      assert.equal(response.status, 200)
      assert.equal(response.body.success, true)
      assert.equal(response.body.data.user.id, patientId)
      assert.equal(response.body.data.profile.gender, 'MALE')
      assert.equal(response.body.data.profileCompletion, 100)
    })

    it('allows an authenticated PATIENT to update their own profile', async () => {
      await request('/api/patient/profile', {
        method: 'PUT',
        token: patientToken,
        body: profilePayload(),
      })

      const response = await request('/api/patient/profile', {
        method: 'PUT',
        token: patientToken,
        body: {
          gender: 'FEMALE',
          bloodGroup: 'O+',
          address: { postalCode: '761201' },
        },
      })

      assert.equal(response.status, 200)
      assert.equal(response.body.data.profile.gender, 'FEMALE')
      assert.equal(response.body.data.profile.bloodGroup, 'O+')
      assert.equal(response.body.data.profile.address.postalCode, '761201')

      const stored = await PatientProfile.findOne({ userId: patientId })
      assert.equal(stored.gender, 'FEMALE')
      assert.equal(stored.bloodGroup, 'O+')
      assert.equal(stored.address.postalCode, '761201')
      assert.equal(stored.address.city, 'Paralakhemundi')
    })

    it('does not create a duplicate profile', async () => {
      await request('/api/patient/profile', {
        method: 'PUT',
        token: patientToken,
        body: profilePayload(),
      })
      await request('/api/patient/profile', {
        method: 'PUT',
        token: patientToken,
        body: profilePayload({ gender: 'FEMALE' }),
      })

      const count = await PatientProfile.countDocuments({ userId: patientId })
      assert.equal(count, 1)
    })

    it("keeps each patient's data isolated from other patients", async () => {
      await createUser({ email: 'patient-b@example.com' })
      const patientBToken = await loginAndGetToken('patient-b@example.com')

      await request('/api/patient/profile', {
        method: 'PUT',
        token: patientToken,
        body: profilePayload({ gender: 'MALE' }),
      })
      await request('/api/patient/profile', {
        method: 'PUT',
        token: patientBToken,
        body: profilePayload({ gender: 'FEMALE' }),
      })

      const own = await request('/api/patient/profile', { token: patientToken })
      const other = await request('/api/patient/profile', { token: patientBToken })

      assert.equal(own.body.data.profile.gender, 'MALE')
      assert.equal(other.body.data.profile.gender, 'FEMALE')
    })

    it('rejects an unauthenticated request with 401', async () => {
      const response = await request('/api/patient/profile', { method: 'PUT', body: profilePayload() })
      assert.equal(response.status, 401)
      assert.equal(response.body.success, false)
      assert.equal(response.body.code, 'UNAUTHORIZED')
    })

    it('blocks DOCTOR with 403', async () => {
      const response = await request('/api/patient/profile', { token: doctorToken })
      assert.equal(response.status, 403)
      assert.equal(response.body.code, 'FORBIDDEN')
    })

    it('blocks PHARMACY with 403', async () => {
      const response = await request('/api/patient/profile', { token: pharmacyToken })
      assert.equal(response.status, 403)
      assert.equal(response.body.code, 'FORBIDDEN')
    })

    it('blocks ADMIN with 403', async () => {
      const response = await request('/api/patient/profile', { token: adminToken })
      assert.equal(response.status, 403)
      assert.equal(response.body.code, 'FORBIDDEN')
    })

    it('rejects an invalid gender', async () => {
      const response = await request('/api/patient/profile', {
        method: 'PUT',
        token: patientToken,
        body: profilePayload({ gender: 'ALIEN' }),
      })

      assert.equal(response.status, 400)
      assert.equal(response.body.code, 'VALIDATION_ERROR')
      assert.ok(response.body.details.some((d) => d.field === 'gender'))

      const count = await PatientProfile.countDocuments({ userId: patientId })
      assert.equal(count, 0)
    })

    it('rejects an invalid blood group', async () => {
      const response = await request('/api/patient/profile', {
        method: 'PUT',
        token: patientToken,
        body: profilePayload({ bloodGroup: 'Z+' }),
      })

      assert.equal(response.status, 400)
      assert.equal(response.body.code, 'VALIDATION_ERROR')
      assert.ok(response.body.details.some((d) => d.field === 'bloodGroup'))
    })

    it('rejects a future date of birth', async () => {
      const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)
        .toISOString()
        .slice(0, 10)
      const response = await request('/api/patient/profile', {
        method: 'PUT',
        token: patientToken,
        body: profilePayload({ dateOfBirth: future }),
      })

      assert.equal(response.status, 400)
      assert.equal(response.body.code, 'VALIDATION_ERROR')
      assert.ok(response.body.details.some((d) => d.field === 'dateOfBirth'))
    })

    it('rejects an invalid emergency contact phone', async () => {
      const response = await request('/api/patient/profile', {
        method: 'PUT',
        token: patientToken,
        body: profilePayload({
          emergencyContact: { phone: 'not-a-phone' },
        }),
      })

      assert.equal(response.status, 400)
      assert.ok(
        response.body.details.some((d) => d.field === 'emergencyContact.phone'),
      )
    })

    it('rejects malformed arrays', async () => {
      const notArray = await request('/api/patient/profile', {
        method: 'PUT',
        token: patientToken,
        body: profilePayload({ allergies: 'peanuts' }),
      })
      assert.equal(notArray.status, 400)
      assert.ok(notArray.body.details.some((d) => d.field === 'allergies'))

      const badItems = await request('/api/patient/profile', {
        method: 'PUT',
        token: patientToken,
        body: profilePayload({ existingConditions: [123] }),
      })
      assert.equal(badItems.status, 400)
      assert.ok(
        badItems.body.details.some((d) => d.field === 'existingConditions'),
      )
    })

    it('never exposes passwordHash in any response', async () => {
      const created = await request('/api/patient/profile', {
        method: 'PUT',
        token: patientToken,
        body: profilePayload(),
      })
      assert.equal(JSON.stringify(created.body).includes('passwordHash'), false)

      const fetched = await request('/api/patient/profile', { token: patientToken })
      assert.equal(JSON.stringify(fetched.body).includes('passwordHash'), false)
      assert.equal(fetched.body.data.user.passwordHash, undefined)
    })
  })

  describe('Patient dashboard', () => {
    it('returns safe user data with the dashboard', async () => {
      const response = await request('/api/patient/dashboard', { token: patientToken })

      assert.equal(response.status, 200)
      assert.equal(response.body.success, true)
      assert.equal(response.body.data.user.id, patientId)
      assert.equal(response.body.data.user.email, 'patient@example.com')
      assert.equal(response.body.data.user.passwordHash, undefined)
      assert.equal(JSON.stringify(response.body).includes('passwordHash'), false)
    })

    it('calculates profile completion', async () => {
      const empty = await request('/api/patient/dashboard', { token: patientToken })
      assert.equal(empty.body.data.profileCompletion, 0)
      assert.equal(empty.body.data.profile, null)

      await request('/api/patient/profile', {
        method: 'PUT',
        token: patientToken,
        body: { gender: 'FEMALE', bloodGroup: 'O+' },
      })
      const partial = await request('/api/patient/dashboard', { token: patientToken })
      assert.equal(partial.body.data.profileCompletion, 40)

      await request('/api/patient/profile', {
        method: 'PUT',
        token: patientToken,
        body: profilePayload(),
      })
      const complete = await request('/api/patient/dashboard', { token: patientToken })
      assert.equal(complete.body.data.profileCompletion, 100)
    })

    it('keeps future module counts at 0 without fake records', async () => {
      const response = await request('/api/patient/dashboard', { token: patientToken })

      assert.deepEqual(response.body.data.stats, {
        upcomingAppointments: 0,
        completedConsultations: 0,
        prescriptions: 0,
        medicalRecords: 0,
        orders: 0,
      })
    })

    it('blocks non-patient roles from the dashboard', async () => {
      assert.equal(
        (await request('/api/patient/dashboard', { token: doctorToken })).status,
        403,
      )
      assert.equal(
        (await request('/api/patient/dashboard', { token: pharmacyToken })).status,
        403,
      )
      assert.equal(
        (await request('/api/patient/dashboard', { token: adminToken })).status,
        403,
      )
      assert.equal(
        (await request('/api/patient/dashboard')).status,
        401,
      )
    })
  })

  describe('Regression', () => {
    it('still supports /api/auth/register', async () => {
      const response = await request('/api/auth/register', {
        method: 'POST',
        body: {
          name: 'Fresh Patient',
          email: 'fresh@example.com',
          phone: '8123456789',
          password: 'StrongPassword123',
          role: 'PATIENT',
        },
      })
      assert.equal(response.status, 201)
      assert.equal(response.body.data.user.role, 'PATIENT')
    })

    it('still supports /api/auth/login', async () => {
      const response = await request('/api/auth/login', {
        method: 'POST',
        body: { email: 'patient@example.com', password: 'Password123' },
      })
      assert.equal(response.status, 200)
      assert.ok(response.body.data.token)
    })

    it('still supports /api/auth/me', async () => {
      const response = await request('/api/auth/me', { token: patientToken })
      assert.equal(response.status, 200)
      assert.equal(response.body.data.user.id, patientId)
    })

    it('still supports /api/health', async () => {
      const response = await request('/api/health')
      assert.equal(response.status, 200)
      assert.equal(response.body.data.status, 'ok')
    })

    it('still returns the 404 contract for unknown routes', async () => {
      const response = await request('/api/does-not-exist')
      assert.equal(response.status, 404)
      assert.equal(response.body.success, false)
      assert.equal(response.body.code, 'ROUTE_NOT_FOUND')
    })

    it('does not pollute the User document with patient fields', async () => {
      await request('/api/patient/profile', {
        method: 'PUT',
        token: patientToken,
        body: profilePayload(),
      })

      const user = await User.findById(patientId)
      const keys = Object.keys(user.toObject())
      for (const patientField of [
        'dateOfBirth',
        'gender',
        'address',
        'bloodGroup',
        'allergies',
      ]) {
        assert.equal(keys.includes(patientField), false)
      }
    })
  })
})