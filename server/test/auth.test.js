const { describe, before, after, beforeEach, test } = require('node:test')
const assert = require('node:assert')
const http = require('http')
const express = require('express')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')

const {
  startServer,
  stopServer,
  clearUsers,
  request,
  createUser,
  registerPayload,
  User,
} = require('./helpers')

const { requireAuth, requireRole } = require('../src/middleware/auth.middleware')
const errorHandler = require('../src/middleware/errorHandler')

const roleApp = express()
roleApp.get(
  '/patient-only',
  requireAuth,
  requireRole('PATIENT'),
  (req, res) => {
    res.status(200).json({ success: true, data: { role: req.user.role } })
  },
)
roleApp.use(errorHandler)

let roleServer
let roleUrl

async function startRoleServer() {
  roleServer = http.createServer(roleApp)
  await new Promise((resolve) => roleServer.listen(0, resolve))
  roleUrl = `http://127.0.0.1:${roleServer.address().port}`
}

async function stopRoleServer() {
  await new Promise((resolve) => roleServer.close(resolve))
}

async function roleRequest(path, { token } = {}) {
  const headers = token ? { authorization: `Bearer ${token}` } : {}
  const response = await fetch(`${roleUrl}${path}`, { headers })
  const body = await response.json().catch(() => null)
  return { status: response.status, body }
}

async function loginAs(user) {
  const response = await request('/api/auth/login', {
    method: 'POST',
    body: { email: user.email, password: 'Password123' },
  })
  assert.strictEqual(response.status, 200)
  return response.body.data.token
}

before(async () => {
  await startServer()
  await startRoleServer()
})

beforeEach(async () => {
  await clearUsers()
})

after(async () => {
  await stopRoleServer()
  await stopServer()
})

describe('Registration', () => {
  test('registers a valid patient', async () => {
    const response = await request('/api/auth/register', {
      method: 'POST',
      body: registerPayload(),
    })

    assert.strictEqual(response.status, 201)
    assert.strictEqual(response.body.success, true)
    assert.strictEqual(response.body.data.user.role, 'PATIENT')
    assert.strictEqual(response.body.data.user.email, 'john@example.com')
    assert.strictEqual(response.body.data.user.passwordHash, undefined)
    assert.strictEqual(response.body.data.user.password, undefined)
  })

  test('registers a valid doctor', async () => {
    const response = await request('/api/auth/register', {
      method: 'POST',
      body: registerPayload({ role: 'DOCTOR' }),
    })

    assert.strictEqual(response.status, 201)
    assert.strictEqual(response.body.data.user.role, 'DOCTOR')
  })

  test('registers a valid pharmacy', async () => {
    const response = await request('/api/auth/register', {
      method: 'POST',
      body: registerPayload({ role: 'PHARMACY' }),
    })

    assert.strictEqual(response.status, 201)
    assert.strictEqual(response.body.data.user.role, 'PHARMACY')
  })

  test('defaults role to PATIENT when omitted', async () => {
    const response = await request('/api/auth/register', {
      method: 'POST',
      body: registerPayload({ role: undefined }),
    })

    assert.strictEqual(response.status, 201)
    assert.strictEqual(response.body.data.user.role, 'PATIENT')
  })

  test('rejects an invalid email', async () => {
    const response = await request('/api/auth/register', {
      method: 'POST',
      body: registerPayload({ email: 'not-an-email' }),
    })

    assert.strictEqual(response.status, 400)
    assert.strictEqual(response.body.code, 'VALIDATION_ERROR')
    assert.ok(
      response.body.details.some((error) => error.field === 'email'),
      'expected an email field error',
    )
  })

  test('rejects missing required fields', async () => {
    const response = await request('/api/auth/register', {
      method: 'POST',
      body: registerPayload({ name: '', password: undefined }),
    })

    assert.strictEqual(response.status, 400)
    const fields = response.body.details.map((error) => error.field)
    assert.ok(fields.includes('name'), 'expected a name field error')
    assert.ok(fields.includes('password'), 'expected a password field error')
  })

  test('rejects a weak password', async () => {
    const response = await request('/api/auth/register', {
      method: 'POST',
      body: registerPayload({ password: 'short' }),
    })

    assert.strictEqual(response.status, 400)
    assert.ok(
      response.body.details.some((error) => error.field === 'password'),
    )
  })

  test('rejects public ADMIN registration', async () => {
    const response = await request('/api/auth/register', {
      method: 'POST',
      body: registerPayload({ role: 'ADMIN' }),
    })

    assert.strictEqual(response.status, 400)
    assert.strictEqual(response.body.code, 'VALIDATION_ERROR')
  })

  test('rejects a duplicate email', async () => {
    await request('/api/auth/register', {
      method: 'POST',
      body: registerPayload(),
    })

    const response = await request('/api/auth/register', {
      method: 'POST',
      body: registerPayload(),
    })

    assert.strictEqual(response.status, 409)
    assert.strictEqual(response.body.code, 'EMAIL_TAKEN')
  })

  test('stores a hashed password, never plaintext', async () => {
    await request('/api/auth/register', {
      method: 'POST',
      body: registerPayload({ password: 'StrongPassword123' }),
    })

    const user = await User.findOne({ email: 'john@example.com' })
      .select('+passwordHash')
      .lean()

    assert.ok(user.passwordHash, 'passwordHash should exist')
    assert.notStrictEqual(user.passwordHash, 'StrongPassword123')
    assert.ok(user.passwordHash.startsWith('$2'), 'should be a bcrypt hash')
    assert.strictEqual(user.password, undefined, 'no plaintext password field')
  })
})

describe('Login', () => {
  test('logs in with valid credentials and returns a token', async () => {
    const user = await createUser({ email: 'login@example.com' })
    const response = await request('/api/auth/login', {
      method: 'POST',
      body: { email: user.email, password: 'Password123' },
    })

    assert.strictEqual(response.status, 200)
    assert.ok(response.body.data.token, 'should return a token')
    assert.strictEqual(response.body.data.user.id, user.id)
  })

  test('returns a safe response without passwordHash', async () => {
    const user = await createUser({ email: 'safe@example.com' })
    const response = await request('/api/auth/login', {
      method: 'POST',
      body: { email: user.email, password: 'Password123' },
    })

    assert.strictEqual(response.body.data.user.passwordHash, undefined)
    assert.strictEqual(response.body.data.user.password, undefined)
    assert.ok(response.body.data.user.isActive === true)
  })

  test('rejects a wrong password with a generic message', async () => {
    const user = await createUser({ email: 'wrongpw@example.com' })
    const response = await request('/api/auth/login', {
      method: 'POST',
      body: { email: user.email, password: 'WrongPassword123' },
    })

    assert.strictEqual(response.status, 401)
    assert.strictEqual(response.body.message, 'Invalid email or password')
  })

  test('rejects an unknown email with the same generic message', async () => {
    const response = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'nobody@example.com', password: 'Password123' },
    })

    assert.strictEqual(response.status, 401)
    assert.strictEqual(response.body.message, 'Invalid email or password')
  })

  test('rejects an inactive user', async () => {
    await createUser({ email: 'inactive@example.com', isActive: false })
    const response = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'inactive@example.com', password: 'Password123' },
    })

    assert.strictEqual(response.status, 401)
  })
})

describe('JWT validation', () => {
  let user

  beforeEach(async () => {
    user = await createUser({ email: 'jwt@example.com' })
  })

  test('accepts a valid token on /me', async () => {
    const token = await loginAs(user)
    const response = await request('/api/auth/me', { token })

    assert.strictEqual(response.status, 200)
    assert.strictEqual(response.body.data.user.email, user.email)
  })

  test('rejects a missing Authorization header', async () => {
    const response = await request('/api/auth/me')

    assert.strictEqual(response.status, 401)
    assert.strictEqual(response.body.code, 'UNAUTHORIZED')
  })

  test('rejects a malformed token', async () => {
    const response = await request('/api/auth/me', { token: 'not-a-jwt' })

    assert.strictEqual(response.status, 401)
    assert.strictEqual(response.body.code, 'INVALID_TOKEN')
  })

  test('rejects an invalid token', async () => {
    const response = await request('/api/auth/me', { token: 'abc.def.ghi' })

    assert.strictEqual(response.status, 401)
  })

  test('rejects an expired token', async () => {
    const expired = jwt.sign(
      { sub: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: -10 },
    )
    const response = await request('/api/auth/me', { token: expired })

    assert.strictEqual(response.status, 401)
  })
})

describe('Authorization', () => {
  test('allows an authenticated request', async () => {
    const user = await createUser({ email: 'auth@example.com' })
    const token = await loginAs(user)
    const response = await request('/api/auth/me', { token })

    assert.strictEqual(response.status, 200)
  })

  test('blocks an unauthenticated request', async () => {
    const response = await request('/api/auth/me')

    assert.strictEqual(response.status, 401)
  })

  test('allows a PATIENT on a patient-only route', async () => {
    const user = await createUser({ email: 'allow@example.com' })
    const token = await loginAs(user)
    const response = await roleRequest('/patient-only', { token })

    assert.strictEqual(response.status, 200)
  })

  test('forbids a DOCTOR on a patient-only route', async () => {
    const user = await createUser({
      email: 'forbid@example.com',
      role: 'DOCTOR',
    })
    const token = await loginAs(user)
    const response = await roleRequest('/patient-only', { token })

    assert.strictEqual(response.status, 403)
    assert.strictEqual(response.body.code, 'FORBIDDEN')
  })
})

describe('Current user (/me)', () => {
  test('returns the current user for a valid token', async () => {
    const user = await createUser({
      name: 'Me User',
      email: 'me@example.com',
      phone: '+91 9876543210',
    })
    const token = await loginAs(user)
    const response = await request('/api/auth/me', { token })

    assert.strictEqual(response.status, 200)
    assert.strictEqual(response.body.data.user.name, 'Me User')
    assert.strictEqual(response.body.data.user.email, 'me@example.com')
    assert.strictEqual(response.body.data.user.phone, '+91 9876543210')
    assert.strictEqual(response.body.data.user.passwordHash, undefined)
  })

  test('blocks a token for a deactivated account', async () => {
    const user = await createUser({ email: 'deactivated@example.com' })
    const token = await loginAs(user)

    await User.findByIdAndUpdate(user.id, { isActive: false })

    const response = await request('/api/auth/me', { token })
    assert.strictEqual(response.status, 401)
  })

  test('blocks a token for a deleted account', async () => {
    const user = await createUser({ email: 'deleted@example.com' })
    const token = await loginAs(user)

    await User.findByIdAndDelete(user.id)

    const response = await request('/api/auth/me', { token })
    assert.strictEqual(response.status, 401)
  })
})

describe('Password hashing primitive', () => {
  test('bcrypt hash verifies correctly', async () => {
    const hash = await bcrypt.hash('Password123', 4)
    const valid = await bcrypt.compare('Password123', hash)
    const invalid = await bcrypt.compare('WrongPassword', hash)
    assert.strictEqual(valid, true)
    assert.strictEqual(invalid, false)
  })
})