const { describe, before, after, beforeEach, it } = require('node:test')
const assert = require('node:assert/strict')
const {
  startServer,
  stopServer,
  clearUsers,
  clearPharmacies,
  clearMedicines,
  createUser,
  tokenForUser,
  request,
  Medicine,
} = require('./helpers')
const Pharmacy = require('../src/models/Pharmacy')

const PHARMACY_A_LICENSE = 'OD-PH-2026-101'
const PHARMACY_B_LICENSE = 'OD-PH-2026-102'

function pharmacyProfilePayload(overrides = {}) {
  return {
    pharmacyName: 'Aarogya Pharmacy',
    pharmacistName: 'Ravi Kumar',
    licenseNumber: PHARMACY_A_LICENSE,
    phone: '9876543210',
    address: 'Main Road',
    city: 'Berhampur',
    state: 'Odisha',
    pincode: '760001',
    ...overrides,
  }
}

function medicinePayload(overrides = {}) {
  return {
    name: 'Paracetamol',
    genericName: 'Acetaminophen',
    brandName: 'Dolo',
    category: 'TABLET',
    description: 'Pain and fever relief.',
    dosageForm: 'Tablet',
    strength: '500 mg',
    packSize: '10 tablets',
    price: 25.5,
    stockQuantity: 100,
    prescriptionRequired: false,
    expiryDate: '2027-12-31',
    ...overrides,
  }
}

async function createMedicineAs(token, overrides = {}) {
  return request('/api/medicines', {
    method: 'POST',
    token,
    body: medicinePayload(overrides),
  })
}

describe('Medicine inventory module', () => {
  let pharmacyAUser
  let pharmacyBUser
  let pharmacyA
  let pharmacyB
  let pharmacyAToken
  let pharmacyBToken
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
    await clearMedicines()

    pharmacyAUser = await createUser({
      name: 'Aarogya Pharmacy',
      email: 'pharmacy-a@example.com',
      role: 'PHARMACY',
    })
    pharmacyA = await Pharmacy.create({
      userId: pharmacyAUser._id,
      ...pharmacyProfilePayload(),
    })
    pharmacyAToken = tokenForUser(pharmacyAUser)

    pharmacyBUser = await createUser({
      name: 'Wellness Pharmacy',
      email: 'pharmacy-b@example.com',
      role: 'PHARMACY',
    })
    pharmacyB = await Pharmacy.create({
      userId: pharmacyBUser._id,
      ...pharmacyProfilePayload({
        pharmacyName: 'Wellness Pharmacy',
        licenseNumber: PHARMACY_B_LICENSE,
      }),
    })
    pharmacyBToken = tokenForUser(pharmacyBUser)

    const patient = await createUser({ email: 'patient@example.com' })
    patientToken = tokenForUser(patient)

    const doctor = await createUser({
      email: 'doctor@example.com',
      role: 'DOCTOR',
    })
    doctorToken = tokenForUser(doctor)

    const admin = await createUser({ email: 'admin@example.com', role: 'ADMIN' })
    adminToken = tokenForUser(admin)
  })

  describe('authentication and roles', () => {
    it('rejects an unauthenticated inventory list', async () => {
      const response = await request('/api/medicines')
      assert.equal(response.status, 401)
      assert.equal(response.body.code, 'UNAUTHORIZED')
    })

    it('rejects an unauthenticated medicine creation', async () => {
      const response = await request('/api/medicines', {
        method: 'POST',
        body: medicinePayload(),
      })
      assert.equal(response.status, 401)
    })

    it('blocks PATIENT accounts', async () => {
      const response = await request('/api/medicines', { token: patientToken })
      assert.equal(response.status, 403)
      assert.equal(response.body.code, 'FORBIDDEN')
    })

    it('blocks DOCTOR accounts', async () => {
      const response = await request('/api/medicines', {
        method: 'POST',
        token: doctorToken,
        body: medicinePayload(),
      })
      assert.equal(response.status, 403)
    })

    it('blocks ADMIN accounts', async () => {
      const response = await request('/api/medicines', { token: adminToken })
      assert.equal(response.status, 403)
    })

    it('lets a PHARMACY account list its empty inventory', async () => {
      const response = await request('/api/medicines', {
        token: pharmacyAToken,
      })

      assert.equal(response.status, 200)
      assert.equal(response.body.success, true)
      assert.deepEqual(response.body.data.medicines, [])
      assert.deepEqual(response.body.data.pagination, {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      })
    })

    it('requires a pharmacy profile before inventory access', async () => {
      const noProfileUser = await createUser({
        email: 'no-profile@example.com',
        role: 'PHARMACY',
      })
      const token = tokenForUser(noProfileUser)

      const response = await request('/api/medicines', { token })

      assert.equal(response.status, 404)
      assert.equal(response.body.code, 'PROFILE_REQUIRED')
    })
  })

  describe('creation and ownership', () => {
    it('lets a pharmacy create a medicine in its own inventory', async () => {
      const response = await createMedicineAs(pharmacyAToken)

      assert.equal(response.status, 201)
      assert.equal(response.body.success, true)
      assert.equal(response.body.data.medicine.name, 'Paracetamol')
      assert.equal(response.body.data.medicine.genericName, 'Acetaminophen')
      assert.equal(response.body.data.medicine.brandName, 'Dolo')
      assert.equal(response.body.data.medicine.category, 'TABLET')
      assert.equal(response.body.data.medicine.price, 25.5)
      assert.equal(response.body.data.medicine.stockQuantity, 100)
      assert.equal(response.body.data.medicine.prescriptionRequired, false)
      assert.equal(response.body.data.medicine.expiryDate, '2027-12-31')
      assert.equal(response.body.data.medicine.isActive, true)
      assert.equal(response.body.data.medicine.isExpired, false)

      const stored = await Medicine.findById(response.body.data.medicine.id)
      assert.ok(stored)
      assert.equal(stored.pharmacyId.toString(), pharmacyA._id.toString())
    })

    it('defaults prescriptionRequired to true when omitted', async () => {
      const payload = medicinePayload()
      delete payload.prescriptionRequired

      const response = await request('/api/medicines', {
        method: 'POST',
        token: pharmacyAToken,
        body: payload,
      })

      assert.equal(response.status, 201)
      assert.equal(response.body.data.medicine.prescriptionRequired, true)
    })

    it('lists only the authenticated pharmacy inventory', async () => {
      await createMedicineAs(pharmacyAToken, { name: 'Paracetamol' })
      await createMedicineAs(pharmacyBToken, {
        name: 'Amoxicillin',
        genericName: 'Amoxicillin',
        category: 'CAPSULE',
        dosageForm: 'Capsule',
        strength: '250 mg',
      })

      const responseA = await request('/api/medicines', {
        token: pharmacyAToken,
      })
      const responseB = await request('/api/medicines', {
        token: pharmacyBToken,
      })

      assert.equal(responseA.status, 200)
      assert.equal(responseA.body.data.pagination.total, 1)
      assert.equal(responseA.body.data.medicines[0].name, 'Paracetamol')
      assert.equal(responseB.status, 200)
      assert.equal(responseB.body.data.pagination.total, 1)
      assert.equal(responseB.body.data.medicines[0].name, 'Amoxicillin')
    })

    it('lets a pharmacy view its own medicine', async () => {
      const created = await createMedicineAs(pharmacyAToken)
      const medicineId = created.body.data.medicine.id

      const response = await request(`/api/medicines/${medicineId}`, {
        token: pharmacyAToken,
      })

      assert.equal(response.status, 200)
      assert.equal(response.body.data.medicine.id, medicineId)
    })

    it('lets a pharmacy update its own medicine', async () => {
      const created = await createMedicineAs(pharmacyAToken)
      const medicineId = created.body.data.medicine.id

      const response = await request(`/api/medicines/${medicineId}`, {
        method: 'PUT',
        token: pharmacyAToken,
        body: { price: 30.25, stockQuantity: 75 },
      })

      assert.equal(response.status, 200)
      assert.equal(response.body.data.medicine.price, 30.25)
      assert.equal(response.body.data.medicine.stockQuantity, 75)

      const stored = await Medicine.findById(medicineId)
      assert.equal(stored.price, 30.25)
      assert.equal(stored.stockQuantity, 75)
    })

    it('lets a pharmacy deactivate and reactivate its own medicine', async () => {
      const created = await createMedicineAs(pharmacyAToken)
      const medicineId = created.body.data.medicine.id

      const deactivated = await request(
        `/api/medicines/${medicineId}/deactivate`,
        { method: 'PATCH', token: pharmacyAToken },
      )
      assert.equal(deactivated.status, 200)
      assert.equal(deactivated.body.data.medicine.isActive, false)

      const activated = await request(`/api/medicines/${medicineId}/activate`, {
        method: 'PATCH',
        token: pharmacyAToken,
      })
      assert.equal(activated.status, 200)
      assert.equal(activated.body.data.medicine.isActive, true)
    })

    it('does not let another pharmacy view a medicine', async () => {
      const created = await createMedicineAs(pharmacyAToken)
      const medicineId = created.body.data.medicine.id

      const response = await request(`/api/medicines/${medicineId}`, {
        token: pharmacyBToken,
      })

      assert.equal(response.status, 404)
      assert.equal(response.body.code, 'NOT_FOUND')
    })

    it('does not let another pharmacy update a medicine', async () => {
      const created = await createMedicineAs(pharmacyAToken)
      const medicineId = created.body.data.medicine.id

      const response = await request(`/api/medicines/${medicineId}`, {
        method: 'PUT',
        token: pharmacyBToken,
        body: { price: 1 },
      })

      assert.equal(response.status, 404)
      const stored = await Medicine.findById(medicineId)
      assert.equal(stored.price, 25.5)
    })

    it('does not let another pharmacy deactivate a medicine', async () => {
      const created = await createMedicineAs(pharmacyAToken)
      const medicineId = created.body.data.medicine.id

      const response = await request(
        `/api/medicines/${medicineId}/deactivate`,
        { method: 'PATCH', token: pharmacyBToken },
      )

      assert.equal(response.status, 404)
      const stored = await Medicine.findById(medicineId)
      assert.equal(stored.isActive, true)
    })

    it('ignores client-supplied pharmacyId and userId on creation', async () => {
      const response = await request('/api/medicines', {
        method: 'POST',
        token: pharmacyAToken,
        body: {
          ...medicinePayload(),
          pharmacyId: pharmacyB._id.toString(),
          userId: pharmacyBUser._id.toString(),
        },
      })

      assert.equal(response.status, 201)
      const stored = await Medicine.findById(response.body.data.medicine.id)
      assert.equal(stored.pharmacyId.toString(), pharmacyA._id.toString())

      const otherList = await request('/api/medicines', {
        token: pharmacyBToken,
      })
      assert.equal(otherList.body.data.pagination.total, 0)
    })

    it('ignores a client-supplied isActive flag on creation', async () => {
      const response = await createMedicineAs(pharmacyAToken, {
        isActive: false,
      })

      assert.equal(response.status, 201)
      assert.equal(response.body.data.medicine.isActive, true)
    })

    it('ignores a client-supplied isActive flag on update', async () => {
      const created = await createMedicineAs(pharmacyAToken)
      const medicineId = created.body.data.medicine.id

      const response = await request(`/api/medicines/${medicineId}`, {
        method: 'PUT',
        token: pharmacyAToken,
        body: { stockQuantity: 40, isActive: false },
      })

      assert.equal(response.status, 200)
      assert.equal(response.body.data.medicine.stockQuantity, 40)
      assert.equal(response.body.data.medicine.isActive, true)
    })

    it('ignores a client-supplied pharmacy status on update', async () => {
      const created = await createMedicineAs(pharmacyAToken)
      const medicineId = created.body.data.medicine.id

      const response = await request(`/api/medicines/${medicineId}`, {
        method: 'PUT',
        token: pharmacyAToken,
        body: {
          stockQuantity: 10,
          verificationStatus: 'APPROVED',
          isActive: false,
        },
      })

      assert.equal(response.status, 200)
      const storedPharmacy = await Pharmacy.findById(pharmacyA._id)
      assert.equal(storedPharmacy.verificationStatus, 'PENDING')
      assert.equal(storedPharmacy.isActive, true)
    })
  })

  describe('validation', () => {
    const invalidCases = [
      {
        name: 'missing medicine name',
        overrides: { name: undefined },
        field: 'name',
      },
      {
        name: 'blank medicine name',
        overrides: { name: '   ' },
        field: 'name',
      },
      {
        name: 'missing category',
        overrides: { category: undefined },
        field: 'category',
      },
      {
        name: 'invalid category',
        overrides: { category: 'LIQUID' },
        field: 'category',
      },
      {
        name: 'missing price',
        overrides: { price: undefined },
        field: 'price',
      },
      {
        name: 'string price',
        overrides: { price: '25' },
        field: 'price',
      },
      {
        name: 'negative price',
        overrides: { price: -1 },
        field: 'price',
      },
      {
        name: 'excessive price',
        overrides: { price: 1000001 },
        field: 'price',
      },
      {
        name: 'price with too many decimals',
        overrides: { price: 10.999 },
        field: 'price',
      },
      {
        name: 'missing stock quantity',
        overrides: { stockQuantity: undefined },
        field: 'stockQuantity',
      },
      {
        name: 'string stock quantity',
        overrides: { stockQuantity: '10' },
        field: 'stockQuantity',
      },
      {
        name: 'negative stock quantity',
        overrides: { stockQuantity: -1 },
        field: 'stockQuantity',
      },
      {
        name: 'fractional stock quantity',
        overrides: { stockQuantity: 1.5 },
        field: 'stockQuantity',
      },
      {
        name: 'excessive stock quantity',
        overrides: { stockQuantity: 1000001 },
        field: 'stockQuantity',
      },
      {
        name: 'missing expiry date',
        overrides: { expiryDate: undefined },
        field: 'expiryDate',
      },
      {
        name: 'invalid expiry date format',
        overrides: { expiryDate: '31-12-2027' },
        field: 'expiryDate',
      },
      {
        name: 'impossible expiry date',
        overrides: { expiryDate: '2027-02-30' },
        field: 'expiryDate',
      },
      {
        name: 'non-boolean prescription flag',
        overrides: { prescriptionRequired: 'true' },
        field: 'prescriptionRequired',
      },
      {
        name: 'over-long medicine name',
        overrides: { name: 'x'.repeat(201) },
        field: 'name',
      },
    ]

    for (const testCase of invalidCases) {
      it(`rejects ${testCase.name}`, async () => {
        const payload = medicinePayload(testCase.overrides)
        if (testCase.overrides.name === undefined) {
          delete payload.name
        }
        if (testCase.overrides.category === undefined) {
          delete payload.category
        }
        if (testCase.overrides.price === undefined) {
          delete payload.price
        }
        if (testCase.overrides.stockQuantity === undefined) {
          delete payload.stockQuantity
        }
        if (testCase.overrides.expiryDate === undefined) {
          delete payload.expiryDate
        }

        const response = await request('/api/medicines', {
          method: 'POST',
          token: pharmacyAToken,
          body: payload,
        })

        assert.equal(response.status, 400)
        assert.equal(response.body.code, 'VALIDATION_ERROR')
        assert.ok(
          response.body.details.some(
            (detail) => detail.field === testCase.field,
          ),
          `expected validation detail for ${testCase.field}`,
        )
      })
    }

    it('rejects over-long optional strings', async () => {
      const cases = [
        ['genericName', 'x'.repeat(201)],
        ['brandName', 'x'.repeat(201)],
        ['description', 'x'.repeat(1001)],
        ['dosageForm', 'x'.repeat(101)],
        ['strength', 'x'.repeat(101)],
        ['packSize', 'x'.repeat(101)],
      ]

      for (const [field, value] of cases) {
        const response = await createMedicineAs(pharmacyAToken, {
          [field]: value,
        })
        assert.equal(response.status, 400)
        assert.ok(
          response.body.details.some((detail) => detail.field === field),
          `expected validation detail for ${field}`,
        )
      }
    })

    it('normalizes empty optional strings to null', async () => {
      const response = await createMedicineAs(pharmacyAToken, {
        genericName: '',
        brandName: '  ',
        description: '',
        dosageForm: '',
        strength: '',
        packSize: '',
      })

      assert.equal(response.status, 201)
      assert.equal(response.body.data.medicine.genericName, null)
      assert.equal(response.body.data.medicine.brandName, null)
      assert.equal(response.body.data.medicine.description, null)
      assert.equal(response.body.data.medicine.dosageForm, null)
      assert.equal(response.body.data.medicine.strength, null)
      assert.equal(response.body.data.medicine.packSize, null)
    })

    it('rejects a non-object request body', async () => {
      const response = await request('/api/medicines', {
        method: 'POST',
        token: pharmacyAToken,
        body: [medicinePayload()],
      })

      assert.equal(response.status, 400)
      assert.equal(response.body.code, 'INVALID_REQUEST_BODY')
    })
  })

  describe('duplicate prevention', () => {
    it('rejects an identical medicine in the same pharmacy', async () => {
      await createMedicineAs(pharmacyAToken)
      const response = await createMedicineAs(pharmacyAToken)

      assert.equal(response.status, 409)
      assert.equal(response.body.code, 'DUPLICATE_MEDICINE')
    })

    it('rejects a normalized duplicate in the same pharmacy', async () => {
      await createMedicineAs(pharmacyAToken)
      const response = await createMedicineAs(pharmacyAToken, {
        name: '  PARACETAMOL  ',
        strength: '500 MG',
        dosageForm: ' tablet ',
      })

      assert.equal(response.status, 409)
      assert.equal(response.body.code, 'DUPLICATE_MEDICINE')
    })

    it('allows the same medicine in another pharmacy', async () => {
      await createMedicineAs(pharmacyAToken)
      const response = await createMedicineAs(pharmacyBToken)

      assert.equal(response.status, 201)
      assert.equal(await Medicine.countDocuments({ name: 'Paracetamol' }), 2)
    })

    it('allows the same name with a different strength or dosage form', async () => {
      await createMedicineAs(pharmacyAToken, {
        name: 'Paracetamol',
        strength: '500 mg',
        dosageForm: 'Tablet',
      })
      const differentStrength = await createMedicineAs(pharmacyAToken, {
        name: 'Paracetamol',
        strength: '650 mg',
        dosageForm: 'Tablet',
      })
      const differentForm = await createMedicineAs(pharmacyAToken, {
        name: 'Paracetamol',
        strength: '500 mg',
        dosageForm: 'Syrup',
        category: 'SYRUP',
      })

      assert.equal(differentStrength.status, 201)
      assert.equal(differentForm.status, 201)
    })

    it('rejects an update that would duplicate another medicine', async () => {
      const first = await createMedicineAs(pharmacyAToken, {
        name: 'Paracetamol',
        strength: '500 mg',
      })
      const second = await createMedicineAs(pharmacyAToken, {
        name: 'Paracetamol',
        strength: '650 mg',
      })

      const response = await request(
        `/api/medicines/${second.body.data.medicine.id}`,
        {
          method: 'PUT',
          token: pharmacyAToken,
          body: { strength: '500 mg' },
        },
      )

      assert.equal(response.status, 409)
      assert.equal(response.body.code, 'DUPLICATE_MEDICINE')

      const stored = await Medicine.findById(first.body.data.medicine.id)
      assert.equal(stored.strength, '500 mg')
    })
  })

  describe('pharmacy status rules', () => {
    it('allows a PENDING pharmacy to manage inventory', async () => {
      const response = await createMedicineAs(pharmacyAToken)
      assert.equal(response.status, 201)
    })

    it('allows an APPROVED active pharmacy to manage inventory', async () => {
      await Pharmacy.updateOne(
        { _id: pharmacyA._id },
        { $set: { verificationStatus: 'APPROVED' } },
      )

      const response = await createMedicineAs(pharmacyAToken)
      assert.equal(response.status, 201)
    })

    it('blocks a REJECTED pharmacy from listing inventory', async () => {
      await Pharmacy.updateOne(
        { _id: pharmacyA._id },
        { $set: { verificationStatus: 'REJECTED' } },
      )

      const response = await request('/api/medicines', {
        token: pharmacyAToken,
      })

      assert.equal(response.status, 403)
      assert.equal(response.body.code, 'PHARMACY_REJECTED')
    })

    it('blocks a REJECTED pharmacy from creating inventory', async () => {
      await Pharmacy.updateOne(
        { _id: pharmacyA._id },
        { $set: { verificationStatus: 'REJECTED' } },
      )

      const response = await createMedicineAs(pharmacyAToken)
      assert.equal(response.status, 403)
      assert.equal(response.body.code, 'PHARMACY_REJECTED')
    })

    it('blocks an inactive pharmacy from listing inventory', async () => {
      await Pharmacy.updateOne(
        { _id: pharmacyA._id },
        { $set: { isActive: false } },
      )

      const response = await request('/api/medicines', {
        token: pharmacyAToken,
      })

      assert.equal(response.status, 403)
      assert.equal(response.body.code, 'PHARMACY_INACTIVE')
    })

    it('blocks an inactive pharmacy from creating inventory', async () => {
      await Pharmacy.updateOne(
        { _id: pharmacyA._id },
        { $set: { isActive: false } },
      )

      const response = await createMedicineAs(pharmacyAToken)
      assert.equal(response.status, 403)
      assert.equal(response.body.code, 'PHARMACY_INACTIVE')
    })
  })

  describe('security', () => {
    it('never returns password hashes or tokens', async () => {
      const created = await createMedicineAs(pharmacyAToken)
      const medicineId = created.body.data.medicine.id
      const listed = await request('/api/medicines', {
        token: pharmacyAToken,
      })
      const read = await request(`/api/medicines/${medicineId}`, {
        token: pharmacyAToken,
      })
      const updated = await request(`/api/medicines/${medicineId}`, {
        method: 'PUT',
        token: pharmacyAToken,
        body: { stockQuantity: 5 },
      })

      for (const response of [created, listed, read, updated]) {
        const raw = JSON.stringify(response.body)
        assert.equal(raw.includes('passwordHash'), false)
        assert.equal(raw.includes('password'), false)
        assert.equal(raw.includes('token'), false)
      }
    })

    it('does not expose internal or ownership fields', async () => {
      const created = await createMedicineAs(pharmacyAToken)
      const medicine = created.body.data.medicine

      assert.equal(medicine._id, undefined)
      assert.equal(medicine.__v, undefined)
      assert.equal(medicine.pharmacyId, undefined)
      assert.equal(medicine.userId, undefined)
      assert.equal(medicine.identityKey, undefined)
    })

    it('rejects Mongo-style operator values for writable fields', async () => {
      const response = await createMedicineAs(pharmacyAToken, {
        name: { $ne: null },
      })

      assert.equal(response.status, 400)
      assert.ok(
        response.body.details.some((detail) => detail.field === 'name'),
      )
    })

    it('ignores injected top-level update operators', async () => {
      const response = await request('/api/medicines', {
        method: 'POST',
        token: pharmacyAToken,
        body: {
          ...medicinePayload(),
          $set: { isActive: false, pharmacyId: pharmacyB._id.toString() },
        },
      })

      assert.equal(response.status, 201)
      assert.equal(response.body.data.medicine.isActive, true)

      const stored = await Medicine.findById(response.body.data.medicine.id)
      assert.equal(stored.pharmacyId.toString(), pharmacyA._id.toString())
    })

    it('does not expose another pharmacy inventory through query filters', async () => {
      await createMedicineAs(pharmacyBToken)

      const response = await request('/api/medicines?q=Paracetamol', {
        token: pharmacyAToken,
      })

      assert.equal(response.status, 200)
      assert.equal(response.body.data.pagination.total, 0)
    })
  })

  describe('filtering, pagination, and sorting', () => {
    it('searches by name, generic name, and brand name', async () => {
      await createMedicineAs(pharmacyAToken, {
        name: 'Paracetamol',
        genericName: 'Acetaminophen',
        brandName: 'Dolo',
      })

      for (const query of ['paracetamol', 'acetaminophen', 'dolo']) {
        const response = await request(
          `/api/medicines?q=${encodeURIComponent(query)}`,
          { token: pharmacyAToken },
        )
        assert.equal(response.status, 200)
        assert.equal(response.body.data.pagination.total, 1)
      }
    })

    it('filters by category', async () => {
      await createMedicineAs(pharmacyAToken, {
        name: 'Paracetamol',
        category: 'TABLET',
        dosageForm: 'Tablet',
      })
      await createMedicineAs(pharmacyAToken, {
        name: 'Cough Syrup',
        category: 'SYRUP',
        dosageForm: 'Syrup',
        strength: '100 ml',
      })

      const response = await request('/api/medicines?category=SYRUP', {
        token: pharmacyAToken,
      })

      assert.equal(response.status, 200)
      assert.equal(response.body.data.pagination.total, 1)
      assert.equal(response.body.data.medicines[0].name, 'Cough Syrup')
    })

    it('filters by active state', async () => {
      const active = await createMedicineAs(pharmacyAToken, {
        name: 'Paracetamol',
      })
      const inactive = await createMedicineAs(pharmacyAToken, {
        name: 'Amoxicillin',
        category: 'CAPSULE',
        dosageForm: 'Capsule',
        strength: '250 mg',
      })
      await request(
        `/api/medicines/${inactive.body.data.medicine.id}/deactivate`,
        { method: 'PATCH', token: pharmacyAToken },
      )

      const activeResponse = await request('/api/medicines?isActive=true', {
        token: pharmacyAToken,
      })
      const inactiveResponse = await request(
        '/api/medicines?isActive=false',
        { token: pharmacyAToken },
      )

      assert.equal(activeResponse.body.data.pagination.total, 1)
      assert.equal(activeResponse.body.data.medicines[0].name, 'Paracetamol')
      assert.equal(inactiveResponse.body.data.pagination.total, 1)
      assert.equal(inactiveResponse.body.data.medicines[0].name, 'Amoxicillin')
      assert.equal(active.body.data.medicine.isActive, true)
    })

    it('paginates inventory with metadata', async () => {
      await createMedicineAs(pharmacyAToken, { name: 'Alpha' })
      await createMedicineAs(pharmacyAToken, {
        name: 'Beta',
        strength: '650 mg',
      })
      await createMedicineAs(pharmacyAToken, {
        name: 'Gamma',
        strength: '250 mg',
      })

      const pageOne = await request('/api/medicines?page=1&limit=2', {
        token: pharmacyAToken,
      })
      const pageTwo = await request('/api/medicines?page=2&limit=2', {
        token: pharmacyAToken,
      })

      assert.equal(pageOne.status, 200)
      assert.equal(pageOne.body.data.medicines.length, 2)
      assert.deepEqual(pageOne.body.data.pagination, {
        page: 1,
        limit: 2,
        total: 3,
        totalPages: 2,
      })
      assert.equal(pageTwo.body.data.medicines.length, 1)
    })

    it('sorts by price ascending and descending', async () => {
      await createMedicineAs(pharmacyAToken, {
        name: 'Low',
        price: 10,
      })
      await createMedicineAs(pharmacyAToken, {
        name: 'High',
        strength: '650 mg',
        price: 100,
      })

      const ascending = await request('/api/medicines?sort=price_asc', {
        token: pharmacyAToken,
      })
      const descending = await request('/api/medicines?sort=price_desc', {
        token: pharmacyAToken,
      })

      assert.equal(ascending.body.data.medicines[0].name, 'Low')
      assert.equal(descending.body.data.medicines[0].name, 'High')
    })

    it('accepts every whitelisted sort option', async () => {
      await createMedicineAs(pharmacyAToken)

      const sortOptions = [
        'name_asc',
        'name_desc',
        'price_asc',
        'price_desc',
        'stock_asc',
        'stock_desc',
        'expiry_asc',
        'expiry_desc',
      ]

      for (const sort of sortOptions) {
        const response = await request(`/api/medicines?sort=${sort}`, {
          token: pharmacyAToken,
        })
        assert.equal(response.status, 200)
      }
    })

    it('rejects an unsupported sort option', async () => {
      const response = await request('/api/medicines?sort=createdAt_asc', {
        token: pharmacyAToken,
      })

      assert.equal(response.status, 400)
      assert.ok(
        response.body.details.some((detail) => detail.field === 'sort'),
      )
    })

    it('rejects an invalid category filter', async () => {
      const response = await request('/api/medicines?category=LIQUID', {
        token: pharmacyAToken,
      })

      assert.equal(response.status, 400)
      assert.ok(
        response.body.details.some((detail) => detail.field === 'category'),
      )
    })

    it('rejects an invalid active filter', async () => {
      const response = await request('/api/medicines?isActive=maybe', {
        token: pharmacyAToken,
      })

      assert.equal(response.status, 400)
      assert.ok(
        response.body.details.some((detail) => detail.field === 'isActive'),
      )
    })

    it('rejects invalid pagination values', async () => {
      for (const query of ['page=0', 'page=1.5', 'limit=0', 'limit=51']) {
        const response = await request(`/api/medicines?${query}`, {
          token: pharmacyAToken,
        })
        assert.equal(response.status, 400)
      }
    })

    it('rejects an over-long search query', async () => {
      const response = await request(
        `/api/medicines?q=${'x'.repeat(101)}`,
        { token: pharmacyAToken },
      )

      assert.equal(response.status, 400)
      assert.ok(response.body.details.some((detail) => detail.field === 'q'))
    })

    it('ignores unknown query parameters', async () => {
      const response = await request('/api/medicines?unknown=value', {
        token: pharmacyAToken,
      })

      assert.equal(response.status, 200)
    })

    it('treats search input as literal text, not a regex', async () => {
      await createMedicineAs(pharmacyAToken, { name: 'Paracetamol' })

      const response = await request('/api/medicines?q=%5B', {
        token: pharmacyAToken,
      })

      assert.equal(response.status, 200)
      assert.equal(response.body.data.pagination.total, 0)
    })
  })

  describe('invalid identifiers', () => {
    it('returns 400 for a malformed medicine identifier on read', async () => {
      const response = await request('/api/medicines/not-an-id', {
        token: pharmacyAToken,
      })
      assert.equal(response.status, 400)
      assert.equal(response.body.code, 'VALIDATION_ERROR')
    })

    it('returns 404 for an unknown medicine identifier', async () => {
      const response = await request(
        '/api/medicines/64b7f0c2a1b2c3d4e5f60718',
        { token: pharmacyAToken },
      )
      assert.equal(response.status, 404)
    })
  })
})
