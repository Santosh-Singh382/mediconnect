process.env.NODE_ENV = 'test'
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/mediconnect_test'
process.env.JWT_SECRET = 'test-only-secret-not-for-production'
process.env.PORT = '0'

const http = require('http')
const bcrypt = require('bcryptjs')

const app = require('../src/app')
const {
  connectDatabase,
  disconnectDatabase,
} = require('../src/config/database')
const User = require('../src/models/User')
const PatientProfile = require('../src/models/PatientProfile')
const DoctorProfile = require('../src/models/DoctorProfile')
const Appointment = require('../src/models/Appointment')
const Prescription = require('../src/models/Prescription')
const MedicalRecord = require('../src/models/MedicalRecord')
const MedicalDocument = require('../src/models/MedicalDocument')
const Pharmacy = require('../src/models/Pharmacy')
const Medicine = require('../src/models/Medicine')
const Cart = require('../src/models/Cart')
const Order = require('../src/models/Order')
const Notification = require('../src/models/Notification')
const { initSocket } = require('../src/realtime/socket')
const { signAccessToken } = require('../src/utils/jwt')

let server
let io
let baseUrl

async function startServer({ realtime = false } = {}) {
  await connectDatabase()
  server = http.createServer(app)
  if (realtime) {
    io = initSocket(server)
  }
  await new Promise((resolve) => server.listen(0, resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
}

async function stopServer() {
  if (io) {
    await new Promise((resolve) => io.close(resolve))
    io = null
  }
  if (server && server.listening) {
    await new Promise((resolve) => server.close(resolve))
  }
  await disconnectDatabase()
}

async function clearUsers() {
  await User.deleteMany({})
}

async function clearPatientProfiles() {
  await PatientProfile.deleteMany({})
}

async function clearDoctorProfiles() {
  await DoctorProfile.deleteMany({})
}

async function clearAppointments() {
  await Appointment.deleteMany({})
}

async function clearPrescriptions() {
  await Prescription.deleteMany({})
}

async function clearMedicalRecords() {
  await MedicalRecord.deleteMany({})
}

async function clearMedicalDocuments() {
  await MedicalDocument.deleteMany({})
}

async function clearPharmacies() {
  await Pharmacy.deleteMany({})
}

async function clearMedicines() {
  await Medicine.deleteMany({})
}

async function clearCarts() {
  await Cart.deleteMany({})
}

async function clearOrders() {
  await Order.deleteMany({})
}

async function clearNotifications() {
  await Notification.deleteMany({})
}

async function request(
  path,
  { method = 'GET', body, token, headers: extraHeaders } = {},
) {
  const headers = { ...(extraHeaders || {}) }
  if (body !== undefined) {
    headers['content-type'] = 'application/json'
  }
  if (token) {
    headers.authorization = `Bearer ${token}`
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  let json = null
  try {
    json = await response.json()
  } catch {
    json = null
  }

  return { status: response.status, body: json, headers: response.headers }
}

// Multipart upload helper. Builds a FormData body with an optional file and
// extra text fields, so tests exercise the real multipart path.
async function uploadRequest(
  path,
  { method = 'POST', token, fields = {}, file } = {},
) {
  const form = new FormData()

  if (file) {
    form.append('file', new Blob([file.buffer], { type: file.contentType }), file.filename)
  }
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null) {
      form.append(key, String(value))
    }
  }

  const headers = {}
  if (token) {
    headers.authorization = `Bearer ${token}`
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: form,
  })

  let json = null
  try {
    json = await response.json()
  } catch {
    json = null
  }

  return { status: response.status, body: json, headers: response.headers }
}

async function createUser({
  name = 'Test Patient',
  email = 'patient@example.com',
  phone = null,
  password = 'Password123',
  role = 'PATIENT',
  isActive = true,
} = {}) {
  const passwordHash = await bcrypt.hash(password, 4)
  return User.create({ name, email, phone, passwordHash, role, isActive })
}

async function createDoctor({
  email = 'doctor@example.com',
  name = 'Test Doctor',
  password = 'Password123',
  verificationStatus = 'PENDING',
  profile = {},
} = {}) {
  const user = await createUser({ name, email, role: 'DOCTOR', password })
  const fullProfile = {
    specialization: 'General Physician',
    qualification: 'MBBS',
    experience: 5,
    registrationNumber: 'MC-00001',
    consultationFee: 500,
    bio: 'A short bio.',
    clinicName: 'Sunny Clinic',
    clinicAddress: {
      street: 'Main Road',
      city: 'Berhampur',
      state: 'Odisha',
      postalCode: '760001',
      country: 'India',
    },
    languages: ['English'],
    availability: [
      { dayOfWeek: 'MONDAY', enabled: true, startTime: '10:00', endTime: '13:00' },
    ],
  }
  const doctorProfile = await DoctorProfile.create({
    userId: user._id,
    ...fullProfile,
    ...profile,
    verificationStatus,
  })
  return { user, profile: doctorProfile }
}

function registerPayload(overrides = {}) {
  return {
    name: 'John Doe',
    email: 'john@example.com',
    phone: '9876543210',
    password: 'StrongPassword123',
    role: 'PATIENT',
    ...overrides,
  }
}

async function loginAndGetToken(email, password = 'Password123') {
  const response = await request('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  })
  if (response.status !== 200 || !response.body.data?.token) {
    throw new Error(`Unexpected login response: ${response.status}`)
  }
  return response.body.data.token
}

function tokenForUser(user) {
  return signAccessToken({ id: user._id, role: user.role })
}

module.exports = {
  startServer,
  stopServer,
  clearUsers,
  clearPatientProfiles,
  clearDoctorProfiles,
  clearAppointments,
  clearPrescriptions,
  clearMedicalRecords,
  clearMedicalDocuments,
  clearPharmacies,
  clearMedicines,
  clearCarts,
  clearOrders,
  clearNotifications,
  request,
  uploadRequest,
  createUser,
  createDoctor,
  registerPayload,
  loginAndGetToken,
  tokenForUser,
  User,
  PatientProfile,
  DoctorProfile,
  Appointment,
  Prescription,
  MedicalRecord,
  MedicalDocument,
  Pharmacy,
  Medicine,
  Cart,
  Order,
  Notification,
  baseUrl: () => baseUrl,
}