let ioServer = null

function notificationRoom(userId) {
  return `notifications:${userId}`
}

function setNotificationIO(io) {
  ioServer = io || null
}

function emitNotification(userId, notification) {
  if (!ioServer) {
    return false
  }

  ioServer.to(notificationRoom(userId)).emit('notification:new', notification)
  return true
}

module.exports = {
  notificationRoom,
  setNotificationIO,
  emitNotification,
}
