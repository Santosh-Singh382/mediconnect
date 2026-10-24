const { describe, before, after, beforeEach, it } = require('node:test')
const assert = require('node:assert/strict')
const mongoose = require('mongoose')
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
const { buildIdentityKey } = require('../src/services/medicine.service')

function pharmacyPayload(overrides = {}) {
  return {
    pharmacyName: 'Aarogya Pharmacy',
    pharmacistName: 'Ravi Kumar',
    licenseNumber: 'OD-PH-2026-201',
    phone: '9876543210',
    email: 'contact@aarogyapharmacy.in',
    address: 'Main Road',
    city: 'Berhampur',
    state: 'Odisha',
    pincode: '760001',
    verificationStatus: 'APPROVED',
    isActive: true,
    ...overrides,
  }
}

function medicineData(overrides = {}) {
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
    expiryDate: '2030-12-31',
    isActive: true,
    ...overrides,
  }
}

async function createMedicine(pharmacy, overrides = {}) {
  const data = medicineData(overrides)
  return Medicine.create({
    pharmacyId: pharmacy._id,
    ...data,
    identityKey: buildIdentityKey(data),
  })
}

async function createPharmacy(user, overrides = {}) {
  return Pharmacy.create({
    userId: user._id,
    ...pharmacyPayload(overrides),
  })
}

function query(values) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value))
    }
  }
  const text = params.toString()
  return text ? `?${text}` : ''
}

describe('Public medicine discovery module', () => {
  let approvedA
  let approvedB
  let pending
  let rejected
  let inactive
  let paracetamolA
  let cetirizineA
  let expiredA
  let inactiveMedicineA
  let paracetamolB
  let pendingMedicine
  let rejectedMedicine
  let inactivePharmacyMedicine
  let orphanMedicine
  let patientToken
  let doctorToken
  let pharmacyToken

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

    const ownerA = await createUser({
      name: 'Aarogya Pharmacy Owner',
      email: 'public-a@example.com',
      role: 'PHARMACY',
    })
    approvedA = await createPharmacy(ownerA)

    const ownerB = await createUser({
      name: 'Wellness Pharmacy Owner',
      email: 'public-b@example.com',
      role: 'PHARMACY',
    })
    approvedB = await createPharmacy(ownerB, {
      pharmacyName: 'Wellness Pharmacy',
      licenseNumber: 'OD-PH-2026-202',
      city: 'Bhubaneswar',
    })

    const pendingOwner = await createUser({
      name: 'Pending Pharmacy Owner',
      email: 'public-pending@example.com',
      role: 'PHARMACY',
    })
    pending = await createPharmacy(pendingOwner, {
      pharmacyName: 'Pending Pharmacy',
      licenseNumber: 'OD-PH-2026-203',
      verificationStatus: 'PENDING',
    })

    const rejectedOwner = await createUser({
      name: 'Rejected Pharmacy Owner',
      email: 'public-rejected@example.com',
      role: 'PHARMACY',
    })
    rejected = await createPharmacy(rejectedOwner, {
      pharmacyName: 'Rejected Pharmacy',
      licenseNumber: 'OD-PH-2026-204',
      verificationStatus: 'REJECTED',
    })

    const inactiveOwner = await createUser({
      name: 'Inactive Pharmacy Owner',
      email: 'public-inactive@example.com',
      role: 'PHARMACY',
    })
    inactive = await createPharmacy(inactiveOwner, {
      pharmacyName: 'Inactive Pharmacy',
      licenseNumber: 'OD-PH-2026-205',
      isActive: false,
    })

    paracetamolA = await createMedicine(approvedA)
    cetirizineA = await createMedicine(approvedA, {
      name: 'Cetirizine',
      genericName: 'Cetirizine Hydrochloride',
      brandName: 'Alerid',
      category: 'SYRUP',
      description: 'Allergy relief.',
      dosageForm: 'Syrup',
      strength: '5 mg/5 ml',
      price: 18.25,
      stockQuantity: 0,
      prescriptionRequired: false,
      expiryDate: '2029-12-31',
    })
    expiredA = await createMedicine(approvedA, {
      name: 'Amoxicillin',
      genericName: 'Amoxicillin',
      brandName: 'Mox',
      category: 'CAPSULE',
      dosageForm: 'Capsule',
      strength: '250 mg',
      price: 50,
      stockQuantity: 10,
      prescriptionRequired: true,
      expiryDate: '2020-01-31',
    })
    inactiveMedicineA = await createMedicine(approvedA, {
      name: 'Ibuprofen',
      genericName: 'Ibuprofen',
      brandName: 'Brufen',
      category: 'TABLET',
      dosageForm: 'Tablet',
      strength: '400 mg',
      price: 30,
      stockQuantity: 10,
      expiryDate: '2030-06-30',
      isActive: false,
    })
    paracetamolB = await createMedicine(approvedB, {
      brandName: 'Calpol',
      strength: '650 mg',
      price: 40,
      stockQuantity: 5,
      prescriptionRequired: true,
      expiryDate: '2028-06-30',
    })
    pendingMedicine = await createMedicine(pending, {
      name: 'Vitamin C',
      category: 'TABLET',
      strength: '500 mg',
      expiryDate: '2030-12-31',
    })
    rejectedMedicine = await createMedicine(rejected, {
      name: 'Cough Syrup',
      category: 'SYRUP',
      dosageForm: 'Syrup',
      strength: '100 ml',
      expiryDate: '2030-12-31',
    })
    inactivePharmacyMedicine = await createMedicine(inactive, {
      name: 'Zinc',
      category: 'TABLET',
      strength: '50 mg',
      expiryDate: '2030-12-31',
    })
    orphanMedicine = await createMedicine(
      { _id: new mongoose.Types.ObjectId() },
      { name: 'Orphan Medicine', category: 'OTHER', strength: '1 unit' },
    )

    const patient = await createUser({
      name: 'Public Patient',
      email: 'public-patient@example.com',
      role: 'PATIENT',
    })
    patientToken = tokenForUser(patient)
    const doctor = await createUser({
      name: 'Public Doctor',
      email: 'public-doctor@example.com',
      role: 'DOCTOR',
    })
    doctorToken = tokenForUser(doctor)
    pharmacyToken = tokenForUser(ownerA)
  })

  function publicNames(body) {
    return body.data.medicines.map((medicine) => medicine.name)
  }

  describe('Public access', () => {
    it('lets unauthenticated visitors search', async () => {
      const response = await request('/api/public/medicines')
      assert.equal(response.status, 200)
      assert.equal(response.body.success, true)
      assert.equal(response.body.data.medicines.length, 3)
    })

    it('lets PATIENT accounts search', async () => {
      const response = await request('/api/public/medicines', { token: patientToken })
      assert.equal(response.status, 200)
    })

    it('lets DOCTOR accounts search', async () => {
      const response = await request('/api/public/medicines', { token: doctorToken })
      assert.equal(response.status, 200)
    })

    it('lets PHARMACY accounts search', async () => {
      const response = await request('/api/public/medicines', { token: pharmacyToken })
      assert.equal(response.status, 200)
    })
  })

  describe('Visibility', () => {
    it('shows medicines from APPROVED and ACTIVE pharmacies', async () => {
      const response = await request('/api/public/medicines')
      const names = publicNames(response.body)
      assert.ok(names.includes('Paracetamol'))
      assert.ok(names.includes('Cetirizine'))
      assert.equal(response.body.data.pagination.total, 3)
    })

    it('hides PENDING pharmacy medicines', async () => {
      const response = await request('/api/public/medicines')
      assert.ok(!publicNames(response.body).includes(pendingMedicine.name))
    })

    it('hides REJECTED pharmacy medicines', async () => {
      const response = await request('/api/public/medicines')
      assert.ok(!publicNames(response.body).includes(rejectedMedicine.name))
    })

    it('hides inactive pharmacy medicines', async () => {
      const response = await request('/api/public/medicines')
      assert.ok(
        !publicNames(response.body).includes(inactivePharmacyMedicine.name),
      )
    })

    it('hides inactive medicines', async () => {
      const response = await request('/api/public/medicines')
      assert.ok(!publicNames(response.body).includes(inactiveMedicineA.name))
    })

    it('hides expired medicines', async () => {
      const response = await request('/api/public/medicines')
      assert.ok(!publicNames(response.body).includes(expiredA.name))
    })

    it('hides medicines whose pharmacy no longer exists', async () => {
      const response = await request('/api/public/medicines')
      assert.ok(!publicNames(response.body).includes(orphanMedicine.name))
    })

    it('shows future-expiry medicines', async () => {
      const response = await request('/api/public/medicines')
      const item = response.body.data.medicines.find(
        (medicine) => medicine.id === paracetamolA._id.toString(),
      )
      assert.ok(item)
      assert.equal(item.isExpired, false)
    })

    it('shows out-of-stock medicines when availability is not filtered', async () => {
      const response = await request('/api/public/medicines')
      const item = response.body.data.medicines.find(
        (medicine) => medicine.id === cetirizineA._id.toString(),
      )
      assert.ok(item)
      assert.equal(item.inStock, false)
      assert.equal(item.stockQuantity, 0)
    })
  })

  describe('Search', () => {
    it('searches by medicine name', async () => {
      const response = await request(`/api/public/medicines${query({ q: 'paracetamol' })}`)
      assert.equal(response.body.data.medicines.length, 2)
    })

    it('searches by generic name', async () => {
      const response = await request(`/api/public/medicines${query({ q: 'acetaminophen' })}`)
      assert.equal(response.body.data.medicines.length, 2)
    })

    it('searches by brand name', async () => {
      const response = await request(`/api/public/medicines${query({ q: 'dolo' })}`)
      assert.equal(response.body.data.medicines.length, 1)
      assert.equal(response.body.data.medicines[0].id, paracetamolA._id.toString())
    })

    it('searches by strength', async () => {
      const response = await request(`/api/public/medicines${query({ q: '5 mg/5 ml' })}`)
      assert.equal(response.body.data.medicines.length, 1)
      assert.equal(response.body.data.medicines[0].id, cetirizineA._id.toString())
    })

    it('is case-insensitive', async () => {
      const response = await request(`/api/public/medicines${query({ q: 'PARACETAMOL' })}`)
      assert.equal(response.body.data.medicines.length, 2)
    })

    it('treats an empty search as browsing', async () => {
      const response = await request(`/api/public/medicines${query({ q: '   ' })}`)
      assert.equal(response.body.data.medicines.length, 3)
    })

    it('treats regex characters as literal text', async () => {
      const response = await request('/api/public/medicines?q=para%28')
      assert.equal(response.status, 200)
      assert.equal(response.body.data.medicines.length, 0)
    })

    it('rejects an over-long search', async () => {
      const response = await request(
        `/api/public/medicines${query({ q: 'a'.repeat(101) })}`,
      )
      assert.equal(response.status, 400)
      assert.equal(response.body.code, 'VALIDATION_ERROR')
    })

    it('rejects repeated search parameters', async () => {
      const response = await request('/api/public/medicines?q=a&q=b')
      assert.equal(response.status, 400)
    })
  })

  describe('Filters', () => {
    it('filters by category', async () => {
      const response = await request(`/api/public/medicines${query({ category: 'SYRUP' })}`)
      assert.equal(response.body.data.medicines.length, 1)
      assert.equal(response.body.data.medicines[0].id, cetirizineA._id.toString())
    })

    it('accepts a lowercase category', async () => {
      const response = await request(`/api/public/medicines${query({ category: 'syrup' })}`)
      assert.equal(response.body.data.medicines.length, 1)
    })

    it('rejects an invalid category', async () => {
      const response = await request(`/api/public/medicines${query({ category: 'INVALID' })}`)
      assert.equal(response.status, 400)
      assert.ok(response.body.details.some((detail) => detail.field === 'category'))
    })

    it('filters by minPrice', async () => {
      const response = await request(
        `/api/public/medicines${query({ minPrice: 25.5 })}`,
      )
      assert.equal(response.body.data.medicines.length, 2)
      assert.ok(
        response.body.data.medicines.every((medicine) => medicine.price >= 25.5),
      )
    })

    it('filters by maxPrice', async () => {
      const response = await request(
        `/api/public/medicines${query({ maxPrice: 25.5 })}`,
      )
      assert.equal(response.body.data.medicines.length, 2)
      assert.ok(
        response.body.data.medicines.every((medicine) => medicine.price <= 25.5),
      )
    })

    it('rejects an inverted price range', async () => {
      const response = await request(
        `/api/public/medicines${query({ minPrice: 40, maxPrice: 20 })}`,
      )
      assert.equal(response.status, 400)
      assert.ok(response.body.details.some((detail) => detail.field === 'minPrice'))
    })

    it('rejects invalid price values', async () => {
      for (const value of ['-1', 'abc', 'Infinity', '1000001']) {
        const response = await request(
          `/api/public/medicines${query({ minPrice: value })}`,
        )
        assert.equal(response.status, 400, `minPrice=${value}`)
      }
    })

    it('filters by prescriptionRequired=true', async () => {
      const response = await request(
        `/api/public/medicines${query({ prescriptionRequired: 'true' })}`,
      )
      assert.equal(response.body.data.medicines.length, 1)
      assert.equal(
        response.body.data.medicines[0].id,
        paracetamolB._id.toString(),
      )
    })

    it('filters by prescriptionRequired=false', async () => {
      const response = await request(
        `/api/public/medicines${query({ prescriptionRequired: 'false' })}`,
      )
      assert.equal(response.body.data.medicines.length, 2)
    })

    it('rejects non-boolean prescription values', async () => {
      for (const value of ['yes', '1', 'maybe']) {
        const response = await request(
          `/api/public/medicines${query({ prescriptionRequired: value })}`,
        )
        assert.equal(response.status, 400, `prescriptionRequired=${value}`)
      }
    })

    it('filters by inStock=true', async () => {
      const response = await request(`/api/public/medicines${query({ inStock: 'true' })}`)
      assert.equal(response.body.data.medicines.length, 2)
      assert.ok(response.body.data.medicines.every((medicine) => medicine.inStock))
    })

    it('filters by inStock=false', async () => {
      const response = await request(`/api/public/medicines${query({ inStock: 'false' })}`)
      assert.equal(response.body.data.medicines.length, 1)
      assert.equal(response.body.data.medicines[0].id, cetirizineA._id.toString())
    })

    it('rejects non-boolean stock values', async () => {
      const response = await request(`/api/public/medicines${query({ inStock: 'available' })}`)
      assert.equal(response.status, 400)
    })

    it('filters by an approved public pharmacyId', async () => {
      const response = await request(
        `/api/public/medicines${query({ pharmacyId: approvedA._id.toString() })}`,
      )
      assert.equal(response.body.data.medicines.length, 2)
      assert.ok(
        response.body.data.medicines.every(
          (medicine) => medicine.pharmacy.id === approvedA._id.toString(),
        ),
      )
    })

    it('returns no results for a non-public pharmacyId without revealing it', async () => {
      for (const pharmacy of [pending, rejected, inactive]) {
        const response = await request(
          `/api/public/medicines${query({ pharmacyId: pharmacy._id.toString() })}`,
        )
        assert.equal(response.status, 200)
        assert.equal(response.body.data.medicines.length, 0)
        assert.equal(response.body.data.pagination.total, 0)
      }
    })

    it('returns no results for an unknown pharmacyId', async () => {
      const response = await request(
        `/api/public/medicines${query({ pharmacyId: new mongoose.Types.ObjectId().toString() })}`,
      )
      assert.equal(response.status, 200)
      assert.equal(response.body.data.medicines.length, 0)
    })

    it('rejects a malformed pharmacyId', async () => {
      const response = await request(`/api/public/medicines${query({ pharmacyId: 'bad-id' })}`)
      assert.equal(response.status, 400)
      assert.ok(response.body.details.some((detail) => detail.field === 'pharmacyId'))
    })
  })

  describe('Sorting', () => {
    it('sorts by name ascending by default', async () => {
      const response = await request('/api/public/medicines')
      assert.equal(response.body.data.medicines[0].name, 'Cetirizine')
    })

    it('sorts by name descending', async () => {
      const response = await request(
        `/api/public/medicines${query({ sort: 'name_desc' })}`,
      )
      assert.equal(response.body.data.medicines[0].name, 'Paracetamol')
      assert.equal(response.body.data.medicines[2].name, 'Cetirizine')
    })

    it('sorts by price ascending', async () => {
      const response = await request(
        `/api/public/medicines${query({ sort: 'price_asc' })}`,
      )
      assert.deepEqual(
        response.body.data.medicines.map((medicine) => medicine.price),
        [18.25, 25.5, 40],
      )
    })

    it('sorts by price descending', async () => {
      const response = await request(
        `/api/public/medicines${query({ sort: 'price_desc' })}`,
      )
      assert.deepEqual(
        response.body.data.medicines.map((medicine) => medicine.price),
        [40, 25.5, 18.25],
      )
    })

    it('sorts by expiry ascending', async () => {
      const response = await request(
        `/api/public/medicines${query({ sort: 'expiry_asc' })}`,
      )
      assert.deepEqual(
        response.body.data.medicines.map((medicine) => medicine.expiryDate),
        ['2028-06-30', '2029-12-31', '2030-12-31'],
      )
    })

    it('sorts by expiry descending', async () => {
      const response = await request(
        `/api/public/medicines${query({ sort: 'expiry_desc' })}`,
      )
      assert.deepEqual(
        response.body.data.medicines.map((medicine) => medicine.expiryDate),
        ['2030-12-31', '2029-12-31', '2028-06-30'],
      )
    })

    it('sorts by stock descending', async () => {
      const response = await request(
        `/api/public/medicines${query({ sort: 'stock_desc' })}`,
      )
      assert.deepEqual(
        response.body.data.medicines.map((medicine) => medicine.stockQuantity),
        [100, 5, 0],
      )
    })

    it('accepts newest', async () => {
      const response = await request(
        `/api/public/medicines${query({ sort: 'newest' })}`,
      )
      assert.equal(response.status, 200)
      assert.equal(response.body.data.medicines.length, 3)
    })

    it('rejects an unknown sort field', async () => {
      const response = await request(`/api/public/medicines${query({ sort: 'pharmacyName' })}`)
      assert.equal(response.status, 400)
      assert.ok(response.body.details.some((detail) => detail.field === 'sort'))
    })
  })

  describe('Pagination', () => {
    it('uses default pagination', async () => {
      const response = await request('/api/public/medicines')
      assert.deepEqual(response.body.data.pagination, {
        page: 1,
        limit: 20,
        total: 3,
        totalPages: 1,
      })
    })

    it('supports a custom page and limit', async () => {
      const response = await request(
        `/api/public/medicines${query({ page: 2, limit: 2 })}`,
      )
      assert.equal(response.body.data.medicines.length, 1)
      assert.deepEqual(response.body.data.pagination, {
        page: 2,
        limit: 2,
        total: 3,
        totalPages: 2,
      })
    })

    it('accepts the maximum limit', async () => {
      const response = await request(`/api/public/medicines${query({ limit: 50 })}`)
      assert.equal(response.status, 200)
      assert.equal(response.body.data.pagination.limit, 50)
    })

    it('rejects a limit above the maximum', async () => {
      const response = await request(`/api/public/medicines${query({ limit: 51 })}`)
      assert.equal(response.status, 400)
    })

    it('rejects invalid page and limit values', async () => {
      for (const value of ['0', '-1', 'abc']) {
        const page = await request(`/api/public/medicines${query({ page: value })}`)
        assert.equal(page.status, 400, `page=${value}`)
        const limit = await request(`/api/public/medicines${query({ limit: value })}`)
        assert.equal(limit.status, 400, `limit=${value}`)
      }
    })

    it('ignores unknown query parameters', async () => {
      const response = await request(`/api/public/medicines${query({ unknown: 'value' })}`)
      assert.equal(response.status, 200)
      assert.equal(response.body.data.medicines.length, 3)
    })
  })

  describe('Medicine details', () => {
    it('returns a publicly visible medicine', async () => {
      const response = await request(
        `/api/public/medicines/${paracetamolA._id.toString()}`,
      )
      assert.equal(response.status, 200)
      assert.equal(response.body.data.medicine.id, paracetamolA._id.toString())
      assert.equal(response.body.data.medicine.name, 'Paracetamol')
      assert.equal(response.body.data.medicine.pharmacy.id, approvedA._id.toString())
      assert.equal(response.body.data.medicine.pharmacy.pharmacyName, 'Aarogya Pharmacy')
    })

    it('returns 404 for an inactive medicine', async () => {
      const response = await request(
        `/api/public/medicines/${inactiveMedicineA._id.toString()}`,
      )
      assert.equal(response.status, 404)
      assert.equal(response.body.code, 'NOT_FOUND')
    })

    it('returns 404 for an expired medicine', async () => {
      const response = await request(
        `/api/public/medicines/${expiredA._id.toString()}`,
      )
      assert.equal(response.status, 404)
    })

    it('returns 404 for medicines from non-public pharmacies', async () => {
      for (const medicine of [
        pendingMedicine,
        rejectedMedicine,
        inactivePharmacyMedicine,
        orphanMedicine,
      ]) {
        const response = await request(
          `/api/public/medicines/${medicine._id.toString()}`,
        )
        assert.equal(response.status, 404)
        assert.equal(response.body.code, 'NOT_FOUND')
      }
    })

    it('returns 404 for an unknown medicine', async () => {
      const response = await request(
        `/api/public/medicines/${new mongoose.Types.ObjectId().toString()}`,
      )
      assert.equal(response.status, 404)
    })

    it('returns 400 for a malformed medicine id', async () => {
      const response = await request('/api/public/medicines/not-an-id')
      assert.equal(response.status, 400)
      assert.equal(response.body.code, 'VALIDATION_ERROR')
    })
  })

  describe('Security and privacy', () => {
    it('returns only the public medicine shape', async () => {
      const response = await request('/api/public/medicines')
      const medicine = response.body.data.medicines[0]
      assert.deepEqual(Object.keys(medicine).sort(), [
        'brandName',
        'category',
        'description',
        'dosageForm',
        'expiryDate',
        'genericName',
        'id',
        'inStock',
        'isExpired',
        'name',
        'packSize',
        'pharmacy',
        'prescriptionRequired',
        'price',
        'stockQuantity',
        'strength',
      ])
    })

    it('returns only the safe pharmacy summary shape', async () => {
      const response = await request('/api/public/medicines')
      const pharmacy = response.body.data.medicines[0].pharmacy
      assert.deepEqual(Object.keys(pharmacy).sort(), [
        'address',
        'city',
        'id',
        'pharmacistName',
        'pharmacyName',
        'pincode',
        'state',
      ])
    })

    it('never exposes account, token, ownership, or identity fields', async () => {
      const list = await request('/api/public/medicines')
      const detail = await request(
        `/api/public/medicines/${paracetamolA._id.toString()}`,
      )
      for (const body of [list.body, detail.body]) {
        const text = JSON.stringify(body)
        for (const forbidden of [
          'passwordHash',
          'password',
          'token',
          'userId',
          'pharmacyId',
          'identityKey',
          'verificationStatus',
          'licenseNumber',
          'email',
          'phone',
        ]) {
          assert.equal(text.includes(`"${forbidden}"`), false, forbidden)
        }
      }
    })

    it('keeps the public route read-only', async () => {
      const create = await request('/api/public/medicines', {
        method: 'POST',
        body: medicineData({ name: 'Injected Medicine' }),
      })
      assert.equal(create.status, 404)

      const update = await request(
        `/api/public/medicines/${paracetamolA._id.toString()}`,
        { method: 'PUT', body: { price: 1 } },
      )
      assert.equal(update.status, 404)

      const remove = await request(
        `/api/public/medicines/${paracetamolA._id.toString()}`,
        { method: 'DELETE' },
      )
      assert.equal(remove.status, 404)

      const stored = await Medicine.findById(paracetamolA._id)
      assert.equal(stored.price, 25.5)
      assert.equal(
        await Medicine.countDocuments({ name: 'Injected Medicine' }),
        0,
      )
    })

    it('defensively hides records with negative stock', async () => {
      await Medicine.collection.insertOne({
        pharmacyId: approvedA._id,
        name: 'Negative Stock Medicine',
        category: 'OTHER',
        price: 10,
        stockQuantity: -5,
        prescriptionRequired: false,
        expiryDate: new Date('2030-12-31T00:00:00.000Z'),
        isActive: true,
        identityKey: 'negative-stock-fixture',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const response = await request('/api/public/medicines')
      assert.ok(!publicNames(response.body).includes('Negative Stock Medicine'))
      assert.equal(response.body.data.medicines.length, 3)
    })

    it('does not expose raw Mongo operators or sort fields', async () => {
      const operatorQuery = await request(
        '/api/public/medicines?category[$ne]=TABLET',
      )
      assert.equal(operatorQuery.status, 200)
      assert.equal(operatorQuery.body.data.medicines.length, 3)

      const sortQuery = await request('/api/public/medicines?sort=$natural')
      assert.equal(sortQuery.status, 400)
    })
  })

  describe('Phase regression smoke checks', () => {
    it('keeps pharmacy-owner inventory protected', async () => {
      const response = await request('/api/medicines')
      assert.equal(response.status, 401)
    })

    it('keeps the public pharmacy directory available', async () => {
      const response = await request(`/api/pharmacies/${approvedA._id.toString()}`)
      assert.equal(response.status, 200)
      assert.equal(response.body.data.pharmacy.id, approvedA._id.toString())
    })

    it('keeps the health endpoint available', async () => {
      const response = await request('/api/health')
      assert.equal(response.status, 200)
    })
  })
})
