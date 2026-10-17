const { Server } = require('socket.io')
const env = require('../config/env')
const { verifyAccessToken } = require('../utils/jwt')
const ApiError = require('../utils/ApiError')
const User = require('../models/User')
const { serializeUser } = require('../utils/serializeUser')
const chatService = require('../services/chat.service')
const videoService = require('../services/video.service')
const audioService = require('../services/audio.service')

// WebRTC signaling is point-to-point: at most two participants per room.
const MAX_CALL_PARTICIPANTS = 2

// Each consultation method has its own signaling channel and its own room, so
// video and audio traffic never mix. Both channels share the exact same relay
// behavior; only the room prefix, the event names, and the access check differ.
const CALL_CHANNELS = [
  { kind: 'video', checkAccess: videoService.checkVideoAccess },
  { kind: 'audio', checkAccess: audioService.checkAudioAccess },
]

function appointmentRoom(appointmentId) {
  return `appointment:${appointmentId}`
}

function callRoom(kind, appointmentId) {
  return `${kind}:${appointmentId}`
}

function socketAuthMiddleware(socket, next) {
  const token = socket.handshake.auth && socket.handshake.auth.token

  if (!token || typeof token !== 'string') {
    next(new Error('Unauthorized'))
    return
  }

  const payload = verifyAccessToken(token)
  if (!payload || !payload.sub) {
    next(new Error('Unauthorized'))
    return
  }

  User.findById(payload.sub)
    .then((user) => {
      if (!user || !user.isActive) {
        next(new Error('Unauthorized'))
        return
      }
      socket.user = serializeUser(user)
      next()
    })
    .catch(() => {
      next(new Error('Unauthorized'))
    })
}

function respond(ack, error, result) {
  if (typeof ack !== 'function') {
    return
  }
  if (error) {
    ack({
      ok: false,
      code: error.code || 'CHAT_ERROR',
      message: error.message,
    })
    return
  }
  ack({ ok: true, ...result })
}

function handleWithAck(ack, work) {
  Promise.resolve()
    .then(work)
    .then((result) => respond(ack, null, result))
    .catch((error) => respond(ack, error))
}

function registerChatHandlers(io, socket) {
  const userId = socket.user.id.toString()

  socket.on('chat:join', (payload, ack) => {
    handleWithAck(ack, async () => {
      const appointmentId = payload && payload.appointmentId
      const { appointment } = await chatService.checkChatAccess(appointmentId, userId)
      socket.join(appointmentRoom(appointment._id.toString()))
      return { appointmentId: appointment._id.toString() }
    })
  })

  socket.on('chat:send', (payload, ack) => {
    handleWithAck(ack, async () => {
      const appointmentId = payload && payload.appointmentId
      const message = payload && payload.message
      const { message: serializedMessage } = await chatService.sendMessage({
        appointmentId,
        userId,
        message,
      })
      io.to(appointmentRoom(appointmentId)).emit('chat:message', serializedMessage)
      return { message: serializedMessage }
    })
  })

  socket.on('chat:read', (payload, ack) => {
    handleWithAck(ack, async () => {
      const appointmentId = payload && payload.appointmentId
      const { updatedCount, readAt } = await chatService.markAsRead({
        appointmentId,
        userId,
      })
      io.to(appointmentRoom(appointmentId)).emit('chat:messagesRead', {
        appointmentId,
        byUserId: userId,
        readAt,
      })
      return { updatedCount }
    })
  })
}

function assertCallMembership(socket, kind, appointmentId) {
  if (!appointmentId || !socket.rooms.has(callRoom(kind, appointmentId))) {
    throw new ApiError(403, 'You are not a participant in this consultation', 'FORBIDDEN')
  }
}

// Registers the signaling handlers for a single consultation channel
// ('video' or 'audio'). Every event is namespaced with the channel kind so the
// video protocol is byte-for-byte identical to before and audio gains the same
// behavior under audio:*.
function registerCallHandlers(io, socket, channel) {
  const { kind, checkAccess } = channel
  const userId = socket.user.id.toString()
  const event = (name) => `${kind}:${name}`

  // Joining authenticates the socket (already done at handshake), authorizes the
  // appointment, enforces the two-participant limit, and tells the caller which
  // negotiation role to take. The participant who was already waiting becomes
  // the initiator so both sides never create offers at the same time.
  socket.on(event('join'), (payload, ack) => {
    handleWithAck(ack, async () => {
      const appointmentId = payload && payload.appointmentId
      const { appointment } = await checkAccess(appointmentId, userId)
      const room = callRoom(kind, appointment._id.toString())

      if (socket.rooms.has(room)) {
        return { role: 'peer', peerPresent: true, appointmentId: appointment._id.toString() }
      }

      const socketsInRoom = await io.in(room).fetchSockets()
      const others = socketsInRoom.filter((member) => member.id !== socket.id)

      if (others.length >= MAX_CALL_PARTICIPANTS) {
        throw new ApiError(409, 'This consultation already has two participants', 'ROOM_FULL')
      }

      socket.join(room)

      if (others.length === 0) {
        return { role: 'waiting', peerPresent: false, appointmentId: appointment._id.toString() }
      }

      io.to(others[0].id).emit(event('ready'), {
        appointmentId: appointment._id.toString(),
        initiator: true,
        peerUserId: userId,
      })

      return { role: 'answerer', peerPresent: true, appointmentId: appointment._id.toString() }
    })
  })

  // Signaling relays are only forwarded to the other authorized participant in
  // the sender's own room. Signal payloads are never persisted or logged.
  socket.on(event('offer'), (payload, ack) => {
    handleWithAck(ack, async () => {
      const appointmentId = payload && payload.appointmentId
      assertCallMembership(socket, kind, appointmentId)
      if (!payload || !payload.sdp) {
        throw new ApiError(400, 'Offer description is required', 'VALIDATION_ERROR')
      }
      socket.to(callRoom(kind, appointmentId)).emit(event('offer'), {
        appointmentId,
        sdp: payload.sdp,
        fromUserId: userId,
      })
      return {}
    })
  })

  socket.on(event('answer'), (payload, ack) => {
    handleWithAck(ack, async () => {
      const appointmentId = payload && payload.appointmentId
      assertCallMembership(socket, kind, appointmentId)
      if (!payload || !payload.sdp) {
        throw new ApiError(400, 'Answer description is required', 'VALIDATION_ERROR')
      }
      socket.to(callRoom(kind, appointmentId)).emit(event('answer'), {
        appointmentId,
        sdp: payload.sdp,
        fromUserId: userId,
      })
      return {}
    })
  })

  socket.on(event('ice-candidate'), (payload, ack) => {
    handleWithAck(ack, async () => {
      const appointmentId = payload && payload.appointmentId
      assertCallMembership(socket, kind, appointmentId)
      if (!payload || payload.candidate === undefined) {
        throw new ApiError(400, 'ICE candidate is required', 'VALIDATION_ERROR')
      }
      socket.to(callRoom(kind, appointmentId)).emit(event('ice-candidate'), {
        appointmentId,
        candidate: payload.candidate,
        fromUserId: userId,
      })
      return {}
    })
  })

  socket.on(event('leave'), (payload, ack) => {
    handleWithAck(ack, async () => {
      const appointmentId = payload && payload.appointmentId
      if (appointmentId && socket.rooms.has(callRoom(kind, appointmentId))) {
        socket.to(callRoom(kind, appointmentId)).emit(event('leave'), {
          appointmentId,
          fromUserId: userId,
        })
        socket.leave(callRoom(kind, appointmentId))
      }
      return {}
    })
  })

  socket.on(event('end'), (payload, ack) => {
    handleWithAck(ack, async () => {
      const appointmentId = payload && payload.appointmentId
      if (appointmentId && socket.rooms.has(callRoom(kind, appointmentId))) {
        socket.to(callRoom(kind, appointmentId)).emit(event('end'), {
          appointmentId,
          fromUserId: userId,
        })
        socket.leave(callRoom(kind, appointmentId))
      }
      return {}
    })
  })
}

// A disconnect (tab close, refresh, network drop) must notify the peer and
// remove this socket from any call rooms. Idempotent by nature.
function registerDisconnectHandlers(socket) {
  const userId = socket.user.id.toString()

  socket.on('disconnecting', () => {
    for (const room of socket.rooms) {
      if (typeof room !== 'string') continue
      for (const channel of CALL_CHANNELS) {
        const prefix = `${channel.kind}:`
        if (room.startsWith(prefix)) {
          socket.to(room).emit(`${channel.kind}:leave`, {
            appointmentId: room.slice(prefix.length),
            fromUserId: userId,
          })
        }
      }
    }
  })
}

function registerConnectionHandlers(io) {
  io.on('connection', (socket) => {
    registerChatHandlers(io, socket)
    for (const channel of CALL_CHANNELS) {
      registerCallHandlers(io, socket, channel)
    }
    registerDisconnectHandlers(socket)
  })
}

function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: env.clientOrigins,
      credentials: true,
    },
  })

  io.use(socketAuthMiddleware)
  registerConnectionHandlers(io)

  return io
}

module.exports = { initSocket }