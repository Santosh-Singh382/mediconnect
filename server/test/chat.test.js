require('./helpers')
const { describe, before, after, beforeEach, it } = require('node:test')
const assert = require('node:assert/strict')
const http = require('http')
const mongoose = require('mongoose')
const { io: ioClient } = require('socket.io-client')

const app = require('../src/app')
const { connectDatabase, disconnectDatabase } = require('../src/config/database')
const { initSocket } = require('../src/realtime/socket')
const User = require('../src/models/User')
const DoctorProfile = require('../src/models/DoctorProfile')
const Appointment = require('../src/models/Appointment')
const Message = require('../src/models/Message')
const { tokenForUser } = require('./helpers')

async function clearMessages() {
  await Message.deleteMany({})
}

async function clearAppointments() {
  await Appointment.deleteMany({})
}

async function clearDoctorProfiles() {
  await DoctorProfile.deleteMany({})
}

async function clearUsers() {
  await User.deleteMany({})
}

function dateString(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(base, days) {
  const result = new Date(base)
  result.setDate(result.getDate() + days)
  return result
}

const MESSAGES_DATE = dateString(addDays(new Date(), 14))

async function createPatient(prefix) {
  return User.create({
    name: `${prefix} Patient`,
    email: `${prefix}-patient@example.com`,
    passwordHash: 'x',
    role: 'PATIENT',
  })
}

async function createDoctor(prefix) {
  const user = await User.create({
    name: `Dr. ${prefix}`,
    email: `${prefix}-doctor@example.com`,
    passwordHash: 'x',
    role: 'DOCTOR',
  })
  await DoctorProfile.create({
    userId: user._id,
    specialization: 'General Physician',
    qualification: 'MBBS',
    registrationNumber: `MC-CHAT-${prefix}`,
    verificationStatus: 'APPROVED',
  })
  return user
}

async function createAppointment({ patient, doctor, status = 'CONFIRMED' }) {
  return Appointment.create({
    patientId: patient._id,
    doctorId: doctor._id,
    appointmentDate: MESSAGES_DATE,
    startTime: '10:00',
    endTime: '10:30',
    type: 'CHAT',
    status,
    reason: 'Chat consultation',
  })
}

function connectSocket(url, tokenOpts) {
  return new Promise((resolve) => {
    const socket = ioClient(url, {
      ...(tokenOpts ? { auth: tokenOpts } : {}),
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    })
    const onError = (err) => {
      socket.off('connect', onConnect)
      socket.close()
      resolve({ socket: null, error: err })
    }
    const onConnect = () => {
      socket.off('connect_error', onError)
      resolve({ socket, error: null })
    }
    socket.once('connect', onConnect)
    socket.once('connect_error', onError)
  })
}

function emitAck(socket, event, payload, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ ok: false, timeout: true }), timeoutMs)
    socket.emit(event, payload, (response) => {
      clearTimeout(timer)
      resolve(response)
    })
  })
}

function waitForEvent(socket, event, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), timeoutMs)
    socket.once(event, (payload) => {
      clearTimeout(timer)
      resolve(payload)
    })
  })
}

function collectEvents(socket, event) {
  const events = []
  socket.on(event, (payload) => events.push(payload))
  return events
}

describe('Chat module', () => {
  let server
  let io
  let baseUrl
  let socketUrl

  let patientA
  let patientAToken
  let patientB
  let patientBToken
  let doctorA
  let doctorAToken
  let doctorB
  let doctorBToken

  before(async () => {
    await connectDatabase()
    server = http.createServer(app)
    io = initSocket(server)
    await new Promise((resolve) => server.listen(0, resolve))
    baseUrl = `http://127.0.0.1:${server.address().port}`
    socketUrl = baseUrl
  })

  after(async () => {
    await new Promise((resolve) => io.close(resolve))
    await new Promise((resolve) => server.close(resolve))
    await disconnectDatabase()
  })

  beforeEach(async () => {
    await clearMessages()
    await clearAppointments()
    await clearDoctorProfiles()
    await clearUsers()

    patientA = await createPatient('alpha')
    patientAToken = tokenForUser(patientA)
    patientB = await createPatient('bravo')
    patientBToken = tokenForUser(patientB)
    doctorA = await createDoctor('alpha')
    doctorAToken = tokenForUser(doctorA)
    doctorB = await createDoctor('bravo')
    doctorBToken = tokenForUser(doctorB)
  })

  function request(path, { method = 'GET', body, token } = {}) {
    const headers = {}
    if (body !== undefined) {
      headers['content-type'] = 'application/json'
    }
    if (token) {
      headers.authorization = `Bearer ${token}`
    }
    return fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }).then(async (response) => {
      let json = null
      try {
        json = await response.json()
      } catch {
        json = null
      }
      return { status: response.status, body: json }
    })
  }

  async function confirmedChat() {
    return createAppointment({ patient: patientA, doctor: doctorA, status: 'CONFIRMED' })
  }

  describe('authentication', () => {
    it('unauthenticated history returns 401', async () => {
      const appointment = await confirmedChat()
      const response = await request(`/api/chat/${appointment._id}/messages`)
      assert.equal(response.status, 401)
      assert.equal(response.body.code, 'UNAUTHORIZED')
    })

    it('unauthenticated send returns 401', async () => {
      const appointment = await confirmedChat()
      const response = await request(`/api/chat/${appointment._id}/messages`, {
        method: 'POST',
        body: { message: 'Hello' },
      })
      assert.equal(response.status, 401)
    })

    it('unauthenticated read returns 401', async () => {
      const appointment = await confirmedChat()
      const response = await request(`/api/chat/${appointment._id}/read`, {
        method: 'PATCH',
      })
      assert.equal(response.status, 401)
    })
  })

  describe('authorization', () => {
    it('patient can access their own appointment chat', async () => {
      const appointment = await confirmedChat()
      const response = await request(`/api/chat/${appointment._id}/messages`, {
        token: patientAToken,
      })
      assert.equal(response.status, 200)
      assert.equal(response.body.success, true)
      assert.deepEqual(response.body.data.messages, [])
    })

    it('doctor can access their own appointment chat', async () => {
      const appointment = await confirmedChat()
      const response = await request(`/api/chat/${appointment._id}/messages`, {
        token: doctorAToken,
      })
      assert.equal(response.status, 200)
    })

    it('unrelated patient is blocked', async () => {
      const appointment = await confirmedChat()
      const response = await request(`/api/chat/${appointment._id}/messages`, {
        token: patientBToken,
      })
      assert.equal(response.status, 403)
      assert.equal(response.body.code, 'FORBIDDEN')
    })

    it('unrelated doctor is blocked', async () => {
      const appointment = await confirmedChat()
      const response = await request(`/api/chat/${appointment._id}/messages`, {
        token: doctorBToken,
      })
      assert.equal(response.status, 403)
    })
  })

  describe('appointment status rules', () => {
    it('PENDING cannot send and has no chat', async () => {
      const appointment = await createAppointment({
        patient: patientA,
        doctor: doctorA,
        status: 'PENDING',
      })
      const history = await request(`/api/chat/${appointment._id}/messages`, {
        token: patientAToken,
      })
      assert.equal(history.status, 403)
      assert.equal(history.body.code, 'CHAT_ACCESS_DENIED')

      const send = await request(`/api/chat/${appointment._id}/messages`, {
        method: 'POST',
        body: { message: 'Hello doctor' },
        token: patientAToken,
      })
      assert.equal(send.status, 403)
    })

    it('CONFIRMED can send messages', async () => {
      const appointment = await confirmedChat()
      const response = await request(`/api/chat/${appointment._id}/messages`, {
        method: 'POST',
        body: { message: 'Hello doctor' },
        token: patientAToken,
      })
      assert.equal(response.status, 201)
      assert.equal(response.body.success, true)
      assert.equal(response.body.data.message.message, 'Hello doctor')
    })

    it('COMPLETED allows history but not new messages', async () => {
      const appointment = await createAppointment({
        patient: patientA,
        doctor: doctorA,
        status: 'COMPLETED',
      })
      await Message.create({
        appointmentId: appointment._id,
        senderId: doctorA._id,
        receiverId: patientA._id,
        message: 'Good news, you are doing well.',
      })

      const history = await request(`/api/chat/${appointment._id}/messages`, {
        token: patientAToken,
      })
      assert.equal(history.status, 200)
      assert.equal(history.body.data.messages.length, 1)

      const send = await request(`/api/chat/${appointment._id}/messages`, {
        method: 'POST',
        body: { message: 'One more question' },
        token: patientAToken,
      })
      assert.equal(send.status, 403)
      assert.equal(send.body.code, 'CHAT_NOT_AVAILABLE')
    })

    it('CANCELLED has no chat', async () => {
      const appointment = await createAppointment({
        patient: patientA,
        doctor: doctorA,
        status: 'CANCELLED',
      })
      const history = await request(`/api/chat/${appointment._id}/messages`, {
        token: patientAToken,
      })
      assert.equal(history.status, 403)
      const send = await request(`/api/chat/${appointment._id}/messages`, {
        method: 'POST',
        body: { message: 'Hi' },
        token: patientAToken,
      })
      assert.equal(send.status, 403)
    })

    it('REJECTED has no chat', async () => {
      const appointment = await createAppointment({
        patient: patientA,
        doctor: doctorA,
        status: 'REJECTED',
      })
      const history = await request(`/api/chat/${appointment._id}/messages`, {
        token: doctorAToken,
      })
      assert.equal(history.status, 403)
    })
  })

  describe('message validation', () => {
    it('valid message is accepted', async () => {
      const appointment = await confirmedChat()
      const response = await request(`/api/chat/${appointment._id}/messages`, {
        method: 'POST',
        body: { message: '   Hello doctor   ' },
        token: patientAToken,
      })
      assert.equal(response.status, 201)
      assert.equal(response.body.data.message.message, 'Hello doctor')
    })

    it('empty message is rejected', async () => {
      const appointment = await confirmedChat()
      const response = await request(`/api/chat/${appointment._id}/messages`, {
        method: 'POST',
        body: { message: '' },
        token: patientAToken,
      })
      assert.equal(response.status, 400)
      assert.equal(response.body.code, 'VALIDATION_ERROR')
    })

    it('whitespace message is rejected', async () => {
      const appointment = await confirmedChat()
      const response = await request(`/api/chat/${appointment._id}/messages`, {
        method: 'POST',
        body: { message: '     ' },
        token: patientAToken,
      })
      assert.equal(response.status, 400)
    })

    it('message over 2000 characters is rejected', async () => {
      const appointment = await confirmedChat()
      const response = await request(`/api/chat/${appointment._id}/messages`, {
        method: 'POST',
        body: { message: 'a'.repeat(2001) },
        token: patientAToken,
      })
      assert.equal(response.status, 400)
      assert.ok(response.body.details.some((detail) => detail.field === 'message'))
    })

    it('exactly 2000 characters is accepted', async () => {
      const appointment = await confirmedChat()
      const response = await request(`/api/chat/${appointment._id}/messages`, {
        method: 'POST',
        body: { message: 'a'.repeat(2000) },
        token: patientAToken,
      })
      assert.equal(response.status, 201)
      assert.equal(response.body.data.message.message.length, 2000)
    })

    it('invalid appointment ID is handled cleanly', async () => {
      const response = await request('/api/chat/not-an-id/messages', {
        token: patientAToken,
      })
      assert.equal(response.status, 400)
      assert.equal(response.body.code, 'VALIDATION_ERROR')

      const missing = await request(
        `/api/chat/${new mongoose.Types.ObjectId()}/messages`,
        { token: patientAToken },
      )
      assert.equal(missing.status, 404)
      assert.equal(missing.body.code, 'NOT_FOUND')
    })

    it('non-string message is rejected', async () => {
      const appointment = await confirmedChat()
      const response = await request(`/api/chat/${appointment._id}/messages`, {
        method: 'POST',
        body: { message: 12345 },
        token: patientAToken,
      })
      assert.equal(response.status, 400)
    })
  })

  describe('persistence', () => {
    it('message is saved with correct sender, receiver, appointment and type', async () => {
      const appointment = await confirmedChat()
      const response = await request(`/api/chat/${appointment._id}/messages`, {
        method: 'POST',
        body: { message: 'Hello doctor' },
        token: patientAToken,
      })
      assert.equal(response.status, 201)

      const stored = await Message.findOne().lean()
      assert.ok(stored)
      assert.equal(stored.appointmentId.toString(), appointment._id.toString())
      assert.equal(stored.senderId.toString(), patientA._id.toString())
      assert.equal(stored.receiverId.toString(), doctorA._id.toString())
      assert.equal(stored.message, 'Hello doctor')
      assert.equal(stored.messageType, 'TEXT')
      assert.equal(stored.isRead, false)
      assert.equal(stored.readAt, null)
      assert.ok(stored.createdAt instanceof Date)
      assert.equal(stored._id.toString(), response.body.data.message.id)
    })

    it('doctor-derived receiver is used when the doctor sends', async () => {
      const appointment = await confirmedChat()
      const response = await request(`/api/chat/${appointment._id}/messages`, {
        method: 'POST',
        body: { message: 'Hello patient' },
        token: doctorAToken,
      })
      assert.equal(response.status, 201)
      const stored = await Message.findOne().lean()
      assert.equal(stored.senderId.toString(), doctorA._id.toString())
      assert.equal(stored.receiverId.toString(), patientA._id.toString())
    })
  })

  describe('history ordering and pagination', () => {
    it('messages are returned chronologically', async () => {
      const appointment = await confirmedChat()
      await Message.create({
        appointmentId: appointment._id,
        senderId: patientA._id,
        receiverId: doctorA._id,
        message: 'first',
      })
      await Message.create({
        appointmentId: appointment._id,
        senderId: doctorA._id,
        receiverId: patientA._id,
        message: 'second',
      })

      const response = await request(`/api/chat/${appointment._id}/messages`, {
        token: patientAToken,
      })
      assert.equal(response.status, 200)
      assert.equal(response.body.data.messages.length, 2)
      assert.equal(response.body.data.messages[0].message, 'first')
      assert.equal(response.body.data.messages[1].message, 'second')
      assert.equal(response.body.data.pagination.total, 2)
    })

    it('pagination returns a stable window', async () => {
      const appointment = await confirmedChat()
      for (let i = 0; i < 5; i += 1) {
        await Message.create({
          appointmentId: appointment._id,
          senderId: i % 2 === 0 ? patientA._id : doctorA._id,
          receiverId: i % 2 === 0 ? doctorA._id : patientA._id,
          message: `message-${i}`,
        })
      }
      const pageTwo = await request(
        `/api/chat/${appointment._id}/messages?page=2&limit=2`,
        { token: patientAToken },
      )
      assert.equal(pageTwo.status, 200)
      assert.equal(pageTwo.body.data.messages.length, 2)
      assert.deepEqual(
        pageTwo.body.data.messages.map((m) => m.message),
        ['message-2', 'message-3'],
      )
      assert.equal(pageTwo.body.data.pagination.totalPages, 3)

      const badLimit = await request(
        `/api/chat/${appointment._id}/messages?limit=0`,
        { token: patientAToken },
      )
      assert.equal(badLimit.status, 400)
    })
  })

  describe('read state', () => {
    it('receiver messages become read and readAt is set; sender messages untouched', async () => {
      const appointment = await confirmedChat()
      await Message.create({
        appointmentId: appointment._id,
        senderId: patientA._id,
        receiverId: doctorA._id,
        message: 'for the doctor',
      })
      await Message.create({
        appointmentId: appointment._id,
        senderId: doctorA._id,
        receiverId: patientA._id,
        message: 'for the patient',
      })

      const response = await request(`/api/chat/${appointment._id}/read`, {
        method: 'PATCH',
        token: doctorAToken,
      })
      assert.equal(response.status, 200)
      assert.equal(response.body.data.updatedCount, 1)

      const stored = await Message.find().sort({ createdAt: 1 }).lean()
      assert.equal(stored[0].isRead, true)
      assert.ok(stored[0].readAt instanceof Date)
      assert.equal(stored[1].isRead, false)
      assert.equal(stored[1].readAt, null)
    })

    it('unrelated appointment messages are unchanged', async () => {
      const appointment = await confirmedChat()
      const otherAppointment = await createAppointment({
        patient: patientB,
        doctor: doctorB,
        status: 'CONFIRMED',
      })
      await Message.create({
        appointmentId: otherAppointment._id,
        senderId: patientB._id,
        receiverId: doctorB._id,
        message: 'other appointment',
      })

      const response = await request(`/api/chat/${appointment._id}/read`, {
        method: 'PATCH',
        token: doctorAToken,
      })
      assert.equal(response.status, 200)

      const untouched = await Message.findOne({ appointmentId: otherAppointment._id }).lean()
      assert.equal(untouched.isRead, false)
      assert.equal(untouched.readAt, null)
    })

    it('read is denied for non-participants', async () => {
      const appointment = await confirmedChat()
      await Message.create({
        appointmentId: appointment._id,
        senderId: patientA._id,
        receiverId: doctorA._id,
        message: 'for the doctor',
      })
      const response = await request(`/api/chat/${appointment._id}/read`, {
        method: 'PATCH',
        token: patientBToken,
      })
      assert.equal(response.status, 403)
      const stored = await Message.findOne().lean()
      assert.equal(stored.isRead, false)
    })
  })

  describe('security', () => {
    it('responses never expose sensitive fields', async () => {
      const appointment = await confirmedChat()
      await Message.create({
        appointmentId: appointment._id,
        senderId: patientA._id,
        receiverId: doctorA._id,
        message: 'private hello',
      })

      const sent = await request(`/api/chat/${appointment._id}/messages`, {
        method: 'POST',
        body: { message: 'second hello' },
        token: patientAToken,
      })
      const history = await request(`/api/chat/${appointment._id}/messages`, {
        token: doctorAToken,
      })

      for (const message of [
        sent.body.data.message,
        ...history.body.data.messages,
      ]) {
        const serialized = JSON.stringify(message)
        assert.ok(!serialized.includes('passwordHash'))
        assert.ok(!serialized.includes('token'))
        assert.ok(!serialized.includes('email'))
        assert.ok(!('passwordHash' in message))
        assert.deepEqual(message.messageType, 'TEXT')
      }
    })

    it('receiverId is always derived from the appointment, never from the client', async () => {
      const appointment = await confirmedChat()
      const response = await request(`/api/chat/${appointment._id}/messages`, {
        method: 'POST',
        body: { message: 'hello', receiverId: patientB._id.toString() },
        token: patientAToken,
      })
      assert.equal(response.status, 201)
      const stored = await Message.findOne().lean()
      assert.equal(stored.receiverId.toString(), doctorA._id.toString())
    })
  })

  describe('Socket.IO', () => {
    it('connection is refused without a token', async () => {
      const { socket, error } = await connectSocket(socketUrl)
      assert.equal(socket, null)
      assert.ok(error)
    })

    it('connection is refused with an invalid token', async () => {
      const { socket, error } = await connectSocket(socketUrl, { token: 'not-a-real-token' })
      assert.equal(socket, null)
      assert.ok(error)
    })

    it('authenticated user can connect and join their appointment room', async () => {
      const appointment = await confirmedChat()
      const { socket } = await connectSocket(socketUrl, { token: patientAToken })
      const ack = await emitAck(socket, 'chat:join', {
        appointmentId: appointment._id.toString(),
      })
      assert.equal(ack.ok, true)
      socket.close()
    })

    it('unauthorized user cannot join another appointment room', async () => {
      const appointment = await confirmedChat()
      const { socket } = await connectSocket(socketUrl, { token: patientBToken })
      const ack = await emitAck(socket, 'chat:join', {
        appointmentId: appointment._id.toString(),
      })
      assert.equal(ack.ok, false)
      assert.equal(ack.code, 'FORBIDDEN')
      socket.close()
    })

    it('socket authorization happens before room join (no broadcasts to non-members)', async () => {
      const appointment = await confirmedChat()
      const { socket: member } = await connectSocket(socketUrl, {
        token: doctorAToken,
      })
      const membership = await emitAck(member, 'chat:join', {
        appointmentId: appointment._id.toString(),
      })
      assert.equal(membership.ok, true)

      const { socket: intruder } = await connectSocket(socketUrl, {
        token: patientBToken,
      })
      const denied = await emitAck(intruder, 'chat:join', {
        appointmentId: appointment._id.toString(),
      })
      assert.equal(denied.ok, false)

      const memberEvents = collectEvents(member, 'chat:message')
      const intruderEvents = collectEvents(intruder, 'chat:message')

      const sendAck = await emitAck(member, 'chat:send', {
        appointmentId: appointment._id.toString(),
        message: 'secret update',
      })
      assert.equal(sendAck.ok, true)

      await new Promise((resolve) => setTimeout(resolve, 200))

      assert.equal(memberEvents.length, 1)
      assert.equal(memberEvents[0].message, 'secret update')
      assert.equal(intruderEvents.length, 0)

      member.close()
      intruder.close()
    })

    it('chat:send persists the message before emitting it', async () => {
      const appointment = await confirmedChat()
      const { socket: member } = await connectSocket(socketUrl, {
        token: patientAToken,
      })
      await emitAck(member, 'chat:join', {
        appointmentId: appointment._id.toString(),
      })

      const { socket: peer } = await connectSocket(socketUrl, {
        token: doctorAToken,
      })
      await emitAck(peer, 'chat:join', {
        appointmentId: appointment._id.toString(),
      })

      const received = waitForEvent(peer, 'chat:message')
      const sendAck = await emitAck(member, 'chat:send', {
        appointmentId: appointment._id.toString(),
        message: 'persisted first',
      })
      assert.equal(sendAck.ok, true)

      const broadcast = await received
      const stored = await Message.findOne().lean()
      assert.ok(stored)
      assert.equal(stored.senderId.toString(), patientA._id.toString())
      assert.equal(stored.receiverId.toString(), doctorA._id.toString())
      assert.equal(stored.message, 'persisted first')
      assert.equal(stored._id.toString(), broadcast.id)
      assert.equal(sendAck.message.id, broadcast.id)

      member.close()
      peer.close()
    })

    it('chat:send fails for COMPLETED appointments', async () => {
      const appointment = await createAppointment({
        patient: patientA,
        doctor: doctorA,
        status: 'COMPLETED',
      })
      const { socket } = await connectSocket(socketUrl, { token: patientAToken })
      const join = await emitAck(socket, 'chat:join', {
        appointmentId: appointment._id.toString(),
      })
      assert.equal(join.ok, true)

      const send = await emitAck(socket, 'chat:send', {
        appointmentId: appointment._id.toString(),
        message: 'too late',
      })
      assert.equal(send.ok, false)
      assert.equal(send.code, 'CHAT_NOT_AVAILABLE')
      const stored = await Message.countDocuments({})
      assert.equal(stored, 0)
      socket.close()
    })

    it('chat:read updates received messages and notifies the room', async () => {
      const appointment = await confirmedChat()
      await Message.create({
        appointmentId: appointment._id,
        senderId: patientA._id,
        receiverId: doctorA._id,
        message: 'awaiting read',
      })

      const { socket: doctorSocket } = await connectSocket(socketUrl, {
        token: doctorAToken,
      })
      await emitAck(doctorSocket, 'chat:join', {
        appointmentId: appointment._id.toString(),
      })

      const { socket: patientSocket } = await connectSocket(socketUrl, {
        token: patientAToken,
      })
      await emitAck(patientSocket, 'chat:join', {
        appointmentId: appointment._id.toString(),
      })

      const readEvent = waitForEvent(patientSocket, 'chat:messagesRead')
      const readAck = await emitAck(doctorSocket, 'chat:read', {
        appointmentId: appointment._id.toString(),
      })
      assert.equal(readAck.ok, true)
      assert.equal(readAck.updatedCount, 1)

      const payload = await readEvent
      assert.equal(payload.appointmentId, appointment._id.toString())
      assert.equal(payload.byUserId, doctorA._id.toString())
      assert.ok(payload.readAt)

      const stored = await Message.findOne().lean()
      assert.equal(stored.isRead, true)
      assert.ok(stored.readAt)

      doctorSocket.close()
      patientSocket.close()
    })
  })
})