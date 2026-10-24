const { describe, before, after, beforeEach, it } = require('node:test')
const assert = require('node:assert/strict')
const mongoose = require('mongoose')
const {
  startServer,
  stopServer,
  clearUsers,
  clearPharmacies,
  clearMedicines,
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

function pharmacyData(overrides = {}) {
  return {
    pharmacyName: 'Aarogya Pharmacy',
    pharmacistName: 'Ravi Kumar',
    licenseNumber: 'OD-PH-2026-501',
    phone: '9876543210',
    email: 'private-aarogya@example.com',
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

function itemData(overrides = {}) {
  return {
    medicineId: new mongoose.Types.ObjectId(),
    nameSnapshot: 'Paracetamol',
    genericNameSnapshot: 'Acetaminophen',
    brandNameSnapshot: 'Dolo',
    dosageFormSnapshot: 'Tablet',
    strengthSnapshot: '500 mg',
    packSizeSnapshot: '10 tablets',
    quantity: 2,
    unitPriceSnapshot: 25.5,
    lineTotal: 51,
    prescriptionRequired: false,
    prescriptionId: null,
    ...overrides,
  }
}

let orderSequence = 0

async function createOrder(pharmacy, patient, overrides = {}) {
  orderSequence += 1
  const placedAt =
    overrides.placedAt || new Date(Date.now() - orderSequence * 60 * 1000)
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
    subtotal: 51,
    deliveryFee: 0,
    totalAmount: 51,
    paymentMethod: 'COD',
    paymentStatus: 'PENDING',
    orderStatus: 'PLACED',
    prescriptionStatus: 'NOT_REQUIRED',
    placedAt,
    sourceCartId: new mongoose.Types.ObjectId(),
    ...overrides,
  })
}

async function listPharmacyOrders(token, query = '') {
  return request(`/api/pharmacy/orders${query}`, { token })
}

async function getSummary(token) {
  return request('/api/pharmacy/orders/summary', { token })
}

async function getPharmacyOrder(token, orderId) {
  return request(`/api/pharmacy/orders/${orderId}`, { token })
}

async function patchStatus(token, orderId, body) {
  return request(`/api/pharmacy/orders/${orderId}/status`, {
    method: 'PATCH',
    token,
    body,
  })
}

describe('Pharmacy order management module', () => {
  let patientA
  let patientB
  let doctorUser
  let adminUser
  let pharmacyAUser
  let pharmacyBUser
  let pendingOwner
  let rejectedOwner
  let inactiveOwner
  let noProfileOwner
  let patientAToken
  let pharmacyAToken
  let pharmacyBToken
  let pendingToken
  let rejectedToken
  let inactiveToken
  let noProfileToken
  let doctorToken
  let adminToken
  let pharmacyA
  let pharmacyB

  before(async () => {
    await startServer()
    await Order.init()
  })

  after(async () => {
    await stopServer()
  })

  beforeEach(async () => {
    await clearOrders()
    await clearMedicines()
    await clearPharmacies()
    await clearUsers()
    orderSequence = 0

    patientA = await createUser({
      name: 'Pharmacy Order Patient A',
      email: 'pharmacy-order-patient-a@example.com',
      phone: '9876543210',
      role: 'PATIENT',
    })
    patientB = await createUser({
      name: 'Pharmacy Order Patient B',
      email: 'pharmacy-order-patient-b@example.com',
      phone: '9876543211',
      role: 'PATIENT',
    })
    doctorUser = await createUser({
      name: 'Pharmacy Order Doctor',
      email: 'pharmacy-order-doctor@example.com',
      role: 'DOCTOR',
    })
    adminUser = await createUser({
      name: 'Pharmacy Order Admin',
      email: 'pharmacy-order-admin@example.com',
      role: 'ADMIN',
    })
    pharmacyAUser = await createUser({
      name: 'Aarogya Owner',
      email: 'pharmacy-order-a@example.com',
      role: 'PHARMACY',
    })
    pharmacyBUser = await createUser({
      name: 'Wellness Owner',
      email: 'pharmacy-order-b@example.com',
      role: 'PHARMACY',
    })
    pendingOwner = await createUser({
      name: 'Pending Owner',
      email: 'pharmacy-order-pending@example.com',
      role: 'PHARMACY',
    })
    rejectedOwner = await createUser({
      name: 'Rejected Owner',
      email: 'pharmacy-order-rejected@example.com',
      role: 'PHARMACY',
    })
    inactiveOwner = await createUser({
      name: 'Inactive Owner',
      email: 'pharmacy-order-inactive@example.com',
      role: 'PHARMACY',
    })
    noProfileOwner = await createUser({
      name: 'No Profile Owner',
      email: 'pharmacy-order-no-profile@example.com',
      role: 'PHARMACY',
    })

    patientAToken = tokenForUser(patientA)
    pharmacyAToken = tokenForUser(pharmacyAUser)
    pharmacyBToken = tokenForUser(pharmacyBUser)
    pendingToken = tokenForUser(pendingOwner)
    rejectedToken = tokenForUser(rejectedOwner)
    inactiveToken = tokenForUser(inactiveOwner)
    noProfileToken = tokenForUser(noProfileOwner)
    doctorToken = tokenForUser(doctorUser)
    adminToken = tokenForUser(adminUser)

    pharmacyA = await createPharmacy(pharmacyAUser)
    pharmacyB = await createPharmacy(pharmacyBUser, {
      pharmacyName: 'Wellness Pharmacy',
      licenseNumber: 'OD-PH-2026-502',
      email: 'private-wellness@example.com',
      address: 'Market Street',
      city: 'Bhubaneswar',
    })
    await createPharmacy(pendingOwner, {
      pharmacyName: 'Pending Pharmacy',
      licenseNumber: 'OD-PH-2026-503',
      verificationStatus: 'PENDING',
    })
    await createPharmacy(rejectedOwner, {
      pharmacyName: 'Rejected Pharmacy',
      licenseNumber: 'OD-PH-2026-504',
      verificationStatus: 'REJECTED',
    })
    await createPharmacy(inactiveOwner, {
      pharmacyName: 'Inactive Pharmacy',
      licenseNumber: 'OD-PH-2026-505',
      isActive: false,
    })
  })

  describe('authentication and roles', () => {
    it('rejects an unauthenticated order list', async () => {
      const response = await request('/api/pharmacy/orders')
      assert.equal(response.status, 401)
      assert.equal(response.body.code, 'UNAUTHORIZED')
    })

    it('rejects an unauthenticated order detail', async () => {
      const response = await request(
        `/api/pharmacy/orders/${new mongoose.Types.ObjectId().toString()}`,
      )
      assert.equal(response.status, 401)
      assert.equal(response.body.code, 'UNAUTHORIZED')
    })

    it('rejects an unauthenticated summary request', async () => {
      const response = await request('/api/pharmacy/orders/summary')
      assert.equal(response.status, 401)
      assert.equal(response.body.code, 'UNAUTHORIZED')
    })

    it('rejects an unauthenticated status update', async () => {
      const response = await request(
        `/api/pharmacy/orders/${new mongoose.Types.ObjectId().toString()}/status`,
        { method: 'PATCH', body: { status: 'CONFIRMED' } },
      )
      assert.equal(response.status, 401)
      assert.equal(response.body.code, 'UNAUTHORIZED')
    })

    it('blocks patients from the pharmacy order list', async () => {
      const response = await listPharmacyOrders(patientAToken)
      assert.equal(response.status, 403)
      assert.equal(response.body.code, 'FORBIDDEN')
    })

    it('blocks doctors from the pharmacy order list', async () => {
      const response = await listPharmacyOrders(doctorToken)
      assert.equal(response.status, 403)
      assert.equal(response.body.code, 'FORBIDDEN')
    })

    it('blocks administrators from pharmacy order management', async () => {
      const order = await createOrder(pharmacyA, patientA)
      const response = await patchStatus(adminToken, order._id, {
        status: 'CONFIRMED',
      })
      assert.equal(response.status, 403)
      assert.equal(response.body.code, 'FORBIDDEN')
      assert.equal(
        (await Order.findById(order._id).lean()).orderStatus,
        'PLACED',
      )
    })

    it('blocks patients from updating pharmacy order status', async () => {
      const order = await createOrder(pharmacyA, patientA)
      const response = await patchStatus(patientAToken, order._id, {
        status: 'CONFIRMED',
      })
      assert.equal(response.status, 403)
      assert.equal(response.body.code, 'FORBIDDEN')
    })
  })

  describe('pharmacy profile eligibility', () => {
    it('requires a pharmacy profile', async () => {
      const response = await listPharmacyOrders(noProfileToken)
      assert.equal(response.status, 404)
      assert.equal(response.body.code, 'PROFILE_REQUIRED')
    })

    it('rejects a pending pharmacy profile', async () => {
      const response = await listPharmacyOrders(pendingToken)
      assert.equal(response.status, 403)
      assert.equal(response.body.code, 'PHARMACY_NOT_APPROVED')
    })

    it('rejects a pending pharmacy summary', async () => {
      const response = await getSummary(pendingToken)
      assert.equal(response.status, 403)
      assert.equal(response.body.code, 'PHARMACY_NOT_APPROVED')
    })

    it('rejects a rejected pharmacy profile', async () => {
      const response = await listPharmacyOrders(rejectedToken)
      assert.equal(response.status, 403)
      assert.equal(response.body.code, 'PHARMACY_REJECTED')
    })

    it('rejects an inactive pharmacy profile', async () => {
      const response = await listPharmacyOrders(inactiveToken)
      assert.equal(response.status, 403)
      assert.equal(response.body.code, 'PHARMACY_INACTIVE')
    })

    it('allows an approved active pharmacy', async () => {
      await createOrder(pharmacyA, patientA)
      const response = await listPharmacyOrders(pharmacyAToken)
      assert.equal(response.status, 200)
      assert.equal(response.body.data.orders.length, 1)
    })
  })

  describe('pharmacy isolation', () => {
    it('lists only orders belonging to the authenticated pharmacy', async () => {
      await createOrder(pharmacyA, patientA)
      await createOrder(pharmacyB, patientB)

      const response = await listPharmacyOrders(pharmacyAToken)
      assert.equal(response.status, 200)
      assert.equal(response.body.data.orders.length, 1)
      assert.equal(response.body.data.pagination.total, 1)
    })

    it('ignores a client-supplied pharmacy identifier in list queries', async () => {
      await createOrder(pharmacyA, patientA)
      await createOrder(pharmacyB, patientB)

      const response = await listPharmacyOrders(
        pharmacyAToken,
        `?pharmacyId=${pharmacyB._id.toString()}`,
      )
      assert.equal(response.status, 200)
      assert.equal(response.body.data.orders.length, 1)
      assert.equal(response.body.data.orders[0].deliveryAddress.fullName, 'Rina Das')
    })

    it('does not count another pharmacy orders in the summary', async () => {
      await createOrder(pharmacyA, patientA)
      await createOrder(pharmacyB, patientB, { orderStatus: 'DELIVERED' })

      const response = await getSummary(pharmacyAToken)
      assert.equal(response.status, 200)
      assert.equal(response.body.data.summary.placed, 1)
      assert.equal(response.body.data.summary.delivered, 0)
    })

    it('does not expose another pharmacy order by identifier', async () => {
      const otherOrder = await createOrder(pharmacyB, patientB)
      const response = await getPharmacyOrder(
        pharmacyAToken,
        otherOrder._id.toString(),
      )
      assert.equal(response.status, 404)
      assert.equal(response.body.code, 'ORDER_NOT_FOUND')
    })

    it('does not update another pharmacy order', async () => {
      const otherOrder = await createOrder(pharmacyB, patientB)
      const response = await patchStatus(
        pharmacyAToken,
        otherOrder._id.toString(),
        { status: 'CONFIRMED' },
      )
      assert.equal(response.status, 404)
      assert.equal(response.body.code, 'ORDER_NOT_FOUND')
      assert.equal(
        (await Order.findById(otherOrder._id).lean()).orderStatus,
        'PLACED',
      )
    })

    it('does not find another pharmacy order through search', async () => {
      const otherOrder = await createOrder(pharmacyB, patientB)
      const response = await listPharmacyOrders(
        pharmacyAToken,
        `?q=${otherOrder._id.toString()}`,
      )
      assert.equal(response.status, 200)
      assert.equal(response.body.data.orders.length, 0)
    })
  })

  describe('listing, search, filter, sorting, and pagination', () => {
    it('returns orders with default page and limit metadata', async () => {
      await createOrder(pharmacyA, patientA)
      const response = await listPharmacyOrders(pharmacyAToken)
      assert.equal(response.status, 200)
      assert.equal(response.body.data.orders.length, 1)
      assert.deepEqual(response.body.data.pagination, {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      })
    })

    it('sorts by newest first by default', async () => {
      const older = await createOrder(pharmacyA, patientA, {
        placedAt: new Date('2026-01-01T10:00:00.000Z'),
      })
      const newer = await createOrder(pharmacyA, patientA, {
        placedAt: new Date('2026-02-01T10:00:00.000Z'),
      })

      const response = await listPharmacyOrders(pharmacyAToken)
      assert.deepEqual(
        response.body.data.orders.map((order) => order.orderId),
        [newer._id.toString(), older._id.toString()],
      )
    })

    it('sorts by oldest first', async () => {
      const older = await createOrder(pharmacyA, patientA, {
        placedAt: new Date('2026-01-01T10:00:00.000Z'),
      })
      const newer = await createOrder(pharmacyA, patientA, {
        placedAt: new Date('2026-02-01T10:00:00.000Z'),
      })

      const response = await listPharmacyOrders(
        pharmacyAToken,
        '?sort=oldest',
      )
      assert.deepEqual(
        response.body.data.orders.map((order) => order.orderId),
        [older._id.toString(), newer._id.toString()],
      )
    })

    it('sorts by total amount in both directions', async () => {
      const low = await createOrder(pharmacyA, patientA, { totalAmount: 10 })
      const high = await createOrder(pharmacyA, patientA, { totalAmount: 90 })

      const descending = await listPharmacyOrders(
        pharmacyAToken,
        '?sort=total_desc',
      )
      assert.deepEqual(
        descending.body.data.orders.map((order) => order.orderId),
        [high._id.toString(), low._id.toString()],
      )

      const ascending = await listPharmacyOrders(
        pharmacyAToken,
        '?sort=total_asc',
      )
      assert.deepEqual(
        ascending.body.data.orders.map((order) => order.orderId),
        [low._id.toString(), high._id.toString()],
      )
    })

    it('filters by status', async () => {
      await createOrder(pharmacyA, patientA)
      const confirmed = await createOrder(pharmacyA, patientA, {
        orderStatus: 'CONFIRMED',
      })

      const response = await listPharmacyOrders(
        pharmacyAToken,
        '?status=confirmed',
      )
      assert.equal(response.status, 200)
      assert.equal(response.body.data.orders.length, 1)
      assert.equal(response.body.data.orders[0].orderId, confirmed._id.toString())
    })

    it('searches by complete order identifier', async () => {
      const target = await createOrder(pharmacyA, patientA)
      await createOrder(pharmacyA, patientA)

      const response = await listPharmacyOrders(
        pharmacyAToken,
        `?q=${target._id.toString()}`,
      )
      assert.equal(response.status, 200)
      assert.equal(response.body.data.orders.length, 1)
      assert.equal(response.body.data.orders[0].orderId, target._id.toString())
    })

    it('searches customer names case-insensitively', async () => {
      await createOrder(pharmacyA, patientA, {
        deliveryAddress: addressData({ fullName: 'Anita Sharma' }),
      })
      await createOrder(pharmacyA, patientA, {
        deliveryAddress: addressData({ fullName: 'Rina Das' }),
      })

      const response = await listPharmacyOrders(pharmacyAToken, '?q=anita')
      assert.equal(response.status, 200)
      assert.equal(response.body.data.orders.length, 1)
      assert.equal(
        response.body.data.orders[0].deliveryAddress.fullName,
        'Anita Sharma',
      )
    })

    it('searches medicine names case-insensitively', async () => {
      await createOrder(pharmacyA, patientA, {
        items: [itemData({ nameSnapshot: 'Cetirizine' })],
      })
      await createOrder(pharmacyA, patientA)

      const response = await listPharmacyOrders(pharmacyAToken, '?q=cetirizine')
      assert.equal(response.status, 200)
      assert.equal(response.body.data.orders.length, 1)
      assert.equal(response.body.data.orders[0].items[0].name, 'Cetirizine')
    })

    it('returns an empty result when no orders match the search', async () => {
      await createOrder(pharmacyA, patientA)
      const response = await listPharmacyOrders(
        pharmacyAToken,
        '?q=does-not-exist',
      )
      assert.equal(response.status, 200)
      assert.deepEqual(response.body.data.orders, [])
      assert.equal(response.body.data.pagination.total, 0)
      assert.equal(response.body.data.pagination.totalPages, 0)
    })

    it('paginates results using the requested page and limit', async () => {
      const base = new Date('2026-03-01T10:00:00.000Z').getTime()
      for (let index = 0; index < 5; index += 1) {
        await createOrder(pharmacyA, patientA, {
          placedAt: new Date(base + index * 60 * 1000),
        })
      }

      const response = await listPharmacyOrders(
        pharmacyAToken,
        '?page=2&limit=2',
      )
      assert.equal(response.status, 200)
      assert.equal(response.body.data.orders.length, 2)
      assert.deepEqual(response.body.data.pagination, {
        page: 2,
        limit: 2,
        total: 5,
        totalPages: 3,
      })
    })

    it('rejects a limit above the maximum', async () => {
      const response = await listPharmacyOrders(pharmacyAToken, '?limit=51')
      assert.equal(response.status, 400)
      assert.equal(response.body.code, 'VALIDATION_ERROR')
      assert.equal(response.body.details[0].field, 'limit')
    })

    it('rejects a malformed page', async () => {
      const response = await listPharmacyOrders(pharmacyAToken, '?page=abc')
      assert.equal(response.status, 400)
      assert.equal(response.body.code, 'VALIDATION_ERROR')
      assert.equal(response.body.details[0].field, 'page')
    })

    it('rejects an unsupported status filter', async () => {
      const response = await listPharmacyOrders(
        pharmacyAToken,
        '?status=UNKNOWN',
      )
      assert.equal(response.status, 400)
      assert.equal(response.body.code, 'VALIDATION_ERROR')
      assert.equal(response.body.details[0].field, 'status')
    })

    it('rejects an unsupported sort value', async () => {
      const response = await listPharmacyOrders(
        pharmacyAToken,
        '?sort=createdAt',
      )
      assert.equal(response.status, 400)
      assert.equal(response.body.code, 'VALIDATION_ERROR')
      assert.equal(response.body.details[0].field, 'sort')
    })

    it('rejects repeated search query parameters', async () => {
      const response = await listPharmacyOrders(
        pharmacyAToken,
        '?q=paracetamol&q=cetirizine',
      )
      assert.equal(response.status, 400)
      assert.equal(response.body.code, 'VALIDATION_ERROR')
      assert.equal(response.body.details[0].field, 'q')
    })

    it('rejects an overlong search query', async () => {
      const response = await listPharmacyOrders(
        pharmacyAToken,
        `?q=${'x'.repeat(101)}`,
      )
      assert.equal(response.status, 400)
      assert.equal(response.body.code, 'VALIDATION_ERROR')
      assert.equal(response.body.details[0].field, 'q')
    })
  })

  describe('order details and serialization', () => {
    it('returns complete safe order details', async () => {
      const order = await createOrder(pharmacyA, patientA, {
        items: [
          itemData({
            prescriptionRequired: true,
            prescriptionId: new mongoose.Types.ObjectId(),
          }),
        ],
        prescriptionStatus: 'VERIFIED',
      })

      const response = await getPharmacyOrder(
        pharmacyAToken,
        order._id.toString(),
      )
      assert.equal(response.status, 200)
      const data = response.body.data.order
      assert.equal(data.orderId, order._id.toString())
      assert.equal(data.orderStatus, 'PLACED')
      assert.equal(data.paymentMethod, 'COD')
      assert.equal(data.paymentStatus, 'PENDING')
      assert.equal(data.prescriptionStatus, 'VERIFIED')
      assert.equal(data.deliveryAddress.fullName, 'Rina Das')
      assert.equal(data.deliveryAddress.phone, '9876543210')
      assert.equal(data.items.length, 1)
      assert.equal(data.items[0].name, 'Paracetamol')
      assert.equal(data.items[0].prescriptionRequired, true)
    })

    it('returns only the expected order and item fields', async () => {
      const order = await createOrder(pharmacyA, patientA, {
        items: [itemData({ prescriptionId: new mongoose.Types.ObjectId() })],
      })
      const response = await getPharmacyOrder(
        pharmacyAToken,
        order._id.toString(),
      )
      const data = response.body.data.order

      assert.deepEqual(Object.keys(data).sort(), [
        'createdAt',
        'deliveryAddress',
        'deliveryFee',
        'items',
        'orderId',
        'orderStatus',
        'paymentMethod',
        'paymentStatus',
        'placedAt',
        'prescriptionStatus',
        'statusHistory',
        'subtotal',
        'totalAmount',
        'updatedAt',
      ])
      assert.deepEqual(Object.keys(data.items[0]).sort(), [
        'brandName',
        'dosageForm',
        'genericName',
        'lineTotal',
        'name',
        'packSize',
        'prescriptionRequired',
        'quantity',
        'strength',
        'unitPrice',
      ])
    })

    it('does not expose patient accounts, medical data, or internal fields', async () => {
      const order = await createOrder(pharmacyA, patientA, {
        items: [itemData({ prescriptionId: new mongoose.Types.ObjectId() })],
      })
      const response = await getPharmacyOrder(
        pharmacyAToken,
        order._id.toString(),
      )
      const serialized = JSON.stringify(response.body)

      for (const forbidden of [
        'patientId',
        'sourceCartId',
        'idempotencyKey',
        'pharmacySnapshot',
        'passwordHash',
        'prescriptionId',
        'medicineId',
        'pharmacy-order-patient-a@example.com',
        'private-aarogya@example.com',
        'diagnosis',
      ]) {
        assert.equal(
          serialized.includes(forbidden),
          false,
          `response must not expose ${forbidden}`,
        )
      }
    })

    it('returns not found for a foreign pharmacy order', async () => {
      const order = await createOrder(pharmacyB, patientB)
      const response = await getPharmacyOrder(
        pharmacyAToken,
        order._id.toString(),
      )
      assert.equal(response.status, 404)
      assert.equal(response.body.code, 'ORDER_NOT_FOUND')
    })

    it('rejects a malformed order identifier', async () => {
      const response = await getPharmacyOrder(pharmacyAToken, 'not-an-id')
      assert.equal(response.status, 400)
      assert.equal(response.body.code, 'VALIDATION_ERROR')
      assert.equal(response.body.details[0].field, 'orderId')
    })
  })

  describe('valid status transitions', () => {
    it('confirms a placed order', async () => {
      const order = await createOrder(pharmacyA, patientA)
      const response = await patchStatus(
        pharmacyAToken,
        order._id.toString(),
        { status: 'CONFIRMED' },
      )
      assert.equal(response.status, 200)
      assert.equal(response.body.data.order.orderStatus, 'CONFIRMED')
      assert.equal(
        (await Order.findById(order._id).lean()).orderStatus,
        'CONFIRMED',
      )
    })

    it('cancels a placed order', async () => {
      const order = await createOrder(pharmacyA, patientA)
      const response = await patchStatus(
        pharmacyAToken,
        order._id.toString(),
        { status: 'CANCELLED' },
      )
      assert.equal(response.status, 200)
      assert.equal(response.body.data.order.orderStatus, 'CANCELLED')
    })

    it('starts processing a confirmed order', async () => {
      const order = await createOrder(pharmacyA, patientA, {
        orderStatus: 'CONFIRMED',
      })
      const response = await patchStatus(
        pharmacyAToken,
        order._id.toString(),
        { status: 'PROCESSING' },
      )
      assert.equal(response.status, 200)
      assert.equal(response.body.data.order.orderStatus, 'PROCESSING')
    })

    it('cancels a confirmed order', async () => {
      const order = await createOrder(pharmacyA, patientA, {
        orderStatus: 'CONFIRMED',
      })
      const response = await patchStatus(
        pharmacyAToken,
        order._id.toString(),
        { status: 'CANCELLED' },
      )
      assert.equal(response.status, 200)
      assert.equal(response.body.data.order.orderStatus, 'CANCELLED')
    })

    it('marks a processing order ready', async () => {
      const order = await createOrder(pharmacyA, patientA, {
        orderStatus: 'PROCESSING',
      })
      const response = await patchStatus(
        pharmacyAToken,
        order._id.toString(),
        { status: 'READY' },
      )
      assert.equal(response.status, 200)
      assert.equal(response.body.data.order.orderStatus, 'READY')
    })

    it('marks a ready order out for delivery', async () => {
      const order = await createOrder(pharmacyA, patientA, {
        orderStatus: 'READY',
      })
      const response = await patchStatus(
        pharmacyAToken,
        order._id.toString(),
        { status: 'OUT_FOR_DELIVERY' },
      )
      assert.equal(response.status, 200)
      assert.equal(response.body.data.order.orderStatus, 'OUT_FOR_DELIVERY')
    })

    it('marks an out-for-delivery order delivered', async () => {
      const order = await createOrder(pharmacyA, patientA, {
        orderStatus: 'OUT_FOR_DELIVERY',
      })
      const response = await patchStatus(
        pharmacyAToken,
        order._id.toString(),
        { status: 'DELIVERED' },
      )
      assert.equal(response.status, 200)
      assert.equal(response.body.data.order.orderStatus, 'DELIVERED')
    })

    it('makes a successful status change visible to the patient', async () => {
      const order = await createOrder(pharmacyA, patientA)
      const updated = await patchStatus(
        pharmacyAToken,
        order._id.toString(),
        { status: 'CONFIRMED' },
      )
      assert.equal(updated.status, 200)

      const patientView = await request(`/api/orders/${order._id.toString()}`, {
        token: patientAToken,
      })
      assert.equal(patientView.status, 200)
      assert.equal(patientView.body.data.order.orderStatus, 'CONFIRMED')
    })
  })

  describe('invalid status transitions', () => {
    const invalidTransitions = [
      ['PLACED', 'DELIVERED'],
      ['PLACED', 'OUT_FOR_DELIVERY'],
      ['CONFIRMED', 'READY'],
      ['PROCESSING', 'DELIVERED'],
      ['DELIVERED', 'CANCELLED'],
      ['CANCELLED', 'CONFIRMED'],
      ['PLACED', 'PLACED'],
    ]

    for (const [currentStatus, requestedStatus] of invalidTransitions) {
      it(`rejects ${currentStatus} to ${requestedStatus}`, async () => {
        const order = await createOrder(pharmacyA, patientA, {
          orderStatus: currentStatus,
        })
        const response = await patchStatus(
          pharmacyAToken,
          order._id.toString(),
          { status: requestedStatus },
        )
        assert.equal(response.status, 409)
        assert.equal(response.body.code, 'INVALID_STATUS_TRANSITION')
        assert.equal(response.body.details[0].currentStatus, currentStatus)
        assert.equal(response.body.details[0].requestedStatus, requestedStatus)
        assert.equal(
          (await Order.findById(order._id).lean()).orderStatus,
          currentStatus,
        )
      })
    }

    it('rejects an unknown target status', async () => {
      const order = await createOrder(pharmacyA, patientA)
      const response = await patchStatus(
        pharmacyAToken,
        order._id.toString(),
        { status: 'SHIPPED' },
      )
      assert.equal(response.status, 400)
      assert.equal(response.body.code, 'VALIDATION_ERROR')
      assert.equal(response.body.details[0].field, 'status')
    })

    it('rejects a missing target status', async () => {
      const order = await createOrder(pharmacyA, patientA)
      const response = await patchStatus(pharmacyAToken, order._id.toString(), {})
      assert.equal(response.status, 400)
      assert.equal(response.body.code, 'VALIDATION_ERROR')
      assert.equal(response.body.details[0].field, 'status')
    })

    it('rejects a non-string target status', async () => {
      const order = await createOrder(pharmacyA, patientA)
      const response = await patchStatus(
        pharmacyAToken,
        order._id.toString(),
        { status: 1 },
      )
      assert.equal(response.status, 400)
      assert.equal(response.body.code, 'VALIDATION_ERROR')
      assert.equal(response.body.details[0].field, 'status')
    })

    it('rejects attempts to update payment status', async () => {
      const order = await createOrder(pharmacyA, patientA)
      const response = await patchStatus(
        pharmacyAToken,
        order._id.toString(),
        { status: 'CONFIRMED', paymentStatus: 'PAID' },
      )
      assert.equal(response.status, 400)
      assert.equal(response.body.code, 'VALIDATION_ERROR')
      assert.equal(response.body.details[0].field, 'paymentStatus')

      const saved = await Order.findById(order._id).lean()
      assert.equal(saved.orderStatus, 'PLACED')
      assert.equal(saved.paymentStatus, 'PENDING')
    })

    it('rejects attempts to update totals', async () => {
      const order = await createOrder(pharmacyA, patientA)
      const response = await patchStatus(
        pharmacyAToken,
        order._id.toString(),
        { status: 'CONFIRMED', totalAmount: 1 },
      )
      assert.equal(response.status, 400)
      assert.equal(response.body.code, 'VALIDATION_ERROR')
      assert.equal(response.body.details[0].field, 'totalAmount')
      assert.equal((await Order.findById(order._id).lean()).totalAmount, 51)
    })

    it('rejects attempts to override pharmacy ownership', async () => {
      const order = await createOrder(pharmacyA, patientA)
      const response = await patchStatus(
        pharmacyAToken,
        order._id.toString(),
        { status: 'CONFIRMED', pharmacyId: pharmacyB._id.toString() },
      )
      assert.equal(response.status, 400)
      assert.equal(response.body.code, 'VALIDATION_ERROR')
      assert.equal(response.body.details[0].field, 'pharmacyId')
      assert.equal(
        (await Order.findById(order._id).lean()).orderStatus,
        'PLACED',
      )
    })

    it('rejects a foreign order update before revealing its status', async () => {
      const order = await createOrder(pharmacyB, patientB, {
        orderStatus: 'DELIVERED',
      })
      const response = await patchStatus(
        pharmacyAToken,
        order._id.toString(),
        { status: 'CANCELLED' },
      )
      assert.equal(response.status, 404)
      assert.equal(response.body.code, 'ORDER_NOT_FOUND')
      assert.equal(response.body.details, undefined)
    })
  })

  describe('order integrity', () => {
    it('does not change stock when confirming or cancelling an order', async () => {
      const medicineData = {
        name: 'Stock Integrity Medicine',
        genericName: 'Stock Integrity',
        brandName: 'Integrity',
        category: 'TABLET',
        description: 'Test medicine.',
        dosageForm: 'Tablet',
        strength: '10 mg',
        packSize: '10 tablets',
        price: 10,
        stockQuantity: 8,
        prescriptionRequired: false,
        expiryDate: future,
        isActive: true,
      }
      const medicine = await Medicine.create({
        pharmacyId: pharmacyA._id,
        ...medicineData,
        identityKey: buildIdentityKey(medicineData),
      })
      const order = await createOrder(pharmacyA, patientA, {
        items: [itemData({ medicineId: medicine._id, quantity: 2 })],
      })

      const confirmed = await patchStatus(
        pharmacyAToken,
        order._id.toString(),
        { status: 'CONFIRMED' },
      )
      assert.equal(confirmed.status, 200)
      assert.equal(
        (await Medicine.findById(medicine._id).lean()).stockQuantity,
        8,
      )

      const cancelled = await patchStatus(
        pharmacyAToken,
        order._id.toString(),
        { status: 'CANCELLED' },
      )
      assert.equal(cancelled.status, 200)
      assert.equal(
        (await Medicine.findById(medicine._id).lean()).stockQuantity,
        8,
      )
    })

    it('keeps payment, totals, items, and address immutable', async () => {
      const order = await createOrder(pharmacyA, patientA, {
        items: [itemData({ prescriptionId: new mongoose.Types.ObjectId() })],
      })
      const before = await Order.findById(order._id).lean()

      const response = await patchStatus(
        pharmacyAToken,
        order._id.toString(),
        { status: 'CONFIRMED' },
      )
      assert.equal(response.status, 200)

      const after = await Order.findById(order._id).lean()
      assert.equal(after.paymentStatus, before.paymentStatus)
      assert.equal(after.paymentMethod, before.paymentMethod)
      assert.equal(after.subtotal, before.subtotal)
      assert.equal(after.deliveryFee, before.deliveryFee)
      assert.equal(after.totalAmount, before.totalAmount)
      assert.equal(after.prescriptionStatus, before.prescriptionStatus)
      assert.deepEqual(after.items, before.items)
      assert.deepEqual(after.deliveryAddress, before.deliveryAddress)
    })

    it('does not mark a delivered order as paid', async () => {
      const order = await createOrder(pharmacyA, patientA, {
        orderStatus: 'OUT_FOR_DELIVERY',
      })
      const response = await patchStatus(
        pharmacyAToken,
        order._id.toString(),
        { status: 'DELIVERED' },
      )
      assert.equal(response.status, 200)
      assert.equal(response.body.data.order.paymentStatus, 'PENDING')
      assert.equal(
        (await Order.findById(order._id).lean()).paymentStatus,
        'PENDING',
      )
    })

    it('allows only one of two concurrent transitions from the same status', async () => {
      const order = await createOrder(pharmacyA, patientA)
      const [confirmed, cancelled] = await Promise.all([
        patchStatus(pharmacyAToken, order._id.toString(), {
          status: 'CONFIRMED',
        }),
        patchStatus(pharmacyAToken, order._id.toString(), {
          status: 'CANCELLED',
        }),
      ])

      const statuses = [confirmed.status, cancelled.status].sort()
      assert.deepEqual(statuses, [200, 409])
      const saved = await Order.findById(order._id).lean()
      assert.ok(['CONFIRMED', 'CANCELLED'].includes(saved.orderStatus))
    })
  })

  describe('dashboard summary', () => {
    it('counts every pharmacy-owned status', async () => {
      await createOrder(pharmacyA, patientA)
      await createOrder(pharmacyA, patientA)
      await createOrder(pharmacyA, patientA, { orderStatus: 'CONFIRMED' })
      await createOrder(pharmacyA, patientA, { orderStatus: 'PROCESSING' })
      await createOrder(pharmacyA, patientA, { orderStatus: 'READY' })
      await createOrder(pharmacyA, patientA, {
        orderStatus: 'OUT_FOR_DELIVERY',
      })
      await createOrder(pharmacyA, patientA, { orderStatus: 'DELIVERED' })
      await createOrder(pharmacyA, patientA, { orderStatus: 'CANCELLED' })
      await createOrder(pharmacyB, patientB, { orderStatus: 'PLACED' })

      const response = await getSummary(pharmacyAToken)
      assert.equal(response.status, 200)
      assert.deepEqual(response.body.data.summary, {
        placed: 2,
        confirmed: 1,
        processing: 1,
        ready: 1,
        outForDelivery: 1,
        delivered: 1,
        cancelled: 1,
      })
    })

    it('returns zero counts when the pharmacy has no orders', async () => {
      const response = await getSummary(pharmacyAToken)
      assert.equal(response.status, 200)
      assert.deepEqual(response.body.data.summary, {
        placed: 0,
        confirmed: 0,
        processing: 0,
        ready: 0,
        outForDelivery: 0,
        delivered: 0,
        cancelled: 0,
      })
    })
  })
})
