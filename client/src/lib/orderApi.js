import api from './api.js'

export function checkoutOrder(payload, idempotencyKey) {
  return api.post('/orders/checkout', payload, {
    headers: { 'Idempotency-Key': idempotencyKey },
  })
}

export function getOrders(params = {}) {
  return api.get('/orders', { params })
}

export function getOrder(orderId) {
  return api.get(`/orders/${orderId}`)
}

export function getPharmacyOrders(params = {}) {
  return api.get('/pharmacy/orders', { params })
}

export function getPharmacyOrder(orderId) {
  return api.get(`/pharmacy/orders/${orderId}`)
}

export function updatePharmacyOrderStatus(orderId, status) {
  return api.patch(`/pharmacy/orders/${orderId}/status`, { status })
}

export function getPharmacyOrderSummary() {
  return api.get('/pharmacy/orders/summary')
}

export function createIdempotencyKey() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID()
  }
  return `checkout-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
}
