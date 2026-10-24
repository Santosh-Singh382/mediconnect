import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from './useAuth.js'
import { getSocket, disconnectSocket } from '../lib/socket.js'

const ACK_TIMEOUT_MS = 8000

function emitWithAck(socket, event, payload) {
  return new Promise((resolve) => {
    const timer = setTimeout(
      () => resolve({ ok: false, code: 'TIMEOUT' }),
      ACK_TIMEOUT_MS,
    )
    socket.emit(event, payload, (response) => {
      clearTimeout(timer)
      resolve(response || { ok: false, code: 'CHAT_ERROR' })
    })
  })
}

// Connects to the shared Socket.IO server while the hook is enabled, forwards
// incoming chat events to the latest callbacks, and removes its listeners on
// unmount while the shared connection remains available to other features.
export function useChatSocket({ enabled = false, onMessage, onMessagesRead } = {}) {
  const { user } = useAuth()
  const [connectionState, setConnectionState] = useState('idle')
  const [connectionError, setConnectionError] = useState(null)
  const socketRef = useRef(null)
  const messageRef = useRef(onMessage)
  const readRef = useRef(onMessagesRead)

  useEffect(() => {
    messageRef.current = onMessage
    readRef.current = onMessagesRead
  })

  const userId = user ? user.id : null

  useEffect(() => {
    if (!user) {
      disconnectSocket()
    }
  }, [user])

  useEffect(() => {
    if (!enabled || !userId) {
      socketRef.current = null
      return undefined
    }

    const socket = getSocket()
    if (!socket) {
      return undefined
    }

    socketRef.current = socket
    let active = true

    const handleConnect = () => {
      if (!active) return
      setConnectionState('connected')
      setConnectionError(null)
    }
    const handleDisconnect = () => {
      if (!active) return
      setConnectionState('disconnected')
    }
    const handleConnectError = () => {
      if (!active) return
      setConnectionState('error')
      setConnectionError('Unable to connect to chat. Please check your connection.')
    }
    const handleMessage = (payload) => {
      if (active) messageRef.current?.(payload)
    }
    const handleMessagesRead = (payload) => {
      if (active) readRef.current?.(payload)
    }

    socket.on('connect', handleConnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('connect_error', handleConnectError)
    socket.on('chat:message', handleMessage)
    socket.on('chat:messagesRead', handleMessagesRead)

    if (!socket.connected) {
      socket.connect()
    }

    return () => {
      active = false
      socket.off('connect', handleConnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('connect_error', handleConnectError)
      socket.off('chat:message', handleMessage)
      socket.off('chat:messagesRead', handleMessagesRead)
    }
  }, [enabled, userId])

  const joinRoom = useCallback((appointmentId) => {
    const socket = socketRef.current
    if (!socket || !socket.connected) {
      return Promise.resolve({ ok: false, code: 'SOCKET_DISCONNECTED' })
    }
    return emitWithAck(socket, 'chat:join', { appointmentId })
  }, [])

  const sendMessage = useCallback((appointmentId, message) => {
    const socket = socketRef.current
    if (!socket || !socket.connected) {
      return Promise.resolve({ ok: false, code: 'SOCKET_DISCONNECTED' })
    }
    return emitWithAck(socket, 'chat:send', { appointmentId, message })
  }, [])

  const markRead = useCallback((appointmentId) => {
    const socket = socketRef.current
    if (!socket || !socket.connected) {
      return Promise.resolve({ ok: false, code: 'SOCKET_DISCONNECTED' })
    }
    return emitWithAck(socket, 'chat:read', { appointmentId })
  }, [])

  const state = enabled && userId ? connectionState : 'idle'

  return {
    connectionState: state,
    connectionError,
    joinRoom,
    sendMessage,
    markRead,
  }
}