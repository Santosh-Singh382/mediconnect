const mongoose = require('mongoose')

const NOTIFICATION_TYPES = [
  'ORDER_PLACED',
  'ORDER_CONFIRMED',
  'ORDER_PROCESSING',
  'ORDER_READY',
  'ORDER_OUT_FOR_DELIVERY',
  'ORDER_DELIVERED',
  'ORDER_CANCELLED',
  'NEW_ORDER',
  'DOCTOR_APPROVED',
  'DOCTOR_REJECTED',
  'PHARMACY_APPROVED',
  'PHARMACY_REJECTED',
]

const REFERENCE_TYPES = ['ORDER', 'DOCTOR_PROFILE', 'PHARMACY_PROFILE']

const MAX_EVENT_KEY_LENGTH = 180
const MAX_TITLE_LENGTH = 120
const MAX_MESSAGE_LENGTH = 500

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Notification user is required'],
      index: true,
    },
    type: {
      type: String,
      enum: {
        values: NOTIFICATION_TYPES,
        message: '{VALUE} is not a supported notification type',
      },
      required: [true, 'Notification type is required'],
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
      maxlength: [
        MAX_TITLE_LENGTH,
        `Notification title cannot exceed ${MAX_TITLE_LENGTH} characters`,
      ],
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true,
      maxlength: [
        MAX_MESSAGE_LENGTH,
        `Notification message cannot exceed ${MAX_MESSAGE_LENGTH} characters`,
      ],
    },
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    referenceType: {
      type: String,
      enum: {
        values: REFERENCE_TYPES,
        message: '{VALUE} is not a supported reference type',
      },
      default: 'ORDER',
    },
    eventKey: {
      type: String,
      required: [true, 'Notification event key is required'],
      trim: true,
      maxlength: [
        MAX_EVENT_KEY_LENGTH,
        `Notification event key cannot exceed ${MAX_EVENT_KEY_LENGTH} characters`,
      ],
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
)

notificationSchema.index({ userId: 1, createdAt: -1 })
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 })
notificationSchema.index({ userId: 1, eventKey: 1 }, { unique: true })

const NotificationModel = mongoose.model('Notification', notificationSchema)

module.exports = NotificationModel
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES
module.exports.REFERENCE_TYPES = REFERENCE_TYPES
module.exports.MAX_EVENT_KEY_LENGTH = MAX_EVENT_KEY_LENGTH
module.exports.MAX_TITLE_LENGTH = MAX_TITLE_LENGTH
module.exports.MAX_MESSAGE_LENGTH = MAX_MESSAGE_LENGTH
