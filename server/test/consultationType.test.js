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

const CONSULT_DATE = dateString(addDays(new Date(), 21))

async function createPatient(prefix) {
  return User.create({
    name: `${prefix} Patient`,
    email: `${prefix}-consult-patient@example.com`,
    passwordHash: 'x',
    role: 'PATIENT',
  })
}

async function createDoctor(prefix) {
  const user = await User.create({
    name: `Dr. ${prefix}`,
    email: `${prefix}-consult-doctor@example.com`,
    passwordHash: 'x',
    role: 'DOCTOR',
  })
  await DoctorProfile.create({
    userId: user._id,
    specialization: 'General Physician',
    qualification: 'MBBS',
    registrationNumber: `MC-CONSULT-${prefix}`,
    verificationStatus: 'APPROVED',
  })
  return user
}

async function createAppointment({
  patient,
  doctor,
  status = 'CONFIRMED',
  type = 'VIDEO',
  startTime = '10:00',
}) {
  return Appointment.create({
    patientId: patient._id,
    doctorId: doctor._id,
    appointmentDate: CONSULT_DATE,
    startTime,
    endTime: '10:30',
    type,
    status,
    reason: 'Consultation type enforcement',
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

describe('Consultation type enforcement', () => {
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

  function request(path, { method = 'GET', body, token } = {}) {
    const headers = {}
    if (body !== undefined) headers['content-type'] = 'application/json'
    if (token) headers.authorization = `Bearer ${token}`
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
    await clearAll()
    patientA = await createPatient('alpha')
    patientAToken = tokenForUser(patientA)
    patientB = await createPatient('bravo')
    patientBToken = tokenForUser(patientB)
    doctorA = await createDoctor('alpha')
    doctorAToken = tokenForUser(doctorA)
  })

  // The consultation method chosen at booking is the single source of truth.
  // Each channel must accept its own appointment type and reject every other.
  describe('socket channel accept / reject matrix', () => {
    const matrix = [
      {
        appointmentType: 'VIDEO',
        allowed: 'video:join',
        rejected: ['audio:join', 'chat:join'],
      },
      {
        appointmentType: 'AUDIO',
        allowed: 'audio:join',
        rejected: ['video:join', 'chat:join'],
      },
      {
        appointmentType: 'CHAT',
        allowed: 'chat:join',
        rejected: ['video:join', 'audio:join'],
      },
    ]

    for (const entry of matrix) {
      it(`${entry.appointmentType} appointment allows only ${entry.allowed}`, async () => {
        const appointment = await createAppointment({
          patient: patientA,
          doctor: doctorA,
          type: entry.appointmentType,
        })
        const { socket } = await connectSocket(socketUrl, { token: patientAToken })

        const allowedAck = await emitAck(socket, entry.allowed, {
          appointmentId: appointment._id.toString(),
        })
        assert.equal(allowedAck.ok, true, `${entry.allowed} should be accepted`)

        for (const rejectedEvent of entry.rejected) {
          const ack = await emitAck(socket, rejectedEvent, {
            appointmentId: appointment._id.toString(),
          })
          assert.equal(ack.ok, false, `${rejectedEvent} should be rejected`)
          assert.equal(ack.code, 'CONSULTATION_TYPE_MISMATCH')
        }

        socket.close()
      })
    }
  })

  describe('audio channel mirrors the video protocol', () => {
    async function confirmedAudio(startTime = '10:00') {
      return createAppointment({
        patient: patientA,
        doctor: doctorA,
        type: 'AUDIO',
        startTime,
      })
    }

    it('first participant waits and the second triggers negotiation init', async () => {
      const appointment = await confirmedAudio()
      const appointmentId = appointment._id.toString()

      const { socket: first } = await connectSocket(socketUrl, { token: patientAToken })
      const firstJoin = await emitAck(first, 'audio:join', { appointmentId })
      assert.equal(firstJoin.role, 'waiting')
      assert.equal(firstJoin.peerPresent, false)

      const readyEvent = waitForEvent(first, 'audio:ready')

      const { socket: second } = await connectSocket(socketUrl, { token: doctorAToken })
      const secondJoin = await emitAck(second, 'audio:join', { appointmentId })
      assert.equal(secondJoin.role, 'answerer')
      assert.equal(secondJoin.peerPresent, true)

      const ready = await readyEvent
      assert.equal(ready.initiator, true)
      assert.equal(ready.appointmentId, appointmentId)

      first.close()
      second.close()
    })

    it('offer, answer and ICE are relayed only to the authorized peer', async () => {
      const appointment = await confirmedAudio()
      const appointmentId = appointment._id.toString()

      const { socket: patientSocket } = await connectSocket(socketUrl, { token: patientAToken })
      await emitAck(patientSocket, 'audio:join', { appointmentId })
      const { socket: doctorSocket } = await connectSocket(socketUrl, { token: doctorAToken })
      await emitAck(doctorSocket, 'audio:join', { appointmentId })
      await delay(50)

      const doctorOffers = collectEvents(doctorSocket, 'audio:offer')
      const patientAnswers = collectEvents(patientSocket, 'audio:answer')
      const patientCandidates = collectEvents(patientSocket, 'audio:ice-candidate')

      await emitAck(patientSocket, 'audio:offer', {
        appointmentId,
        sdp: { type: 'offer', sdp: 'audio-offer-sdp' },
      })
      await emitAck(doctorSocket, 'audio:answer', {
        appointmentId,
        sdp: { type: 'answer', sdp: 'audio-answer-sdp' },
      })
      await emitAck(doctorSocket, 'audio:ice-candidate', {
        appointmentId,
        candidate: { candidate: 'candidate:1 1 udp 1 2.2.2.2 2 typ host' },
      })
      await delay(100)

      assert.equal(doctorOffers.length, 1)
      assert.equal(doctorOffers[0].sdp.sdp, 'audio-offer-sdp')
      assert.equal(patientAnswers.length, 1)
      assert.equal(patientCandidates.length, 1)

      patientSocket.close()
      doctorSocket.close()
    })

    it('a third participant is rejected with ROOM_FULL', async () => {
      const appointment = await confirmedAudio()
      const appointmentId = appointment._id.toString()

      const { socket: p1 } = await connectSocket(socketUrl, { token: patientAToken })
      await emitAck(p1, 'audio:join', { appointmentId })
      const { socket: d1 } = await connectSocket(socketUrl, { token: doctorAToken })
      await emitAck(d1, 'audio:join', { appointmentId })

      const { socket: p2 } = await connectSocket(socketUrl, { token: patientAToken })
      const third = await emitAck(p2, 'audio:join', { appointmentId })
      assert.equal(third.ok, false)
      assert.equal(third.code, 'ROOM_FULL')

      p1.close()
      d1.close()
      p2.close()
    })

    it('audio:leave notifies the peer and removes the sender from the room', async () => {
      const appointment = await confirmedAudio()
      const appointmentId = appointment._id.toString()

      const { socket: patientSocket } = await connectSocket(socketUrl, { token: patientAToken })
      await emitAck(patientSocket, 'audio:join', { appointmentId })
      const { socket: doctorSocket } = await connectSocket(socketUrl, { token: doctorAToken })
      await emitAck(doctorSocket, 'audio:join', { appointmentId })
      await delay(50)

      const leaveEvent = waitForEvent(patientSocket, 'audio:leave')
      await emitAck(doctorSocket, 'audio:leave', { appointmentId })
      const leave = await leaveEvent
      assert.equal(leave.fromUserId, doctorA._id.toString())

      const afterLeave = await emitAck(doctorSocket, 'audio:offer', {
        appointmentId,
        sdp: { type: 'offer', sdp: 'late' },
      })
      assert.equal(afterLeave.ok, false)
      assert.equal(afterLeave.code, 'FORBIDDEN')

      patientSocket.close()
      doctorSocket.close()
    })

    it('audio:end notifies the peer that the call ended', async () => {
      const appointment = await confirmedAudio()
      const appointmentId = appointment._id.toString()

      const { socket: patientSocket } = await connectSocket(socketUrl, { token: patientAToken })
      await emitAck(patientSocket, 'audio:join', { appointmentId })
      const { socket: doctorSocket } = await connectSocket(socketUrl, { token: doctorAToken })
      await emitAck(doctorSocket, 'audio:join', { appointmentId })
      await delay(50)

      const endEvent = waitForEvent(patientSocket, 'audio:end')
      await emitAck(doctorSocket, 'audio:end', { appointmentId })
      const ended = await endEvent
      assert.equal(ended.fromUserId, doctorA._id.toString())

      patientSocket.close()
      doctorSocket.close()
    })

    it('an unexpected disconnect notifies the peer', async () => {
      const appointment = await confirmedAudio()
      const appointmentId = appointment._id.toString()

      const { socket: patientSocket } = await connectSocket(socketUrl, { token: patientAToken })
      await emitAck(patientSocket, 'audio:join', { appointmentId })
      const { socket: doctorSocket } = await connectSocket(socketUrl, { token: doctorAToken })
      await emitAck(doctorSocket, 'audio:join', { appointmentId })
      await delay(50)

      const leaveEvent = waitForEvent(patientSocket, 'audio:leave')
      doctorSocket.close()
      const leave = await leaveEvent
      assert.equal(leave.fromUserId, doctorA._id.toString())

      patientSocket.close()
    })

    it('signaling never crosses between the audio and video rooms', async () => {
      const audioAppointment = await confirmedAudio('10:00')
      const videoAppointment = await createAppointment({
        patient: patientA,
        doctor: doctorA,
        type: 'VIDEO',
        startTime: '11:00',
      })

      const { socket: audioPatient } = await connectSocket(socketUrl, { token: patientAToken })
      await emitAck(audioPatient, 'audio:join', { appointmentId: audioAppointment._id.toString() })

      const { socket: videoDoctor } = await connectSocket(socketUrl, { token: doctorAToken })
      await emitAck(videoDoctor, 'video:join', { appointmentId: videoAppointment._id.toString() })
      const leaked = collectEvents(videoDoctor, 'video:offer')

      await emitAck(audioPatient, 'audio:offer', {
        appointmentId: audioAppointment._id.toString(),
        sdp: { type: 'offer', sdp: 'cross-room' },
      })
      await delay(100)
      assert.equal(leaked.length, 0)

      audioPatient.close()
      videoDoctor.close()
    })

    it('a non-member cannot inject audio signaling into a room', async () => {
      const appointment = await confirmedAudio()
      const appointmentId = appointment._id.toString()

      const { socket: patientSocket } = await connectSocket(socketUrl, { token: patientAToken })
      await emitAck(patientSocket, 'audio:join', { appointmentId })
      const { socket: doctorSocket } = await connectSocket(socketUrl, { token: doctorAToken })
      await emitAck(doctorSocket, 'audio:join', { appointmentId })
      await delay(50)

      const doctorOffers = collectEvents(doctorSocket, 'audio:offer')
      const { socket: intruder } = await connectSocket(socketUrl, { token: patientBToken })
      const ack = await emitAck(intruder, 'audio:offer', {
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
  })

  describe('audio authorization', () => {
    it('unrelated participant cannot start an audio call', async () => {
      const appointment = await createAppointment({
        patient: patientA,
        doctor: doctorA,
        type: 'AUDIO',
      })
      const { socket } = await connectSocket(socketUrl, { token: patientBToken })
      const ack = await emitAck(socket, 'audio:join', {
        appointmentId: appointment._id.toString(),
      })
      assert.equal(ack.ok, false)
      assert.equal(ack.code, 'FORBIDDEN')
      socket.close()
    })

    it('invalid appointment id is rejected cleanly', async () => {
      const { socket } = await connectSocket(socketUrl, { token: patientAToken })
      const ack = await emitAck(socket, 'audio:join', { appointmentId: 'not-an-id' })
      assert.equal(ack.ok, false)
      assert.equal(ack.code, 'VALIDATION_ERROR')
      socket.close()
    })

    it('missing appointment is reported as not found', async () => {
      const { socket } = await connectSocket(socketUrl, { token: patientAToken })
      const ack = await emitAck(socket, 'audio:join', {
        appointmentId: new mongoose.Types.ObjectId().toString(),
      })
      assert.equal(ack.ok, false)
      assert.equal(ack.code, 'NOT_FOUND')
      socket.close()
    })
  })

  describe('audio appointment state rules', () => {
    for (const status of ['PENDING', 'CANCELLED', 'REJECTED', 'COMPLETED']) {
      it(`${status} appointment cannot start an audio consultation`, async () => {
        const appointment = await createAppointment({
          patient: patientA,
          doctor: doctorA,
          type: 'AUDIO',
          status,
          startTime: status === 'PENDING' ? '10:00' : '11:00',
        })
        const { socket } = await connectSocket(socketUrl, { token: patientAToken })
        const ack = await emitAck(socket, 'audio:join', {
          appointmentId: appointment._id.toString(),
        })
        assert.equal(ack.ok, false)
        assert.equal(ack.code, 'AUDIO_NOT_AVAILABLE')
        socket.close()
      })
    }
  })

  describe('video appointment state rules are unchanged', () => {
    for (const status of ['PENDING', 'CANCELLED', 'REJECTED', 'COMPLETED']) {
      it(`${status} VIDEO appointment still cannot start a video consultation`, async () => {
        const appointment = await createAppointment({
          patient: patientA,
          doctor: doctorA,
          type: 'VIDEO',
          status,
          startTime: status === 'PENDING' ? '10:00' : '12:00',
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

  describe('REST chat consultation type enforcement', () => {
    it('CHAT appointment can read chat history', async () => {
      const appointment = await createAppointment({
        patient: patientA,
        doctor: doctorA,
        type: 'CHAT',
      })
      const response = await request(`/api/chat/${appointment._id}/messages`, {
        token: patientAToken,
      })
      assert.equal(response.status, 200)
      assert.equal(response.body.success, true)
    })

    it('VIDEO appointment is rejected for chat consultation', async () => {
      const appointment = await createAppointment({
        patient: patientA,
        doctor: doctorA,
        type: 'VIDEO',
        startTime: '10:00',
      })
      const read = await request(`/api/chat/${appointment._id}/messages`, {
        token: patientAToken,
      })
      assert.equal(read.status, 403)
      assert.equal(read.body.code, 'CONSULTATION_TYPE_MISMATCH')

      const send = await request(`/api/chat/${appointment._id}/messages`, {
        method: 'POST',
        body: { message: 'Not a chat consultation' },
        token: patientAToken,
      })
      assert.equal(send.status, 403)
      assert.equal(send.body.code, 'CONSULTATION_TYPE_MISMATCH')
    })

    it('AUDIO appointment is rejected for chat consultation', async () => {
      const appointment = await createAppointment({
        patient: patientA,
        doctor: doctorA,
        type: 'AUDIO',
        startTime: '10:00',
      })
      const read = await request(`/api/chat/${appointment._id}/messages`, {
        token: patientAToken,
      })
      assert.equal(read.status, 403)
      assert.equal(read.body.code, 'CONSULTATION_TYPE_MISMATCH')
    })

    it('non-participant still gets 403 for chat', async () => {
      const appointment = await createAppointment({
        patient: patientA,
        doctor: doctorA,
        type: 'CHAT',
        startTime: '10:00',
      })
      const response = await request(`/api/chat/${appointment._id}/messages`, {
        token: patientBToken,
      })
      assert.equal(response.status, 403)
      assert.equal(response.body.code, 'FORBIDDEN')
    })
  })
})
