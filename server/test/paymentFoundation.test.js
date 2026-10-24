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
  clearOrders,
  createUser,
  tokenForUser,
  request,
  Pharmacy,
  Medicine,
  Cart,
  Order,
} = require('./helpers')
const {
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  DEFAULT_PAYMENT_METHOD,
  DEFAULT_PAYMENT_STATUS,
} = require('../src/models/Order')
const { buildIdentityKey } = require('../src/services/medicine.service')

const future = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)

function pharmacyData(overrides = {}) {
  return {
    pharmacyName: 'Payment Test Pharmacy',
    pharmacistName: 'Ravi Kumar',
    licenseNumber: 'OD-PH-2026-701',
    phone: '9876543210',
    email: 'payment-pharmacy@test.example',
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
    expiryDate: future,
    isActive: true,
    ...overrides,
  }
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

function orderData(overrides = {}) {
  return {
    patientId: overrides.patientId,
    pharmacyId: overrides.pharmacyId,
    pharmacySnapshot: {
      pharmacyName: 'Payment Test Pharmacy',
      pharmacistName: 'Ravi Kumar',
      address: 'Main Road',
      city: 'Berhampur',
      state: 'Odisha',
      pincode: '760001',
    },
    items: [
      {
        medicineId: new mongoose.Types.ObjectId(),
        nameSnapshot: 'Paracetamol',
        genericNameSnapshot: 'Acetaminophen',
        brandNameSnapshot: 'Dolo',
        dosageFormSnapshot: 'Tablet',
        strengthSnapshot: '500 mg',
        packSizeSnapshot: '10 tablets',
        quantity: 1,
        unitPriceSnapshot: 25.5,
        lineTotal: 25.5,
        prescriptionRequired: false,
      },
    ],
    deliveryAddress: addressData(),
    subtotal: 25.5,
    deliveryFee: 0,
    totalAmount: 25.5,
    prescriptionStatus: 'NOT_REQUIRED',
    sourceCartId: new mongoose.Types.ObjectId(),
    ...overrides,
  }
}

describe('COD payment foundation', () => {
  let patient
  let pharmacyOwner
  let patientToken
  let pharmacyToken
  let pharmacy
  let medicine

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
    await clearMedicines()
    await clearPharmacies()
    await clearUsers()

    patient = await createUser({
      name: 'Payment Patient',
      email: 'payment-patient@example.com',
      phone: '9876543210',
      role: 'PATIENT',
    })
    pharmacyOwner = await createUser({
      name: 'Payment Pharmacy Owner',
      email: 'payment-owner@example.com',
      role: 'PHARMACY',
    })
    patientToken = tokenForUser(patient)
    pharmacyToken = tokenForUser(pharmacyOwner)

    pharmacy = await Pharmacy.create({
      userId: pharmacyOwner._id,
      ...pharmacyData(),
    })

    const data = medicineData()
    medicine = await Medicine.create({
      pharmacyId: pharmacy._id,
      ...data,
      identityKey: buildIdentityKey(data),
    })
  })

  async function addToCart(quantity = 1) {
    const response = await request('/api/cart/items', {
      method: 'POST',
      token: patientToken,
      body: { medicineId: medicine._id.toString(), quantity },
    })
    assert.equal(response.status, 201, JSON.stringify(response.body))
    return response.body.data.cart.cartId
  }

  async function checkout(body, headers) {
    return request('/api/orders/checkout', {
      method: 'POST',
      token: patientToken,
      headers,
      body,
    })
  }

  async function placeOrder(quantity = 1) {
    const cartId = await addToCart(quantity)
    const response = await checkout(checkoutPayload(cartId))
    assert.equal(response.status, 201, JSON.stringify(response.body))
    return response.body.data.order
  }

  function patchPharmacyStatus(orderId, body, token = pharmacyToken) {
    return request(`/api/pharmacy/orders/${orderId}/status`, {
      method: 'PATCH',
      token,
      body,
    })
  }

  describe('constants and schema', () => {
    it('supports only Cash on Delivery', () => {
      assert.deepEqual(PAYMENT_METHODS, ['COD'])
      assert.equal(DEFAULT_PAYMENT_METHOD, 'COD')
    })

    it('exposes the expected payment statuses without a refund status', () => {
      assert.deepEqual(PAYMENT_STATUSES, [
        'PENDING',
        'PAID',
        'FAILED',
        'CANCELLED',
      ])
      assert.equal(DEFAULT_PAYMENT_STATUS, 'PENDING')
      assert.equal(PAYMENT_STATUSES.includes('REFUNDED'), false)
    })

    it('defaults new model documents to COD and PENDING', async () => {
      const order = await Order.create({
        ...orderData({ patientId: patient._id, pharmacyId: pharmacy._id }),
      })
      assert.equal(order.paymentMethod, 'COD')
      assert.equal(order.paymentStatus, 'PENDING')
    })

    it('rejects DEMO as a payment method at the schema layer', async () => {
      const order = await Order.create(
        orderData({ patientId: patient._id, pharmacyId: pharmacy._id }),
      )
      order.paymentMethod = 'DEMO'
      await assert.rejects(
        order.save(),
        (error) =>
          error.name === 'ValidationError' &&
          error.errors.paymentMethod.message.includes('not a supported'),
      )
    })

    it('rejects REFUNDED as a payment status at the schema layer', async () => {
      const order = await Order.create(
        orderData({ patientId: patient._id, pharmacyId: pharmacy._id }),
      )
      order.paymentStatus = 'REFUNDED'
      await assert.rejects(
        order.save(),
        (error) =>
          error.name === 'ValidationError' &&
          error.errors.paymentStatus.message.includes('not a supported'),
      )
    })

    it('allows the CANCELLED payment status for future explicit states', async () => {
      const order = await Order.create(
        orderData({ patientId: patient._id, pharmacyId: pharmacy._id }),
      )
      order.paymentStatus = 'CANCELLED'
      const saved = await order.save()
      assert.equal(saved.paymentStatus, 'CANCELLED')
    })

    it('does not add an index on paymentStatus', () => {
      const indexedFields = Order.schema
        .indexes()
        .map(([fields]) => Object.keys(fields))
      assert.equal(
        indexedFields.some((fields) => fields.includes('paymentStatus')),
        false,
      )
    })

    it('stores no card, CVV, UPI, or gateway fields', () => {
      for (const field of [
        'cardNumber',
        'cardHolder',
        'cvv',
        'upiId',
        'transactionId',
        'gatewayPaymentId',
      ]) {
        assert.equal(Order.schema.path(field), undefined, field)
      }
    })
  })

  describe('checkout validation', () => {
    it('accepts a missing payment method and defaults to COD', async () => {
      const cartId = await addToCart()
      const body = checkoutPayload(cartId)
      delete body.paymentMethod
      const response = await checkout(body)
      assert.equal(response.status, 201)
      assert.equal(response.body.data.order.paymentMethod, 'COD')
    })

    it('accepts null and defaults to COD', async () => {
      const cartId = await addToCart()
      const response = await checkout(
        checkoutPayload(cartId, { paymentMethod: null }),
      )
      assert.equal(response.status, 201)
      assert.equal(response.body.data.order.paymentMethod, 'COD')
    })

    it('accepts an empty string and defaults to COD', async () => {
      const cartId = await addToCart()
      const response = await checkout(
        checkoutPayload(cartId, { paymentMethod: '' }),
      )
      assert.equal(response.status, 201)
      assert.equal(response.body.data.order.paymentMethod, 'COD')
    })

    it('normalizes lowercase cod to COD', async () => {
      const cartId = await addToCart()
      const response = await checkout(
        checkoutPayload(cartId, { paymentMethod: 'cod' }),
      )
      assert.equal(response.status, 201)
      assert.equal(response.body.data.order.paymentMethod, 'COD')
    })

    it('normalizes mixed case with surrounding whitespace to COD', async () => {
      const cartId = await addToCart()
      const response = await checkout(
        checkoutPayload(cartId, { paymentMethod: '  CoD  ' }),
      )
      assert.equal(response.status, 201)
      assert.equal(response.body.data.order.paymentMethod, 'COD')
    })

    for (const method of ['UPI', 'CARD', 'NETBANKING', 'DEMO', 'WALLET']) {
      it(`rejects the unsupported ${method} payment method`, async () => {
        const cartId = await addToCart()
        const response = await checkout(
          checkoutPayload(cartId, { paymentMethod: method }),
        )
        assert.equal(response.status, 400)
        assert.equal(response.body.code, 'VALIDATION_ERROR')
        assert.equal(response.body.details[0].field, 'paymentMethod')
        assert.equal(await Order.countDocuments({}), 0)
        assert.equal(await Cart.countDocuments({ _id: cartId }), 1)
      })
    }

    it('rejects a numeric payment method', async () => {
      const cartId = await addToCart()
      const response = await checkout(
        checkoutPayload(cartId, { paymentMethod: 123 }),
      )
      assert.equal(response.status, 400)
      assert.equal(response.body.code, 'VALIDATION_ERROR')
      assert.equal(response.body.details[0].field, 'paymentMethod')
      assert.equal(response.body.details[0].message, 'Payment method must be a string')
    })

    it('rejects a boolean payment method', async () => {
      const cartId = await addToCart()
      const response = await checkout(
        checkoutPayload(cartId, { paymentMethod: true }),
      )
      assert.equal(response.status, 400)
      assert.equal(response.body.code, 'VALIDATION_ERROR')
      assert.equal(response.body.details[0].field, 'paymentMethod')
    })

    it('rejects an array payment method without accepting the first value', async () => {
      const cartId = await addToCart()
      const response = await checkout(
        checkoutPayload(cartId, { paymentMethod: ['COD', 'UPI'] }),
      )
      assert.equal(response.status, 400)
      assert.equal(response.body.code, 'VALIDATION_ERROR')
      assert.equal(response.body.details[0].field, 'paymentMethod')
      assert.equal(await Order.countDocuments({}), 0)
    })

    it('rejects an object payment method', async () => {
      const cartId = await addToCart()
      const response = await checkout(
        checkoutPayload(cartId, { paymentMethod: { value: 'COD' } }),
      )
      assert.equal(response.status, 400)
      assert.equal(response.body.code, 'VALIDATION_ERROR')
      assert.equal(response.body.details[0].field, 'paymentMethod')
    })

    it('does not consume the cart or stock for an invalid method', async () => {
      const cartId = await addToCart(3)
      const response = await checkout(
        checkoutPayload(cartId, { paymentMethod: 'UPI' }),
      )
      assert.equal(response.status, 400)
      assert.equal(await Order.countDocuments({}), 0)
      assert.equal(await Cart.countDocuments({ _id: cartId }), 1)
      const stored = await Medicine.findById(medicine._id).lean()
      assert.equal(stored.stockQuantity, 100)
    })

    it('returns a standard validation error shape', async () => {
      const cartId = await addToCart()
      const response = await checkout(
        checkoutPayload(cartId, { paymentMethod: 'UPI' }),
      )
      assert.equal(response.status, 400)
      assert.equal(response.body.success, false)
      assert.equal(response.body.code, 'VALIDATION_ERROR')
      assert.equal(Array.isArray(response.body.details), true)
      assert.deepEqual(Object.keys(response.body.details[0]).sort(), [
        'field',
        'message',
      ])
    })
  })

  describe('server-authoritative payment fields', () => {
    for (const status of ['PAID', 'FAILED', 'CANCELLED']) {
      it(`ignores a client-supplied paymentStatus of ${status}`, async () => {
        const cartId = await addToCart()
        const response = await checkout(
          checkoutPayload(cartId, { paymentStatus: status }),
        )
        assert.equal(response.status, 201)
        assert.equal(response.body.data.order.paymentStatus, 'PENDING')
        const stored = await Order.findById(response.body.data.order.orderId).lean()
        assert.equal(stored.paymentStatus, 'PENDING')
      })
    }

    it('ignores client-supplied totals and fees', async () => {
      const cartId = await addToCart(2)
      const response = await checkout(
        checkoutPayload(cartId, {
          subtotal: 1,
          deliveryFee: 999,
          totalAmount: 1,
          amount: 1,
        }),
      )
      assert.equal(response.status, 201)
      const order = response.body.data.order
      assert.equal(order.subtotal, 51)
      assert.equal(order.deliveryFee, 0)
      assert.equal(order.totalAmount, 51)
      const stored = await Order.findById(order.orderId).lean()
      assert.equal(stored.subtotal, 51)
      assert.equal(stored.totalAmount, 51)
    })

    it('ignores client-supplied item snapshots and prices', async () => {
      const cartId = await addToCart(1)
      const response = await checkout(
        checkoutPayload(cartId, {
          items: [
            {
              medicineId: medicine._id.toString(),
              quantity: 99,
              unitPrice: 0.01,
              lineTotal: 0.99,
            },
          ],
        }),
      )
      assert.equal(response.status, 201)
      const order = response.body.data.order
      assert.equal(order.items.length, 1)
      assert.equal(order.items[0].quantity, 1)
      assert.equal(order.items[0].unitPrice, 25.5)
      assert.equal(order.totalAmount, 25.5)
    })

    it('returns only the COD method and PENDING status', async () => {
      const order = await placeOrder()
      assert.equal(order.paymentMethod, 'COD')
      assert.equal(order.paymentStatus, 'PENDING')
      assert.equal('cardNumber' in order, false)
      assert.equal('cvv' in order, false)
      assert.equal('upiId' in order, false)
      assert.equal('gatewayPaymentId' in order, false)
    })

    it('persists COD and PENDING in MongoDB', async () => {
      const order = await placeOrder()
      const stored = await Order.findById(order.orderId).lean()
      assert.equal(stored.paymentMethod, 'COD')
      assert.equal(stored.paymentStatus, 'PENDING')
    })

    it('keeps COD and PENDING on an idempotent replay', async () => {
      const cartId = await addToCart()
      const headers = { 'Idempotency-Key': 'payment-foundation-replay' }
      const first = await checkout(checkoutPayload(cartId), headers)
      const second = await checkout(checkoutPayload(cartId), headers)
      assert.equal(first.status, 201)
      assert.equal(second.status, 200)
      assert.equal(
        second.body.data.order.orderId,
        first.body.data.order.orderId,
      )
      assert.equal(second.body.data.order.paymentMethod, 'COD')
      assert.equal(second.body.data.order.paymentStatus, 'PENDING')
      assert.equal(await Order.countDocuments({}), 1)
    })
  })

  describe('payment immutability across the order lifecycle', () => {
    it('keeps a COD order PENDING through every fulfilment step', async () => {
      const order = await placeOrder()

      for (const status of [
        'CONFIRMED',
        'PROCESSING',
        'READY',
        'OUT_FOR_DELIVERY',
        'DELIVERED',
      ]) {
        const response = await patchPharmacyStatus(order.orderId, { status })
        assert.equal(response.status, 200, JSON.stringify(response.body))
        assert.equal(response.body.data.order.paymentMethod, 'COD')
        assert.equal(response.body.data.order.paymentStatus, 'PENDING')

        const stored = await Order.findById(order.orderId).lean()
        assert.equal(stored.paymentMethod, 'COD')
        assert.equal(stored.paymentStatus, 'PENDING')
      }
    })

    it('keeps a cancelled COD order PENDING', async () => {
      const order = await placeOrder()
      const response = await patchPharmacyStatus(order.orderId, {
        status: 'CANCELLED',
      })
      assert.equal(response.status, 200)
      assert.equal(response.body.data.order.paymentStatus, 'PENDING')
      const stored = await Order.findById(order.orderId).lean()
      assert.equal(stored.paymentMethod, 'COD')
      assert.equal(stored.paymentStatus, 'PENDING')
    })

    it('rejects a pharmacy attempt to update paymentStatus', async () => {
      const order = await placeOrder()
      const response = await patchPharmacyStatus(order.orderId, {
        status: 'CONFIRMED',
        paymentStatus: 'PAID',
      })
      assert.equal(response.status, 400)
      assert.equal(response.body.code, 'VALIDATION_ERROR')
      assert.equal(response.body.details[0].field, 'paymentStatus')
      const stored = await Order.findById(order.orderId).lean()
      assert.equal(stored.orderStatus, 'PLACED')
      assert.equal(stored.paymentStatus, 'PENDING')
    })

    it('does not expose a patient payment update route', async () => {
      const order = await placeOrder()
      const response = await request(`/api/orders/${order.orderId}`, {
        method: 'PATCH',
        token: patientToken,
        body: { paymentStatus: 'PAID' },
      })
      assert.equal(response.status, 404)
      const stored = await Order.findById(order.orderId).lean()
      assert.equal(stored.paymentStatus, 'PENDING')
    })

    for (const path of [
      '/api/payments',
      '/api/payments/cod/collect',
      '/api/orders/000000000000000000000000/payment',
    ]) {
      it(`does not expose ${path}`, async () => {
        const response = await request(path, {
          method: 'POST',
          token: patientToken,
          body: { paymentStatus: 'PAID' },
        })
        assert.equal(response.status, 404)
      })
    }
  })

  describe('legacy and serialization safety', () => {
    async function createCheckoutOrder() {
      const order = await placeOrder()
      return new mongoose.Types.ObjectId(order.orderId)
    }

    it('serializes missing legacy payment fields as null for patients', async () => {
      const orderId = await createCheckoutOrder()
      await Order.collection.updateOne(
        { _id: orderId },
        { $unset: { paymentMethod: 1, paymentStatus: 1 } },
      )
      const response = await request(`/api/orders/${orderId}`, {
        token: patientToken,
      })
      assert.equal(response.status, 200)
      assert.equal(response.body.data.order.paymentMethod, null)
      assert.equal(response.body.data.order.paymentStatus, null)
    })

    it('serializes missing legacy payment fields as null for pharmacies', async () => {
      const orderId = await createCheckoutOrder()
      await Order.collection.updateOne(
        { _id: orderId },
        { $unset: { paymentMethod: 1, paymentStatus: 1 } },
      )
      const response = await request(`/api/pharmacy/orders/${orderId}`, {
        token: pharmacyToken,
      })
      assert.equal(response.status, 200)
      assert.equal(response.body.data.order.paymentMethod, null)
      assert.equal(response.body.data.order.paymentStatus, null)
    })

    it('masks unsupported legacy payment values for patients', async () => {
      const orderId = await createCheckoutOrder()
      await Order.collection.updateOne(
        { _id: orderId },
        { $set: { paymentMethod: 'DEMO', paymentStatus: 'REFUNDED' } },
      )
      const response = await request(`/api/orders/${orderId}`, {
        token: patientToken,
      })
      assert.equal(response.status, 200)
      assert.equal(response.body.data.order.paymentMethod, null)
      assert.equal(response.body.data.order.paymentStatus, null)
    })

    it('masks unsupported legacy payment values for pharmacies', async () => {
      const orderId = await createCheckoutOrder()
      await Order.collection.updateOne(
        { _id: orderId },
        { $set: { paymentMethod: 'DEMO', paymentStatus: 'REFUNDED' } },
      )
      const response = await request(`/api/pharmacy/orders/${orderId}`, {
        token: pharmacyToken,
      })
      assert.equal(response.status, 200)
      assert.equal(response.body.data.order.paymentMethod, null)
      assert.equal(response.body.data.order.paymentStatus, null)
    })

    it('serializes safe payment data in the patient order list', async () => {
      await placeOrder()
      const response = await request('/api/orders', { token: patientToken })
      assert.equal(response.status, 200)
      const order = response.body.data.orders[0]
      assert.equal(order.paymentMethod, 'COD')
      assert.equal(order.paymentStatus, 'PENDING')
      assert.equal('cardNumber' in order, false)
    })

    it('serializes safe payment data in the pharmacy order list', async () => {
      await placeOrder()
      const response = await request('/api/pharmacy/orders', {
        token: pharmacyToken,
      })
      assert.equal(response.status, 200)
      const order = response.body.data.orders[0]
      assert.equal(order.paymentMethod, 'COD')
      assert.equal(order.paymentStatus, 'PENDING')
      assert.equal('gatewayPaymentId' in order, false)
    })
  })
})
