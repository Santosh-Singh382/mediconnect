const express = require('express')
const { requireAuth } = require('../middleware/auth.middleware')
const chatController = require('../controllers/chat.controller')

const router = express.Router()

router.use(requireAuth)

router.get('/:appointmentId/messages', chatController.getMessages)
router.post('/:appointmentId/messages', chatController.sendMessage)
router.patch('/:appointmentId/read', chatController.markAsRead)

module.exports = router