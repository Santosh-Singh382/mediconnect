const asyncHandler = require('../utils/asyncHandler')
const chatService = require('../services/chat.service')

const getMessages = asyncHandler(async (req, res) => {
  const data = await chatService.getMessages({
    appointmentId: req.params.appointmentId,
    userId: req.user.id,
    query: req.query,
  })
  res.json({ success: true, data })
})

const sendMessage = asyncHandler(async (req, res) => {
  const data = await chatService.sendMessage({
    appointmentId: req.params.appointmentId,
    userId: req.user.id,
    message: req.body && req.body.message,
  })
  res.status(201).json({ success: true, data })
})

const markAsRead = asyncHandler(async (req, res) => {
  const data = await chatService.markAsRead({
    appointmentId: req.params.appointmentId,
    userId: req.user.id,
  })
  res.json({ success: true, data })
})

module.exports = {
  getMessages,
  sendMessage,
  markAsRead,
}