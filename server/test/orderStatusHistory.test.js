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
  Order,
} = require('./helpers')
const { buildIdentityKey } = require('../src/services/medicine.service')

const future = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
const LIFECYCLE = [
  'PLACED',
  'CONFIRMED',
  'PROCESSING',
  'READY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
]

function pharmacyData(overrides = {}) {
  return {
    pharmacyName: 'History Pharmacy A',
    pharmacistName: 'Asha Patel',
    licenseNumber: 'OD-PH-2027-701',
    phone: '9876543210',
    email: 'history-pharmacy-a@example.com',
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
    name: 'History Paracetamol',
    genericName: 'Acetaminophen',
    brandName: 'Dolo',
    category: 'TABLET',
    description: 'Pain and fever relief.',
    dosageForm: 'Tablet',
    strength: '500 mg',
    packSize: '10 tablets',
    price: 25.5,
    stockQuantity: 1000,
    prescriptionRequired: false,
    expiryDate: future,
    isActive: true,
    ...overrides,
  }
}

function addressData(overrides = {}) {
  return {
    fullName: 'History Patient',
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

function itemData(overrides = {}) {
  return {
    medicineId: new mongoose.Types.ObjectId(),
    nameSnapshot: 'History Paracetamol',
    genericNameSnapshot: 'Acetaminophen',
    brandNameSnapshot: 'Dolo',
    dosageFormSnapshot: 'Tablet',
    strengthSnapshot: '500 mg',
    packSizeSnapshot: '10 tablets',
    quantity: 1,
    unitPriceSnapshot: 25.5,
    lineTotal: 25.5,
    prescriptionRequired: false,
    prescriptionId: null,
    ...overrides,
  }
}

function statusesFor(status) {
  if (status === 'CANCELLED') return ['PLACED', 'CANCELLED']
  return LIFECYCLE.slice(0, LIFECYCLE.indexOf(status) + 1)
}

function historyFor(status, startTime = Date.now() - 60 * 60 * 1000) {
  return statusesFor(status).map((historyStatus, index) => ({
    status: historyStatus,
    timestamp: new Date(startTime + index * 60 * 1000),
  }))
}

async function createOrder(
  pharmacy,
  patient,
  { orderStatus = 'PLACED', history, ...overrides } = {},
) {
  const placedAt = new Date(Date.now() - 60 * 60 * 1000)
  const statusHistory =
    history === undefined ? historyFor(orderStatus, placedAt.getTime()) : history

  return Order.create({
    patientId: patient._id,
    pharmacyId: pharmacy._id,
    pharmacySnapshot: {
      pharmacyName: pharmacy.pharmacyName,
      pharmacistName: pharmacy.pharmacistName,
      address: pharmacy.address,
      city: pharmacy.city,
      state: pharmacy.state,
      pincode: pharmacy.pincode,
    },
    items: [itemData()],
    deliveryAddress: addressData(),
    subtotal: 25.5,
    deliveryFee: 0,
    totalAmount: 25.5,
    paymentMethod: 'COD',
    paymentStatus: 'PENDING',
    orderStatus,
    statusHistory,
    prescriptionStatus: 'NOT_REQUIRED',
    placedAt,
    sourceCartId: new mongoose.Types.ObjectId(),
    ...overrides,
  })
}

async function patchStatus(token, orderId, body) {
  return request(`/api/pharmacy/orders/${orderId}/status`, {
    method: 'PATCH',
    token,
    body,
  })
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

async function placeCheckoutOrder(
  token,
  medicine,
  overrides = {},
) {
  const cartId = await addToCart(token, medicine)
  const response = await request('/api/orders/checkout', {
    method: 'POST',
    token,
    body: {
      cartId,
      deliveryAddress: addressData(),
      paymentMethod: 'COD',
      ...overrides,
    },
  })
  assert.equal(response.status, 201, JSON.stringify(response.body))
  return response.body.data.order
}

describe('Patient order status history module', () => {
  let patientA
  let patientB
  let pharmacyAUser
  let pharmacyBUser
  let patientAToken
  let patientBToken
  let pharmacyAToken
  let pharmacyBToken
  let pharmacyA
  let pharmacyB
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

    patientA = await createUser({
      name: 'History Patient A',
      email: 'history-patient-a@example.com',
      phone: '9876543210',
      role: 'PATIENT',
    })
    patientB = await createUser({
      name: 'History Patient B',
      email: 'history-patient-b@example.com',
      phone: '9876543211',
      role: 'PATIENT',
    })
    pharmacyAUser = await createUser({
      name: 'History Pharmacy Owner A',
      email: 'history-pharmacy-owner-a@example.com',
      role: 'PHARMACY',
    })
    pharmacyBUser = await createUser({
      name: 'History Pharmacy Owner B',
      email: 'history-pharmacy-owner-b@example.com',
      role: 'PHARMACY',
    })

    patientAToken = tokenForUser(patientA)
    patientBToken = tokenForUser(patientB)
    pharmacyAToken = tokenForUser(pharmacyAUser)
    pharmacyBToken = tokenForUser(pharmacyBUser)

    pharmacyA = await Pharmacy.create({
      userId: pharmacyAUser._id,
      ...pharmacyData(),
    })
    pharmacyB = await Pharmacy.create({
      userId: pharmacyBUser._id,
      ...pharmacyData({
        pharmacyName: 'History Pharmacy B',
        licenseNumber: 'OD-PH-2027-702',
        email: 'history-pharmacy-b@example.com',
        address: 'Market Street',
        city: 'Bhubaneswar',
      }),
    })

    const data = medicineData()
    medicine = await Medicine.create({
      pharmacyId: pharmacyA._id,
      ...data,
      identityKey: buildIdentityKey(data),
    })
  })

  describe('order creation', () => {
    it('creates a PLACED history entry for a new order', async () => {
      const order = await placeCheckoutOrder(patientAToken, medicine)
      const stored = await Order.findById(order.orderId).lean()

      assert.equal(order.statusHistory.length, 1)
      assert.equal(order.statusHistory[0].status, 'PLACED')
      assert.equal(stored.statusHistory.length, 1)
      assert.equal(stored.statusHistory[0].status, 'PLACED')
    })

    it('stores a valid timestamp for the initial history entry', async () => {
      const order = await placeCheckoutOrder(patientAToken, medicine)
      const timestamp = new Date(order.statusHistory[0].timestamp)

      assert.equal(Number.isNaN(timestamp.getTime()), false)
      assert.equal(timestamp.toISOString(), order.placedAt)
    })

    it('keeps history status aligned with the initial order status', async () => {
      const order = await placeCheckoutOrder(patientAToken, medicine)

      assert.equal(order.orderStatus, 'PLACED')
      assert.equal(order.statusHistory.at(-1).status, order.orderStatus)
    })
  })

  describe('pharmacy status transitions', () => {
    it('appends CONFIRMED after PLACED', async () => {
      const order = await createOrder(pharmacyA, patientA)
      const response = await patchStatus(
        pharmacyAToken,
        order._id.toString(),
        { status: 'CONFIRMED' },
      )

      assert.equal(response.status, 200)
      assert.deepEqual(
        response.body.data.order.statusHistory.map((entry) => entry.status),
        ['PLACED', 'CONFIRMED'],
      )
    })

    it('appends PROCESSING after CONFIRMED', async () => {
      const order = await createOrder(pharmacyA, patientA, {
        orderStatus: 'CONFIRMED',
      })
      const response = await patchStatus(
        pharmacyAToken,
        order._id.toString(),
        { status: 'PROCESSING' },
      )

      assert.equal(response.status, 200)
      assert.deepEqual(
        response.body.data.order.statusHistory.map((entry) => entry.status),
        ['PLACED', 'CONFIRMED', 'PROCESSING'],
      )
    })

    it('appends READY after PROCESSING', async () => {
      const order = await createOrder(pharmacyA, patientA, {
        orderStatus: 'PROCESSING',
      })
      const response = await patchStatus(
        pharmacyAToken,
        order._id.toString(),
        { status: 'READY' },
      )

      assert.equal(response.status, 200)
      assert.equal(response.body.data.order.statusHistory.at(-1).status, 'READY')
      assert.equal(response.body.data.order.statusHistory.length, 4)
    })

    it('appends OUT_FOR_DELIVERY after READY', async () => {
      const order = await createOrder(pharmacyA, patientA, {
        orderStatus: 'READY',
      })
      const response = await patchStatus(
        pharmacyAToken,
        order._id.toString(),
        { status: 'OUT_FOR_DELIVERY' },
      )

      assert.equal(response.status, 200)
      assert.equal(
        response.body.data.order.statusHistory.at(-1).status,
        'OUT_FOR_DELIVERY',
      )
      assert.equal(response.body.data.order.statusHistory.length, 5)
    })

    it('appends DELIVERED after OUT_FOR_DELIVERY', async () => {
      const order = await createOrder(pharmacyA, patientA, {
        orderStatus: 'OUT_FOR_DELIVERY',
      })
      const response = await patchStatus(
        pharmacyAToken,
        order._id.toString(),
        { status: 'DELIVERED' },
      )

      assert.equal(response.status, 200)
      assert.equal(
        response.body.data.order.statusHistory.at(-1).status,
        'DELIVERED',
      )
      assert.equal(response.body.data.order.statusHistory.length, 6)
    })

    it('appends CANCELLED for a valid cancellation', async () => {
      const order = await createOrder(pharmacyA, patientA)
      const response = await patchStatus(
        pharmacyAToken,
        order._id.toString(),
        { status: 'CANCELLED' },
      )

      assert.equal(response.status, 200)
      assert.deepEqual(
        response.body.data.order.statusHistory.map((entry) => entry.status),
        ['PLACED', 'CANCELLED'],
      )
    })

    it('appends exactly one entry for each transition in a full lifecycle', async () => {
      const order = await createOrder(pharmacyA, patientA)

      for (const status of LIFECYCLE.slice(1)) {
        const response = await patchStatus(
          pharmacyAToken,
          order._id.toString(),
          { status },
        )
        assert.equal(response.status, 200)
      }

      const stored = await Order.findById(order._id).lean()
      assert.deepEqual(
        stored.statusHistory.map((entry) => entry.status),
        LIFECYCLE,
      )
      for (let index = 1; index < stored.statusHistory.length; index += 1) {
        assert.ok(
          stored.statusHistory[index].timestamp >=
            stored.statusHistory[index - 1].timestamp,
        )
      }
    })
  })

  describe('invalid transitions', () => {
    it('does not append history for an invalid transition', async () => {
      const order = await createOrder(pharmacyA, patientA)
      const before = await Order.findById(order._id).lean()
      const response = await patchStatus(
        pharmacyAToken,
        order._id.toString(),
        { status: 'DELIVERED' },
      )

      assert.equal(response.status, 409)
      const after = await Order.findById(order._id).lean()
      assert.equal(after.orderStatus, 'PLACED')
      assert.deepEqual(after.statusHistory, before.statusHistory)
    })

    it('does not append history for a repeated transition', async () => {
      const order = await createOrder(pharmacyA, patientA, {
        orderStatus: 'CONFIRMED',
      })
      const before = await Order.findById(order._id).lean()
      const response = await patchStatus(
        pharmacyAToken,
        order._id.toString(),
        { status: 'CONFIRMED' },
      )

      assert.equal(response.status, 409)
      const after = await Order.findById(order._id).lean()
      assert.deepEqual(after.statusHistory, before.statusHistory)
    })

    it('does not append history for a delivered order', async () => {
      const order = await createOrder(pharmacyA, patientA, {
        orderStatus: 'DELIVERED',
      })
      const before = await Order.findById(order._id).lean()
      const response = await patchStatus(
        pharmacyAToken,
        order._id.toString(),
        { status: 'CANCELLED' },
      )

      assert.equal(response.status, 409)
      const after = await Order.findById(order._id).lean()
      assert.deepEqual(after.statusHistory, before.statusHistory)
    })

    it('does not append history for a cancelled order', async () => {
      const order = await createOrder(pharmacyA, patientA, {
        orderStatus: 'CANCELLED',
      })
      const before = await Order.findById(order._id).lean()
      const response = await patchStatus(
        pharmacyAToken,
        order._id.toString(),
        { status: 'CONFIRMED' },
      )

      assert.equal(response.status, 409)
      const after = await Order.findById(order._id).lean()
      assert.deepEqual(after.statusHistory, before.statusHistory)
    })
  })

  describe('atomic history integrity', () => {
    it('updates status and history together', async () => {
      const order = await createOrder(pharmacyA, patientA)
      const response = await patchStatus(
        pharmacyAToken,
        order._id.toString(),
        { status: 'CONFIRMED' },
      )

      assert.equal(response.status, 200)
      const stored = await Order.findById(order._id).lean()
      assert.equal(stored.orderStatus, 'CONFIRMED')
      assert.equal(stored.statusHistory.at(-1).status, 'CONFIRMED')
      assert.equal(stored.statusHistory.length, 2)
    })

    it('prevents concurrent updates from corrupting history', async () => {
      const order = await createOrder(pharmacyA, patientA)
      const [confirmed, cancelled] = await Promise.all([
        patchStatus(pharmacyAToken, order._id.toString(), {
          status: 'CONFIRMED',
        }),
        patchStatus(pharmacyAToken, order._id.toString(), {
          status: 'CANCELLED',
        }),
      ])

      assert.deepEqual(
        [confirmed.status, cancelled.status].sort(),
        [200, 409],
      )

      const stored = await Order.findById(order._id).lean()
      assert.equal(stored.statusHistory.length, 2)
      assert.equal(stored.statusHistory.at(-1).status, stored.orderStatus)
      assert.equal(
        stored.statusHistory.filter(
          (entry) => entry.status !== 'PLACED',
        ).length,
        1,
      )
    })

    it('does not duplicate history for a repeated request', async () => {
      const order = await createOrder(pharmacyA, patientA)
      const first = await patchStatus(pharmacyAToken, order._id.toString(), {
        status: 'CONFIRMED',
      })
      const second = await patchStatus(pharmacyAToken, order._id.toString(), {
        status: 'CONFIRMED',
      })

      assert.equal(first.status, 200)
      assert.equal(second.status, 409)
      const stored = await Order.findById(order._id).lean()
      assert.equal(stored.statusHistory.length, 2)
      assert.equal(
        stored.statusHistory.filter((entry) => entry.status === 'CONFIRMED')
          .length,
        1,
      )
    })
  })

  describe('patient access', () => {
    it('shows the status history to the order owner', async () => {
      const order = await createOrder(pharmacyA, patientA, {
        orderStatus: 'PROCESSING',
      })
      const response = await request(`/api/orders/${order._id}`, {
        token: patientAToken,
      })

      assert.equal(response.status, 200)
      assert.equal(response.body.data.order.orderStatus, 'PROCESSING')
      assert.deepEqual(
        response.body.data.order.statusHistory.map((entry) => entry.status),
        ['PLACED', 'CONFIRMED', 'PROCESSING'],
      )
    })

    it('does not show another patient order history', async () => {
      const order = await createOrder(pharmacyA, patientA, {
        orderStatus: 'CONFIRMED',
      })
      const response = await request(`/api/orders/${order._id}`, {
        token: patientBToken,
      })

      assert.equal(response.status, 404)
      assert.equal(response.body.code, 'ORDER_NOT_FOUND')
    })

    it('does not let a patient modify order history', async () => {
      const order = await createOrder(pharmacyA, patientA)
      const before = await Order.findById(order._id).lean()
      const response = await request(`/api/orders/${order._id}`, {
        method: 'PATCH',
        token: patientAToken,
        body: {
          statusHistory: [{ status: 'DELIVERED', timestamp: new Date() }],
        },
      })

      assert.ok(response.status >= 400)
      const after = await Order.findById(order._id).lean()
      assert.deepEqual(after.statusHistory, before.statusHistory)
    })

    it('does not let a patient change order status', async () => {
      const order = await createOrder(pharmacyA, patientA)
      const response = await patchStatus(
        patientAToken,
        order._id.toString(),
        { status: 'CANCELLED' },
      )

      assert.equal(response.status, 403)
      assert.equal(response.body.code, 'FORBIDDEN')
      const stored = await Order.findById(order._id).lean()
      assert.equal(stored.orderStatus, 'PLACED')
      assert.equal(stored.statusHistory.length, 1)
    })
  })

  describe('pharmacy access', () => {
    it('shows the status history to the owning pharmacy', async () => {
      const order = await createOrder(pharmacyA, patientA, {
        orderStatus: 'READY',
      })
      const response = await request(`/api/pharmacy/orders/${order._id}`, {
        token: pharmacyAToken,
      })

      assert.equal(response.status, 200)
      assert.deepEqual(
        response.body.data.order.statusHistory.map((entry) => entry.status),
        ['PLACED', 'CONFIRMED', 'PROCESSING', 'READY'],
      )
    })

    it('does not show another pharmacy order history', async () => {
      const order = await createOrder(pharmacyB, patientA)
      const response = await request(`/api/pharmacy/orders/${order._id}`, {
        token: pharmacyAToken,
      })

      assert.equal(response.status, 404)
      assert.equal(response.body.code, 'ORDER_NOT_FOUND')
    })

    it('does not let a pharmacy directly modify history', async () => {
      const order = await createOrder(pharmacyA, patientA)
      const response = await patchStatus(
        pharmacyAToken,
        order._id.toString(),
        {
          status: 'CONFIRMED',
          statusHistory: [{ status: 'DELIVERED', timestamp: new Date() }],
        },
      )

      assert.equal(response.status, 400)
      assert.equal(response.body.code, 'VALIDATION_ERROR')
      const stored = await Order.findById(order._id).lean()
      assert.equal(stored.orderStatus, 'PLACED')
      assert.deepEqual(
        stored.statusHistory.map((entry) => entry.status),
        ['PLACED'],
      )
    })

    it('creates history through an authorized status transition', async () => {
      const order = await createOrder(pharmacyA, patientA)
      const response = await patchStatus(
        pharmacyAToken,
        order._id.toString(),
        { status: 'CONFIRMED' },
      )

      assert.equal(response.status, 200)
      const stored = await Order.findById(order._id).lean()
      assert.equal(stored.statusHistory.at(-1).status, 'CONFIRMED')
      assert.equal(stored.statusHistory.length, 2)
    })
  })

  describe('history privacy and input safety', () => {
    it('exposes only status and timestamp in history entries', async () => {
      const order = await createOrder(pharmacyA, patientA, {
        orderStatus: 'CONFIRMED',
      })
      const response = await request(`/api/orders/${order._id}`, {
        token: patientAToken,
      })

      for (const entry of response.body.data.order.statusHistory) {
        assert.deepEqual(Object.keys(entry).sort(), ['status', 'timestamp'])
      }
    })

    it('does not expose account internals through history', async () => {
      const order = await createOrder(pharmacyA, patientA, {
        orderStatus: 'CONFIRMED',
      })
      const response = await request(`/api/orders/${order._id}`, {
        token: patientAToken,
      })
      const history = JSON.stringify(response.body.data.order.statusHistory)

      for (const forbidden of [
        'patientId',
        'pharmacyId',
        'passwordHash',
        'accessToken',
        'refreshToken',
        'userId',
        'changedBy',
      ]) {
        assert.equal(history.includes(forbidden), false)
      }
    })

    it('does not expose tokens or password hashes in order responses', async () => {
      const order = await createOrder(pharmacyA, patientA, {
        orderStatus: 'CONFIRMED',
      })
      const response = await request(`/api/orders/${order._id}`, {
        token: patientAToken,
      })
      const serialized = JSON.stringify(response.body)

      for (const forbidden of [
        'passwordHash',
        'accessToken',
        'refreshToken',
        'JWT',
      ]) {
        assert.equal(serialized.includes(forbidden), false)
      }
    })

    it('ignores status history supplied during checkout', async () => {
      const order = await placeCheckoutOrder(patientAToken, medicine, {
        statusHistory: [
          { status: 'DELIVERED', timestamp: new Date().toISOString() },
        ],
        orderStatus: 'DELIVERED',
      })

      assert.equal(order.orderStatus, 'PLACED')
      assert.deepEqual(
        order.statusHistory.map((entry) => entry.status),
        ['PLACED'],
      )
    })
  })

  describe('legacy orders', () => {
    async function createLegacyOrder(orderStatus = 'PLACED') {
      const order = await createOrder(pharmacyA, patientA, { orderStatus })
      await Order.collection.updateOne(
        { _id: order._id },
        { $unset: { statusHistory: 1 } },
      )
      return order
    }

    it('returns a legacy order without history without crashing', async () => {
      const order = await createLegacyOrder()
      const response = await request(`/api/orders/${order._id}`, {
        token: patientAToken,
      })

      assert.equal(response.status, 200)
      assert.equal(response.body.data.order.orderStatus, 'PLACED')
      assert.deepEqual(response.body.data.order.statusHistory, [])
    })

    it('does not invent historical transitions for a legacy delivered order', async () => {
      const order = await createLegacyOrder('DELIVERED')
      const response = await request(`/api/orders/${order._id}`, {
        token: patientAToken,
      })

      assert.equal(response.status, 200)
      assert.equal(response.body.data.order.orderStatus, 'DELIVERED')
      assert.deepEqual(response.body.data.order.statusHistory, [])
    })

    it('appends only the actual transition for a legacy order update', async () => {
      const order = await createLegacyOrder()
      const response = await patchStatus(
        pharmacyAToken,
        order._id.toString(),
        { status: 'CONFIRMED' },
      )

      assert.equal(response.status, 200)
      assert.deepEqual(
        response.body.data.order.statusHistory.map((entry) => entry.status),
        ['CONFIRMED'],
      )
    })

    it('returns a legacy pharmacy order without history without crashing', async () => {
      const order = await createLegacyOrder('READY')
      const response = await request(`/api/pharmacy/orders/${order._id}`, {
        token: pharmacyAToken,
      })

      assert.equal(response.status, 200)
      assert.deepEqual(response.body.data.order.statusHistory, [])
    })

    it('filters malformed legacy history entries safely', async () => {
      const order = await createOrder(pharmacyA, patientA)
      await Order.collection.updateOne(
        { _id: order._id },
        {
          $set: {
            statusHistory: [
              { status: 'PLACED', timestamp: order.placedAt },
              { status: 'NOT_A_STATUS', timestamp: new Date() },
              { status: 'CONFIRMED', timestamp: 'not-a-date' },
            ],
          },
        },
      )

      const response = await request(`/api/orders/${order._id}`, {
        token: patientAToken,
      })

      assert.equal(response.status, 200)
      assert.deepEqual(response.body.data.order.statusHistory, [
        {
          status: 'PLACED',
          timestamp: order.placedAt.toISOString(),
        },
      ])
    })
  })
})
