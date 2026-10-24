const mongoose = require('mongoose')
const Notification = require('../models/Notification')
const Pharmacy = require('../models/Pharmacy')
const ApiError = require('../utils/ApiError')
const { emitNotification } = require('../realtime/notificationEvents')

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50

const ORDER_NOTIFICATION_CONTENT = {
  ORDER_PLACED: {
    title: 'Order placed',
    message: 'Your pharmacy order has been placed successfully.',
  },
  ORDER_CONFIRMED: {
    title: 'Order confirmed',
    message: 'Your pharmacy order has been confirmed.',
  },
  ORDER_PROCESSING: {
    title: 'Order processing',
    message: 'Your pharmacy order is being processed.',
  },
  ORDER_READY: {
    title: 'Order ready',
    message: 'Your pharmacy order is ready.',
  },
  ORDER_OUT_FOR_DELIVERY: {
    title: 'Order out for delivery',
    message: 'Your pharmacy order is out for delivery.',
  },
  ORDER_DELIVERED: {
    title: 'Order delivered',
    message: 'Your pharmacy order has been delivered.',
  },
  ORDER_CANCELLED: {
    title: 'Order cancelled',
    message: 'Your pharmacy order has been cancelled.',
  },
  NEW_ORDER: {
    title: 'New order received',
    message:
      'A new pharmacy order has been received. Open Orders to review it.',
  },
}

const VERIFICATION_NOTIFICATION_CONTENT = {
  DOCTOR_APPROVED: {
    title: 'Doctor profile approved',
    message:
      'Your doctor profile has been approved and is visible in the public directory.',
  },
  DOCTOR_REJECTED: {
    title: 'Doctor profile verification rejected',
    message:
      'Your doctor profile verification was rejected. Review your details and contact support if you need help.',
  },
  PHARMACY_APPROVED: {
    title: 'Pharmacy approved',
    message:
      'Your pharmacy profile has been approved. Your pharmacy is now visible in the public directory.',
  },
  PHARMACY_REJECTED: {
    title: 'Pharmacy verification rejected',
    message:
      'Your pharmacy profile verification was rejected. Review your details and contact support if you need help.',
  },
}

const STATUS_NOTIFICATION_TYPES = {
  CONFIRMED: 'ORDER_CONFIRMED',
  PROCESSING: 'ORDER_PROCESSING',
  READY: 'ORDER_READY',
  OUT_FOR_DELIVERY: 'ORDER_OUT_FOR_DELIVERY',
  DELIVERED: 'ORDER_DELIVERED',
  CANCELLED: 'ORDER_CANCELLED',
}

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value)
}

function serializeNotification(notification) {
  const source =
    typeof notification.toObject === 'function'
      ? notification.toObject()
      : notification

  return {
    id: source._id.toString(),
    type: source.type,
    title: source.title,
    message: source.message,
    referenceId: source.referenceId ? source.referenceId.toString() : null,
    referenceType: source.referenceType || null,
    isRead: Boolean(source.isRead),
    createdAt: source.createdAt ? source.createdAt.toISOString() : null,
  }
}

function notificationPayload({
  userId,
  type,
  title,
  message,
  referenceId,
  referenceType = 'ORDER',
  eventKey,
}) {
  return {
    userId,
    type,
    title,
    message,
    referenceId: referenceId || null,
    referenceType,
    eventKey,
  }
}

async function createNotification(input) {
  let notification

  try {
    notification = await Notification.create(notificationPayload(input))
  } catch (error) {
    if (error && error.code === 11000) {
      const existing = await Notification.findOne({
        userId: input.userId,
        eventKey: input.eventKey,
      }).lean()

      if (existing) {
        return { notification: serializeNotification(existing), created: false }
      }
    }
    throw error
  }

  const serialized = serializeNotification(notification)

  try {
    emitNotification(input.userId, serialized)
  } catch {
    return { notification: serialized, created: true }
  }

  return { notification: serialized, created: true }
}

async function createNotificationSafely(input) {
  try {
    return await createNotification(input)
  } catch (error) {
    console.error(`Notification could not be created: ${error.message}`)
    return null
  }
}

async function notifyOrderCreated(order) {
  const orderId = order._id.toString()
  const placedContent = ORDER_NOTIFICATION_CONTENT.ORDER_PLACED
  const newOrderContent = ORDER_NOTIFICATION_CONTENT.NEW_ORDER

  const tasks = [
    createNotificationSafely({
      userId: order.patientId,
      type: 'ORDER_PLACED',
      title: placedContent.title,
      message: placedContent.message,
      referenceId: order._id,
      referenceType: 'ORDER',
      eventKey: `ORDER_PLACED:${orderId}`,
    }),
  ]

  try {
    const pharmacy = await Pharmacy.findById(order.pharmacyId)
      .select('userId')
      .lean()

    if (pharmacy && pharmacy.userId) {
      tasks.push(
        createNotificationSafely({
          userId: pharmacy.userId,
          type: 'NEW_ORDER',
          title: newOrderContent.title,
          message: newOrderContent.message,
          referenceId: order._id,
          referenceType: 'ORDER',
          eventKey: `NEW_ORDER:${orderId}`,
        }),
      )
    }
  } catch (error) {
    console.error(`Pharmacy notification recipient lookup failed: ${error.message}`)
  }

  await Promise.all(tasks)
}

async function notifyOrderStatusChanged(order) {
  const type = STATUS_NOTIFICATION_TYPES[order.orderStatus]
  if (!type) {
    return
  }

  const content = ORDER_NOTIFICATION_CONTENT[type]
  const orderId = order._id.toString()

  await createNotificationSafely({
    userId: order.patientId,
    type,
    title: content.title,
    message: content.message,
    referenceId: order._id,
    referenceType: 'ORDER',
    eventKey: `${type}:${orderId}`,
  })
}

async function notifyVerificationDecision({
  subject,
  userId,
  profileId,
  status,
  eventTimestamp,
}) {
  const prefix = subject === 'DOCTOR' ? 'DOCTOR' : 'PHARMACY'
  const type = `${prefix}_${status}`
  const content = VERIFICATION_NOTIFICATION_CONTENT[type]
  if (!content) {
    return null
  }

  const timestamp =
    eventTimestamp instanceof Date ? eventTimestamp : new Date(eventTimestamp)
  const keyTimestamp = Number.isNaN(timestamp.getTime())
    ? Date.now()
    : timestamp.getTime()

  return createNotificationSafely({
    userId,
    type,
    title: content.title,
    message: content.message,
    referenceId: profileId,
    referenceType: prefix === 'DOCTOR' ? 'DOCTOR_PROFILE' : 'PHARMACY_PROFILE',
    eventKey: `${type}:${profileId.toString()}:${keyTimestamp}`,
  })
}

function parsePositiveInteger(raw, field, errors, fallback, max) {
  if (raw === undefined || raw === '') {
    return fallback
  }
  if (Array.isArray(raw) || (typeof raw !== 'string' && typeof raw !== 'number')) {
    errors.push({ field, message: `${field} must be a positive whole number` })
    return fallback
  }

  const value = Number(raw)
  if (!Number.isInteger(value) || value < 1) {
    errors.push({ field, message: `${field} must be a positive whole number` })
    return fallback
  }
  if (value > max) {
    errors.push({ field, message: `${field} cannot exceed ${max}` })
    return fallback
  }

  return value
}

function parseUnreadOnly(raw, errors) {
  if (raw === undefined || raw === '') {
    return false
  }
  if (Array.isArray(raw) || typeof raw !== 'string') {
    errors.push({ field: 'unreadOnly', message: 'unreadOnly must be true or false' })
    return false
  }

  const value = raw.trim().toLowerCase()
  if (value === 'true') {
    return true
  }
  if (value === 'false') {
    return false
  }

  errors.push({ field: 'unreadOnly', message: 'unreadOnly must be true or false' })
  return false
}

function parseListQuery(query) {
  const errors = []
  const page = parsePositiveInteger(
    query.page,
    'page',
    errors,
    DEFAULT_PAGE,
    1000000,
  )
  const limit = parsePositiveInteger(
    query.limit,
    'limit',
    errors,
    DEFAULT_LIMIT,
    MAX_LIMIT,
  )
  const unreadOnly = parseUnreadOnly(query.unreadOnly, errors)

  if (errors.length > 0) {
    throw new ApiError(
      400,
      'Invalid notifications query',
      'VALIDATION_ERROR',
      errors,
    )
  }

  return { page, limit, unreadOnly }
}

async function getUnreadCount(userId) {
  return Notification.countDocuments({ userId, isRead: false })
}

async function listNotifications(userId, query) {
  const { page, limit, unreadOnly } = parseListQuery(query || {})
  const filter = { userId }
  if (unreadOnly) {
    filter.isRead = false
  }

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Notification.countDocuments(filter),
    getUnreadCount(userId),
  ])

  return {
    notifications: notifications.map(serializeNotification),
    pagination: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
    unreadCount,
  }
}

async function markNotificationRead(userId, notificationId) {
  if (!isValidObjectId(notificationId)) {
    throw new ApiError(400, 'Invalid notification identifier', 'VALIDATION_ERROR', [
      {
        field: 'notificationId',
        message: 'Notification ID is not a valid identifier',
      },
    ])
  }

  const updated = await Notification.findOneAndUpdate(
    { _id: notificationId, userId, isRead: false },
    { $set: { isRead: true } },
    { returnDocument: 'after' },
  ).lean()

  let notification = updated
  if (!notification) {
    notification = await Notification.findOne({
      _id: notificationId,
      userId,
    }).lean()
  }

  if (!notification) {
    throw new ApiError(404, 'Notification not found', 'NOTIFICATION_NOT_FOUND')
  }

  return {
    notification: serializeNotification(notification),
    unreadCount: await getUnreadCount(userId),
  }
}

async function markAllNotificationsRead(userId) {
  const result = await Notification.updateMany(
    { userId, isRead: false },
    { $set: { isRead: true } },
  )

  return {
    updatedCount: result.modifiedCount || 0,
    unreadCount: 0,
  }
}

module.exports = {
  createNotification,
  notifyOrderCreated,
  notifyOrderStatusChanged,
  notifyVerificationDecision,
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  serializeNotification,
  ORDER_NOTIFICATION_CONTENT,
  STATUS_NOTIFICATION_TYPES,
}
