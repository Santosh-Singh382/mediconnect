const { describe, before, after, beforeEach, it } = require('node:test')
const assert = require('node:assert/strict')
const mongoose = require('mongoose')
const {
  startServer,
  stopServer,
  clearUsers,
  clearPrescriptions,
  clearPharmacies,
  clearMedicines,
  clearCarts,
  clearOrders,
  createUser,
  tokenForUser,
  request,
  Pharmacy,
  Medicine,
  Cart,
  Prescription,
  Order,
} = require('./helpers')
const { buildIdentityKey } = require('../src/services/medicine.service')

const future = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
const past = new Date(Date.now() - 24 * 60 * 60 * 1000)

function pharmacyData(overrides = {}) {
  return {
    pharmacyName: 'Aarogya Pharmacy',
    pharmacistName: 'Ravi Kumar',
    licenseNumber: 'OD-PH-2026-501',
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

function addressData(overrides = {}) {
  return {
    fullName: 'Rina Das',
    phone: '9876543210',
    addressLine1: '12 Main Road',
    addressLine2: 'Near Bus Stop',
    city: 'Berhampur',
    state: 'Odisha',
    pincode: '760001',
    landmark: 'Opposite the park',
    ...overrides,
  }
}

function checkoutPayload(cartId, overrides = {}) {
  return {
    cartId,
    deliveryAddress: addressData(),
    paymentMethod: 'COD',
    ...overrides,
  }
}

async function addToCart(token, medicine, quantity = 1) {
  const response = await request('/api/cart/items', {
    method: 'POST',
    token,
    body: { medicineId: medicine._id.toString(), quantity },
  })
  assert.equal(response.status, 201, JSON.stringify(response.body))
  return response.body.data.cart.cartId
}

async function checkout(token, payload, headers) {
  return request('/api/orders/checkout', {
    method: 'POST',
    token,
    headers,
    body: payload,
  })
}

async function placeOrder(token, medicine, quantity = 1, overrides = {}) {
  const cartId = await addToCart(token, medicine, quantity)
  const response = await checkout(token, checkoutPayload(cartId, overrides))
  assert.equal(response.status, 201, JSON.stringify(response.body))
  return response.body.data.order
}

async function createPrescription(patient, doctor, overrides = {}) {
  return Prescription.create({
    appointmentId: new mongoose.Types.ObjectId(),
    patientId: patient._id,
    doctorId: doctor._id,
    diagnosis: 'Infection',
    medicines: [
      {
        medicineName: 'Amoxicillin',
        dosage: '1 capsule',
        frequency: 'Twice daily',
        duration: '5 days',
        quantity: 10,
      },
    ],
    status: 'ACTIVE',
    ...overrides,
  })
}

describe('Order creation and checkout module', () => {
  let patientA
  let patientB
  let doctorUser
  let pharmacyAUser
  let pharmacyBUser
  let pendingOwner
  let inactiveOwner
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
  let cetirizine
  let prescriptionMedicine
  let multivitamin

  before(async () => {
    await startServer()
    await Order.init()
  })

  after(async () => {
    await stopServer()
  })

  beforeEach(async () => {
    await clearOrders()
    await clearCarts()
    await clearPrescriptions()
    await clearMedicines()
    await clearPharmacies()
    await clearUsers()

    patientA = await createUser({
      name: 'Order Patient A',
      email: 'order-patient-a@example.com',
      phone: '9876543210',
      role: 'PATIENT',
    })
    patientB = await createUser({
      name: 'Order Patient B',
      email: 'order-patient-b@example.com',
      phone: '9876543211',
      role: 'PATIENT',
    })
    doctorUser = await createUser({
      name: 'Order Doctor',
      email: 'order-doctor@example.com',
      role: 'DOCTOR',
    })
    pharmacyAUser = await createUser({
      name: 'Aarogya Owner',
      email: 'order-pharmacy-a@example.com',
      role: 'PHARMACY',
    })
    pharmacyBUser = await createUser({
      name: 'Wellness Owner',
      email: 'order-pharmacy-b@example.com',
      role: 'PHARMACY',
    })
    pendingOwner = await createUser({
      name: 'Pending Owner',
      email: 'order-pending@example.com',
      role: 'PHARMACY',
    })
    inactiveOwner = await createUser({
      name: 'Inactive Owner',
      email: 'order-inactive@example.com',
      role: 'PHARMACY',
    })
    adminUser = await createUser({
      name: 'Order Admin',
      email: 'order-admin@example.com',
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
      licenseNumber: 'OD-PH-2026-502',
      address: 'Market Street',
      city: 'Bhubaneswar',
    })

    pendingPharmacy = await createPharmacy(pendingOwner, {
      pharmacyName: 'Pending Pharmacy',
      licenseNumber: 'OD-PH-2026-503',
      verificationStatus: 'PENDING',
    })
    inactivePharmacy = await createPharmacy(inactiveOwner, {
      pharmacyName: 'Inactive Pharmacy',
      licenseNumber: 'OD-PH-2026-504',
      isActive: false,
    })

    paracetamol = await createMedicine(pharmacyA)
    cetirizine = await createMedicine(pharmacyA, {
      name: 'Cetirizine',
      genericName: 'Cetirizine Hydrochloride',
      brandName: 'Alerid',
      strength: '10 mg',
      price: 18.25,
      stockQuantity: 10,
    })
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
    multivitamin = await createMedicine(pharmacyB, {
      name: 'Multivitamin',
      genericName: 'Multivitamin',
      brandName: 'Supradyn',
      strength: 'Daily',
      price: 12.5,
      stockQuantity: 20,
    })
  })

  describe('authentication', () => {
    it('rejects an unauthenticated checkout', async () => {
      const response = await checkout(null, checkoutPayload(new mongoose.Types.ObjectId()))
      assert.equal(response.status, 401)
      assert.equal(response.body.code, 'UNAUTHORIZED')
    })

    it('rejects an unauthenticated order list', async () => {
      const response = await request('/api/orders')
      assert.equal(response.status, 401)
      assert.equal(response.body.code, 'UNAUTHORIZED')
    })

    it('rejects an unauthenticated order detail read', async () => {
      const response = await request(
        `/api/orders/${new mongoose.Types.ObjectId().toString()}`,
      )
      assert.equal(response.status, 401)
      assert.equal(response.body.code, 'UNAUTHORIZED')
    })
  })

  describe('roles', () => {
    it('blocks DOCTOR accounts from checkout', async () => {
      const cartId = new mongoose.Types.ObjectId().toString()
      const response = await checkout(doctorToken, checkoutPayload(cartId))
      assert.equal(response.status, 403)
      assert.equal(response.body.code, 'FORBIDDEN')
    })

    it('blocks PHARMACY accounts from checkout', async () => {
      const response = await checkout(
        pharmacyToken,
        checkoutPayload(new mongoose.Types.ObjectId().toString()),
      )
      assert.equal(response.status, 403)
      assert.equal(response.body.code, 'FORBIDDEN')
    })

    it('blocks ADMIN accounts from checkout', async () => {
      const response = await checkout(
        adminToken,
        checkoutPayload(new mongoose.Types.ObjectId().toString()),
      )
      assert.equal(response.status, 403)
      assert.equal(response.body.code, 'FORBIDDEN')
    })

    it('allows a patient to place an order', async () => {
      const order = await placeOrder(patientAToken, paracetamol, 1)
      assert.equal(order.orderStatus, 'PLACED')
    })

    it('blocks non-patient roles from order history', async () => {
      const response = await request('/api/orders', { token: doctorToken })
      assert.equal(response.status, 403)
      assert.equal(response.body.code, 'FORBIDDEN')
    })
  })

  describe('cart validation', () => {
    it('rejects a malformed cart identifier', async () => {
      const response = await checkout(
        patientAToken,
        checkoutPayload('not-an-id'),
      )
      assert.equal(response.status, 400)
      assert.equal(response.body.code, 'VALIDATION_ERROR')
      assert.equal(response.body.details[0].field, 'cartId')
    })

    it('rejects an unknown cart', async () => {
      const response = await checkout(
        patientAToken,
        checkoutPayload(new mongoose.Types.ObjectId().toString()),
      )
      assert.equal(response.status, 404)
      assert.equal(response.body.code, 'CART_NOT_FOUND')
    })

    it('rejects another patient cart without creating an order', async () => {
      const cartId = await addToCart(patientAToken, paracetamol, 2)
      const response = await checkout(patientBToken, checkoutPayload(cartId))

      assert.equal(response.status, 404)
      assert.equal(response.body.code, 'CART_NOT_FOUND')
      assert.equal(await Order.countDocuments({}), 0)
      assert.equal((await Medicine.findById(paracetamol._id).lean()).stockQuantity, 100)
      assert.ok(await Cart.findById(cartId).lean())
    })

    it('rejects an empty cart', async () => {
      const cartId = await addToCart(patientAToken, paracetamol, 1)
      const removed = await request(
        `/api/cart/items/${paracetamol._id.toString()}`,
        { method: 'DELETE', token: patientAToken },
      )
      assert.equal(removed.status, 200)
      assert.equal(removed.body.data.cart, null)

      const response = await checkout(patientAToken, checkoutPayload(cartId))
      assert.equal(response.status, 409)
      assert.equal(response.body.code, 'CART_EMPTY')
      assert.equal(await Order.countDocuments({}), 0)
    })

    it('creates one order for exactly one pharmacy', async () => {
      const cartId = await addToCart(patientAToken, paracetamol, 1)
      await addToCart(patientAToken, multivitamin, 1)

      const response = await checkout(patientAToken, checkoutPayload(cartId))
      assert.equal(response.status, 201)
      const { order } = response.body.data
      assert.equal(order.pharmacy.id, pharmacyA._id.toString())
      assert.equal(order.pharmacy.pharmacyName, 'Aarogya Pharmacy')
      assert.equal(order.items.length, 1)
      assert.equal(order.items[0].name, 'Paracetamol')

      const dirtyCart = await Cart.findOne({
        patientId: patientA._id,
        'items.medicineId': multivitamin._id,
      }).lean()
      assert.ok(dirtyCart)
    })
  })

  describe('medicine and pharmacy validation', () => {
    it('rejects a cart whose medicine record no longer exists', async () => {
      const cartId = await addToCart(patientAToken, paracetamol, 1)
      await Medicine.deleteOne({ _id: paracetamol._id })

      const response = await checkout(patientAToken, checkoutPayload(cartId))
      assert.equal(response.status, 409)
      assert.equal(response.body.code, 'MEDICINE_NOT_FOUND')
      assert.equal(await Order.countDocuments({}), 0)
    })

    it('rejects an inactive medicine', async () => {
      const cartId = await addToCart(patientAToken, paracetamol, 1)
      await Medicine.updateOne(
        { _id: paracetamol._id },
        { $set: { isActive: false } },
      )

      const response = await checkout(patientAToken, checkoutPayload(cartId))
      assert.equal(response.status, 409)
      assert.equal(response.body.code, 'MEDICINE_UNAVAILABLE')
      assert.equal(await Order.countDocuments({}), 0)
    })

    it('rejects an expired medicine', async () => {
      const cartId = await addToCart(patientAToken, paracetamol, 1)
      await Medicine.updateOne(
        { _id: paracetamol._id },
        { $set: { expiryDate: past } },
      )

      const response = await checkout(patientAToken, checkoutPayload(cartId))
      assert.equal(response.status, 409)
      assert.equal(response.body.code, 'MEDICINE_EXPIRED')
      assert.equal(await Order.countDocuments({}), 0)
    })

    it('rejects an out-of-stock medicine with safe stock details', async () => {
      const cartId = await addToCart(patientAToken, paracetamol, 1)
      await Medicine.updateOne(
        { _id: paracetamol._id },
        { $set: { stockQuantity: 0 } },
      )

      const response = await checkout(patientAToken, checkoutPayload(cartId))
      assert.equal(response.status, 409)
      assert.equal(response.body.code, 'INSUFFICIENT_STOCK')
      assert.equal(response.body.details[0].availableQuantity, 0)
      assert.equal(response.body.details[0].requestedQuantity, 1)
      assert.equal(await Order.countDocuments({}), 0)
    })

    it('rejects a quantity above current stock', async () => {
      const cartId = await addToCart(patientAToken, cetirizine, 2)
      await Medicine.updateOne(
        { _id: cetirizine._id },
        { $set: { stockQuantity: 1 } },
      )

      const response = await checkout(patientAToken, checkoutPayload(cartId))
      assert.equal(response.status, 409)
      assert.equal(response.body.code, 'INSUFFICIENT_STOCK')
      assert.deepEqual(
        {
          requested: response.body.details[0].requestedQuantity,
          available: response.body.details[0].availableQuantity,
        },
        { requested: 2, available: 1 },
      )
      assert.equal(
        (await Medicine.findById(cetirizine._id).lean()).stockQuantity,
        1,
      )
      assert.ok(await Cart.findById(cartId).lean())
    })

    it('rejects a medicine moved to another pharmacy', async () => {
      const cartId = await addToCart(patientAToken, paracetamol, 1)
      await Medicine.updateOne(
        { _id: paracetamol._id },
        { $set: { pharmacyId: pharmacyB._id } },
      )

      const response = await checkout(patientAToken, checkoutPayload(cartId))
      assert.equal(response.status, 409)
      assert.equal(response.body.code, 'MEDICINE_UNAVAILABLE')
      assert.equal(await Order.countDocuments({}), 0)
    })

    it('rejects an unapproved pharmacy', async () => {
      const cartId = await addToCart(patientAToken, paracetamol, 1)
      await Pharmacy.updateOne(
        { _id: pharmacyA._id },
        { $set: { verificationStatus: 'PENDING' } },
      )

      const response = await checkout(patientAToken, checkoutPayload(cartId))
      assert.equal(response.status, 409)
      assert.equal(response.body.code, 'PHARMACY_UNAVAILABLE')
      assert.equal(
        (await Medicine.findById(paracetamol._id).lean()).stockQuantity,
        100,
      )
    })

    it('rejects an inactive pharmacy', async () => {
      const cartId = await addToCart(patientAToken, paracetamol, 1)
      await Pharmacy.updateOne(
        { _id: pharmacyA._id },
        { $set: { isActive: false } },
      )

      const response = await checkout(patientAToken, checkoutPayload(cartId))
      assert.equal(response.status, 409)
      assert.equal(response.body.code, 'PHARMACY_UNAVAILABLE')
      assert.equal(await Order.countDocuments({}), 0)
    })
  })

  describe('pricing', () => {
    it('accepts unchanged prices', async () => {
      const order = await placeOrder(patientAToken, paracetamol, 2)
      assert.equal(order.items[0].unitPrice, 25.5)
      assert.equal(order.subtotal, 51)
    })

    it('blocks checkout when a price has changed', async () => {
      const cartId = await addToCart(patientAToken, paracetamol, 2)
      await Medicine.updateOne(
        { _id: paracetamol._id },
        { $set: { price: 30 } },
      )

      const response = await checkout(patientAToken, checkoutPayload(cartId))
      assert.equal(response.status, 409)
      assert.equal(response.body.code, 'PRICE_CHANGED')
      assert.deepEqual(
        {
          medicineName: response.body.details[0].medicineName,
          previousPrice: response.body.details[0].previousPrice,
          currentPrice: response.body.details[0].currentPrice,
        },
        {
          medicineName: 'Paracetamol',
          previousPrice: 25.5,
          currentPrice: 30,
        },
      )
      assert.equal(await Order.countDocuments({}), 0)
      assert.equal(
        (await Medicine.findById(paracetamol._id).lean()).stockQuantity,
        100,
      )
      assert.ok(await Cart.findById(cartId).lean())
    })

    it('ignores client-supplied prices and totals', async () => {
      const cartId = await addToCart(patientAToken, paracetamol, 2)
      const response = await checkout(
        patientAToken,
        checkoutPayload(cartId, {
          unitPrice: 1,
          price: 1,
          subtotal: 2,
          total: 2,
          totalAmount: 2,
          deliveryFee: 50,
        }),
      )

      assert.equal(response.status, 201)
      const { order } = response.body.data
      assert.equal(order.items[0].unitPrice, 25.5)
      assert.equal(order.items[0].lineTotal, 51)
      assert.equal(order.subtotal, 51)
      assert.equal(order.deliveryFee, 0)
      assert.equal(order.totalAmount, 51)
    })
  })

  describe('prescriptions', () => {
    it('blocks prescription-required medicines without a prescription reference', async () => {
      const cartId = await addToCart(patientAToken, prescriptionMedicine, 2)

      const response = await checkout(patientAToken, checkoutPayload(cartId))
      assert.equal(response.status, 409)
      assert.equal(response.body.code, 'PRESCRIPTION_REQUIRED')
      assert.equal(response.body.details[0].medicineName, 'Amoxicillin')
      assert.equal(await Order.countDocuments({}), 0)
      assert.equal(
        (await Medicine.findById(prescriptionMedicine._id).lean())
          .stockQuantity,
        10,
      )
      assert.ok(await Cart.findById(cartId).lean())
    })

    it('does not let a client mark a prescription as verified', async () => {
      const cartId = await addToCart(patientAToken, prescriptionMedicine, 1)
      const response = await checkout(
        patientAToken,
        checkoutPayload(cartId, {
          prescriptionVerified: true,
          prescriptionStatus: 'VERIFIED',
          items: [{ prescriptionRequired: false }],
        }),
      )

      assert.equal(response.status, 409)
      assert.equal(response.body.code, 'PRESCRIPTION_REQUIRED')
      assert.equal(await Order.countDocuments({}), 0)
    })

    it('rejects malformed prescription selections', async () => {
      const cartId = await addToCart(patientAToken, prescriptionMedicine, 1)
      const response = await checkout(
        patientAToken,
        checkoutPayload(cartId, {
          prescriptionSelections: [
            { medicineId: 'bad-id', prescriptionId: 'also-bad' },
          ],
        }),
      )

      assert.equal(response.status, 400)
      assert.equal(response.body.code, 'VALIDATION_ERROR')
      assert.equal(
        response.body.details[0].field,
        'prescriptionSelections[0].medicineId',
      )
    })

    it('rejects an unknown prescription reference', async () => {
      const cartId = await addToCart(patientAToken, prescriptionMedicine, 1)
      const response = await checkout(
        patientAToken,
        checkoutPayload(cartId, {
          prescriptionSelections: [
            {
              medicineId: prescriptionMedicine._id.toString(),
              prescriptionId: new mongoose.Types.ObjectId().toString(),
            },
          ],
        }),
      )

      assert.equal(response.status, 409)
      assert.equal(response.body.code, 'INVALID_PRESCRIPTION')
      assert.equal(await Order.countDocuments({}), 0)
    })

    it('rejects another patient prescription reference', async () => {
      const prescription = await createPrescription(patientB, doctorUser)
      const cartId = await addToCart(patientAToken, prescriptionMedicine, 1)

      const response = await checkout(
        patientAToken,
        checkoutPayload(cartId, {
          prescriptionSelections: [
            {
              medicineId: prescriptionMedicine._id.toString(),
              prescriptionId: prescription._id.toString(),
            },
          ],
        }),
      )

      assert.equal(response.status, 409)
      assert.equal(response.body.code, 'INVALID_PRESCRIPTION')
    })

    it('rejects a cancelled prescription', async () => {
      const prescription = await createPrescription(patientA, doctorUser, {
        status: 'CANCELLED',
      })
      const cartId = await addToCart(patientAToken, prescriptionMedicine, 1)

      const response = await checkout(
        patientAToken,
        checkoutPayload(cartId, {
          prescriptionSelections: [
            {
              medicineId: prescriptionMedicine._id.toString(),
              prescriptionId: prescription._id.toString(),
            },
          ],
        }),
      )

      assert.equal(response.status, 409)
      assert.equal(response.body.code, 'INVALID_PRESCRIPTION')
    })

    it('rejects a prescription that does not include the medicine', async () => {
      const prescription = await createPrescription(patientA, doctorUser, {
        medicines: [
          {
            medicineName: 'Paracetamol',
            dosage: '1 tablet',
            frequency: 'Once daily',
            duration: '3 days',
            quantity: 3,
          },
        ],
      })
      const cartId = await addToCart(patientAToken, prescriptionMedicine, 1)

      const response = await checkout(
        patientAToken,
        checkoutPayload(cartId, {
          prescriptionSelections: [
            {
              medicineId: prescriptionMedicine._id.toString(),
              prescriptionId: prescription._id.toString(),
            },
          ],
        }),
      )

      assert.equal(response.status, 409)
      assert.equal(response.body.code, 'INVALID_PRESCRIPTION')
    })

    it('accepts an active prescription that includes the medicine', async () => {
      const prescription = await createPrescription(patientA, doctorUser)
      const cartId = await addToCart(patientAToken, prescriptionMedicine, 2)

      const response = await checkout(
        patientAToken,
        checkoutPayload(cartId, {
          prescriptionSelections: [
            {
              medicineId: prescriptionMedicine._id.toString(),
              prescriptionId: prescription._id.toString(),
            },
          ],
        }),
      )

      assert.equal(response.status, 201)
      const { order } = response.body.data
      assert.equal(order.prescriptionStatus, 'VERIFIED')
      assert.equal(order.items[0].prescriptionRequired, true)
      assert.equal(
        order.items[0].prescriptionId,
        prescription._id.toString(),
      )
      assert.equal(order.items[0].lineTotal, 180)
    })
  })

  describe('delivery address validation', () => {
    const cases = [
      ['full name', { fullName: '' }, 'deliveryAddress.fullName'],
      [
        'phone',
        { phone: 'abc' },
        'deliveryAddress.phone',
      ],
      [
        'address line 1',
        { addressLine1: '' },
        'deliveryAddress.addressLine1',
      ],
      ['pincode', { pincode: '012345' }, 'deliveryAddress.pincode'],
      ['city', { city: '' }, 'deliveryAddress.city'],
      ['state', { state: '' }, 'deliveryAddress.state'],
    ]

    for (const [label, addressOverride, expectedField] of cases) {
      it(`rejects a missing or invalid ${label}`, async () => {
        const cartId = await addToCart(patientAToken, paracetamol, 1)
        const response = await checkout(
          patientAToken,
          checkoutPayload(cartId, {
            deliveryAddress: addressData(addressOverride),
          }),
        )

        assert.equal(response.status, 400)
        assert.equal(response.body.code, 'VALIDATION_ERROR')
        assert.ok(
          response.body.details.some((detail) => detail.field === expectedField),
        )
        assert.equal(await Order.countDocuments({}), 0)
        assert.equal(
          (await Medicine.findById(paracetamol._id).lean()).stockQuantity,
          100,
        )
        assert.ok(await Cart.findById(cartId).lean())
      })
    }
  })

  describe('order totals and snapshots', () => {
    it('calculates line totals, subtotal, zero delivery fee, and total', async () => {
      const cartId = await addToCart(patientAToken, paracetamol, 2)
      const second = await request('/api/cart/items', {
        method: 'POST',
        token: patientAToken,
        body: {
          medicineId: cetirizine._id.toString(),
          quantity: 3,
        },
      })
      assert.equal(second.status, 201)

      const response = await checkout(
        patientAToken,
        checkoutPayload(cartId, { paymentMethod: undefined }),
      )
      assert.equal(response.status, 201)
      const { order } = response.body.data

      assert.equal(order.items.length, 2)
      assert.equal(order.items[0].lineTotal, 51)
      assert.equal(order.items[1].lineTotal, 54.75)
      assert.equal(order.subtotal, 105.75)
      assert.equal(order.deliveryFee, 0)
      assert.equal(order.totalAmount, 105.75)
      assert.equal(order.paymentMethod, 'COD')
    })

    it('stores payment, order, and prescription defaults', async () => {
      const order = await placeOrder(patientAToken, paracetamol, 1)

      assert.equal(order.paymentStatus, 'PENDING')
      assert.equal(order.orderStatus, 'PLACED')
      assert.equal(order.prescriptionStatus, 'NOT_REQUIRED')
      assert.ok(order.placedAt)
      assert.ok(order.createdAt)
      assert.ok(order.updatedAt)
    })

    it('snapshots current medicine details into the order', async () => {
      const cartId = await addToCart(patientAToken, paracetamol, 1)
      await Medicine.updateOne(
        { _id: paracetamol._id },
        {
          $set: {
            name: 'Paracetamol Advance',
            genericName: 'Acetaminophen',
            brandName: 'Dolo 650',
            dosageForm: 'Caplet',
            strength: '650 mg',
            packSize: '15 caplets',
          },
        },
      )

      const response = await checkout(patientAToken, checkoutPayload(cartId))
      assert.equal(response.status, 201)
      const item = response.body.data.order.items[0]
      assert.equal(item.name, 'Paracetamol Advance')
      assert.equal(item.brandName, 'Dolo 650')
      assert.equal(item.dosageForm, 'Caplet')
      assert.equal(item.strength, '650 mg')
      assert.equal(item.packSize, '15 caplets')
      assert.equal(item.quantity, 1)
      assert.equal(item.unitPrice, 25.5)
    })

    it('snapshots the delivery address into the order', async () => {
      const address = addressData({ landmark: 'Beside the temple' })
      const cartId = await addToCart(patientAToken, paracetamol, 1)
      const response = await checkout(
        patientAToken,
        checkoutPayload(cartId, { deliveryAddress: address }),
      )

      assert.equal(response.status, 201)
      const { order } = response.body.data
      assert.deepEqual(order.deliveryAddress, address)

      const stored = await Order.findById(order.orderId).lean()
      assert.deepEqual(
        {
          fullName: stored.deliveryAddress.fullName,
          phone: stored.deliveryAddress.phone,
          addressLine1: stored.deliveryAddress.addressLine1,
          addressLine2: stored.deliveryAddress.addressLine2,
          city: stored.deliveryAddress.city,
          state: stored.deliveryAddress.state,
          pincode: stored.deliveryAddress.pincode,
          landmark: stored.deliveryAddress.landmark,
        },
        address,
      )
    })

    it('returns a safe pharmacy snapshot', async () => {
      const order = await placeOrder(patientAToken, paracetamol, 1)
      assert.deepEqual(order.pharmacy, {
        id: pharmacyA._id.toString(),
        pharmacyName: 'Aarogya Pharmacy',
        pharmacistName: 'Ravi Kumar',
        address: 'Main Road',
        city: 'Berhampur',
        state: 'Odisha',
        pincode: '760001',
      })
    })

    it('validates the payment method', async () => {
      const cartId = await addToCart(patientAToken, paracetamol, 1)
      const response = await checkout(
        patientAToken,
        checkoutPayload(cartId, { paymentMethod: 'UPI' }),
      )

      assert.equal(response.status, 400)
      assert.equal(response.body.code, 'VALIDATION_ERROR')
      assert.equal(await Order.countDocuments({}), 0)
    })
  })

  describe('stock handling', () => {
    it('decrements stock by the ordered quantity', async () => {
      await placeOrder(patientAToken, paracetamol, 3)
      assert.equal(
        (await Medicine.findById(paracetamol._id).lean()).stockQuantity,
        97,
      )
    })

    it('allows an order for exactly the available stock', async () => {
      await Medicine.updateOne(
        { _id: paracetamol._id },
        { $set: { stockQuantity: 3 } },
      )
      const order = await placeOrder(patientAToken, paracetamol, 3)

      assert.equal(order.items[0].quantity, 3)
      assert.equal(
        (await Medicine.findById(paracetamol._id).lean()).stockQuantity,
        0,
      )
    })

    it('does not partially deduct stock when a later item fails', async () => {
      const cartId = await addToCart(patientAToken, paracetamol, 2)
      await request('/api/cart/items', {
        method: 'POST',
        token: patientAToken,
        body: { medicineId: cetirizine._id.toString(), quantity: 3 },
      })
      await Medicine.updateOne(
        { _id: cetirizine._id },
        { $set: { stockQuantity: 1 } },
      )

      const response = await checkout(patientAToken, checkoutPayload(cartId))
      assert.equal(response.status, 409)
      assert.equal(response.body.code, 'INSUFFICIENT_STOCK')
      assert.equal(await Order.countDocuments({}), 0)
      assert.equal(
        (await Medicine.findById(paracetamol._id).lean()).stockQuantity,
        100,
      )
      assert.equal(
        (await Medicine.findById(cetirizine._id).lean()).stockQuantity,
        1,
      )
      assert.equal(
        (await Cart.findById(cartId).lean()).items.length,
        2,
      )
    })

    it('prevents two patients from overselling the last unit', async () => {
      await Medicine.updateOne(
        { _id: paracetamol._id },
        { $set: { stockQuantity: 1 } },
      )
      const cartA = await addToCart(patientAToken, paracetamol, 1)
      const cartB = await addToCart(patientBToken, paracetamol, 1)

      const [first, second] = await Promise.all([
        checkout(patientAToken, checkoutPayload(cartA)),
        checkout(patientBToken, checkoutPayload(cartB)),
      ])

      const statuses = [first.status, second.status].sort()
      assert.deepEqual(statuses, [201, 409])
      const failure = first.status === 409 ? first : second
      assert.equal(failure.body.code, 'INSUFFICIENT_STOCK')
      assert.equal(await Order.countDocuments({}), 1)
      assert.equal(
        (await Medicine.findById(paracetamol._id).lean()).stockQuantity,
        0,
      )
    })

    it('enforces total stock across simultaneous multi-unit checkouts', async () => {
      await Medicine.updateOne(
        { _id: paracetamol._id },
        { $set: { stockQuantity: 5 } },
      )
      const cartA = await addToCart(patientAToken, paracetamol, 3)
      const cartB = await addToCart(patientBToken, paracetamol, 3)

      const [first, second] = await Promise.all([
        checkout(patientAToken, checkoutPayload(cartA)),
        checkout(patientBToken, checkoutPayload(cartB)),
      ])

      const statuses = [first.status, second.status].sort()
      assert.deepEqual(statuses, [201, 409])
      assert.equal(await Order.countDocuments({}), 1)
      assert.equal(
        (await Medicine.findById(paracetamol._id).lean()).stockQuantity,
        2,
      )
    })

    it('handles a double-submitted checkout without duplicating the order', async () => {
      const cartId = await addToCart(patientAToken, paracetamol, 1)
      const payload = checkoutPayload(cartId)

      const [first, second] = await Promise.all([
        checkout(patientAToken, payload),
        checkout(patientAToken, payload),
      ])

      assert.ok([200, 201].includes(first.status))
      assert.ok([200, 201].includes(second.status))
      assert.equal(
        first.body.data.order.orderId,
        second.body.data.order.orderId,
      )
      assert.equal(await Order.countDocuments({}), 1)
      assert.equal(
        (await Medicine.findById(paracetamol._id).lean()).stockQuantity,
        99,
      )
      assert.equal(await Cart.countDocuments({ patientId: patientA._id }), 0)
    })
  })

  describe('cart clearing', () => {
    it('clears only the successfully ordered pharmacy cart', async () => {
      const cartA = await addToCart(patientAToken, paracetamol, 1)
      const cartB = await addToCart(patientAToken, multivitamin, 1)

      const response = await checkout(patientAToken, checkoutPayload(cartA))
      assert.equal(response.status, 201)
      assert.equal(await Cart.findById(cartA).lean(), null)

      const remaining = await Cart.findById(cartB).lean()
      assert.ok(remaining)
      assert.equal(remaining.items.length, 1)
    })

    it('leaves the cart unchanged when checkout fails', async () => {
      const cartId = await addToCart(patientAToken, paracetamol, 2)
      await Medicine.updateOne(
        { _id: paracetamol._id },
        { $set: { price: 30 } },
      )

      const response = await checkout(patientAToken, checkoutPayload(cartId))
      assert.equal(response.status, 409)
      const cart = await Cart.findById(cartId).lean()
      assert.ok(cart)
      assert.equal(cart.items[0].quantity, 2)
      assert.equal(cart.items[0].unitPriceSnapshot, 25.5)
    })
  })

  describe('idempotency', () => {
    it('requires a reasonable idempotency key length', async () => {
      const cartId = await addToCart(patientAToken, paracetamol, 1)
      const response = await checkout(
        patientAToken,
        checkoutPayload(cartId),
        { 'Idempotency-Key': 'x'.repeat(129) },
      )

      assert.equal(response.status, 400)
      assert.equal(response.body.code, 'VALIDATION_ERROR')
      assert.equal(await Order.countDocuments({}), 0)
    })

    it('returns the same order for a repeated idempotency key', async () => {
      const cartId = await addToCart(patientAToken, paracetamol, 2)
      const headers = { 'Idempotency-Key': 'checkout-key-001' }

      const first = await checkout(
        patientAToken,
        checkoutPayload(cartId),
        headers,
      )
      const second = await checkout(
        patientAToken,
        checkoutPayload(cartId),
        headers,
      )

      assert.equal(first.status, 201)
      assert.equal(second.status, 200)
      assert.equal(
        first.body.data.order.orderId,
        second.body.data.order.orderId,
      )
      assert.equal(await Order.countDocuments({}), 1)
      assert.equal(
        (await Medicine.findById(paracetamol._id).lean()).stockQuantity,
        98,
      )
    })

    it('does not let another patient reuse an order through a key', async () => {
      const cartA = await addToCart(patientAToken, paracetamol, 1)
      const first = await checkout(
        patientAToken,
        checkoutPayload(cartA),
        { 'Idempotency-Key': 'shared-key' },
      )
      assert.equal(first.status, 201)

      const cartB = await addToCart(patientBToken, paracetamol, 1)
      const second = await checkout(
        patientBToken,
        checkoutPayload(cartB),
        { 'Idempotency-Key': 'shared-key' },
      )

      assert.equal(second.status, 201)
      assert.notEqual(
        second.body.data.order.orderId,
        first.body.data.order.orderId,
      )
      assert.equal(
        await Order.countDocuments({ patientId: patientA._id }),
        1,
      )
      assert.equal(
        await Order.countDocuments({ patientId: patientB._id }),
        1,
      )
    })
  })

  describe('ownership and security', () => {
    it('does not allow one patient to read another order', async () => {
      const order = await placeOrder(patientAToken, paracetamol, 1)
      const response = await request(`/api/orders/${order.orderId}`, {
        token: patientBToken,
      })

      assert.equal(response.status, 404)
      assert.equal(response.body.code, 'ORDER_NOT_FOUND')
    })

    it('does not allow one patient to modify another order', async () => {
      const order = await placeOrder(patientAToken, paracetamol, 1)
      const response = await request(`/api/orders/${order.orderId}`, {
        method: 'PATCH',
        token: patientBToken,
        body: { orderStatus: 'CANCELLED' },
      })

      assert.equal(response.status, 404)
      const stored = await Order.findById(order.orderId).lean()
      assert.equal(stored.orderStatus, 'PLACED')
    })

    it('ignores a client-supplied patientId', async () => {
      const cartId = await addToCart(patientAToken, paracetamol, 1)
      const response = await checkout(
        patientAToken,
        checkoutPayload(cartId, { patientId: patientB._id.toString() }),
      )

      assert.equal(response.status, 201)
      assert.equal(
        await Order.countDocuments({ patientId: patientA._id }),
        1,
      )
      assert.equal(
        await Order.countDocuments({ patientId: patientB._id }),
        0,
      )
    })

    it('ignores a client-supplied pharmacyId', async () => {
      const cartId = await addToCart(patientAToken, paracetamol, 1)
      const response = await checkout(
        patientAToken,
        checkoutPayload(cartId, { pharmacyId: pharmacyB._id.toString() }),
      )

      assert.equal(response.status, 201)
      assert.equal(
        response.body.data.order.pharmacy.id,
        pharmacyA._id.toString(),
      )
    })

    it('ignores client-controlled order and payment status', async () => {
      const cartId = await addToCart(patientAToken, paracetamol, 1)
      const response = await checkout(
        patientAToken,
        checkoutPayload(cartId, {
          orderStatus: 'DELIVERED',
          paymentStatus: 'PAID',
          prescriptionStatus: 'VERIFIED',
        }),
      )

      assert.equal(response.status, 201)
      const { order } = response.body.data
      assert.equal(order.orderStatus, 'PLACED')
      assert.equal(order.paymentStatus, 'PENDING')
      assert.equal(order.prescriptionStatus, 'NOT_REQUIRED')
    })

    it('ignores client-controlled stock and totals', async () => {
      const cartId = await addToCart(patientAToken, paracetamol, 2)
      const response = await checkout(
        patientAToken,
        checkoutPayload(cartId, {
          stockQuantity: 999,
          subtotal: 1,
          totalAmount: 1,
          deliveryFee: 100,
        }),
      )

      assert.equal(response.status, 201)
      assert.equal(response.body.data.order.totalAmount, 51)
      assert.equal(
        (await Medicine.findById(paracetamol._id).lean()).stockQuantity,
        98,
      )
    })

    it('does not expose authentication or internal database fields', async () => {
      const order = await placeOrder(patientAToken, paracetamol, 1)
      const detail = await request(`/api/orders/${order.orderId}`, {
        token: patientAToken,
      })
      const serialized = JSON.stringify(detail.body)

      for (const forbidden of [
        'passwordHash',
        'accessToken',
        'token',
        'sourceCartId',
        'idempotencyKey',
        'patientId',
        'pharmacyId',
        'licenseNumber',
        'private@aarogyapharmacy.test',
        'OD-PH-2026-501',
        '_id',
        '__v',
      ]) {
        assert.equal(
          serialized.includes(forbidden),
          false,
          `${forbidden} was exposed`,
        )
      }
    })

    it('does not expose another patient order in history', async () => {
      await placeOrder(patientAToken, paracetamol, 1)
      const response = await request('/api/orders', {
        token: patientBToken,
      })

      assert.equal(response.status, 200)
      assert.deepEqual(response.body.data.orders, [])
      assert.equal(response.body.data.pagination.total, 0)
    })
  })

  describe('order history and details', () => {
    it('returns an empty order history cleanly', async () => {
      const response = await request('/api/orders', {
        token: patientAToken,
      })

      assert.equal(response.status, 200)
      assert.deepEqual(response.body.data.orders, [])
      assert.deepEqual(response.body.data.pagination, {
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
      })
    })

    it('returns only the authenticated patient orders', async () => {
      await placeOrder(patientAToken, paracetamol, 1)
      await placeOrder(patientAToken, cetirizine, 1)
      await placeOrder(patientBToken, paracetamol, 1)

      const response = await request('/api/orders', {
        token: patientAToken,
      })
      assert.equal(response.status, 200)
      assert.equal(response.body.data.orders.length, 2)
      assert.equal(response.body.data.pagination.total, 2)
    })

    it('supports a status filter', async () => {
      const placed = await placeOrder(patientAToken, paracetamol, 1)
      await placeOrder(patientAToken, cetirizine, 1)
      await Order.updateOne(
        { _id: placed.orderId },
        { $set: { orderStatus: 'CONFIRMED' } },
      )

      const confirmed = await request('/api/orders?status=CONFIRMED', {
        token: patientAToken,
      })
      assert.equal(confirmed.status, 200)
      assert.equal(confirmed.body.data.orders.length, 1)
      assert.equal(
        confirmed.body.data.orders[0].orderId,
        placed.orderId,
      )

      const placedOnly = await request('/api/orders?status=PLACED', {
        token: patientAToken,
      })
      assert.equal(placedOnly.body.data.orders.length, 1)
    })

    it('paginates order history', async () => {
      await placeOrder(patientAToken, paracetamol, 1)
      await placeOrder(patientAToken, paracetamol, 2)
      await placeOrder(patientAToken, paracetamol, 3)

      const first = await request('/api/orders?page=1&limit=2', {
        token: patientAToken,
      })
      const second = await request('/api/orders?page=2&limit=2', {
        token: patientAToken,
      })

      assert.equal(first.body.data.orders.length, 2)
      assert.equal(first.body.data.pagination.totalPages, 2)
      assert.equal(second.body.data.orders.length, 1)
      assert.equal(second.body.data.pagination.page, 2)
    })

    it('supports a safe total sort', async () => {
      const low = await placeOrder(patientAToken, paracetamol, 1)
      const high = await placeOrder(patientAToken, paracetamol, 3)

      const response = await request('/api/orders?sort=total_desc', {
        token: patientAToken,
      })
      assert.equal(response.status, 200)
      assert.equal(response.body.data.orders[0].orderId, high.orderId)
      assert.equal(response.body.data.orders[1].orderId, low.orderId)
    })

    it('rejects an unsupported status or sort', async () => {
      const status = await request('/api/orders?status=UNKNOWN', {
        token: patientAToken,
      })
      assert.equal(status.status, 400)
      assert.equal(status.body.code, 'VALIDATION_ERROR')

      const sort = await request('/api/orders?sort=passwordHash', {
        token: patientAToken,
      })
      assert.equal(sort.status, 400)
      assert.equal(sort.body.code, 'VALIDATION_ERROR')
    })

    it('returns an individual order to its owner', async () => {
      const order = await placeOrder(patientAToken, paracetamol, 2)
      const response = await request(`/api/orders/${order.orderId}`, {
        token: patientAToken,
      })

      assert.equal(response.status, 200)
      const returned = response.body.data.order
      assert.equal(returned.orderId, order.orderId)
      assert.equal(returned.items[0].quantity, 2)
      assert.equal(returned.totalAmount, 51)
    })

    it('returns ORDER_NOT_FOUND for an unknown order', async () => {
      const response = await request(
        `/api/orders/${new mongoose.Types.ObjectId().toString()}`,
        { token: patientAToken },
      )
      assert.equal(response.status, 404)
      assert.equal(response.body.code, 'ORDER_NOT_FOUND')
    })

    it('rejects a malformed order identifier', async () => {
      const response = await request('/api/orders/not-an-id', {
        token: patientAToken,
      })
      assert.equal(response.status, 400)
      assert.equal(response.body.code, 'VALIDATION_ERROR')
    })
  })
})
