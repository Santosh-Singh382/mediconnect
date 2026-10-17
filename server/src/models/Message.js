const mongoose = require('mongoose')

const MESSAGE_TYPES = ['TEXT']
const MAX_MESSAGE_LENGTH = 2000

const messageSchema = new mongoose.Schema(
  {
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      required: [true, 'Appointment is required'],
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sender is required'],
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Receiver is required'],
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
      trim: true,
      minlength: [1, 'Message cannot be empty'],
      maxlength: [MAX_MESSAGE_LENGTH, `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters`],
    },
    messageType: {
      type: String,
      default: 'TEXT',
      enum: {
        values: MESSAGE_TYPES,
        message: '{VALUE} is not a supported message type',
      },
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
)

// History is fetched by appointment in chronological order.
messageSchema.index({ appointmentId: 1, createdAt: 1 })

// Unread counts for a participant.
messageSchema.index({ receiverId: 1, isRead: 1 })

// Own messages lists for a participant.
messageSchema.index({ senderId: 1, createdAt: 1 })

const MessageModel = mongoose.model('Message', messageSchema)

module.exports = MessageModel
module.exports.MESSAGE_TYPES = MESSAGE_TYPES
module.exports.MAX_MESSAGE_LENGTH = MAX_MESSAGE_LENGTH