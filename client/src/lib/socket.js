import { io } from 'socket.io-client'
import { getStoredToken } from './tokenStorage.js'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || undefined

let socket = null

// Returns the shared authenticated socket, creating and connecting it on first
// use. The JWT is sent only through the Socket.IO auth handshake and is never
// exposed to the UI. Returns null when the user is not authenticated.
export function getSocket() {
  const token = getStoredToken()
  if (!token) {
    return null
  }

  if (!socket) {
    socket = io(SOCKET_URL, {
      auth: { token },
      autoConnect: false,
    })
  }

  if (!socket.connected && !socket.active) {
    socket.auth = { token }
    socket.connect()
  }

  return socket
}

export function disconnectSocket() {
  if (!socket) {
    return
  }
  socket.removeAllListeners()
  socket.disconnect()
  socket = null
}