const { describe, before, after, beforeEach, it } = require('node:test')
const assert = require('node:assert/strict')
const mongoose = require('mongoose')
const {
  startServer,
  stopServer,
  clearUsers,
  clearPharmacies,
  clearMedicines,
  clearCarts,
  createUser,
  tokenForUser,
  request,
  Pharmacy,
  Medicine,
  Cart,
} = require('./helpers')
const { buildIdentityKey } = require('../src/services/medicine.service')

const future = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
const past = new Date(Date.now() - 24 * 60 * 60 * 1000)

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
    expiryDate: future,
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

function pharmacyData(overrides = {}) {
  return {
    pharmacyName: 'Aarogya Pharmacy',
    pharmacistName: 'Ravi Kumar',
    licenseNumber: 'OD-PH-2026-301',
    phone: '9876543210',
    email: 'private@aarogyapharmacy.test',
    address: 'Main Road',
    city: 'Berhampur',
    state: 'Odisha',
    pincode: '760001',
    verificationStatus: 'APPROVED',
    isActive: true,
    ...overrides,
  }
}

async function createPharmacy(user, overrides = {}) {
  return Pharmacy.create({
    userId: user._id,
    ...pharmacyData(overrides),
  })
}

async function addMedicine(token, medicine, quantity = 1, extra = {}) {
  return request('/api/cart/items', {
    method: 'POST',
    token,
    body: {
      medicineId: medicine._id.toString(),
      quantity,
      ...extra,
    },
  })
}

async function updatedQuantity(token, medicine, quantity) {
  return request(`/api/cart/items/${medicine._id.toString()}`, {
    method: 'PATCH',
    token,
    body: { quantity },
  })
}

async function removedItem(token, medicine) {
  return request(`/api/cart/items/${medicine._id.toString()}`, {
    method: 'DELETE',
    token,
  })
}

function cartByName(response, pharmacyName) {
  return response.body.data.carts.find(
    (cart) => cart.pharmacy.pharmacyName === pharmacyName,
  )
}

function itemByMedicine(cart, medicine) {
  return cart.items.find((item) => item.medicineId === medicine._id.toString())
}

describe('Pharmacy cart module', () => {
  let patientA
  let patientB
  let doctorUser
  let pharmacyAUser
  let pharmacyBUser
  let adminUser
  let patientAToken
  let patientBToken
  let doctorToken
  let pharmacyToken
  let adminToken
  let pharmacyA
  let pharmacyB
  let pendingPharmacy
  let inactivePharmacy
  let paracetamol
  let prescriptionMedicine
  let lowStockMedicine
  let outOfStockMedicine
  let expiredMedicine
  let inactiveMedicine
  let multivitamin
  let pendingMedicine
  let inactivePharmacyMedicine

  before(async () => {
    await startServer()
  })

  after(async () => {
    await stopServer()
  })

  beforeEach(async () => {
    await clearCarts()
    await clearMedicines()
    await clearPharmacies()
    await clearUsers()

    patientA = await createUser({
      name: 'Patient A',
      email: 'cart-patient-a@example.com',
      role: 'PATIENT',
    })
    patientB = await createUser({
      name: 'Patient B',
      email: 'cart-patient-b@example.com',
      role: 'PATIENT',
    })
    doctorUser = await createUser({
      name: 'Cart Doctor',
      email: 'cart-doctor@example.com',
      role: 'DOCTOR',
    })
    pharmacyAUser = await createUser({
      name: 'Aarogya Owner',
      email: 'cart-pharmacy-a@example.com',
      role: 'PHARMACY',
    })
    pharmacyBUser = await createUser({
      name: 'Wellness Owner',
      email: 'cart-pharmacy-b@example.com',
      role: 'PHARMACY',
    })
    adminUser = await createUser({
      name: 'Cart Admin',
      email: 'cart-admin@example.com',
      role: 'ADMIN',
    })

    patientAToken = tokenForUser(patientA)
    patientBToken = tokenForUser(patientB)
    doctorToken = tokenForUser(doctorUser)
    pharmacyToken = tokenForUser(pharmacyAUser)
    adminToken = tokenForUser(adminUser)

    pharmacyA = await createPharmacy(pharmacyAUser)
    pharmacyB = await createPharmacy(pharmacyBUser, {
      pharmacyName: 'Wellness Pharmacy',
      licenseNumber: 'OD-PH-2026-302',
      address: 'Market Street',
      city: 'Bhubaneswar',
    })
    pendingPharmacy = await createPharmacy(
      await createUser({
        name: 'Pending Owner',
        email: 'cart-pending@example.com',
        role: 'PHARMACY',
      }),
      {
        pharmacyName: 'Pending Pharmacy',
        licenseNumber: 'OD-PH-2026-303',
        verificationStatus: 'PENDING',
      },
    )
    inactivePharmacy = await createPharmacy(
      await createUser({
        name: 'Inactive Owner',
        email: 'cart-inactive@example.com',
        role: 'PHARMACY',
      }),
      {
        pharmacyName: 'Inactive Pharmacy',
        licenseNumber: 'OD-PH-2026-304',
        isActive: false,
      },
    )

    paracetamol = await createMedicine(pharmacyA)
    prescriptionMedicine = await createMedicine(pharmacyA, {
      name: 'Amoxicillin',
      genericName: 'Amoxicillin',
      brandName: 'Mox',
      category: 'CAPSULE',
      dosageForm: 'Capsule',
      strength: '250 mg',
      price: 90,
      stockQuantity: 10,
      prescriptionRequired: true,
    })
    lowStockMedicine = await createMedicine(pharmacyA, {
      name: 'Cetirizine',
      genericName: 'Cetirizine Hydrochloride',
      brandName: 'Alerid',
      dosageForm: 'Tablet',
      strength: '10 mg',
      price: 18.25,
      stockQuantity: 3,
    })
    outOfStockMedicine = await createMedicine(pharmacyA, {
      name: 'Azithromycin',
      genericName: 'Azithromycin',
      brandName: 'Azee',
      dosageForm: 'Tablet',
      strength: '500 mg',
      price: 65,
      stockQuantity: 0,
    })
    expiredMedicine = await createMedicine(pharmacyA, {
      name: 'Expired Syrup',
      genericName: 'Dextromethorphan',
      brandName: null,
      category: 'SYRUP',
      dosageForm: 'Syrup',
      strength: '5 mg/5 ml',
      price: 42,
      expiryDate: past,
    })
    inactiveMedicine = await createMedicine(pharmacyA, {
      name: 'Inactive Ointment',
      genericName: 'Mupirocin',
      brandName: null,
      category: 'OINTMENT',
      dosageForm: 'Ointment',
      strength: '2%',
      price: 75,
      isActive: false,
    })
    multivitamin = await createMedicine(pharmacyB, {
      name: 'Multivitamin',
      genericName: 'Multivitamin',
      brandName: 'Supradyn',
      category: 'CAPSULE',
      dosageForm: 'Capsule',
      strength: 'Daily',
      price: 12.5,
      stockQuantity: 20,
    })
    pendingMedicine = await createMedicine(pendingPharmacy, {
      name: 'Pending Medicine',
      price: 11,
    })
    inactivePharmacyMedicine = await createMedicine(inactivePharmacy, {
      name: 'Inactive Pharmacy Medicine',
      price: 12,
    })
  })

  describe('authentication', () => {
    it('rejects an unauthenticated cart read', async () => {
      const response = await request('/api/cart')
      assert.equal(response.status, 401)
      assert.equal(response.body.code, 'UNAUTHORIZED')
    })

    it('rejects an unauthenticated add', async () => {
      const response = await request('/api/cart/items', {
        method: 'POST',
        body: { medicineId: paracetamol._id.toString(), quantity: 1 },
      })
      assert.equal(response.status, 401)
    })

    it('rejects an unauthenticated quantity update', async () => {
      const response = await request(
        `/api/cart/items/${paracetamol._id.toString()}`,
        { method: 'PATCH', body: { quantity: 2 } },
      )
      assert.equal(response.status, 401)
    })

    it('rejects an unauthenticated item removal', async () => {
      const response = await request(
        `/api/cart/items/${paracetamol._id.toString()}`,
        { method: 'DELETE' },
      )
      assert.equal(response.status, 401)
    })

    it('rejects an unauthenticated cart clear', async () => {
      const response = await request(
        `/api/cart/${new mongoose.Types.ObjectId().toString()}`,
        { method: 'DELETE' },
      )
      assert.equal(response.status, 401)
    })
  })

  describe('roles', () => {
    it('blocks DOCTOR accounts', async () => {
      const response = await request('/api/cart', { token: doctorToken })
      assert.equal(response.status, 403)
      assert.equal(response.body.code, 'FORBIDDEN')
    })

    it('blocks PHARMACY accounts', async () => {
      const response = await request('/api/cart', { token: pharmacyToken })
      assert.equal(response.status, 403)
    })

    it('blocks ADMIN accounts', async () => {
      const response = await request('/api/cart', { token: adminToken })
      assert.equal(response.status, 403)
    })

    it('allows PATIENT accounts', async () => {
      const response = await request('/api/cart', { token: patientAToken })
      assert.equal(response.status, 200)
      assert.deepEqual(response.body.data.carts, [])
    })
  })

  describe('add item', () => {
    it('adds a publicly available medicine with server-derived snapshots', async () => {
      const response = await addMedicine(patientAToken, paracetamol, 2)

      assert.equal(response.status, 201)
      const { cart } = response.body.data
      assert.equal(cart.pharmacy.pharmacyName, 'Aarogya Pharmacy')
      assert.equal(cart.itemCount, 1)
      assert.equal(cart.totalQuantity, 2)
      assert.equal(cart.subtotal, 51)

      const item = cart.items[0]
      assert.equal(item.medicineId, paracetamol._id.toString())
      assert.equal(item.name, 'Paracetamol')
      assert.equal(item.genericName, 'Acetaminophen')
      assert.equal(item.brandName, 'Dolo')
      assert.equal(item.category, 'TABLET')
      assert.equal(item.strength, '500 mg')
      assert.equal(item.dosageForm, 'Tablet')
      assert.equal(item.packSize, '10 tablets')
      assert.equal(item.quantity, 2)
      assert.equal(item.unitPrice, 25.5)
      assert.equal(item.subtotal, 51)
      assert.equal(item.prescriptionRequired, false)
      assert.equal(item.currentUnitPrice, 25.5)
      assert.equal(item.priceChanged, false)
      assert.equal(item.currentStock, 100)
      assert.equal(item.available, true)
    })

    it('rejects a malformed medicine identifier', async () => {
      const response = await request('/api/cart/items', {
        method: 'POST',
        token: patientAToken,
        body: { medicineId: 'not-an-id', quantity: 1 },
      })
      assert.equal(response.status, 400)
      assert.equal(response.body.code, 'VALIDATION_ERROR')
      assert.equal(response.body.details[0].field, 'medicineId')
    })

    it('returns MEDICINE_NOT_FOUND for an unknown medicine', async () => {
      const response = await request('/api/cart/items', {
        method: 'POST',
        token: patientAToken,
        body: {
          medicineId: new mongoose.Types.ObjectId().toString(),
          quantity: 1,
        },
      })
      assert.equal(response.status, 404)
      assert.equal(response.body.code, 'MEDICINE_NOT_FOUND')
    })

    it('rejects an inactive medicine', async () => {
      const response = await addMedicine(patientAToken, inactiveMedicine)
      assert.equal(response.status, 409)
      assert.equal(response.body.code, 'MEDICINE_UNAVAILABLE')
    })

    it('rejects an expired medicine', async () => {
      const response = await addMedicine(patientAToken, expiredMedicine)
      assert.equal(response.status, 409)
      assert.equal(response.body.code, 'MEDICINE_EXPIRED')
    })

    it('rejects an out-of-stock medicine', async () => {
      const response = await addMedicine(patientAToken, outOfStockMedicine)
      assert.equal(response.status, 409)
      assert.equal(response.body.code, 'MEDICINE_OUT_OF_STOCK')
    })

    it('rejects a medicine from an inactive pharmacy', async () => {
      const response = await addMedicine(
        patientAToken,
        inactivePharmacyMedicine,
      )
      assert.equal(response.status, 409)
      assert.equal(response.body.code, 'PHARMACY_UNAVAILABLE')
    })

    it('rejects a medicine from an unapproved pharmacy', async () => {
      const response = await addMedicine(patientAToken, pendingMedicine)
      assert.equal(response.status, 409)
      assert.equal(response.body.code, 'PHARMACY_UNAVAILABLE')
    })

    it('allows a prescription-required medicine and preserves the requirement', async () => {
      const response = await addMedicine(
        patientAToken,
        prescriptionMedicine,
        3,
      )
      assert.equal(response.status, 201)
      const item = response.body.data.cart.items[0]
      assert.equal(item.prescriptionRequired, true)
      assert.equal(item.quantity, 3)
    })

    it('rejects invalid quantity values', async () => {
      const invalidQuantities = [undefined, null, '2', 0, -1, 1.5, true, 101]
      for (const quantity of invalidQuantities) {
        const response = await request('/api/cart/items', {
          method: 'POST',
          token: patientAToken,
          body: { medicineId: paracetamol._id.toString(), quantity },
        })
        assert.equal(response.status, 400, `quantity: ${String(quantity)}`)
        assert.equal(response.body.code, 'VALIDATION_ERROR')
      }
    })

    it('rejects a quantity above current stock', async () => {
      const response = await addMedicine(
        patientAToken,
        prescriptionMedicine,
        11,
      )
      assert.equal(response.status, 409)
      assert.equal(response.body.code, 'CART_QUANTITY_EXCEEDS_STOCK')
    })

    it('rejects a non-object payload', async () => {
      const response = await request('/api/cart/items', {
        method: 'POST',
        token: patientAToken,
        body: [],
      })
      assert.equal(response.status, 400)
      assert.equal(response.body.code, 'INVALID_REQUEST_BODY')
    })
  })

  describe('existing item', () => {
    it('updates quantity instead of creating a duplicate item', async () => {
      await addMedicine(patientAToken, paracetamol, 2)
      const response = await addMedicine(patientAToken, paracetamol, 3)

      assert.equal(response.status, 201)
      const { cart } = response.body.data
      assert.equal(cart.items.length, 1)
      assert.equal(cart.items[0].quantity, 5)
      assert.equal(cart.items[0].subtotal, 127.5)
      assert.equal(cart.totalQuantity, 5)

      const storedCart = await Cart.findOne({ patientId: patientA._id }).lean()
      assert.equal(storedCart.items.length, 1)
      assert.equal(storedCart.items[0].quantity, 5)
    })

    it('keeps the original price snapshot when quantity is increased', async () => {
      await addMedicine(patientAToken, paracetamol, 1)
      await Medicine.updateOne(
        { _id: paracetamol._id },
        { $set: { price: 30 } },
      )

      const response = await addMedicine(patientAToken, paracetamol, 1)
      assert.equal(response.status, 201)
      const item = response.body.data.cart.items[0]
      assert.equal(item.quantity, 2)
      assert.equal(item.unitPrice, 25.5)
      assert.equal(item.currentUnitPrice, 30)
      assert.equal(item.priceChanged, true)
    })

    it('rejects a cumulative quantity above stock', async () => {
      await addMedicine(patientAToken, prescriptionMedicine, 6)
      const response = await addMedicine(
        patientAToken,
        prescriptionMedicine,
        5,
      )

      assert.equal(response.status, 409)
      assert.equal(response.body.code, 'CART_QUANTITY_EXCEEDS_STOCK')

      const cart = await Cart.findOne({ patientId: patientA._id }).lean()
      assert.equal(cart.items[0].quantity, 6)
    })

    it('rejects a cumulative quantity above the application maximum', async () => {
      await Medicine.updateOne(
        { _id: paracetamol._id },
        { $set: { stockQuantity: 500 } },
      )
      await addMedicine(patientAToken, paracetamol, 60)
      const response = await addMedicine(patientAToken, paracetamol, 50)

      assert.equal(response.status, 409)
      assert.equal(response.body.code, 'CART_QUANTITY_LIMIT_EXCEEDED')

      const cart = await Cart.findOne({ patientId: patientA._id }).lean()
      assert.equal(cart.items[0].quantity, 60)
    })

    it('handles concurrent duplicate add requests without duplicate rows', async () => {
      const [first, second] = await Promise.all([
        addMedicine(patientAToken, paracetamol, 2),
        addMedicine(patientAToken, paracetamol, 2),
      ])

      assert.equal(first.status, 201)
      assert.equal(second.status, 201)

      const carts = await Cart.find({ patientId: patientA._id }).lean()
      assert.equal(carts.length, 1)
      assert.equal(carts[0].items.length, 1)
      assert.equal(carts[0].items[0].quantity, 4)
    })
  })

  describe('read cart', () => {
    it('returns a clean empty response when the patient has no cart', async () => {
      const response = await request('/api/cart', { token: patientAToken })

      assert.equal(response.status, 200)
      assert.deepEqual(response.body.data.carts, [])
      assert.deepEqual(response.body.data.summary, {
        cartCount: 0,
        itemCount: 0,
        totalQuantity: 0,
        subtotal: 0,
      })
    })

    it('returns the correct pharmacy summary without private contact fields', async () => {
      await addMedicine(patientAToken, paracetamol, 1)
      const response = await request('/api/cart', { token: patientAToken })

      const cart = cartByName(response, 'Aarogya Pharmacy')
      assert.equal(cart.pharmacy.id, pharmacyA._id.toString())
      assert.equal(cart.pharmacy.pharmacistName, 'Ravi Kumar')
      assert.equal(cart.pharmacy.address, 'Main Road')
      assert.equal(cart.pharmacy.city, 'Berhampur')
      assert.equal(cart.pharmacy.state, 'Odisha')
      assert.equal(cart.pharmacy.pincode, '760001')

      const serialized = JSON.stringify(response.body)
      assert.equal(serialized.includes('private@aarogyapharmacy.test'), false)
      assert.equal(serialized.includes('9876543210'), false)
      assert.equal(serialized.includes('OD-PH-2026-301'), false)
      assert.equal(serialized.includes(pharmacyAUser._id.toString()), false)
    })

    it('calculates item, pharmacy, and overall totals', async () => {
      await addMedicine(patientAToken, paracetamol, 2)
      await addMedicine(patientAToken, prescriptionMedicine, 1)

      const response = await request('/api/cart', { token: patientAToken })
      const cart = cartByName(response, 'Aarogya Pharmacy')

      assert.equal(cart.itemCount, 2)
      assert.equal(cart.totalQuantity, 3)
      assert.equal(cart.subtotal, 141)
      assert.equal(
        itemByMedicine(cart, paracetamol).subtotal,
        51,
      )
      assert.equal(
        itemByMedicine(cart, prescriptionMedicine).subtotal,
        90,
      )
      assert.deepEqual(response.body.data.summary, {
        cartCount: 1,
        itemCount: 2,
        totalQuantity: 3,
        subtotal: 141,
      })
    })

    it('keeps carts from different pharmacies separate', async () => {
      await addMedicine(patientAToken, paracetamol, 1)
      await addMedicine(patientAToken, multivitamin, 2)

      const response = await request('/api/cart', { token: patientAToken })
      assert.equal(response.body.data.carts.length, 2)
      assert.deepEqual(response.body.data.summary, {
        cartCount: 2,
        itemCount: 2,
        totalQuantity: 3,
        subtotal: 50.5,
      })

      const pharmacyACart = cartByName(response, 'Aarogya Pharmacy')
      const pharmacyBCart = cartByName(response, 'Wellness Pharmacy')
      assert.equal(pharmacyACart.items.length, 1)
      assert.equal(pharmacyBCart.items.length, 1)
      assert.equal(pharmacyACart.items[0].name, 'Paracetamol')
      assert.equal(pharmacyBCart.items[0].name, 'Multivitamin')
    })

    it('detects a price change without changing the snapshot', async () => {
      await addMedicine(patientAToken, paracetamol, 2)
      await Medicine.updateOne(
        { _id: paracetamol._id },
        { $set: { price: 30 } },
      )

      const response = await request('/api/cart', { token: patientAToken })
      const cart = cartByName(response, 'Aarogya Pharmacy')
      const item = itemByMedicine(cart, paracetamol)

      assert.equal(item.unitPrice, 25.5)
      assert.equal(item.currentUnitPrice, 30)
      assert.equal(item.priceChanged, true)
      assert.equal(item.subtotal, 51)

      const stored = await Cart.findOne({ patientId: patientA._id }).lean()
      assert.equal(stored.items[0].unitPriceSnapshot, 25.5)
    })

    it('detects when the cart quantity exceeds current stock', async () => {
      await addMedicine(patientAToken, paracetamol, 5)
      await Medicine.updateOne(
        { _id: paracetamol._id },
        { $set: { stockQuantity: 2 } },
      )

      const response = await request('/api/cart', { token: patientAToken })
      const item = itemByMedicine(
        cartByName(response, 'Aarogya Pharmacy'),
        paracetamol,
      )

      assert.equal(item.currentStock, 2)
      assert.equal(item.quantity, 5)
      assert.equal(item.quantityExceeded, true)
      assert.equal(item.available, false)
      assert.equal(item.availabilityStatus, 'quantityExceeded')
    })

    it('detects out-of-stock medicines without removing them', async () => {
      await addMedicine(patientAToken, paracetamol, 3)
      await Medicine.updateOne(
        { _id: paracetamol._id },
        { $set: { stockQuantity: 0 } },
      )

      const response = await request('/api/cart', { token: patientAToken })
      const cart = cartByName(response, 'Aarogya Pharmacy')
      const item = itemByMedicine(cart, paracetamol)

      assert.equal(cart.items.length, 1)
      assert.equal(item.outOfStock, true)
      assert.equal(item.available, false)
      assert.equal(item.availabilityStatus, 'outOfStock')
    })

    it('detects a medicine that has expired', async () => {
      await addMedicine(patientAToken, paracetamol, 1)
      await Medicine.updateOne(
        { _id: paracetamol._id },
        { $set: { expiryDate: past } },
      )

      const response = await request('/api/cart', { token: patientAToken })
      const cart = cartByName(response, 'Aarogya Pharmacy')
      const item = itemByMedicine(cart, paracetamol)

      assert.equal(cart.items.length, 1)
      assert.equal(item.expired, true)
      assert.equal(item.available, false)
      assert.equal(item.availabilityStatus, 'expired')
    })

    it('detects a medicine that has been deactivated', async () => {
      await addMedicine(patientAToken, paracetamol, 1)
      await Medicine.updateOne(
        { _id: paracetamol._id },
        { $set: { isActive: false } },
      )

      const response = await request('/api/cart', { token: patientAToken })
      const item = itemByMedicine(
        cartByName(response, 'Aarogya Pharmacy'),
        paracetamol,
      )

      assert.equal(item.active, false)
      assert.equal(item.available, false)
      assert.equal(item.availabilityStatus, 'unavailable')
    })

    it('detects when the pharmacy is no longer available', async () => {
      await addMedicine(patientAToken, paracetamol, 1)
      await Pharmacy.updateOne(
        { _id: pharmacyA._id },
        { $set: { verificationStatus: 'REJECTED' } },
      )

      const response = await request('/api/cart', { token: patientAToken })
      const cart = cartByName(response, 'Aarogya Pharmacy')
      const item = itemByMedicine(cart, paracetamol)

      assert.equal(cart.pharmacyAvailable, false)
      assert.equal(item.available, false)
      assert.equal(item.availabilityStatus, 'pharmacyUnavailable')
    })

    it('marks low stock availability without hiding the item', async () => {
      await addMedicine(patientAToken, lowStockMedicine, 1)

      const response = await request('/api/cart', { token: patientAToken })
      const item = itemByMedicine(
        cartByName(response, 'Aarogya Pharmacy'),
        lowStockMedicine,
      )

      assert.equal(item.available, true)
      assert.equal(item.lowStock, true)
      assert.equal(item.currentStock, 3)
      assert.equal(item.availabilityStatus, 'lowStock')
    })

    it('keeps an item visible when its medicine record no longer exists', async () => {
      await addMedicine(patientAToken, paracetamol, 2)
      await Medicine.deleteOne({ _id: paracetamol._id })

      const response = await request('/api/cart', { token: patientAToken })
      const cart = cartByName(response, 'Aarogya Pharmacy')
      const item = itemByMedicine(cart, paracetamol)

      assert.equal(cart.items.length, 1)
      assert.equal(item.name, 'Paracetamol')
      assert.equal(item.available, false)
      assert.equal(item.active, false)
      assert.equal(item.availabilityStatus, 'unavailable')
    })
  })

  describe('update item', () => {
    it('updates the quantity and recalculates the subtotal', async () => {
      await addMedicine(patientAToken, paracetamol, 2)
      const response = await updatedQuantity(
        patientAToken,
        paracetamol,
        4,
      )

      assert.equal(response.status, 200)
      const { cart } = response.body.data
      assert.equal(cart.items.length, 1)
      assert.equal(cart.items[0].quantity, 4)
      assert.equal(cart.items[0].subtotal, 102)
      assert.equal(cart.subtotal, 102)
    })

    it('rejects a quantity above current stock', async () => {
      await addMedicine(patientAToken, prescriptionMedicine, 2)
      const response = await updatedQuantity(
        patientAToken,
        prescriptionMedicine,
        11,
      )

      assert.equal(response.status, 409)
      assert.equal(response.body.code, 'CART_QUANTITY_EXCEEDS_STOCK')

      const cart = await Cart.findOne({ patientId: patientA._id }).lean()
      assert.equal(cart.items[0].quantity, 2)
    })

    it('rejects invalid quantities', async () => {
      await addMedicine(patientAToken, paracetamol, 1)
      for (const quantity of [0, -1, 1.5, '2', 101]) {
        const response = await updatedQuantity(
          patientAToken,
          paracetamol,
          quantity,
        )
        assert.equal(response.status, 400, `quantity: ${String(quantity)}`)
      }
    })

    it('does not let another patient modify the item', async () => {
      await addMedicine(patientAToken, paracetamol, 2)
      const response = await updatedQuantity(patientBToken, paracetamol, 5)

      assert.equal(response.status, 404)
      assert.equal(response.body.code, 'CART_ITEM_NOT_FOUND')

      const cart = await Cart.findOne({ patientId: patientA._id }).lean()
      assert.equal(cart.items[0].quantity, 2)
    })

    it('returns CART_ITEM_NOT_FOUND for an item not in the cart', async () => {
      const response = await updatedQuantity(
        patientAToken,
        paracetamol,
        2,
      )
      assert.equal(response.status, 404)
      assert.equal(response.body.code, 'CART_ITEM_NOT_FOUND')
    })

    it('rejects a malformed medicine identifier', async () => {
      const response = await request('/api/cart/items/not-an-id', {
        method: 'PATCH',
        token: patientAToken,
        body: { quantity: 2 },
      })
      assert.equal(response.status, 400)
      assert.equal(response.body.code, 'VALIDATION_ERROR')
    })

    it('rejects a non-object payload', async () => {
      await addMedicine(patientAToken, paracetamol, 1)
      const response = await request(
        `/api/cart/items/${paracetamol._id.toString()}`,
        { method: 'PATCH', token: patientAToken, body: [] },
      )
      assert.equal(response.status, 400)
      assert.equal(response.body.code, 'INVALID_REQUEST_BODY')
    })
  })

  describe('remove item', () => {
    it('removes an item from the patient cart', async () => {
      await addMedicine(patientAToken, paracetamol, 1)
      await addMedicine(patientAToken, prescriptionMedicine, 1)

      const response = await removedItem(patientAToken, paracetamol)
      assert.equal(response.status, 200)
      const { cart } = response.body.data
      assert.equal(cart.items.length, 1)
      assert.equal(cart.items[0].medicineId, prescriptionMedicine._id.toString())

      const stored = await Cart.findOne({ patientId: patientA._id }).lean()
      assert.equal(stored.items.length, 1)
    })

    it('returns an empty cart response after removing the last item', async () => {
      await addMedicine(patientAToken, paracetamol, 1)
      const response = await removedItem(patientAToken, paracetamol)

      assert.equal(response.status, 200)
      assert.equal(response.body.data.cart, null)

      const read = await request('/api/cart', { token: patientAToken })
      assert.deepEqual(read.body.data.carts, [])
      assert.equal(read.body.data.summary.itemCount, 0)
    })

    it('does not let another patient remove the item', async () => {
      await addMedicine(patientAToken, paracetamol, 1)
      const response = await removedItem(patientBToken, paracetamol)

      assert.equal(response.status, 404)
      assert.equal(response.body.code, 'CART_ITEM_NOT_FOUND')

      const stored = await Cart.findOne({ patientId: patientA._id }).lean()
      assert.equal(stored.items.length, 1)
    })

    it('returns CART_ITEM_NOT_FOUND for a missing item', async () => {
      const response = await removedItem(patientAToken, paracetamol)
      assert.equal(response.status, 404)
      assert.equal(response.body.code, 'CART_ITEM_NOT_FOUND')
    })

    it('rejects a malformed medicine identifier', async () => {
      const response = await request('/api/cart/items/not-an-id', {
        method: 'DELETE',
        token: patientAToken,
      })
      assert.equal(response.status, 400)
      assert.equal(response.body.code, 'VALIDATION_ERROR')
    })
  })

  describe('clear cart', () => {
    it('clears the authenticated patient cart', async () => {
      const added = await addMedicine(patientAToken, paracetamol, 2)
      const cartId = added.body.data.cart.cartId

      const response = await request(`/api/cart/${cartId}`, {
        method: 'DELETE',
        token: patientAToken,
      })
      assert.equal(response.status, 200)
      assert.equal(response.body.data.cleared, true)

      const read = await request('/api/cart', { token: patientAToken })
      assert.deepEqual(read.body.data.carts, [])
      assert.equal(await Cart.countDocuments({ patientId: patientA._id }), 0)
    })

    it('does not let another patient clear the cart', async () => {
      const added = await addMedicine(patientAToken, paracetamol, 2)
      const cartId = added.body.data.cart.cartId

      const response = await request(`/api/cart/${cartId}`, {
        method: 'DELETE',
        token: patientBToken,
      })
      assert.equal(response.status, 404)
      assert.equal(response.body.code, 'CART_NOT_FOUND')
      assert.equal(await Cart.countDocuments({ patientId: patientA._id }), 1)
    })

    it('returns CART_NOT_FOUND for an unknown cart', async () => {
      const response = await request(
        `/api/cart/${new mongoose.Types.ObjectId().toString()}`,
        { method: 'DELETE', token: patientAToken },
      )
      assert.equal(response.status, 404)
      assert.equal(response.body.code, 'CART_NOT_FOUND')
    })

    it('rejects a malformed cart identifier', async () => {
      const response = await request('/api/cart/not-an-id', {
        method: 'DELETE',
        token: patientAToken,
      })
      assert.equal(response.status, 400)
      assert.equal(response.body.code, 'VALIDATION_ERROR')
    })

    it('clears only the selected pharmacy cart', async () => {
      const first = await addMedicine(patientAToken, paracetamol, 1)
      await addMedicine(patientAToken, multivitamin, 1)
      const cartId = first.body.data.cart.cartId

      const response = await request(`/api/cart/${cartId}`, {
        method: 'DELETE',
        token: patientAToken,
      })
      assert.equal(response.status, 200)

      const read = await request('/api/cart', { token: patientAToken })
      assert.equal(read.body.data.carts.length, 1)
      assert.equal(
        read.body.data.carts[0].pharmacy.pharmacyName,
        'Wellness Pharmacy',
      )
    })
  })

  describe('security', () => {
    it('ignores a client-supplied patientId', async () => {
      const response = await addMedicine(
        patientAToken,
        paracetamol,
        1,
        { patientId: patientB._id.toString() },
      )
      assert.equal(response.status, 201)

      const stored = await Cart.findOne({
        patientId: patientA._id,
        pharmacyId: pharmacyA._id,
      }).lean()
      assert.ok(stored)
      assert.equal(
        await Cart.countDocuments({ patientId: patientB._id }),
        0,
      )
    })

    it('ignores a client-supplied pharmacyId', async () => {
      const response = await addMedicine(
        patientAToken,
        paracetamol,
        1,
        { pharmacyId: pharmacyB._id.toString() },
      )
      assert.equal(response.status, 201)
      assert.equal(
        response.body.data.cart.pharmacy.id,
        pharmacyA._id.toString(),
      )

      const stored = await Cart.findOne({ patientId: patientA._id }).lean()
      assert.equal(stored.pharmacyId.toString(), pharmacyA._id.toString())
    })

    it('ignores client-supplied price, stock, and medicine snapshots', async () => {
      const response = await addMedicine(
        patientAToken,
        paracetamol,
        1,
        {
          price: 1,
          unitPrice: 1,
          stockQuantity: 9999,
          stock: 9999,
          name: 'Fake Medicine',
          medicineNameSnapshot: 'Fake Medicine',
          prescriptionRequired: true,
        },
      )
      assert.equal(response.status, 201)

      const item = response.body.data.cart.items[0]
      assert.equal(item.name, 'Paracetamol')
      assert.equal(item.unitPrice, 25.5)
      assert.equal(item.currentStock, 100)
      assert.equal(item.prescriptionRequired, false)

      const stored = await Cart.findOne({ patientId: patientA._id }).lean()
      assert.equal(stored.items[0].unitPriceSnapshot, 25.5)
      assert.equal(stored.items[0].medicineNameSnapshot, 'Paracetamol')
    })

    it('never exposes password hashes, tokens, or ownership internals', async () => {
      await addMedicine(patientAToken, paracetamol, 1)
      const response = await request('/api/cart', { token: patientAToken })
      const serialized = JSON.stringify(response.body)

      for (const forbidden of [
        'passwordHash',
        'token',
        'accessToken',
        'identityKey',
        'patientId',
        'userId',
        '_id',
        '__v',
        'unitPriceSnapshot',
        'medicineNameSnapshot',
      ]) {
        assert.equal(
          serialized.includes(forbidden),
          false,
          `${forbidden} was exposed`,
        )
      }
    })

    it('does not expose another patient cart through any operation', async () => {
      await addMedicine(patientAToken, paracetamol, 2)

      const list = await request('/api/cart', { token: patientBToken })
      assert.deepEqual(list.body.data.carts, [])

      const update = await updatedQuantity(patientBToken, paracetamol, 1)
      assert.equal(update.status, 404)

      const remove = await removedItem(patientBToken, paracetamol)
      assert.equal(remove.status, 404)

      const stored = await Cart.findOne({ patientId: patientA._id }).lean()
      assert.equal(stored.items[0].quantity, 2)
    })
  })
})
