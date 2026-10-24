const express = require('express')
const { requireAuth } = require('../middleware/auth.middleware')
const notificationController = require('../controllers/notification.controller')

const router = express.Router()

router.use(requireAuth)

router.get('/', notificationController.listNotifications)
router.get('/unread-count', notificationController.getUnreadCount)
router.patch('/read-all', notificationController.markAllNotificationsRead)
router.patch('/:notificationId/read', notificationController.markNotificationRead)

module.exports = router
