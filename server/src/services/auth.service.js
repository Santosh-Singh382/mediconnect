const bcrypt = require('bcryptjs')
const User = require('../models/User')
const ApiError = require('../utils/ApiError')
const { serializeUser } = require('../utils/serializeUser')
const { signAccessToken } = require('../utils/jwt')

const PUBLIC_REGISTRATION_ROLES = ['PATIENT', 'DOCTOR', 'PHARMACY']
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_PATTERN = /^\+?[0-9\s()-]{7,20}$/
const PASSWORD_MIN_LENGTH = 8
const PASSWORD_MAX_LENGTH = 72
const BCRYPT_ROUNDS = 10

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function validateRegistration(input) {
  const errors = []
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  const email = normalizeEmail(input.email)
  const phone = typeof input.phone === 'string' ? input.phone.trim() : ''
  const password = typeof input.password === 'string' ? input.password : ''
  const role = input.role || 'PATIENT'

  if (!name) {
    errors.push({ field: 'name', message: 'Name is required' })
  } else if (name.length > 100) {
    errors.push({ field: 'name', message: 'Name cannot exceed 100 characters' })
  }

  if (!email) {
    errors.push({ field: 'email', message: 'Email is required' })
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.push({ field: 'email', message: 'Email address is not valid' })
  }

  if (!password) {
    errors.push({ field: 'password', message: 'Password is required' })
  } else if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push({
      field: 'password',
      message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
    })
  } else if (password.length > PASSWORD_MAX_LENGTH) {
    errors.push({
      field: 'password',
      message: `Password cannot exceed ${PASSWORD_MAX_LENGTH} characters`,
    })
  }

  if (phone && !PHONE_PATTERN.test(phone)) {
    errors.push({ field: 'phone', message: 'Phone number is not valid' })
  }

  if (!PUBLIC_REGISTRATION_ROLES.includes(role)) {
    errors.push({
      field: 'role',
      message: 'Role must be one of PATIENT, DOCTOR, or PHARMACY',
    })
  }

  return { errors, data: { name, email, phone, password, role } }
}

async function registerUser(input) {
  const { errors, data } = validateRegistration(input || {})

  if (errors.length > 0) {
    throw new ApiError(400, 'Registration failed', 'VALIDATION_ERROR', errors)
  }

  const existing = await User.findOne({ email: data.email })
  if (existing) {
    throw new ApiError(
      409,
      'An account with this email already exists',
      'EMAIL_TAKEN',
    )
  }

  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS)

  const user = await User.create({
    name: data.name,
    email: data.email,
    phone: data.phone || null,
    passwordHash,
    role: data.role,
  })

  return serializeUser(user)
}

async function loginUser(input) {
  const email = normalizeEmail(input && input.email)
  const password = input && input.password

  if (!email || !password) {
    throw new ApiError(401, 'Invalid email or password', 'INVALID_CREDENTIALS')
  }

  const user = await User.findOne({ email }).select('+passwordHash')

  if (!user || !user.isActive) {
    throw new ApiError(401, 'Invalid email or password', 'INVALID_CREDENTIALS')
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash)
  if (!passwordMatches) {
    throw new ApiError(401, 'Invalid email or password', 'INVALID_CREDENTIALS')
  }

  const token = signAccessToken(user)

  return {
    token,
    user: serializeUser(user),
  }
}

module.exports = {
  registerUser,
  loginUser,
}