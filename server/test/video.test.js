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

async function clearAll() {
  await Message.deleteMany({})
  await Appointment.deleteMany({})
  await DoctorProfile.deleteMany({})
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

const VIDEO_DATE = dateString(addDays(new Date(), 14))

async function createPatient(prefix, { isActive = true } = {}) {
  return User.create({
    name: `${prefix} Patient`,
    email: `${prefix}-patient@example.com`,
    passwordHash: 'x',
    role: 'PATIENT',
    isActive,
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
    registrationNumber: `MC-VIDEO-${prefix}`,
    verificationStatus: 'APPROVED',
  })
  return user
}

async function createAppointment({ patient, doctor, status = 'CONFIRMED', startTime = '10:00', type = 'VIDEO' }) {
  return Appointment.create({
    patientId: patient._id,
    doctorId: doctor._id,
    appointmentDate: VIDEO_DATE,
    startTime,
    endTime: '10:30',
    type,
    status,
    reason: 'Video consultation',
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

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

describe('Video consultation module', () => {
  let server
  let io
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
    socketUrl = `http://127.0.0.1:${server.address().port}`
  })

  after(async () => {
    await new Promise((resolve) => io.close(resolve))
    await new Promise((resolve) => server.close(resolve))
    await disconnectDatabase()
  })

  beforeEach(async () => {
    await clearAll()
    patientA = await createPatient('alpha')
    patientAToken = tokenForUser(patientA)
    patientB = await createPatient('bravo')
    patientBToken = tokenForUser(patientB)
    doctorA = await createDoctor('alpha')
    doctorAToken = tokenForUser(doctorA)
    doctorB = await createDoctor('bravo')
    doctorBToken = tokenForUser(doctorB)
  })

  async function confirmedVideo() {
    return createAppointment({ patient: patientA, doctor: doctorA, status: 'CONFIRMED' })
  }

  describe('authentication', () => {
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

    it('connection is refused for an inactive user', async () => {
      const inactive = await createPatient('inactive', { isActive: false })
      const { socket, error } = await connectSocket(socketUrl, {
        token: tokenForUser(inactive),
      })
      assert.equal(socket, null)
      assert.ok(error)
    })
  })

  describe('authorization', () => {
    it('patient can join their confirmed appointment', async () => {
      const appointment = await confirmedVideo()
      const { socket } = await connectSocket(socketUrl, { token: patientAToken })
      const ack = await emitAck(socket, 'video:join', {
        appointmentId: appointment._id.toString(),
      })
      assert.equal(ack.ok, true)
      assert.equal(ack.role, 'waiting')
      assert.equal(ack.peerPresent, false)
      socket.close()
    })

    it('doctor can join their confirmed appointment', async () => {
      const appointment = await confirmedVideo()
      const { socket } = await connectSocket(socketUrl, { token: doctorAToken })
      const ack = await emitAck(socket, 'video:join', {
        appointmentId: appointment._id.toString(),
      })
      assert.equal(ack.ok, true)
      socket.close()
    })

    it('unrelated patient cannot join', async () => {
      const appointment = await confirmedVideo()
      const { socket } = await connectSocket(socketUrl, { token: patientBToken })
      const ack = await emitAck(socket, 'video:join', {
        appointmentId: appointment._id.toString(),
      })
      assert.equal(ack.ok, false)
      assert.equal(ack.code, 'FORBIDDEN')
      socket.close()
    })

    it('unrelated doctor cannot join', async () => {
      const appointment = await confirmedVideo()
      const { socket } = await connectSocket(socketUrl, { token: doctorBToken })
      const ack = await emitAck(socket, 'video:join', {
        appointmentId: appointment._id.toString(),
      })
      assert.equal(ack.ok, false)
      assert.equal(ack.code, 'FORBIDDEN')
      socket.close()
    })

    it('invalid appointment id is rejected cleanly', async () => {
      const { socket } = await connectSocket(socketUrl, { token: patientAToken })
      const ack = await emitAck(socket, 'video:join', { appointmentId: 'not-an-id' })
      assert.equal(ack.ok, false)
      assert.equal(ack.code, 'VALIDATION_ERROR')
      socket.close()
    })

    it('missing appointment is reported as not found', async () => {
      const { socket } = await connectSocket(socketUrl, { token: patientAToken })
      const ack = await emitAck(socket, 'video:join', {
        appointmentId: new mongoose.Types.ObjectId().toString(),
      })
      assert.equal(ack.ok, false)
      assert.equal(ack.code, 'NOT_FOUND')
      socket.close()
    })
  })

  describe('appointment state rules', () => {
    for (const status of ['PENDING', 'CANCELLED', 'REJECTED', 'COMPLETED']) {
      it(`${status} appointment cannot start a consultation`, async () => {
        const appointment = await createAppointment({
          patient: patientA,
          doctor: doctorA,
          status,
        })
        const { socket } = await connectSocket(socketUrl, { token: patientAToken })
        const ack = await emitAck(socket, 'video:join', {
          appointmentId: appointment._id.toString(),
        })
        assert.equal(ack.ok, false)
        assert.equal(ack.code, 'VIDEO_NOT_AVAILABLE')
        socket.close()
      })
    }
  })

  describe('room membership', () => {
    it('first participant waits and the second triggers negotiation init', async () => {
      const appointment = await confirmedVideo()
      const appointmentId = appointment._id.toString()

      const { socket: first } = await connectSocket(socketUrl, { token: patientAToken })
      const firstJoin = await emitAck(first, 'video:join', { appointmentId })
      assert.equal(firstJoin.role, 'waiting')

      const readyEvent = waitForEvent(first, 'video:ready')

      const { socket: second } = await connectSocket(socketUrl, { token: doctorAToken })
      const secondJoin = await emitAck(second, 'video:join', { appointmentId })
      assert.equal(secondJoin.role, 'answerer')
      assert.equal(secondJoin.peerPresent, true)

      const ready = await readyEvent
      assert.equal(ready.initiator, true)
      assert.equal(ready.appointmentId, appointmentId)
      assert.equal(ready.peerUserId, doctorA._id.toString())

      first.close()
      second.close()
    })

    it('a third participant is rejected with ROOM_FULL', async () => {
      const appointment = await confirmedVideo()
      const appointmentId = appointment._id.toString()

      const { socket: p1 } = await connectSocket(socketUrl, { token: patientAToken })
      await emitAck(p1, 'video:join', { appointmentId })

      const { socket: d1 } = await connectSocket(socketUrl, { token: doctorAToken })
      await emitAck(d1, 'video:join', { appointmentId })

      const { socket: p2 } = await connectSocket(socketUrl, { token: patientAToken })
      const third = await emitAck(p2, 'video:join', { appointmentId })
      assert.equal(third.ok, false)
      assert.equal(third.code, 'ROOM_FULL')

      p1.close()
      d1.close()
      p2.close()
    })

    it('re-joining the same room is idempotent', async () => {
      const appointment = await confirmedVideo()
      const appointmentId = appointment._id.toString()
      const { socket } = await connectSocket(socketUrl, { token: patientAToken })
      const first = await emitAck(socket, 'video:join', { appointmentId })
      const second = await emitAck(socket, 'video:join', { appointmentId })
      assert.equal(first.role, 'waiting')
      assert.equal(second.ok, true)
      assert.equal(second.role, 'peer')
      socket.close()
    })
  })

  describe('signaling relay', () => {
    async function pairedRoom() {
      const appointment = await confirmedVideo()
      const appointmentId = appointment._id.toString()
      const { socket: patientSocket } = await connectSocket(socketUrl, {
        token: patientAToken,
      })
      await emitAck(patientSocket, 'video:join', { appointmentId })
      const { socket: doctorSocket } = await connectSocket(socketUrl, {
        token: doctorAToken,
      })
      await emitAck(doctorSocket, 'video:join', { appointmentId })
      await delay(50)
      return { appointmentId, patientSocket, doctorSocket }
    }

    it('offer is forwarded only to the authorized peer, not echoed to the sender', async () => {
      const { appointmentId, patientSocket, doctorSocket } = await pairedRoom()
      const doctorOffers = collectEvents(doctorSocket, 'video:offer')
      const senderOffers = collectEvents(patientSocket, 'video:offer')

      const ack = await emitAck(patientSocket, 'video:offer', {
        appointmentId,
        sdp: { type: 'offer', sdp: 'fake-offer-sdp' },
      })
      assert.equal(ack.ok, true)
      await delay(100)

      assert.equal(doctorOffers.length, 1)
      assert.equal(doctorOffers[0].sdp.sdp, 'fake-offer-sdp')
      assert.equal(doctorOffers[0].fromUserId, patientA._id.toString())
      assert.equal(senderOffers.length, 0)

      patientSocket.close()
      doctorSocket.close()
    })

    it('answer is forwarded only to the authorized peer', async () => {
      const { appointmentId, patientSocket, doctorSocket } = await pairedRoom()
      const patientAnswers = collectEvents(patientSocket, 'video:answer')

      const ack = await emitAck(doctorSocket, 'video:answer', {
        appointmentId,
        sdp: { type: 'answer', sdp: 'fake-answer-sdp' },
      })
      assert.equal(ack.ok, true)
      await delay(100)

      assert.equal(patientAnswers.length, 1)
      assert.equal(patientAnswers[0].sdp.sdp, 'fake-answer-sdp')

      patientSocket.close()
      doctorSocket.close()
    })

    it('ICE candidate is forwarded only to the authorized peer', async () => {
      const { appointmentId, patientSocket, doctorSocket } = await pairedRoom()
      const patientCandidates = collectEvents(patientSocket, 'video:ice-candidate')

      const ack = await emitAck(doctorSocket, 'video:ice-candidate', {
        appointmentId,
        candidate: { candidate: 'candidate:1 1 udp 1 1.1.1.1 1 typ host' },
      })
      assert.equal(ack.ok, true)
      await delay(100)

      assert.equal(patientCandidates.length, 1)
      assert.equal(
        patientCandidates[0].candidate.candidate,
        'candidate:1 1 udp 1 1.1.1.1 1 typ host',
      )

      patientSocket.close()
      doctorSocket.close()
    })

    it('a non-member cannot inject signaling into a room', async () => {
      const { appointmentId, patientSocket, doctorSocket } = await pairedRoom()
      const doctorOffers = collectEvents(doctorSocket, 'video:offer')

      const { socket: intruder } = await connectSocket(socketUrl, { token: patientBToken })
      const ack = await emitAck(intruder, 'video:offer', {
        appointmentId,
        sdp: { type: 'offer', sdp: 'injected' },
      })
      assert.equal(ack.ok, false)
      assert.equal(ack.code, 'FORBIDDEN')
      await delay(100)
      assert.equal(doctorOffers.length, 0)

      intruder.close()
      patientSocket.close()
      doctorSocket.close()
    })

    it('signaling never crosses into another appointment room', async () => {
      const { appointmentId, patientSocket } = await pairedRoom()

      const otherAppointment = await createAppointment({
        patient: patientB,
        doctor: doctorB,
        status: 'CONFIRMED',
        startTime: '11:00',
      })
      const { socket: otherDoctor } = await connectSocket(socketUrl, {
        token: doctorBToken,
      })
      await emitAck(otherDoctor, 'video:join', {
        appointmentId: otherAppointment._id.toString(),
      })
      const leaked = collectEvents(otherDoctor, 'video:offer')

      await emitAck(patientSocket, 'video:offer', {
        appointmentId,
        sdp: { type: 'offer', sdp: 'room-one-only' },
      })
      await delay(100)
      assert.equal(leaked.length, 0)

      otherDoctor.close()
      patientSocket.close()
    })

    it('signaling requires an SDP payload', async () => {
      const { appointmentId, patientSocket } = await pairedRoom()
      const ack = await emitAck(patientSocket, 'video:offer', { appointmentId })
      assert.equal(ack.ok, false)
      assert.equal(ack.code, 'VALIDATION_ERROR')
      patientSocket.close()
    })
  })

  describe('leaving and cleanup', () => {
    it('video:leave notifies the peer and removes the sender from the room', async () => {
      const appointment = await confirmedVideo()
      const appointmentId = appointment._id.toString()

      const { socket: patientSocket } = await connectSocket(socketUrl, {
        token: patientAToken,
      })
      await emitAck(patientSocket, 'video:join', { appointmentId })
      const { socket: doctorSocket } = await connectSocket(socketUrl, {
        token: doctorAToken,
      })
      await emitAck(doctorSocket, 'video:join', { appointmentId })
      await delay(50)

      const leaveEvent = waitForEvent(patientSocket, 'video:leave')
      const ack = await emitAck(doctorSocket, 'video:leave', { appointmentId })
      assert.equal(ack.ok, true)
      const leave = await leaveEvent
      assert.equal(leave.fromUserId, doctorA._id.toString())

      // After leaving, the doctor can no longer inject signaling.
      const afterLeave = await emitAck(doctorSocket, 'video:offer', {
        appointmentId,
        sdp: { type: 'offer', sdp: 'late' },
      })
      assert.equal(afterLeave.ok, false)
      assert.equal(afterLeave.code, 'FORBIDDEN')

      patientSocket.close()
      doctorSocket.close()
    })

    it('video:end notifies the peer that the call ended', async () => {
      const appointment = await confirmedVideo()
      const appointmentId = appointment._id.toString()

      const { socket: patientSocket } = await connectSocket(socketUrl, {
        token: patientAToken,
      })
      await emitAck(patientSocket, 'video:join', { appointmentId })
      const { socket: doctorSocket } = await connectSocket(socketUrl, {
        token: doctorAToken,
      })
      await emitAck(doctorSocket, 'video:join', { appointmentId })
      await delay(50)

      const endEvent = waitForEvent(patientSocket, 'video:end')
      await emitAck(doctorSocket, 'video:end', { appointmentId })
      const ended = await endEvent
      assert.equal(ended.fromUserId, doctorA._id.toString())

      patientSocket.close()
      doctorSocket.close()
    })

    it('an unexpected disconnect notifies the peer', async () => {
      const appointment = await confirmedVideo()
      const appointmentId = appointment._id.toString()

      const { socket: patientSocket } = await connectSocket(socketUrl, {
        token: patientAToken,
      })
      await emitAck(patientSocket, 'video:join', { appointmentId })
      const { socket: doctorSocket } = await connectSocket(socketUrl, {
        token: doctorAToken,
      })
      await emitAck(doctorSocket, 'video:join', { appointmentId })
      await delay(50)

      const leaveEvent = waitForEvent(patientSocket, 'video:leave')
      doctorSocket.close()
      const leave = await leaveEvent
      assert.equal(leave.fromUserId, doctorA._id.toString())

      patientSocket.close()
    })
  })
})
