const { describe, before, after, beforeEach, it } = require('node:test')
const assert = require('node:assert/strict')
const {
  startServer,
  stopServer,
  clearUsers,
  clearPharmacies,
  createUser,
  loginAndGetToken,
  request,
  Pharmacy,
} = require('./helpers')

function pharmacyPayload(overrides = {}) {
  return {
    pharmacyName: 'Aarogya Pharmacy',
    pharmacistName: 'Ravi Kumar',
    licenseNumber: 'OD-PH-2026-001',
    phone: '9876543210',
    email: 'contact@aarogyapharmacy.in',
    address: 'Main Road',
    city: 'Berhampur',
    state: 'Odisha',
    pincode: '760001',
    description: 'A neighbourhood pharmacy serving the local community.',
    openingTime: '09:00',
    closingTime: '21:00',
    ...overrides,
  }
}

describe('Pharmacy module', () => {
  let pharmacyAToken
  let pharmacyBToken
  let pharmacyAId
  let pharmacyBId
  let patientToken
  let doctorToken
  let adminToken

  before(async () => {
    await startServer()
  })

  after(async () => {
    await stopServer()
  })

  beforeEach(async () => {
    await clearUsers()
    await clearPharmacies()

    const pharmacyA = await createUser({
      name: 'Aarogya Pharmacy',
      email: 'pharmacy-a@example.com',
      role: 'PHARMACY',
    })
    pharmacyAId = pharmacyA._id.toString()
    pharmacyAToken = await loginAndGetToken('pharmacy-a@example.com')

    const pharmacyB = await createUser({
      name: 'Wellness Pharmacy',
      email: 'pharmacy-b@example.com',
      role: 'PHARMACY',
    })
    pharmacyBId = pharmacyB._id.toString()
    pharmacyBToken = await loginAndGetToken('pharmacy-b@example.com')

    await createUser({ email: 'patient@example.com' })
    patientToken = await loginAndGetToken('patient@example.com')

    await createUser({ email: 'doctor@example.com', role: 'DOCTOR' })
    doctorToken = await loginAndGetToken('doctor@example.com')

    await createUser({ email: 'admin@example.com', role: 'ADMIN' })
    adminToken = await loginAndGetToken('admin@example.com')
  })

  describe('authentication and roles', () => {
    it('rejects an unauthenticated profile request', async () => {
      const response = await request('/api/pharmacy/profile')
      assert.equal(response.status, 401)
      assert.equal(response.body.code, 'UNAUTHORIZED')
    })

    it('rejects an unauthenticated profile creation', async () => {
      const response = await request('/api/pharmacy/profile', {
        method: 'POST',
        body: pharmacyPayload(),
      })
      assert.equal(response.status, 401)
    })

    it('blocks PATIENT accounts', async () => {
      const response = await request('/api/pharmacy/profile', {
        token: patientToken,
      })
      assert.equal(response.status, 403)
      assert.equal(response.body.code, 'FORBIDDEN')
    })

    it('blocks DOCTOR accounts', async () => {
      const response = await request('/api/pharmacy/profile', {
        token: doctorToken,
      })
      assert.equal(response.status, 403)
    })

    it('blocks ADMIN accounts from pharmacy-owner routes', async () => {
      const response = await request('/api/pharmacy/profile', {
        method: 'POST',
        token: adminToken,
        body: pharmacyPayload(),
      })
      assert.equal(response.status, 403)
    })

    it('lets a PHARMACY account read its empty profile', async () => {
      const response = await request('/api/pharmacy/profile', {
        token: pharmacyAToken,
      })
      assert.equal(response.status, 200)
      assert.equal(response.body.success, true)
      assert.equal(response.body.data.user.id, pharmacyAId)
      assert.equal(response.body.data.user.role, 'PHARMACY')
      assert.equal(response.body.data.profile, null)
    })
  })

  describe('profile creation', () => {
    it('lets a pharmacy create its own profile', async () => {
      const response = await request('/api/pharmacy/profile', {
        method: 'POST',
        token: pharmacyAToken,
        body: pharmacyPayload(),
      })

      assert.equal(response.status, 201)
      assert.equal(response.body.success, true)
      assert.equal(response.body.data.user.id, pharmacyAId)
      assert.equal(response.body.data.profile.pharmacyName, 'Aarogya Pharmacy')
      assert.equal(response.body.data.profile.pharmacistName, 'Ravi Kumar')
      assert.equal(response.body.data.profile.licenseNumber, 'OD-PH-2026-001')
      assert.equal(response.body.data.profile.verificationStatus, 'PENDING')
      assert.equal(response.body.data.profile.isActive, true)
      assert.equal(response.body.data.profile.openingTime, '09:00')
      assert.equal(response.body.data.profile.closingTime, '21:00')

      const stored = await Pharmacy.findOne({ userId: pharmacyAId })
      assert.ok(stored)
      assert.equal(stored.userId.toString(), pharmacyAId)
      assert.equal(stored.verificationStatus, 'PENDING')
    })

    it('rejects a duplicate profile for the same pharmacy account', async () => {
      await request('/api/pharmacy/profile', {
        method: 'POST',
        token: pharmacyAToken,
        body: pharmacyPayload(),
      })

      const response = await request('/api/pharmacy/profile', {
        method: 'POST',
        token: pharmacyAToken,
        body: pharmacyPayload({ licenseNumber: 'OD-PH-2026-999' }),
      })

      assert.equal(response.status, 409)
      assert.equal(response.body.code, 'PROFILE_EXISTS')
    })

    it('rejects a duplicate license number for another pharmacy', async () => {
      await request('/api/pharmacy/profile', {
        method: 'POST',
        token: pharmacyAToken,
        body: pharmacyPayload(),
      })

      const response = await request('/api/pharmacy/profile', {
        method: 'POST',
        token: pharmacyBToken,
        body: pharmacyPayload({ pharmacyName: 'Wellness Pharmacy' }),
      })

      assert.equal(response.status, 409)
      assert.equal(response.body.code, 'LICENSE_TAKEN')
    })

    const requiredFields = [
      'pharmacyName',
      'pharmacistName',
      'licenseNumber',
      'phone',
      'address',
      'city',
      'state',
      'pincode',
    ]

    for (const field of requiredFields) {
      it(`rejects a missing ${field}`, async () => {
        const payload = pharmacyPayload()
        delete payload[field]

        const response = await request('/api/pharmacy/profile', {
          method: 'POST',
          token: pharmacyAToken,
          body: payload,
        })

        assert.equal(response.status, 400)
        assert.equal(response.body.code, 'VALIDATION_ERROR')
        assert.ok(
          response.body.details.some((detail) => detail.field === field),
          `expected a validation detail for ${field}`,
        )
      })
    }

    it('rejects an invalid pincode', async () => {
      const response = await request('/api/pharmacy/profile', {
        method: 'POST',
        token: pharmacyAToken,
        body: pharmacyPayload({ pincode: '12345' }),
      })

      assert.equal(response.status, 400)
      assert.ok(response.body.details.some((detail) => detail.field === 'pincode'))
    })

    it('rejects a non-Indian six-digit pincode', async () => {
      const response = await request('/api/pharmacy/profile', {
        method: 'POST',
        token: pharmacyAToken,
        body: pharmacyPayload({ pincode: '012345' }),
      })

      assert.equal(response.status, 400)
      assert.ok(response.body.details.some((detail) => detail.field === 'pincode'))
    })

    it('rejects an invalid phone number', async () => {
      const response = await request('/api/pharmacy/profile', {
        method: 'POST',
        token: pharmacyAToken,
        body: pharmacyPayload({ phone: 'abc' }),
      })

      assert.equal(response.status, 400)
      assert.ok(response.body.details.some((detail) => detail.field === 'phone'))
    })

    it('rejects an invalid opening time', async () => {
      const response = await request('/api/pharmacy/profile', {
        method: 'POST',
        token: pharmacyAToken,
        body: pharmacyPayload({ openingTime: '9am' }),
      })

      assert.equal(response.status, 400)
      assert.ok(
        response.body.details.some((detail) => detail.field === 'openingTime'),
      )
    })

    it('rejects an invalid closing time', async () => {
      const response = await request('/api/pharmacy/profile', {
        method: 'POST',
        token: pharmacyAToken,
        body: pharmacyPayload({ closingTime: '25:00' }),
      })

      assert.equal(response.status, 400)
      assert.ok(
        response.body.details.some((detail) => detail.field === 'closingTime'),
      )
    })

    it('rejects an opening time later than the closing time', async () => {
      const response = await request('/api/pharmacy/profile', {
        method: 'POST',
        token: pharmacyAToken,
        body: pharmacyPayload({ openingTime: '22:00', closingTime: '08:00' }),
      })

      assert.equal(response.status, 400)
      assert.ok(
        response.body.details.some((detail) => detail.field === 'openingTime'),
      )
    })

    it('rejects only one of opening or closing time', async () => {
      const response = await request('/api/pharmacy/profile', {
        method: 'POST',
        token: pharmacyAToken,
        body: pharmacyPayload({ closingTime: null }),
      })

      assert.equal(response.status, 400)
      assert.ok(
        response.body.details.some((detail) => detail.field === 'openingTime'),
      )
    })

    it('rejects an invalid email when one is supplied', async () => {
      const response = await request('/api/pharmacy/profile', {
        method: 'POST',
        token: pharmacyAToken,
        body: pharmacyPayload({ email: 'not-an-email' }),
      })

      assert.equal(response.status, 400)
      assert.ok(response.body.details.some((detail) => detail.field === 'email'))
    })

    it('rejects an over-long description', async () => {
      const response = await request('/api/pharmacy/profile', {
        method: 'POST',
        token: pharmacyAToken,
        body: pharmacyPayload({ description: 'x'.repeat(1001) }),
      })

      assert.equal(response.status, 400)
      assert.ok(
        response.body.details.some((detail) => detail.field === 'description'),
      )
    })
  })

  describe('ownership', () => {
    it('lets a pharmacy read its own saved profile', async () => {
      await request('/api/pharmacy/profile', {
        method: 'POST',
        token: pharmacyAToken,
        body: pharmacyPayload(),
      })

      const response = await request('/api/pharmacy/profile', {
        token: pharmacyAToken,
      })

      assert.equal(response.status, 200)
      assert.equal(response.body.data.user.id, pharmacyAId)
      assert.equal(response.body.data.profile.pharmacyName, 'Aarogya Pharmacy')
      assert.ok(response.body.data.profile.id)
    })

    it('lets a pharmacy update its own profile', async () => {
      await request('/api/pharmacy/profile', {
        method: 'POST',
        token: pharmacyAToken,
        body: pharmacyPayload(),
      })

      const response = await request('/api/pharmacy/profile', {
        method: 'PUT',
        token: pharmacyAToken,
        body: {
          pharmacyName: 'Aarogya Pharmacy & Wellness',
          city: 'Bhubaneswar',
          pincode: '751001',
        },
      })

      assert.equal(response.status, 200)
      assert.equal(
        response.body.data.profile.pharmacyName,
        'Aarogya Pharmacy & Wellness',
      )
      assert.equal(response.body.data.profile.city, 'Bhubaneswar')
      assert.equal(response.body.data.profile.pincode, '751001')

      const stored = await Pharmacy.findOne({ userId: pharmacyAId })
      assert.equal(stored.city, 'Bhubaneswar')
    })

    it('rejects an update when no profile exists yet', async () => {
      const response = await request('/api/pharmacy/profile', {
        method: 'PUT',
        token: pharmacyAToken,
        body: { city: 'Bhubaneswar' },
      })

      assert.equal(response.status, 404)
      assert.equal(response.body.code, 'NOT_FOUND')
    })

    it('never changes ownership from a client-supplied userId', async () => {
      const createResponse = await request('/api/pharmacy/profile', {
        method: 'POST',
        token: pharmacyBToken,
        body: {
          ...pharmacyPayload({
            pharmacyName: 'Wellness Pharmacy',
            licenseNumber: 'OD-PH-2026-002',
          }),
          userId: pharmacyAId,
        },
      })

      assert.equal(createResponse.status, 201)
      const stored = await Pharmacy.findOne({ userId: pharmacyBId })
      assert.ok(stored)
      assert.equal(stored.userId.toString(), pharmacyBId)
      assert.equal(await Pharmacy.countDocuments({ userId: pharmacyAId }), 0)
    })

    it('does not let another pharmacy update the first profile', async () => {
      await request('/api/pharmacy/profile', {
        method: 'POST',
        token: pharmacyAToken,
        body: pharmacyPayload(),
      })
      await request('/api/pharmacy/profile', {
        method: 'POST',
        token: pharmacyBToken,
        body: pharmacyPayload({
          pharmacyName: 'Wellness Pharmacy',
          licenseNumber: 'OD-PH-2026-002',
        }),
      })

      const response = await request('/api/pharmacy/profile', {
        method: 'PUT',
        token: pharmacyBToken,
        body: {
          userId: pharmacyAId,
          pharmacyName: 'Hijacked Pharmacy',
        },
      })

      assert.equal(response.status, 200)
      assert.equal(response.body.data.profile.pharmacyName, 'Hijacked Pharmacy')

      const first = await Pharmacy.findOne({ userId: pharmacyAId })
      assert.equal(first.pharmacyName, 'Aarogya Pharmacy')
      const second = await Pharmacy.findOne({ userId: pharmacyBId })
      assert.equal(second.pharmacyName, 'Hijacked Pharmacy')
    })

    it('ignores a client-supplied isActive flag', async () => {
      const response = await request('/api/pharmacy/profile', {
        method: 'POST',
        token: pharmacyAToken,
        body: { ...pharmacyPayload(), isActive: false },
      })

      assert.equal(response.status, 201)
      assert.equal(response.body.data.profile.isActive, true)
    })
  })

  describe('verification control', () => {
    it('creates every new profile as PENDING', async () => {
      const response = await request('/api/pharmacy/profile', {
        method: 'POST',
        token: pharmacyAToken,
        body: pharmacyPayload(),
      })

      assert.equal(response.status, 201)
      assert.equal(response.body.data.profile.verificationStatus, 'PENDING')
    })

    it('rejects self-approval during creation', async () => {
      const response = await request('/api/pharmacy/profile', {
        method: 'POST',
        token: pharmacyAToken,
        body: pharmacyPayload({ verificationStatus: 'APPROVED' }),
      })

      assert.equal(response.status, 403)
      assert.equal(response.body.code, 'FORBIDDEN')
      assert.equal(await Pharmacy.countDocuments({ userId: pharmacyAId }), 0)
    })

    it('rejects changing verificationStatus through update', async () => {
      await request('/api/pharmacy/profile', {
        method: 'POST',
        token: pharmacyAToken,
        body: pharmacyPayload(),
      })

      const response = await request('/api/pharmacy/profile', {
        method: 'PUT',
        token: pharmacyAToken,
        body: { verificationStatus: 'APPROVED' },
      })

      assert.equal(response.status, 403)
      assert.equal(response.body.code, 'FORBIDDEN')

      const stored = await Pharmacy.findOne({ userId: pharmacyAId })
      assert.equal(stored.verificationStatus, 'PENDING')
    })

    it('accepts an unchanged verificationStatus from the client', async () => {
      await request('/api/pharmacy/profile', {
        method: 'POST',
        token: pharmacyAToken,
        body: pharmacyPayload(),
      })

      const response = await request('/api/pharmacy/profile', {
        method: 'PUT',
        token: pharmacyAToken,
        body: { verificationStatus: 'PENDING', city: 'Cuttack' },
      })

      assert.equal(response.status, 200)
      assert.equal(response.body.data.profile.verificationStatus, 'PENDING')
      assert.equal(response.body.data.profile.city, 'Cuttack')
    })
  })

  describe('security', () => {
    it('never exposes password hashes or tokens', async () => {
      const createResponse = await request('/api/pharmacy/profile', {
        method: 'POST',
        token: pharmacyAToken,
        body: pharmacyPayload(),
      })
      const readResponse = await request('/api/pharmacy/profile', {
        token: pharmacyAToken,
      })

      for (const response of [createResponse, readResponse]) {
        const raw = JSON.stringify(response.body)
        assert.equal(raw.includes('passwordHash'), false)
        assert.equal(raw.includes('password'), false)
        assert.equal(raw.includes('token'), false)
      }
    })

    it('does not expose internal Mongo fields or the owning userId', async () => {
      const response = await request('/api/pharmacy/profile', {
        method: 'POST',
        token: pharmacyAToken,
        body: pharmacyPayload(),
      })

      const profile = response.body.data.profile
      assert.equal(profile._id, undefined)
      assert.equal(profile.__v, undefined)
      assert.equal(profile.userId, undefined)
    })

    it('rejects Mongo-style operator values for writable fields', async () => {
      const response = await request('/api/pharmacy/profile', {
        method: 'POST',
        token: pharmacyAToken,
        body: pharmacyPayload({ pharmacyName: { $ne: null } }),
      })

      assert.equal(response.status, 400)
      assert.ok(
        response.body.details.some((detail) => detail.field === 'pharmacyName'),
      )
    })

    it('ignores injected top-level update operators', async () => {
      const response = await request('/api/pharmacy/profile', {
        method: 'POST',
        token: pharmacyAToken,
        body: { ...pharmacyPayload(), $set: { verificationStatus: 'APPROVED' } },
      })

      assert.equal(response.status, 201)
      assert.equal(response.body.data.profile.verificationStatus, 'PENDING')
    })
  })

  describe('public directory', () => {
    async function createApprovedPharmacy() {
      const response = await request('/api/pharmacy/profile', {
        method: 'POST',
        token: pharmacyAToken,
        body: pharmacyPayload(),
      })
      const pharmacyId = response.body.data.profile.id
      await Pharmacy.updateOne(
        { _id: pharmacyId },
        { $set: { verificationStatus: 'APPROVED' } },
      )
      return pharmacyId
    }

    it('returns an approved pharmacy without authentication', async () => {
      const pharmacyId = await createApprovedPharmacy()

      const response = await request(`/api/pharmacies/${pharmacyId}`)

      assert.equal(response.status, 200)
      assert.equal(response.body.data.pharmacy.pharmacyName, 'Aarogya Pharmacy')
      assert.equal(response.body.data.pharmacy.verificationStatus, 'APPROVED')
      assert.equal(response.body.data.pharmacy.userId, undefined)
      assert.equal(JSON.stringify(response.body).includes('passwordHash'), false)
    })

    it('hides a PENDING pharmacy', async () => {
      const createResponse = await request('/api/pharmacy/profile', {
        method: 'POST',
        token: pharmacyAToken,
        body: pharmacyPayload(),
      })
      const pharmacyId = createResponse.body.data.profile.id

      const response = await request(`/api/pharmacies/${pharmacyId}`)

      assert.equal(response.status, 404)
      assert.equal(response.body.code, 'NOT_FOUND')
    })

    it('hides an APPROVED pharmacy that is inactive', async () => {
      const pharmacyId = await createApprovedPharmacy()
      await Pharmacy.updateOne(
        { _id: pharmacyId },
        { $set: { isActive: false } },
      )

      const response = await request(`/api/pharmacies/${pharmacyId}`)

      assert.equal(response.status, 404)
    })

    it('returns 400 for a malformed pharmacy identifier', async () => {
      const response = await request('/api/pharmacies/not-an-id')
      assert.equal(response.status, 400)
      assert.equal(response.body.code, 'VALIDATION_ERROR')
    })

    it('returns 404 for an unknown pharmacy identifier', async () => {
      const response = await request('/api/pharmacies/64b7f0c2a1b2c3d4e5f60718')
      assert.equal(response.status, 404)
    })
  })
})
