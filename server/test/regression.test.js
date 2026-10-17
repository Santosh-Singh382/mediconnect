const { describe, before, after, test } = require('node:test')
const assert = require('node:assert')

const { startServer, stopServer, request, baseUrl } = require('./helpers')

before(async () => {
  await startServer()
})

after(async () => {
  await stopServer()
})

describe('Regression', () => {
  test('GET /api/health still works', async () => {
    const response = await request('/api/health')

    assert.strictEqual(response.status, 200)
    assert.strictEqual(response.body.success, true)
    assert.strictEqual(response.body.data.status, 'ok')
    assert.ok(
      ['connected', 'disconnected', 'connecting', 'disconnecting'].includes(
        response.body.data.database,
      ),
    )
  })

  test('unknown API route still returns the 404 error contract', async () => {
    const response = await request('/api/does-not-exist')

    assert.strictEqual(response.status, 404)
    assert.strictEqual(response.body.success, false)
    assert.strictEqual(response.body.code, 'ROUTE_NOT_FOUND')
  })

  test('CORS reflects the allowed client origin', async () => {
    const response = await fetch(`${baseUrl()}/api/health`, {
      headers: { Origin: 'http://localhost:5173' },
    })

    assert.strictEqual(
      response.headers.get('access-control-allow-origin'),
      'http://localhost:5173',
    )
  })

  test('rate limiting headers are present on API responses', async () => {
    const response = await request('/api/health')

    assert.strictEqual(response.status, 200)
    const rateLimitHeader =
      response.headers.get('ratelimit-limit') ||
      response.headers.get('ratelimit-policy')
    assert.ok(Boolean(rateLimitHeader), 'expected a rate-limit header')
  })

  test('malformed JSON returns a clean client error', async () => {
    const response = await fetch(`${baseUrl()}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"name": not valid json',
    })
    const body = await response.json()

    assert.strictEqual(response.status, 400)
    assert.strictEqual(body.success, false)
    assert.strictEqual(body.code, 'INVALID_REQUEST_BODY')
  })
})