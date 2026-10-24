const notificationService = require('../services/notification.service')

async function listNotifications(req, res) {
  const data = await notificationService.listNotifications(req.user.id, req.query)
  res.json({ success: true, data })
}

async function getUnreadCount(req, res) {
  const unreadCount = await notificationService.getUnreadCount(req.user.id)
  res.json({ success: true, data: { unreadCount } })
}

async function markNotificationRead(req, res) {
  const data = await notificationService.markNotificationRead(
    req.user.id,
    req.params.notificationId,
  )
  res.json({ success: true, data })
}

async function markAllNotificationsRead(req, res) {
  const data = await notificationService.markAllNotificationsRead(req.user.id)
  res.json({ success: true, data })
}

module.exports = {
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
}
