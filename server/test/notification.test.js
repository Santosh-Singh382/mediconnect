const { describe, before, after, beforeEach, it } = require('node:test')
const assert = require('node:assert/strict')
const mongoose = require('mongoose')
const { io: ioClient } = require('socket.io-client')
const {
  startServer,
  stopServer,
  clearUsers,
  clearPharmacies,
  clearMedicines,
  clearCarts,
  clearOrders,
  clearNotifications,
  createUser,
  tokenForUser,
  request,
  Pharmacy,
  Medicine,
  Order,
  Notification,
  baseUrl,
} = require('./helpers')
const { createNotification } = require('../src/services/notification.service')
const { setNotificationIO } = require('../src/realtime/notificationEvents')
const { buildIdentityKey } = require('../src/services/medicine.service')

const future = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)

function pharmacyData() {
  return {
    pharmacyName: 'Notification Test Pharmacy',
    pharmacistName: 'Ravi Kumar',
    licenseNumber: 'OD-PH-2026-901',
    phone: '9876543210',
    email: 'notification-pharmacy@test.example',
    address: 'Main Road',
    city: 'Berhampur',
    state: 'Odisha',
    pincode: '760001',
    verificationStatus: 'APPROVED',
    isActive: true,
  }
}

function medicineData() {
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
  }
}

function addressData() {
  return {
    fullName: 'Rina Das',
    phone: '9876543210',
    addressLine1: '12 Main Road',
    city: 'Berhampur',
    state: 'Odisha',
    pincode: '760001',
  }
}

function checkoutPayload(cartId) {
  return {
    cartId,
    deliveryAddress: addressData(),
    paymentMethod: 'COD',
  }
}

function connectSocket(url, token) {
  return new Promise((resolve) => {
    const socket = ioClient(url, {
      auth: { token },
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    })
    const onError = (error) => {
      socket.off('connect', onConnect)
      socket.close()
      resolve({ socket: null, error })
    }
    const onConnect = () => {
      socket.off('connect_error', onError)
      resolve({ socket, error: null })
    }
    socket.once('connect', onConnect)
    socket.once('connect_error', onError)
  })
}

function waitForEvent(socket, event, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for ${event}`)),
      timeoutMs,
    )
    socket.once(event, (payload) => {
      clearTimeout(timer)
      resolve(payload)
    })
  })
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('Notification module', () => {
  let patient
  let patientB
  let pharmacyOwner
  let patientToken
  let patientBToken
  let pharmacyToken
  let pharmacy
  let medicine

  before(async () => {
    await startServer({ realtime: true })
    await Notification.init()
  })

  after(async () => {
    await stopServer()
  })

  beforeEach(async () => {
    await clearNotifications()
    await clearOrders()
    await clearCarts()
    await clearMedicines()
    await clearPharmacies()
    await clearUsers()

    patient = await createUser({
      name: 'Notification Patient',
      email: 'notification-patient@example.com',
      phone: '9876543210',
      role: 'PATIENT',
    })
    patientB = await createUser({
      name: 'Other Patient',
      email: 'notification-other@example.com',
      role: 'PATIENT',
    })
    pharmacyOwner = await createUser({
      name: 'Notification Pharmacy Owner',
      email: 'notification-owner@example.com',
      role: 'PHARMACY',
    })
    patientToken = tokenForUser(patient)
    patientBToken = tokenForUser(patientB)
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

  async function checkout(headers) {
    const cartId = await addToCart()
    const response = await request('/api/orders/checkout', {
      method: 'POST',
      token: patientToken,
      headers,
      body: checkoutPayload(cartId),
    })
    assert.equal(response.status, 201, JSON.stringify(response.body))
    return response.body.data.order
  }

  async function setStatus(orderId, status) {
    const response = await request(`/api/pharmacy/orders/${orderId}/status`, {
      method: 'PATCH',
      token: pharmacyToken,
      body: { status },
    })
    assert.equal(response.status, 200, JSON.stringify(response.body))
    return response.body.data.order
  }

  function seedNotification(userId, eventKey, overrides = {}) {
    return Notification.create({
      userId,
      type: 'ORDER_DELIVERED',
      title: 'Order delivered',
      message: 'Your pharmacy order has been delivered.',
      referenceId: new mongoose.Types.ObjectId(),
      referenceType: 'ORDER',
      eventKey,
      ...overrides,
    })
  }

  describe('schema and idempotency', () => {
    it('defines the required notification indexes', () => {
      const indexes = Notification.schema.indexes()
      assert.equal(
        indexes.some(
          ([fields, options]) =>
            fields.userId === 1 &&
            fields.createdAt === -1 &&
            !options.unique,
        ),
        true,
      )
      assert.equal(
        indexes.some(
          ([fields]) =>
            fields.userId === 1 &&
            fields.isRead === 1 &&
            fields.createdAt === -1,
        ),
        true,
      )
      assert.equal(
        indexes.some(
          ([fields, options]) =>
            fields.userId === 1 &&
            fields.eventKey === 1 &&
            options.unique === true,
        ),
        true,
      )
    })

    it('defaults isRead to false and stores timestamps', async () => {
      const notification = await seedNotification(patient._id, 'ORDER_X:1')
      assert.equal(notification.isRead, false)
      assert.ok(notification.createdAt)
      assert.ok(notification.updatedAt)
    })

    it('rejects unsupported notification types', async () => {
      await assert.rejects(
        seedNotification(patient._id, 'ORDER_X:1', {
          type: 'PAYMENT_SUCCEEDED',
        }),
        (error) =>
          error.name === 'ValidationError' &&
          error.errors.type.message.includes('not a supported'),
      )
    })

    it('requires an owner, title, message, and event key', async () => {
      await assert.rejects(
        Notification.create({
          type: 'ORDER_PLACED',
          title: 'Order placed',
          message: 'Your pharmacy order has been placed successfully.',
          eventKey: 'ORDER_PLACED:missing-owner',
        }),
        (error) =>
          error.name === 'ValidationError' && Boolean(error.errors.userId),
      )
    })

    it('creates a notification and emits only safe fields', async () => {
      const orderId = new mongoose.Types.ObjectId()
      const result = await createNotification({
        userId: patient._id,
        type: 'ORDER_PLACED',
        title: 'Order placed',
        message: 'Your pharmacy order has been placed successfully.',
        referenceId: orderId,
        referenceType: 'ORDER',
        eventKey: `ORDER_PLACED:${orderId}`,
      })

      assert.equal(result.created, true)
      assert.deepEqual(Object.keys(result.notification).sort(), [
        'createdAt',
        'id',
        'isRead',
        'message',
        'referenceId',
        'referenceType',
        'title',
        'type',
      ])
      assert.equal(result.notification.userId, undefined)
      assert.equal(result.notification.eventKey, undefined)
    })

    it('returns the existing notification for duplicate event keys', async () => {
      const orderId = new mongoose.Types.ObjectId()
      const input = {
        userId: patient._id,
        type: 'ORDER_PLACED',
        title: 'Order placed',
        message: 'Your pharmacy order has been placed successfully.',
        referenceId: orderId,
        referenceType: 'ORDER',
        eventKey: `ORDER_PLACED:${orderId}`,
      }

      const first = await createNotification(input)
      const second = await createNotification(input)

      assert.equal(first.created, true)
      assert.equal(second.created, false)
      assert.equal(second.notification.id, first.notification.id)
      assert.equal(await Notification.countDocuments({}), 1)
    })

    it('allows the same event key for different users', async () => {
      const orderId = new mongoose.Types.ObjectId()
      const base = {
        type: 'ORDER_PLACED',
        title: 'Order placed',
        message: 'Your pharmacy order has been placed successfully.',
        referenceId: orderId,
        eventKey: `ORDER_PLACED:${orderId}`,
      }

      const first = await createNotification({ ...base, userId: patient._id })
      const second = await createNotification({ ...base, userId: patientB._id })

      assert.equal(first.created, true)
      assert.equal(second.created, true)
      assert.equal(await Notification.countDocuments({}), 2)
    })
  })

  describe('order notifications', () => {
    it('creates patient and pharmacy notifications after checkout', async () => {
      const order = await checkout()

      const patientNotifications = await Notification.find({
        userId: patient._id,
      }).lean()
      const pharmacyNotifications = await Notification.find({
        userId: pharmacyOwner._id,
      }).lean()

      assert.equal(patientNotifications.length, 1)
      assert.equal(patientNotifications[0].type, 'ORDER_PLACED')
      assert.equal(patientNotifications[0].title, 'Order placed')
      assert.equal(
        patientNotifications[0].message,
        'Your pharmacy order has been placed successfully.',
      )
      assert.equal(patientNotifications[0].referenceId.toString(), order.orderId)
      assert.equal(patientNotifications[0].referenceType, 'ORDER')
      assert.equal(
        patientNotifications[0].eventKey,
        `ORDER_PLACED:${order.orderId}`,
      )

      assert.equal(pharmacyNotifications.length, 1)
      assert.equal(pharmacyNotifications[0].type, 'NEW_ORDER')
      assert.equal(pharmacyNotifications[0].title, 'New order received')
      assert.equal(
        pharmacyNotifications[0].message,
        'A new pharmacy order has been received. Open Orders to review it.',
      )
      assert.equal(
        pharmacyNotifications[0].eventKey,
        `NEW_ORDER:${order.orderId}`,
      )
    })

    it('does not duplicate notifications when checkout is replayed', async () => {
      const idempotencyKey = new mongoose.Types.ObjectId().toString()
      const cartId = await addToCart()
      const headers = { 'Idempotency-Key': idempotencyKey }
      const body = checkoutPayload(cartId)

      const first = await request('/api/orders/checkout', {
        method: 'POST',
        token: patientToken,
        headers,
        body,
      })
      const second = await request('/api/orders/checkout', {
        method: 'POST',
        token: patientToken,
        headers,
        body,
      })

      assert.equal(first.status, 201)
      assert.equal(second.status, 200)
      assert.equal(
        await Notification.countDocuments({ userId: patient._id }),
        1,
      )
      assert.equal(
        await Notification.countDocuments({ userId: pharmacyOwner._id }),
        1,
      )
    })

    it('does not create notifications for a failed checkout', async () => {
      const cartId = await addToCart()
      const response = await request('/api/orders/checkout', {
        method: 'POST',
        token: patientToken,
        body: {
          ...checkoutPayload(cartId),
          paymentMethod: 'CARD',
        },
      })

      assert.equal(response.status, 400)
      assert.equal(await Notification.countDocuments({}), 0)
    })

    it('creates a patient notification after a successful status change', async () => {
      const order = await checkout()
      await setStatus(order.orderId, 'CONFIRMED')

      const notification = await Notification.findOne({
        userId: patient._id,
        type: 'ORDER_CONFIRMED',
      }).lean()

      assert.ok(notification)
      assert.equal(notification.title, 'Order confirmed')
      assert.equal(
        notification.message,
        'Your pharmacy order has been confirmed.',
      )
      assert.equal(
        notification.eventKey,
        `ORDER_CONFIRMED:${order.orderId}`,
      )
      assert.equal(
        await Notification.countDocuments({
          userId: pharmacyOwner._id,
          type: { $ne: 'NEW_ORDER' },
        }),
        0,
      )
    })

    it('creates the exact message for each supported status', async () => {
      const expected = [
        ['CONFIRMED', 'ORDER_CONFIRMED', 'Your pharmacy order has been confirmed.'],
        [
          'PROCESSING',
          'ORDER_PROCESSING',
          'Your pharmacy order is being processed.',
        ],
        ['READY', 'ORDER_READY', 'Your pharmacy order is ready.'],
        [
          'OUT_FOR_DELIVERY',
          'ORDER_OUT_FOR_DELIVERY',
          'Your pharmacy order is out for delivery.',
        ],
        [
          'DELIVERED',
          'ORDER_DELIVERED',
          'Your pharmacy order has been delivered.',
        ],
      ]

      const order = await checkout()
      for (const [status, type, message] of expected) {
        await setStatus(order.orderId, status)
        const notification = await Notification.findOne({
          userId: patient._id,
          type,
        }).lean()
        assert.ok(notification, type)
        assert.equal(notification.message, message)
        assert.equal(notification.eventKey, `${type}:${order.orderId}`)
      }
    })

    it('creates the cancellation message after a valid cancellation', async () => {
      const order = await checkout()
      await setStatus(order.orderId, 'CANCELLED')

      const notification = await Notification.findOne({
        userId: patient._id,
        type: 'ORDER_CANCELLED',
      }).lean()

      assert.ok(notification)
      assert.equal(notification.title, 'Order cancelled')
      assert.equal(
        notification.message,
        'Your pharmacy order has been cancelled.',
      )
    })

    it('does not notify for an invalid status transition', async () => {
      const order = await checkout()
      const response = await request(
        `/api/pharmacy/orders/${order.orderId}/status`,
        {
          method: 'PATCH',
          token: pharmacyToken,
          body: { status: 'DELIVERED' },
        },
      )

      assert.equal(response.status, 409)
      assert.equal(
        await Notification.countDocuments({
          userId: patient._id,
          type: 'ORDER_DELIVERED',
        }),
        0,
      )
    })

    it('does not notify again when the same status is submitted again', async () => {
      const order = await checkout()
      await setStatus(order.orderId, 'CONFIRMED')

      const repeated = await request(
        `/api/pharmacy/orders/${order.orderId}/status`,
        {
          method: 'PATCH',
          token: pharmacyToken,
          body: { status: 'CONFIRMED' },
        },
      )

      assert.equal(repeated.status, 409)
      assert.equal(
        await Notification.countDocuments({
          userId: patient._id,
          type: 'ORDER_CONFIRMED',
        }),
        1,
      )
    })

    it('notifies only once when two status transitions race', async () => {
      const order = await checkout()
      await setStatus(order.orderId, 'CONFIRMED')

      const requests = await Promise.all([
        request(`/api/pharmacy/orders/${order.orderId}/status`, {
          method: 'PATCH',
          token: pharmacyToken,
          body: { status: 'PROCESSING' },
        }),
        request(`/api/pharmacy/orders/${order.orderId}/status`, {
          method: 'PATCH',
          token: pharmacyToken,
          body: { status: 'PROCESSING' },
        }),
      ])

      const statuses = requests.map((response) => response.status).sort()
      assert.deepEqual(statuses, [200, 409])
      assert.equal(
        await Notification.countDocuments({
          userId: patient._id,
          type: 'ORDER_PROCESSING',
        }),
        1,
      )
    })

    it('does not create direct-order notifications without the order flow', async () => {
      await Order.create({
        patientId: patient._id,
        pharmacyId: pharmacy._id,
        pharmacySnapshot: {
          pharmacyName: pharmacy.pharmacyName,
          city: pharmacy.city,
          state: pharmacy.state,
          pincode: pharmacy.pincode,
        },
        items: [
          {
            medicineId: medicine._id,
            nameSnapshot: medicine.name,
            quantity: 1,
            unitPriceSnapshot: medicine.price,
            lineTotal: medicine.price,
            prescriptionRequired: false,
          },
        ],
        deliveryAddress: addressData(),
        subtotal: medicine.price,
        deliveryFee: 0,
        totalAmount: medicine.price,
        sourceCartId: new mongoose.Types.ObjectId(),
      })

      assert.equal(await Notification.countDocuments({}), 0)
    })
  })

  describe('notification APIs', () => {
    it('requires authentication for every notification endpoint', async () => {
      const responses = await Promise.all([
        request('/api/notifications'),
        request('/api/notifications/unread-count'),
        request('/api/notifications/read-all', { method: 'PATCH' }),
        request(
          `/api/notifications/${new mongoose.Types.ObjectId()}/read`,
          { method: 'PATCH' },
        ),
      ])

      for (const response of responses) {
        assert.equal(response.status, 401)
      }
    })

    it('lists only the authenticated user notifications', async () => {
      await seedNotification(patient._id, 'ORDER_A:1')
      await seedNotification(patientB._id, 'ORDER_A:1')

      const response = await request('/api/notifications', {
        token: patientToken,
      })

      assert.equal(response.status, 200)
      assert.equal(response.body.data.notifications.length, 1)
      assert.equal(response.body.data.notifications[0].id !== undefined, true)
      assert.equal(response.body.data.unreadCount, 1)
      assert.equal(response.body.data.pagination.page, 1)
      assert.equal(response.body.data.pagination.limit, 20)
    })

    it('paginates notifications and caps the limit at 50', async () => {
      await seedNotification(patient._id, 'ORDER_A:1')
      await seedNotification(patient._id, 'ORDER_A:2')
      await seedNotification(patient._id, 'ORDER_A:3')

      const page = await request('/api/notifications?page=2&limit=2', {
        token: patientToken,
      })
      assert.equal(page.status, 200)
      assert.equal(page.body.data.notifications.length, 1)
      assert.equal(page.body.data.pagination.total, 3)
      assert.equal(page.body.data.pagination.totalPages, 2)

      const tooLarge = await request('/api/notifications?limit=51', {
        token: patientToken,
      })
      assert.equal(tooLarge.status, 400)
      assert.equal(tooLarge.body.code, 'VALIDATION_ERROR')
      assert.equal(tooLarge.body.details[0].field, 'limit')
    })

    it('supports unreadOnly filtering and validation', async () => {
      await seedNotification(patient._id, 'ORDER_A:1')
      await seedNotification(patient._id, 'ORDER_A:2', { isRead: true })

      const unread = await request('/api/notifications?unreadOnly=true', {
        token: patientToken,
      })
      assert.equal(unread.status, 200)
      assert.equal(unread.body.data.notifications.length, 1)
      assert.equal(unread.body.data.notifications[0].isRead, false)

      const all = await request('/api/notifications?unreadOnly=false', {
        token: patientToken,
      })
      assert.equal(all.body.data.notifications.length, 2)
      assert.equal(all.body.data.unreadCount, 1)

      const invalid = await request('/api/notifications?unreadOnly=yes', {
        token: patientToken,
      })
      assert.equal(invalid.status, 400)
      assert.equal(invalid.body.details[0].field, 'unreadOnly')
    })

    it('returns the unread notification count', async () => {
      await seedNotification(patient._id, 'ORDER_A:1')
      await seedNotification(patient._id, 'ORDER_A:2')
      await seedNotification(patient._id, 'ORDER_A:3', { isRead: true })
      await seedNotification(patientB._id, 'ORDER_A:1')

      const response = await request('/api/notifications/unread-count', {
        token: patientToken,
      })

      assert.equal(response.status, 200)
      assert.equal(response.body.data.unreadCount, 2)
    })

    it('marks a notification as read and returns the new unread count', async () => {
      const seeded = await seedNotification(patient._id, 'ORDER_A:1')

      const response = await request(
        `/api/notifications/${seeded._id}/read`,
        { method: 'PATCH', token: patientToken },
      )

      assert.equal(response.status, 200)
      assert.equal(response.body.data.notification.isRead, true)
      assert.equal(response.body.data.unreadCount, 0)
      assert.equal(
        (await Notification.findById(seeded._id).lean()).isRead,
        true,
      )
    })

    it('returns success without writing again when already read', async () => {
      const seeded = await seedNotification(patient._id, 'ORDER_A:1')

      const first = await request(`/api/notifications/${seeded._id}/read`, {
        method: 'PATCH',
        token: patientToken,
      })
      assert.equal(first.status, 200)

      const before = await Notification.findById(seeded._id).lean()
      await delay(20)
      const second = await request(`/api/notifications/${seeded._id}/read`, {
        method: 'PATCH',
        token: patientToken,
      })
      const after = await Notification.findById(seeded._id).lean()

      assert.equal(second.status, 200)
      assert.equal(second.body.data.notification.isRead, true)
      assert.equal(second.body.data.unreadCount, 0)
      assert.equal(after.updatedAt.getTime(), before.updatedAt.getTime())
    })

    it('returns 404 when marking another user notification as read', async () => {
      const seeded = await seedNotification(patientB._id, 'ORDER_A:1')

      const response = await request(
        `/api/notifications/${seeded._id}/read`,
        { method: 'PATCH', token: patientToken },
      )

      assert.equal(response.status, 404)
      assert.equal(response.body.code, 'NOTIFICATION_NOT_FOUND')
      assert.equal(
        (await Notification.findById(seeded._id).lean()).isRead,
        false,
      )
    })

    it('rejects an invalid notification identifier', async () => {
      const response = await request('/api/notifications/not-an-id/read', {
        method: 'PATCH',
        token: patientToken,
      })

      assert.equal(response.status, 400)
      assert.equal(response.body.code, 'VALIDATION_ERROR')
      assert.equal(response.body.details[0].field, 'notificationId')
    })

    it('marks all of the authenticated user notifications as read', async () => {
      await seedNotification(patient._id, 'ORDER_A:1')
      await seedNotification(patient._id, 'ORDER_A:2')
      const other = await seedNotification(patientB._id, 'ORDER_A:1')

      const response = await request('/api/notifications/read-all', {
        method: 'PATCH',
        token: patientToken,
      })

      assert.equal(response.status, 200)
      assert.equal(response.body.data.updatedCount, 2)
      assert.equal(response.body.data.unreadCount, 0)
      assert.equal(
        await Notification.countDocuments({
          userId: patient._id,
          isRead: false,
        }),
        0,
      )
      assert.equal(
        (await Notification.findById(other._id).lean()).isRead,
        false,
      )

      const again = await request('/api/notifications/read-all', {
        method: 'PATCH',
        token: patientToken,
      })
      assert.equal(again.status, 200)
      assert.equal(again.body.data.updatedCount, 0)
    })
  })

  describe('real-time delivery', () => {
    it('rejects an unauthenticated socket connection', async () => {
      const { socket, error } = await connectSocket(baseUrl(), 'invalid-token')
      assert.equal(socket, null)
      assert.match(error.message, /Unauthorized/i)
    })

    it('emits new order notifications to the patient and pharmacy rooms', async () => {
      const patientSocket = await connectSocket(baseUrl(), patientToken)
      const pharmacySocket = await connectSocket(baseUrl(), pharmacyToken)
      assert.ok(patientSocket.socket)
      assert.ok(pharmacySocket.socket)

      const patientEvent = waitForEvent(patientSocket.socket, 'notification:new')
      const pharmacyEvent = waitForEvent(
        pharmacySocket.socket,
        'notification:new',
      )

      const order = await checkout()

      const [patientNotification, pharmacyNotification] = await Promise.all([
        patientEvent,
        pharmacyEvent,
      ])

      assert.equal(patientNotification.type, 'ORDER_PLACED')
      assert.equal(patientNotification.referenceId, order.orderId)
      assert.equal(patientNotification.userId, undefined)
      assert.equal(patientNotification.eventKey, undefined)
      assert.equal(pharmacyNotification.type, 'NEW_ORDER')
      assert.equal(pharmacyNotification.referenceId, order.orderId)

      patientSocket.socket.close()
      pharmacySocket.socket.close()
    })

    it('does not emit another user notification to an unrelated socket', async () => {
      const otherSocket = await connectSocket(baseUrl(), patientBToken)
      assert.ok(otherSocket.socket)
      const events = []
      otherSocket.socket.on('notification:new', (payload) => events.push(payload))

      const patientSocket = await connectSocket(baseUrl(), patientToken)
      const patientEvent = waitForEvent(patientSocket.socket, 'notification:new')

      await checkout()
      await patientEvent
      await delay(250)

      assert.equal(events.length, 0)
      patientSocket.socket.close()
      otherSocket.socket.close()
    })

    it('persists a notification when realtime delivery is unavailable', async () => {
      setNotificationIO(null)

      const result = await createNotification({
        userId: patient._id,
        type: 'ORDER_PLACED',
        title: 'Order placed',
        message: 'Your pharmacy order has been placed successfully.',
        referenceId: new mongoose.Types.ObjectId(),
        referenceType: 'ORDER',
        eventKey: `ORDER_PLACED:${new mongoose.Types.ObjectId()}`,
      })

      assert.equal(result.created, true)
      assert.equal(await Notification.countDocuments({ userId: patient._id }), 1)
    })
  })
})
